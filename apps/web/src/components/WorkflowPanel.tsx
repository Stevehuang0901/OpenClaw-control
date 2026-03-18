import { formatClock, formatNumber, truncate } from "../lib/format";
import {
  buildWorkflowOutputPreview,
  getWorkflowProgress,
  getWorkflowSignalLine
} from "../lib/workflows";
import { roleMeta } from "../types/contracts";
import type { AgentRecord, WorkflowRecord } from "../types/contracts";

interface WorkflowPanelProps {
  workflows: WorkflowRecord[];
  agents: AgentRecord[];
  selectedWorkflowId: string | null;
  onSelectWorkflow: (workflowId: string) => void;
}

export function WorkflowPanel({
  workflows,
  agents,
  selectedWorkflowId,
  onSelectWorkflow
}: WorkflowPanelProps) {
  const workflow =
    workflows.find((entry) => entry.id === selectedWorkflowId) ??
    workflows.find((entry) => entry.status === "running") ??
    workflows[0] ??
    null;
  const progress = workflow ? getWorkflowProgress(workflow) : null;

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="pixel-label">Workflow Inspector</p>
          <h2 className="mt-2 text-2xl font-bold text-ink">Focused request detail</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/66">
            Select one workflow and read it cleanly instead of scanning a wall of repeated cards.
          </p>
        </div>
        <span className="rounded-none border-2 border-ink/12 bg-[#15101d] px-3 py-2 text-xs uppercase tracking-[0.2em] text-ink shadow-pixel">
          {workflows.length} requests
        </span>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {workflows.slice(0, 8).map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`rounded-none border-2 px-3 py-2 text-left text-xs shadow-pixel transition hover:-translate-y-0.5 ${
              entry.id === workflow?.id
                ? "border-teal/55 bg-[#21192c] text-ink"
                : "border-ink/12 bg-[#14101c] text-ink/72 hover:border-ink/36"
            }`}
            onClick={() => onSelectWorkflow(entry.id)}
          >
            <div className="font-bold uppercase tracking-[0.18em]">{entry.status}</div>
            <div className="mt-1 max-w-[210px] text-[11px] leading-relaxed">
              {truncate(entry.summary, 52)}
            </div>
          </button>
        ))}
      </div>

      {workflow ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-none border-2 border-ink/12 bg-[#14101c] p-4 shadow-pixel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-3xl">
                <p className="text-xs uppercase tracking-[0.24em] text-ink/46">
                  {workflow.id}
                </p>
                <h3 className="mt-2 text-xl font-bold text-ink">
                  {workflow.summary}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-ink/68">
                  {workflow.prompt}
                </p>
              </div>
              <div className="grid gap-2 text-right text-xs uppercase tracking-[0.18em] text-ink/48">
                <span>{workflow.status}</span>
                <span>Updated {formatClock(workflow.updatedAt)}</span>
                <span>
                  {workflow.usage
                    ? `${formatNumber(workflow.usage.totalTokens)} tok`
                    : "No usage"}
                </span>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-ink/50">
                <span>{getWorkflowSignalLine(workflow)}</span>
                <span>{progress?.percent ?? 0}%</span>
              </div>
              <div className="mt-2 h-4 border-2 border-ink/12 bg-[#0f0c15]">
                <div
                  className="h-full bg-brass transition-[width] duration-500"
                  style={{ width: `${progress?.percent ?? 0}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            {workflow.tasks.map((task) => {
              const tone =
                task.status === "in_progress"
                  ? "border-teal/45 bg-teal/10"
                  : ["done", "handed_off", "completed"].includes(task.status)
                    ? "border-mint/35 bg-mint/10"
                    : "border-ink/12 bg-[#14101c]";
              const agentName =
                task.ownerAgentId
                  ? agents.find((agent) => agent.id === task.ownerAgentId)?.name ?? "Desk"
                  : "Queue";
              const latestHistory = task.history[task.history.length - 1];

              return (
                <div key={task.id} className={`rounded-none border-2 p-4 shadow-pixel ${tone}`}>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-ink/44">
                    Step {task.order}
                  </p>
                  <p className="mt-2 text-base font-bold text-ink">{task.title}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-ink/52">
                    {roleMeta[task.role].label} · {agentName}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-ink/68">
                    {truncate(latestHistory?.note ?? task.description, 160)}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
            <div className="rounded-none border-2 border-ink/12 bg-[#14101c] p-4 shadow-pixel">
              <p className="pixel-label">Execution log</p>
              <div className="mt-3 space-y-3">
                {workflow.tasks.map((task) => {
                  const latestHistory = task.history[task.history.length - 1];

                  return (
                    <div
                      key={`${task.id}-history`}
                      className="rounded-none border-2 border-ink/12 bg-[#0f0c15] p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-ink">{task.title}</p>
                          <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-ink/46">
                            {roleMeta[task.role].label}
                          </p>
                        </div>
                        <span className="text-[10px] uppercase tracking-[0.18em] text-ink/42">
                          {latestHistory ? formatClock(latestHistory.timestamp) : "--"}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-ink/68">
                        {latestHistory?.note ?? task.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-none border-2 border-teal/40 bg-teal/10 p-4 shadow-pixel">
              <p className="pixel-label text-teal">
                {workflow.finalOutput ? "Final output" : "Current output"}
              </p>
              <pre className="mt-3 max-h-[560px] overflow-auto whitespace-pre-wrap text-sm leading-relaxed text-ink/86">
                {buildWorkflowOutputPreview(workflow)}
              </pre>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-none border-2 border-dashed border-ink/12 p-8 text-sm text-ink/56">
          No workflow selected yet.
        </div>
      )}
    </section>
  );
}
