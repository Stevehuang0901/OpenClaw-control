import { formatClock, formatNumber, truncate } from "../lib/format";
import { getWorkflowProgress, getWorkflowSignalLine } from "../lib/workflows";
import { roleMeta } from "../types/contracts";
import type {
  AgentRecord,
  ApprovalRecord,
  MessageRecord,
  OpenClawStatusSnapshot,
  WorkflowRecord
} from "../types/contracts";

interface OfficeCommandDeckProps {
  agents: AgentRecord[];
  approvals: ApprovalRecord[];
  messages: MessageRecord[];
  openclaw: OpenClawStatusSnapshot;
  selectedWorkflowId: string | null;
  workflows: WorkflowRecord[];
  onSelectWorkflow: (workflowId: string) => void;
}

export function OfficeCommandDeck({
  agents,
  approvals,
  messages,
  openclaw,
  selectedWorkflowId,
  workflows,
  onSelectWorkflow
}: OfficeCommandDeckProps) {
  const selectedWorkflow =
    workflows.find((workflow) => workflow.id === selectedWorkflowId) ??
    workflows.find((workflow) => workflow.status === "running") ??
    workflows[0] ??
    null;
  const progress = selectedWorkflow ? getWorkflowProgress(selectedWorkflow) : null;
  const busyAgents = agents.filter((agent) => agent.status !== "idle");
  const pendingApprovals = approvals.filter(
    (approval) => approval.status === "pending"
  );
  const latestMessage = messages[0] ?? null;
  const nextWorkflowCandidates = workflows.filter(
    (workflow) => workflow.id !== selectedWorkflow?.id
  );

  return (
    <section className="grid gap-4 2xl:grid-cols-[1.2fr_0.8fr]">
      <div className="panel p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="pixel-label">Command deck</p>
            <h2 className="mt-2 text-xl font-bold text-ink sm:text-2xl">
              Office control, without making 3D do all the work
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink/68">
              The 3D office should show spatial state. Actual decision-making lives here:
              workflow focus, blockers, approvals, crew load, and the next thing to click.
            </p>
          </div>

          <div className="grid min-w-[220px] gap-2 sm:grid-cols-3">
            <QuickStat
              label="Running"
              value={String(workflows.filter((workflow) => workflow.status === "running").length)}
              note="live requests"
            />
            <QuickStat
              label="Busy desks"
              value={String(busyAgents.length)}
              note="active agents"
            />
            <QuickStat
              label="Pending approvals"
              value={String(pendingApprovals.length)}
              note="review queue"
              accent={pendingApprovals.length > 0 ? "warn" : "good"}
            />
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-none border-2 border-ink/12 bg-[#14101c] p-4 shadow-pixel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-ink/46">
                  Focused workflow
                </p>
                <h3 className="mt-2 text-lg font-bold text-ink">
                  {selectedWorkflow ? selectedWorkflow.summary : "No active request"}
                </h3>
              </div>
              <span className="rounded-none border border-ink/18 bg-[#0d0a13] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-ink/72">
                {selectedWorkflow?.status ?? "standby"}
              </span>
            </div>

            {selectedWorkflow && progress ? (
              <div className="mt-4 space-y-4">
                <p className="text-sm leading-relaxed text-ink/66">
                  {getWorkflowSignalLine(selectedWorkflow)}
                </p>

                <div>
                  <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.18em] text-ink/52">
                    <span>Completion</span>
                    <span>{progress.percent}%</span>
                  </div>
                  <div className="mt-2 h-3 border-2 border-ink/14 bg-[#0f0c15]">
                    <div
                      className="h-full bg-teal transition-[width] duration-500"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <InspectorCard
                    label="Current step"
                    value={
                      progress.activeTask
                        ? truncate(progress.activeTask.title, 48)
                        : "No active task"
                    }
                    note={
                      progress.activeTask
                        ? roleMeta[progress.activeTask.role].label
                        : "Waiting for a new packet"
                    }
                  />
                  <InspectorCard
                    label="Next up"
                    value={
                      progress.nextTask
                        ? truncate(progress.nextTask.title, 48)
                        : selectedWorkflow.finalOutput
                          ? "Package ready"
                          : "Queue idle"
                    }
                    note={
                      progress.nextTask
                        ? roleMeta[progress.nextTask.role].label
                        : "Nothing blocked right now"
                    }
                  />
                  <InspectorCard
                    label="Token load"
                    value={
                      selectedWorkflow.usage
                        ? `${formatNumber(selectedWorkflow.usage.totalTokens)} total`
                        : "No usage yet"
                    }
                    note={selectedWorkflow.usage?.source ?? "estimated later"}
                  />
                  <InspectorCard
                    label="Updated"
                    value={formatClock(selectedWorkflow.updatedAt)}
                    note={`Created ${formatClock(selectedWorkflow.createdAt)}`}
                  />
                </div>

                <div className="grid gap-2 lg:grid-cols-4">
                  {selectedWorkflow.tasks.map((task) => {
                    const tone =
                      task.status === "in_progress"
                        ? "border-teal/38 bg-teal/10"
                        : ["done", "handed_off", "completed"].includes(task.status)
                          ? "border-mint/35 bg-mint/10"
                          : "border-ink/14 bg-[#120e19]";

                    return (
                      <button
                        key={task.id}
                        type="button"
                        className={`rounded-none border p-3 text-left shadow-pixel transition hover:-translate-y-0.5 ${tone}`}
                        onClick={() => onSelectWorkflow(selectedWorkflow.id)}
                      >
                        <p className="text-[10px] uppercase tracking-[0.18em] text-ink/48">
                          Step {task.order}
                        </p>
                        <p className="mt-2 text-sm font-bold leading-snug text-ink">
                          {truncate(task.title, 40)}
                        </p>
                        <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-ink/55">
                          {task.status.replace("_", " ")}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-none border-2 border-dashed border-ink/14 bg-[#110d18] p-4 text-sm leading-relaxed text-ink/56">
                Start a workflow and this deck becomes the primary control surface.
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-none border-2 border-ink/12 bg-[#14101c] p-4 shadow-pixel">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="pixel-label">Queue</p>
                  <h3 className="mt-2 text-base font-bold text-ink">Jump to another request</h3>
                </div>
                <span className="text-[10px] uppercase tracking-[0.18em] text-ink/46">
                  {workflows.length} total
                </span>
              </div>

              <div className="mt-4 space-y-2">
                {(selectedWorkflow ? [selectedWorkflow, ...nextWorkflowCandidates] : workflows)
                  .slice(0, 5)
                  .map((workflow) => {
                    const current = workflow.id === selectedWorkflow?.id;
                    const workflowProgress = getWorkflowProgress(workflow);

                    return (
                      <button
                        key={workflow.id}
                        type="button"
                        className={`w-full rounded-none border px-3 py-3 text-left transition ${
                          current
                            ? "border-teal/45 bg-[#21192c] text-ink shadow-pixel"
                            : "border-ink/14 bg-[#0f0c15] text-ink/74 hover:border-ink/34 hover:bg-[#17121f]"
                        }`}
                        onClick={() => onSelectWorkflow(workflow.id)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-current">
                              {truncate(workflow.summary, 64)}
                            </p>
                            <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-current opacity-55">
                              {workflow.status} · {workflowProgress.percent}% complete
                            </p>
                          </div>
                          <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-current opacity-55">
                            {formatClock(workflow.updatedAt)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>

            <div className="rounded-none border-2 border-ink/12 bg-[#14101c] p-4 shadow-pixel">
              <p className="pixel-label">Watchpoints</p>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink/68">
                <Watchpoint
                  title="Gateway"
                  body={
                    openclaw.gateway.reachable
                      ? `Connected${openclaw.gateway.connectLatencyMs ? ` · ${openclaw.gateway.connectLatencyMs} ms probe` : ""}`
                      : openclaw.gateway.error ?? "Gateway has not been validated yet."
                  }
                  tone={openclaw.gateway.reachable ? "good" : "warn"}
                />
                <Watchpoint
                  title="Approvals"
                  body={
                    pendingApprovals[0]
                      ? `${truncate(pendingApprovals[0].title, 72)} is waiting for review.`
                      : "Approval lane is clear."
                  }
                  tone={pendingApprovals.length > 0 ? "warn" : "good"}
                />
                <Watchpoint
                  title="Agent chatter"
                  body={latestMessage ? truncate(latestMessage.payload, 110) : "No recent cross-agent message."}
                  tone="neutral"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="panel p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="pixel-label">Crew load</p>
              <h3 className="mt-2 text-lg font-bold text-ink">Who is busy right now</h3>
            </div>
            <span className="text-[10px] uppercase tracking-[0.18em] text-ink/46">
              live staffing
            </span>
          </div>

          <div className="mt-4 space-y-2">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-none border border-ink/14 bg-[#120e19] px-3 py-3"
              >
                <span
                  className="h-3.5 w-3.5 border border-ink/24"
                  style={{ backgroundColor: agent.accent }}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">{agent.name}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-ink/50">
                    {roleMeta[agent.role].label}
                  </p>
                </div>
                <span className={`rounded-none border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${statusTone(agent.status)}`}>
                  {agent.status === "thinking" ? "working" : agent.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-4">
          <p className="pixel-label">3D direction</p>
          <h3 className="mt-2 text-lg font-bold text-ink">What the 3D scene should do</h3>
          <ul className="mt-4 space-y-2 text-sm leading-relaxed text-ink/66">
            <li>• Show room occupancy, desk focus, and packet movement.</li>
            <li>• Help people notice changes fast, not hunt for controls.</li>
            <li>• Keep precise actions in 2D panels where they stay reliable.</li>
            <li>• Treat 3D as situational awareness, not the only interface.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function QuickStat({
  label,
  value,
  note,
  accent = "neutral"
}: {
  label: string;
  value: string;
  note: string;
  accent?: "neutral" | "good" | "warn";
}) {
  return (
    <div
      className={`rounded-none border px-3 py-3 ${
        accent === "good"
          ? "border-mint/35 bg-mint/10"
          : accent === "warn"
            ? "border-coral/35 bg-coral/10"
            : "border-ink/14 bg-[#14101c]"
      }`}
    >
      <p className="text-[10px] uppercase tracking-[0.22em] text-ink/46">{label}</p>
      <p className="mt-2 text-xl font-bold text-ink">{value}</p>
      <p className="mt-2 text-[11px] text-ink/60">{note}</p>
    </div>
  );
}

function InspectorCard({
  label,
  value,
  note
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-none border-2 border-ink/14 bg-[#120e19] px-3 py-3">
      <p className="text-[10px] uppercase tracking-[0.22em] text-ink/46">{label}</p>
      <p className="mt-2 text-sm font-bold leading-snug text-ink">{value}</p>
      <p className="mt-2 text-[11px] text-ink/56">{note}</p>
    </div>
  );
}

function Watchpoint({
  title,
  body,
  tone
}: {
  title: string;
  body: string;
  tone: "neutral" | "good" | "warn";
}) {
  return (
    <div
      className={`rounded-none border px-3 py-3 ${
        tone === "good"
          ? "border-mint/35 bg-mint/10"
          : tone === "warn"
            ? "border-brass/35 bg-brass/10"
            : "border-ink/14 bg-[#120e19]"
      }`}
    >
      <p className="text-[10px] uppercase tracking-[0.2em] text-ink/46">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-ink/72">{body}</p>
    </div>
  );
}

function statusTone(status: AgentRecord["status"]) {
  if (status === "thinking") {
    return "border-teal/38 bg-teal/10 text-teal";
  }

  if (status === "handoff") {
    return "border-brass/35 bg-brass/10 text-brass";
  }

  return "border-ink/14 bg-[#0f0c15] text-ink/70";
}
