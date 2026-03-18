import { formatClock, truncate } from "../lib/format";
import { getWorkflowProgress } from "../lib/workflows";
import { roleMeta } from "../types/contracts";
import type {
  AgentRecord,
  ApprovalRecord,
  WorkflowRecord
} from "../types/contracts";

interface OfficeStoryPanelProps {
  agents: AgentRecord[];
  approvals: ApprovalRecord[];
  selectedWorkflowId: string | null;
  workflows: WorkflowRecord[];
}

export function OfficeStoryPanel({
  agents,
  approvals,
  selectedWorkflowId,
  workflows
}: OfficeStoryPanelProps) {
  const workflow =
    workflows.find((entry) => entry.id === selectedWorkflowId) ??
    workflows.find((entry) => entry.status === "running") ??
    workflows[0] ??
    null;
  const progress = workflow ? getWorkflowProgress(workflow) : null;
  const activeTask = progress?.activeTask ?? null;
  const nextTask = progress?.nextTask ?? null;
  const approval =
    workflow ? approvals.find((entry) => entry.workflowId === workflow.id) ?? null : null;
  const activeAgent =
    activeTask?.ownerAgentId
      ? agents.find((agent) => agent.id === activeTask.ownerAgentId) ?? null
      : null;

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="pixel-label">Office Guide</p>
          <h2 className="mt-2 text-2xl font-bold text-ink">Read the scene at a glance</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink/66">
            This is the lightweight legend for the office floor: what is happening
            now, what comes next, and whether release work is waiting on approval.
          </p>
        </div>
        <div className="rounded-none border-2 border-ink/12 bg-[#15101d] px-4 py-3 shadow-pixel">
          <p className="text-[10px] uppercase tracking-[0.24em] text-ink/46">Scene focus</p>
          <p className="mt-2 text-sm text-ink/74">
            {workflow ? workflow.summary : "Waiting for the first mission"}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-4">
        <StoryCard
          kicker="Now"
          title={
            activeTask
              ? `${activeAgent?.name ?? "A desk"} is on ${activeTask.title}`
              : workflow
                ? "The floor is between beats"
                : "No mission is running"
          }
          detail={
            activeTask
              ? `${roleMeta[activeTask.role].label} started ${formatClock(
                  activeTask.startedAt ?? workflow?.updatedAt ?? null
                )}.`
              : workflow
                ? "The packet is waiting for the next desk or approval decision."
                : "Start a mission from the Office console."
          }
          tone="teal"
        />
        <StoryCard
          kicker="Next"
          title={
            nextTask
              ? nextTask.title
              : approval?.status === "pending"
                ? "Approval desk is up next"
                : "No queued follow-up"
          }
          detail={
            nextTask
              ? `${roleMeta[nextTask.role].label} will take the next packet.`
              : approval?.status === "pending"
                ? "The work is assembled, but release still needs a human decision."
                : "The queue is clear until the next request arrives."
          }
          tone="brass"
        />
        <StoryCard
          kicker="Release"
          title={approval ? approval.status : "not opened"}
          detail={
            approval
              ? truncate(approval.summary, 120)
              : "Approval cards appear after validator output is ready."
          }
          tone={
            approval?.status === "approved"
              ? "mint"
              : approval?.status === "rejected"
                ? "coral"
                : "neutral"
          }
        />
        <StoryCard
          kicker="Request"
          title={workflow ? truncate(workflow.summary, 44) : "Standing by"}
          detail={
            workflow
              ? truncate(workflow.prompt, 128)
              : "The next submitted prompt becomes the plot the office acts out."
          }
          tone="neutral"
        />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <article className="rounded-none border-2 border-ink/12 bg-[#14101c] p-4 shadow-pixel">
          <p className="pixel-label">What Animations Mean</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <LegendRow
              title="Walking lanes"
              detail="Teal dotted routes show where desk and lounge traffic move."
            />
            <LegendRow
              title="Speech bubbles"
              detail="Large bubbles mean an agent is actively working or handing off."
            />
            <LegendRow
              title="Flying packets"
              detail="A moving packet is a real handoff between two desks."
            />
            <LegendRow
              title="Celebration sparks"
              detail="Green sparks mean approval landed and the release shipped."
            />
          </div>
        </article>

        <article className="rounded-none border-2 border-ink/12 bg-[#14101c] p-4 shadow-pixel">
          <div className="flex items-center justify-between gap-3">
            <p className="pixel-label">Beat Map</p>
            <span className="text-[10px] uppercase tracking-[0.18em] text-ink/46">
              {workflow ? workflow.status : "idle"}
            </span>
          </div>
          {workflow ? (
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              {workflow.tasks.map((task) => {
                const tone =
                  task.status === "in_progress"
                    ? "border-teal/45 bg-teal/10"
                    : ["done", "handed_off", "completed"].includes(task.status)
                      ? "border-mint/35 bg-mint/10"
                      : "border-ink/12 bg-[#15101d]";

                return (
                  <div key={task.id} className={`rounded-none border-2 p-3 ${tone}`}>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-ink/44">
                      Beat {task.order}
                    </p>
                    <p className="mt-2 text-sm font-bold text-ink">{task.title}</p>
                    <p className="mt-2 text-xs text-ink/62">
                      {roleMeta[task.role].label}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-none border-2 border-dashed border-ink/12 p-4 text-sm text-ink/56">
              No workflow yet.
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

function StoryCard({
  kicker,
  title,
  detail,
  tone
}: {
  kicker: string;
  title: string;
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
    <div className={`rounded-none border-2 p-4 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-[0.24em] text-ink/44">{kicker}</p>
      <h3 className="mt-3 text-base font-bold text-ink">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-ink/66">{detail}</p>
    </div>
  );
}

function LegendRow({
  title,
  detail
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-none border-2 border-ink/12 bg-[#0f0c15] px-4 py-3">
      <p className="text-sm font-bold text-ink">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-ink/66">{detail}</p>
    </div>
  );
}
