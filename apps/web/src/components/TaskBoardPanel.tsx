import { formatClock, formatNumber, truncate } from "../lib/format";
import { getWorkflowProgress } from "../lib/workflows";
import { roleMeta } from "../types/contracts";
import type {
  ApprovalRecord,
  AgentRecord,
  WorkflowRecord
} from "../types/contracts";

interface TaskBoardPanelProps {
  approvals: ApprovalRecord[];
  agents: AgentRecord[];
  selectedWorkflowId: string | null;
  workflows: WorkflowRecord[];
  onSelectWorkflow: (workflowId: string) => void;
}

export function TaskBoardPanel({
  approvals,
  agents,
  selectedWorkflowId,
  workflows,
  onSelectWorkflow
}: TaskBoardPanelProps) {
  const approvalByWorkflow = new Map(
    approvals.map((approval) => [approval.workflowId, approval])
  );

  const sortedWorkflows = [...workflows].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt)
  );

  const summary = {
    queued: workflows.filter((workflow) => workflow.status === "queued").length,
    running: workflows.filter((workflow) => workflow.status === "running").length,
    completed: workflows.filter((workflow) => workflow.status === "completed").length,
    approvals: approvals.filter((approval) => approval.status === "pending").length
  };

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="pixel-label">Workflow Board</p>
          <h2 className="mt-2 text-2xl font-bold text-ink">Readable mission queue</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink/66">
            One card per workflow, with the current stage, next stage, approval state,
            and four-step pipeline visible without squeezing text into narrow columns.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <QueueBadge label="Queued" value={summary.queued} tone="neutral" />
          <QueueBadge label="Running" value={summary.running} tone="teal" />
          <QueueBadge label="Completed" value={summary.completed} tone="mint" />
          <QueueBadge label="Approvals" value={summary.approvals} tone="coral" />
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {sortedWorkflows.length === 0 ? (
          <div className="rounded-none border-2 border-dashed border-ink/12 px-4 py-8 text-sm text-ink/56">
            No workflows yet. Create one from the Office page and it will show up here.
          </div>
        ) : null}

        {sortedWorkflows.map((workflow) => {
          const progress = getWorkflowProgress(workflow);
          const approval = approvalByWorkflow.get(workflow.id) ?? null;
          const activeTask = progress.activeTask ?? null;
          const nextTask = progress.nextTask ?? null;
          const activeAgent =
            activeTask?.ownerAgentId
              ? agents.find((agent) => agent.id === activeTask.ownerAgentId) ?? null
              : null;

          return (
            <button
              key={workflow.id}
              type="button"
              className={`w-full rounded-none border-2 p-4 text-left shadow-pixel transition hover:-translate-y-0.5 ${
                workflow.id === selectedWorkflowId
                  ? "border-teal/55 bg-[#21192c]"
                  : "border-ink/12 bg-[#14101c] hover:border-ink/36"
              }`}
              onClick={() => onSelectWorkflow(workflow.id)}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-none border-2 border-ink/15 bg-[#0f0c15] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-ink/52">
                      {workflow.id}
                    </span>
                    <span className={`workflow-status workflow-status-${workflow.status}`}>
                      {workflow.status}
                    </span>
                  </div>
                  <h3 className="mt-3 text-xl font-bold text-ink">
                    {workflow.summary}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-ink/68">
                    {truncate(workflow.prompt, 180)}
                  </p>
                </div>

                <div className="grid gap-2 text-right text-xs uppercase tracking-[0.18em] text-ink/48">
                  <span>Updated {formatClock(workflow.updatedAt)}</span>
                  <span>
                    {workflow.usage
                      ? `${formatNumber(workflow.usage.totalTokens)} tok`
                      : "No usage"}
                  </span>
                  <span>{progress.percent}% complete</span>
                </div>
              </div>

              <div className="mt-4 grid gap-3 xl:grid-cols-[0.9fr_0.9fr_1.2fr]">
                <SignalCard
                  label="Current"
                  value={
                    activeTask
                      ? `${activeTask.title} at ${activeAgent?.name ?? "assigned desk"}`
                      : "No active desk"
                  }
                  detail={
                    activeTask
                      ? `${roleMeta[activeTask.role].label} is executing the current step.`
                      : "Workflow is queued, complete, or between handoffs."
                  }
                  tone="teal"
                />
                <SignalCard
                  label="Next"
                  value={nextTask ? nextTask.title : "No next step queued"}
                  detail={
                    nextTask
                      ? `${roleMeta[nextTask.role].label} is next in line.`
                      : approval?.status === "pending"
                        ? "Waiting for release approval."
                        : "No pending step right now."
                  }
                  tone="brass"
                />
                <SignalCard
                  label="Release"
                  value={
                    approval
                      ? `${approval.status}${approval.status === "pending" ? " approval" : ""}`
                      : "No approval packet yet"
                  }
                  detail={
                    approval
                      ? truncate(approval.summary, 120)
                      : "Approval record appears after validator completion."
                  }
                  tone={
                    approval?.status === "approved"
                      ? "mint"
                      : approval?.status === "rejected"
                        ? "coral"
                        : "neutral"
                  }
                />
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                {workflow.tasks.map((task) => {
                  const tone =
                    task.status === "in_progress"
                      ? "border-teal/45 bg-teal/10"
                      : ["done", "handed_off", "completed"].includes(task.status)
                        ? "border-mint/35 bg-mint/10"
                        : "border-ink/12 bg-[#0f0c15]";
                  const agentName =
                    task.ownerAgentId
                      ? agents.find((agent) => agent.id === task.ownerAgentId)?.name ?? "Desk"
                      : "Queue";

                  return (
                    <div key={task.id} className={`rounded-none border-2 p-3 ${tone}`}>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-ink/44">
                        Step {task.order}
                      </p>
                      <p className="mt-2 text-sm font-bold text-ink">{task.title}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-ink/52">
                        {agentName}
                      </p>
                    </div>
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function QueueBadge({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: "teal" | "mint" | "coral" | "neutral";
}) {
  const toneClass =
    tone === "teal"
      ? "border-teal/35 bg-teal/10 text-teal"
      : tone === "mint"
        ? "border-mint/35 bg-mint/10 text-mint"
        : tone === "coral"
          ? "border-coral/35 bg-coral/10 text-coral"
          : "border-ink/12 bg-[#100d17] text-ink";

  return (
    <div className={`rounded-none border-2 px-3 py-3 shadow-pixel ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-[0.22em] text-current">{label}</p>
      <p className="mt-2 text-2xl font-bold text-current">{value}</p>
    </div>
  );
}

function SignalCard({
  label,
  value,
  detail,
  tone
}: {
  label: string;
  value: string;
  detail: string;
  tone: "teal" | "brass" | "mint" | "coral" | "neutral";
}) {
  const toneClass =
    tone === "teal"
      ? "border-teal/35 bg-teal/10"
      : tone === "brass"
        ? "border-brass/35 bg-brass/10"
        : tone === "mint"
          ? "border-mint/35 bg-mint/10"
          : tone === "coral"
            ? "border-coral/35 bg-coral/10"
            : "border-ink/12 bg-[#0f0c15]";

  return (
    <div className={`rounded-none border-2 px-4 py-3 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-[0.22em] text-ink/44">{label}</p>
      <p className="mt-3 text-sm font-bold text-ink">{value}</p>
      <p className="mt-3 text-sm leading-relaxed text-ink/64">{detail}</p>
    </div>
  );
}
