import { formatClock, truncate } from "../lib/format";
import { getWorkflowMessages, getWorkflowProgress } from "../lib/workflows";
import { roleMeta } from "../types/contracts";
import type {
  AgentRecord,
  ApprovalRecord,
  MessageRecord,
  WorkflowRecord
} from "../types/contracts";

interface OfficeStoryPanelProps {
  agents: AgentRecord[];
  approvals: ApprovalRecord[];
  messages: MessageRecord[];
  selectedWorkflowId: string | null;
  workflows: WorkflowRecord[];
}

export function OfficeStoryPanel({
  agents,
  approvals,
  messages,
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
  const liveNotes = workflow ? getWorkflowMessages(workflow, messages) : [];
  const activeAgent =
    activeTask?.ownerAgentId
      ? agents.find((agent) => agent.id === activeTask.ownerAgentId) ?? null
      : null;

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="pixel-label">Office Narrative</p>
          <h2 className="mt-2 text-2xl font-bold text-ink">How to read the room</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink/66">
            The office page should feel like a scene with a plot, not just a cute
            animation. This panel explains the current beat, who owns it, and what
            the next beat will be.
          </p>
        </div>
        <div className="rounded-none border-2 border-ink/12 bg-[#15101d] px-4 py-3 shadow-pixel">
          <p className="text-[10px] uppercase tracking-[0.24em] text-ink/46">
            Scene focus
          </p>
          <p className="mt-2 text-sm text-ink/74">
            {workflow ? workflow.summary : "Waiting for the first mission"}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
        <article className="rounded-none border-2 border-ink/12 bg-[#14101c] p-4 shadow-pixel">
          <div className="grid gap-4 md:grid-cols-3">
            <StoryCard
              kicker="Scene now"
              title={
                activeTask
                  ? `${activeAgent?.name ?? "A desk"} is handling ${activeTask.title}`
                  : workflow
                    ? "The desks are between beats"
                    : "No mission is running"
              }
              detail={
                activeTask
                  ? `${roleMeta[activeTask.role].label} owns the current beat. Started ${formatClock(
                      activeTask.startedAt ?? workflow?.updatedAt ?? null
                    )}.`
                  : workflow
                    ? "The packet is either in handoff or waiting for the next assignment."
                    : "Use the prompt box above to start the first story."
              }
            />
            <StoryCard
              kicker="Next cue"
              title={
                nextTask
                  ? `${nextTask.title} is coming next`
                  : approval?.status === "pending"
                    ? "Approval desk is the next stop"
                    : "No queued follow-up right now"
              }
              detail={
                nextTask
                  ? `${roleMeta[nextTask.role].label} will pick up the next packet.`
                  : approval?.status === "pending"
                    ? "The work is done, but release approval still needs a decision."
                    : "The scene is clear until a new request arrives."
              }
            />
            <StoryCard
              kicker="Why it matters"
              title={
                workflow
                  ? truncate(workflow.prompt, 54)
                  : "The office is standing by"
              }
              detail={
                workflow
                  ? "This is the user request currently being dramatized by the office."
                  : "Once you submit a task, this area becomes the plot summary."
              }
            />
          </div>

          <div className="mt-5 rounded-none border-2 border-ink/12 bg-[#0f0c15] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-ink/46">
              Story beats
            </p>
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
          </div>

          <div className="mt-5 rounded-none border-2 border-ink/12 bg-[#0f0c15] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-ink/46">
              Collaboration script
            </p>
            <div className="mt-3 space-y-3">
              {liveNotes.length > 0 ? (
                liveNotes.map((message) => (
                  <div
                    key={message.id}
                    className="rounded-none border-2 border-ink/12 bg-[#15101d] px-3 py-3"
                  >
                    <p className="text-[10px] uppercase tracking-[0.2em] text-ink/44">
                      {message.kind}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-ink/72">
                      {truncate(message.payload, 156)}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-none border-2 border-dashed border-ink/12 p-4 text-sm text-ink/56">
                  Collaboration notes will appear here once agents begin talking to each other.
                </div>
              )}
            </div>
          </div>
        </article>

        <article className="rounded-none border-2 border-ink/12 bg-[#14101c] p-4 shadow-pixel">
          <p className="pixel-label">Reading Guide</p>
          <div className="mt-4 space-y-3">
            <LegendRow
              title="Walking lanes"
              detail="Dotted teal routes show the main movement paths between desks and the lounge."
            />
            <LegendRow
              title="Speech bubbles"
              detail="Big bubbles mean the agent is actively working or handing off a packet."
            />
            <LegendRow
              title="Flying packet"
              detail="A moving packet is a real handoff between desks, not just decoration."
            />
            <LegendRow
              title="Approval fireworks"
              detail="Green celebration sparks mean a release was approved and shipped."
            />
          </div>

          <div className="mt-5 rounded-none border-2 border-ink/12 bg-[#0f0c15] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-ink/46">
              Release state
            </p>
            <div className="mt-3 space-y-2 text-sm text-ink/68">
              <p>
                Approval:{" "}
                <span className="font-bold text-ink">
                  {approval ? approval.status : "not created yet"}
                </span>
              </p>
              <p>
                Workflow:{" "}
                <span className="font-bold text-ink">
                  {workflow ? workflow.status : "idle"}
                </span>
              </p>
              <p>
                Current beat:{" "}
                <span className="font-bold text-ink">
                  {activeTask ? activeTask.title : "none"}
                </span>
              </p>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

function StoryCard({
  kicker,
  title,
  detail
}: {
  kicker: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-none border-2 border-ink/12 bg-[#0f0c15] p-4">
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
