import { formatClock, truncate } from "../lib/format";
import { taskStatusLabel, taskStatusTone } from "../lib/status";
import type {
  ApprovalRecord,
  AgentRecord,
  TaskRecord,
  WorkflowRecord
} from "../types/contracts";

interface TaskBoardPanelProps {
  approvals: ApprovalRecord[];
  agents: AgentRecord[];
  selectedWorkflowId: string | null;
  workflows: WorkflowRecord[];
  onSelectWorkflow: (workflowId: string) => void;
}

type BoardColumnKey = "queued" | "active" | "review" | "complete";

const boardColumns: Array<{
  key: BoardColumnKey;
  label: string;
  description: string;
}> = [
  {
    key: "queued",
    label: "Queued",
    description: "Waiting in the gateway queue."
  },
  {
    key: "active",
    label: "Active",
    description: "Currently being worked at a desk."
  },
  {
    key: "review",
    label: "Handoff",
    description: "Finished packets in motion or awaiting review."
  },
  {
    key: "complete",
    label: "Complete",
    description: "Delivered tasks and shipped workflows."
  }
];

export function TaskBoardPanel({
  approvals,
  agents,
  selectedWorkflowId,
  workflows,
  onSelectWorkflow
}: TaskBoardPanelProps) {
  const agentById = new Map(agents.map((agent) => [agent.id, agent.name]));
  const approvalByWorkflow = new Map(
    approvals.map((approval) => [approval.workflowId, approval])
  );
  const boardItems = workflows
    .flatMap((workflow) =>
      workflow.tasks.map((task) => ({
        workflow,
        task,
        approval: approvalByWorkflow.get(workflow.id) ?? null,
        column: resolveColumn(task)
      }))
    )
    .sort((left, right) => right.workflow.updatedAt.localeCompare(left.workflow.updatedAt));

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="pixel-label">Task Board</p>
          <h2 className="mt-2 text-2xl font-bold text-ink">Mission kanban</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/70">
            Pulled from the imported mission-control ideas: every task lands on a
            dark board now, with handoff state, workflow owner, and approval risk
            visible at a glance.
          </p>
        </div>
        <div className="rounded-none border-2 border-ink/15 bg-[#15101d] px-4 py-3 shadow-pixel">
          <p className="text-[10px] uppercase tracking-[0.24em] text-ink/48">
            Board signal
          </p>
          <p className="mt-2 text-sm text-ink/72">
            {boardItems.filter((item) => item.task.status === "in_progress").length} live
            tasks · {approvals.filter((approval) => approval.status === "pending").length} approvals
            waiting
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-4">
        {boardColumns.map((column) => {
          const items = boardItems.filter((item) => item.column === column.key);

          return (
            <div
              key={column.key}
              className="rounded-none border-2 border-ink/15 bg-[#100d17] p-4 shadow-pixel"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-ink">
                    {column.label}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-ink/55">
                    {column.description}
                  </p>
                </div>
                <span className="rounded-none border-2 border-ink/15 bg-[#1b1526] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-ink/72">
                  {items.length}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {items.length === 0 ? (
                  <div className="rounded-none border-2 border-dashed border-ink/15 px-4 py-6 text-sm text-ink/52">
                    Nothing parked here right now.
                  </div>
                ) : null}

                {items.map(({ workflow, task, approval }) => (
                  <TaskCard
                    key={task.id}
                    agentName={task.ownerAgentId ? agentById.get(task.ownerAgentId) : null}
                    approval={approval}
                    selected={workflow.id === selectedWorkflowId}
                    task={task}
                    workflow={workflow}
                    onSelectWorkflow={onSelectWorkflow}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TaskCard({
  agentName,
  approval,
  selected,
  task,
  workflow,
  onSelectWorkflow
}: {
  agentName: string | null | undefined;
  approval: ApprovalRecord | null;
  selected: boolean;
  task: TaskRecord;
  workflow: WorkflowRecord;
  onSelectWorkflow: (workflowId: string) => void;
}) {
  return (
    <button
      type="button"
      className={`w-full rounded-none border-2 p-4 text-left shadow-pixel transition hover:-translate-y-0.5 ${
        selected
          ? "border-ink bg-[#21192c]"
          : "border-ink/15 bg-[#17121f] hover:border-ink/60"
      }`}
      onClick={() => onSelectWorkflow(workflow.id)}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-ink/45">
            {workflow.id}
          </p>
          <p className="mt-2 text-base font-bold text-ink">{task.title}</p>
        </div>
        <span
          className={`rounded-none border-2 border-current px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${taskStatusTone[task.status]}`}
        >
          {taskStatusLabel[task.status]}
        </span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink/72">
        {truncate(task.output ?? task.description, 140)}
      </p>

      <div className="mt-4 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.18em] text-ink/52">
        <span className="rounded-none border-2 border-ink/15 bg-[#110d18] px-2 py-1">
          {workflow.summary}
        </span>
        <span className="rounded-none border-2 border-ink/15 bg-[#110d18] px-2 py-1">
          {agentName ?? "Gateway queue"}
        </span>
        <span className="rounded-none border-2 border-ink/15 bg-[#110d18] px-2 py-1">
          {task.role}
        </span>
      </div>

      {approval?.status === "pending" && task.status === "completed" ? (
        <div className="mt-4 rounded-none border-2 border-coral/45 bg-coral/10 px-3 py-2 text-xs leading-relaxed text-coral">
          Approval still pending for this delivery package.
        </div>
      ) : null}

      <div className="mt-4 text-[10px] uppercase tracking-[0.18em] text-ink/45">
        Updated {formatClock(task.completedAt ?? task.startedAt ?? workflow.updatedAt)}
      </div>
    </button>
  );
}

const resolveColumn = (task: TaskRecord): BoardColumnKey => {
  if (task.status === "pending") {
    return "queued";
  }

  if (task.status === "in_progress") {
    return "active";
  }

  if (task.status === "done" || task.status === "handed_off") {
    return "review";
  }

  return "complete";
};
