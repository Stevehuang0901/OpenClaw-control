import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  roleMeta,
  type AgentRecord,
  type TaskRecord,
  type TokenUsage,
  type WorkflowRecord
} from "../../../../packages/shared/src/index";
import type { TaskExecutionResult, TaskExecutor } from "./gateway";
import { parseOpenClawJson } from "./openclawMonitor";

const execFileAsync = promisify(execFile);

export const createOpenClawTaskExecutor = (): TaskExecutor => ({
  runTask: async ({ workflow, task, agent }) => {
    const { stdout, stderr } = await execFileAsync(
      "openclaw",
      [
        "agent",
        "--local",
        "--agent",
        "main",
        "--thinking",
        "low",
        "--json",
        "--message",
        buildTaskPrompt(workflow, task, agent)
      ],
      {
        maxBuffer: 12 * 1024 * 1024
      }
    );

    const raw = parseOpenClawJson(`${stdout}\n${stderr}`);
    const payloads = Array.isArray(raw.payloads)
      ? raw.payloads
          .map((payload) =>
            typeof (payload as Record<string, unknown>).text === "string"
              ? ((payload as Record<string, unknown>).text as string)
              : ""
          )
          .filter(Boolean)
      : [];
    const meta = asRecord(raw.meta);
    const agentMeta = asRecord(meta.agentMeta);

    return {
      output:
        payloads.join("\n\n").trim() ||
        `OpenClaw returned no text for ${task.title}.`,
      usage: normalizeReportedUsage(asRecord(agentMeta.lastCallUsage)),
      note:
        typeof agentMeta.model === "string"
          ? `Generated live by OpenClaw using ${agentMeta.model}.`
          : "Generated live by OpenClaw."
    } satisfies TaskExecutionResult;
  }
});

const buildTaskPrompt = (
  workflow: WorkflowRecord,
  task: TaskRecord,
  agent: AgentRecord
) => {
  const previousPackets = workflow.tasks
    .filter((entry) => entry.order < task.order && entry.output)
    .map(
      (entry) =>
        `Packet from ${roleMeta[entry.role].label}:\n${entry.output ?? "No output"}`
    );

  const roleInstruction = (() => {
    switch (task.role) {
      case "collector":
        return "Produce a strong context packet with goals, constraints, assumptions, deliverables, and success criteria.";
      case "analyzer":
        return "Turn the context into a concrete execution plan with dependencies, risks, and recommended order of operations.";
      case "writer":
        return "Create the actual artifact or answer the user needs. Be concrete and directly useful, not meta commentary about the workflow.";
      case "validator":
        return "Produce the final user-facing delivery. Include the answer itself, a short validation summary, and any caveats or next steps that matter.";
      default:
        return "Produce a concise, useful handoff packet.";
    }
  })();

  return [
    `You are ${agent.name}, the ${roleMeta[task.role].label} in a collaborative OpenClaw office workflow.`,
    "You are one step in a multi-agent handoff chain. Write the packet this step should produce.",
    `Original user request:\n${workflow.prompt}`,
    `Workflow summary:\n${workflow.summary}`,
    `Current task:\nTitle: ${task.title}\nDescription: ${task.description}`,
    previousPackets.length > 0
      ? `Upstream packets:\n${previousPackets.join("\n\n---\n\n")}`
      : "Upstream packets:\nNone yet.",
    roleInstruction,
    "Use markdown when it helps. Keep the response substantive, crisp, and ready for the next desk or final delivery screen."
  ].join("\n\n");
};

const normalizeReportedUsage = (usage: Record<string, unknown>): TokenUsage => ({
  source: "reported",
  inputTokens: numberOrZero(usage.input),
  outputTokens: numberOrZero(usage.output),
  cacheRead: numberOrZero(usage.cacheRead),
  cacheWrite: numberOrZero(usage.cacheWrite),
  totalTokens: numberOrZero(usage.total)
});

const numberOrZero = (value: unknown) => (typeof value === "number" ? value : 0);

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
