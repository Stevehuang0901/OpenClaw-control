import { formatClock, formatNumber, truncate } from "../lib/format";
import { getWorkflowProgress, getWorkflowSignalLine } from "../lib/workflows";
import { roleMeta } from "../types/contracts";
import type {
  AgentRecord,
  ApprovalRecord,
  OpenClawStatusSnapshot,
  WorkflowRecord
} from "../types/contracts";

interface OverviewDeckProps {
  agents: AgentRecord[];
  approvals: ApprovalRecord[];
  openclaw: OpenClawStatusSnapshot;
  selectedWorkflowId: string | null;
  workflows: WorkflowRecord[];
}

export function OverviewDeck({
  agents,
  approvals,
  openclaw,
  selectedWorkflowId,
  workflows
}: OverviewDeckProps) {
  const focusWorkflow =
    workflows.find((workflow) => workflow.id === selectedWorkflowId) ??
    workflows.find((workflow) => workflow.status === "running") ??
    workflows[0] ??
    null;
  const progress = focusWorkflow ? getWorkflowProgress(focusWorkflow) : null;
  const pendingApprovals = approvals.filter(
    (approval) => approval.status === "pending"
  );
  const activeTask = progress?.activeTask ?? null;
  const nextTask = progress?.nextTask ?? null;
  const activeAgent =
    activeTask?.ownerAgentId
      ? agents.find((agent) => agent.id === activeTask.ownerAgentId) ?? null
      : null;
  const roleSummary = (["collector", "analyzer", "writer", "validator"] as const).map(
    (role) => {
      const crew = agents.filter((agent) => agent.role === role);
      const active = crew.filter((agent) => agent.status !== "idle").length;
      return {
        role,
        label: roleMeta[role].label,
        active,
        total: crew.length
      };
    }
  );

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="pixel-label">Control Tower</p>
          <h2 className="mt-2 text-2xl font-bold text-ink">What is happening now</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink/66">
            This page should answer three questions immediately: what is running,
            what happens next, and what needs attention.
          </p>
        </div>
        <div className="rounded-none border-2 border-ink/12 bg-[#15101d] px-4 py-3 shadow-pixel">
          <p className="text-[10px] uppercase tracking-[0.24em] text-ink/46">
            Focus workflow
          </p>
          <p className="mt-2 text-sm text-ink/74">
            {focusWorkflow ? focusWorkflow.summary : "No active workflow selected"}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <SituationCard
          kicker="Now"
          title={
            activeTask
              ? `${activeTask.title} at ${activeAgent?.name ?? "assigned desk"}`
              : focusWorkflow
                ? "No desk is actively working right now"
                : "Waiting for the first mission"
          }
          detail={
            activeTask
              ? `${roleMeta[activeTask.role].label} is currently driving the workflow. Updated ${formatClock(
                  activeTask.startedAt ?? focusWorkflow?.updatedAt ?? null
                )}.`
              : focusWorkflow
                ? getWorkflowSignalLine(focusWorkflow)
                : "Submit a prompt from Office to start the first run."
          }
          tone="teal"
        />
        <SituationCard
          kicker="Next"
          title={
            nextTask
              ? `${nextTask.title} is next in line`
              : pendingApprovals[0]
                ? `Approval waiting for ${pendingApprovals[0].title}`
                : "No pending handoff right now"
          }
          detail={
            nextTask
              ? `${roleMeta[nextTask.role].label} is queued to pick up the next packet.`
              : pendingApprovals[0]
                ? "The workflow is done, but release sign-off is still pending."
                : "The queue is either clear or already completed."
          }
          tone="brass"
        />
        <SituationCard
          kicker="Watch"
          title={
            pendingApprovals.length > 0
              ? `${pendingApprovals.length} approval${pendingApprovals.length === 1 ? "" : "s"} need review`
              : openclaw.gateway.reachable
                ? "Gateway looks healthy"
                : "Gateway should be checked"
          }
          detail={
            pendingApprovals.length > 0
              ? "Release desk work is the clearest blocker right now."
              : openclaw.gateway.reachable
                ? "OpenClaw status is live and no release queue is backing up."
                : openclaw.gateway.error ?? "Open the Operations page if the gateway seems stale."
          }
          tone={pendingApprovals.length > 0 || !openclaw.gateway.reachable ? "coral" : "mint"}
        />
      </div>

      <div className="mt-5 grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
        <article className="rounded-none border-2 border-ink/12 bg-[#14101c] p-4 shadow-pixel">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="pixel-label">Workflow Spotlight</p>
              <h3 className="mt-2 text-xl font-bold text-ink">
                {focusWorkflow?.summary ?? "No workflow yet"}
              </h3>
            </div>
            <span className="rounded-none border-2 border-ink/15 bg-[#0f0c15] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-ink/68">
              {focusWorkflow?.status ?? "idle"}
            </span>
          </div>

          {focusWorkflow ? (
            <>
              <p className="mt-3 text-sm leading-relaxed text-ink/66">
                {focusWorkflow.prompt}
              </p>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                {focusWorkflow.tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`rounded-none border-2 px-3 py-3 ${
                      task.status === "in_progress"
                        ? "border-teal/50 bg-teal/10"
                        : ["done", "handed_off", "completed"].includes(task.status)
                          ? "border-mint/35 bg-mint/10"
                          : "border-ink/12 bg-[#0f0c15]"
                    }`}
                  >
                    <p className="text-[10px] uppercase tracking-[0.2em] text-ink/46">
                      Step {task.order}
                    </p>
                    <p className="mt-2 text-sm font-bold text-ink">{task.title}</p>
                    <p className="mt-2 text-xs text-ink/62">
                      {roleMeta[task.role].label}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[0.78fr_1.22fr]">
                <div className="rounded-none border-2 border-ink/12 bg-[#0f0c15] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-ink/48">
                    Focus reading
                  </p>
                  <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink/68">
                    <p>{getWorkflowSignalLine(focusWorkflow)}</p>
                    <p>
                      Progress: {progress?.completedTasks ?? 0}/{progress?.totalTasks ?? 0} settled
                      steps.
                    </p>
                    <p>
                      Usage:{" "}
                      {focusWorkflow.usage
                        ? `${formatNumber(focusWorkflow.usage.totalTokens)} total tokens`
                        : "No usage yet"}
                    </p>
                  </div>
                </div>

                <div className="rounded-none border-2 border-ink/12 bg-[#0f0c15] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-ink/48">
                    Output snapshot
                  </p>
                  <pre className="mt-3 max-h-[220px] overflow-auto whitespace-pre-wrap text-sm leading-relaxed text-ink/78">
                    {truncate(
                      (
                        focusWorkflow.finalOutput ??
                        focusWorkflow.tasks
                          .map((task) => task.output)
                          .filter(Boolean)
                          .join("\n\n")
                      ) || "No output packets yet.",
                      820
                    )}
                  </pre>
                </div>
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-none border-2 border-dashed border-ink/12 p-6 text-sm text-ink/56">
              No workflows have been submitted yet.
            </div>
          )}
        </article>

        <article className="rounded-none border-2 border-ink/12 bg-[#14101c] p-4 shadow-pixel">
          <p className="pixel-label">Crew Pressure</p>
          <div className="mt-4 space-y-3">
            {roleSummary.map((role) => (
              <div
                key={role.role}
                className="rounded-none border-2 border-ink/12 bg-[#0f0c15] px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-ink">{role.label}</span>
                  <span className="text-xs uppercase tracking-[0.18em] text-ink/56">
                    {role.active}/{role.total} busy
                  </span>
                </div>
                <div className="mt-3 h-3 border-2 border-ink/12 bg-[#16121f]">
                  <div
                    className="h-full transition-[width] duration-500"
                    style={{
                      width: `${role.total === 0 ? 0 : (role.active / role.total) * 100}%`,
                      backgroundColor: roleMeta[role.role].accent
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

function SituationCard({
  kicker,
  title,
  detail,
  tone
}: {
  kicker: string;
  title: string;
  detail: string;
  tone: "teal" | "brass" | "coral" | "mint";
}) {
  const toneClass =
    tone === "teal"
      ? "border-teal/35 bg-teal/10"
      : tone === "brass"
        ? "border-brass/35 bg-brass/10"
        : tone === "coral"
          ? "border-coral/35 bg-coral/10"
          : "border-mint/35 bg-mint/10";

  return (
    <article className={`rounded-none border-2 p-4 shadow-pixel ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-[0.24em] text-ink/46">{kicker}</p>
      <h3 className="mt-3 text-lg font-bold text-ink">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-ink/68">{detail}</p>
    </article>
  );
}
