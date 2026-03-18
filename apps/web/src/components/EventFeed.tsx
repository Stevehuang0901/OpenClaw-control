import { formatClock, formatDateTime, truncate } from "../lib/format";
import type {
  AgentRecord,
  ApprovalRecord,
  GatewayEvent,
  MessageRecord,
  WorkflowRecord
} from "../types/contracts";

interface EventFeedProps {
  agents: AgentRecord[];
  approvals: ApprovalRecord[];
  events: GatewayEvent[];
  messages: MessageRecord[];
  workflows: WorkflowRecord[];
}

interface TimelineEntry {
  id: string;
  timestamp: string;
  lane: "message" | "handoff" | "result" | "workflow" | "approval" | "system";
  title: string;
  subtitle: string;
  detail: string;
  workflowSummary: string | null;
}

export function EventFeed({
  agents,
  approvals,
  events,
  messages,
  workflows
}: EventFeedProps) {
  const agentById = new Map(agents.map((agent) => [agent.id, agent.name]));
  const workflowById = new Map(workflows.map((workflow) => [workflow.id, workflow]));
  const mergedTimeline = [
    ...messages.map((message) =>
      buildMessageEntry(message, agentById, workflowById)
    ),
    ...events.map((event, index) => buildEventEntry(event, index, agentById, workflowById))
  ]
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
    .slice(0, 24);

  const summary = {
    messages: messages.filter((message) => message.kind === "info").length,
    handoffs: messages.filter((message) => message.kind === "handoff").length,
    results: messages.filter((message) => message.kind === "result").length,
    approvals: approvals.filter((approval) => approval.status === "pending").length
  };

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="pixel-label">Activity</p>
          <h2 className="mt-2 text-2xl font-bold text-ink">Operations timeline</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink/66">
            Merged into one chronological feed so you can read the system like an ops
            timeline instead of jumping between unrelated message and event lists.
          </p>
        </div>
        <div className="rounded-none border-2 border-ink/12 bg-[#15101d] px-4 py-3 shadow-pixel">
          <p className="text-[10px] uppercase tracking-[0.24em] text-ink/46">
            Timeline range
          </p>
          <p className="mt-2 text-sm text-ink/74">
            {mergedTimeline.length > 0
              ? `${formatDateTime(mergedTimeline[mergedTimeline.length - 1].timestamp)} -> ${formatDateTime(
                  mergedTimeline[0].timestamp
                )}`
              : "No activity yet"}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <article className="rounded-none border-2 border-ink/12 bg-[#14101c] p-4 shadow-pixel">
          <p className="pixel-label">Signal Guide</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <SummaryCard
              label="Messages"
              value={summary.messages.toString()}
              note="General agent notes and gateway updates."
              tone="system"
            />
            <SummaryCard
              label="Handoffs"
              value={summary.handoffs.toString()}
              note="Packets moving between desks."
              tone="handoff"
            />
            <SummaryCard
              label="Results"
              value={summary.results.toString()}
              note="Final delivery packets heading back to the gateway."
              tone="result"
            />
            <SummaryCard
              label="Pending approvals"
              value={summary.approvals.toString()}
              note="Release desk items still waiting on a decision."
              tone="approval"
            />
          </div>

          <div className="mt-5 rounded-none border-2 border-ink/12 bg-[#0f0c15] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-ink/46">
              How to read this
            </p>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink/66">
              <p>Most recent entries are at the top.</p>
              <p>Each item shows the lane, what happened, and which workflow it belonged to.</p>
              <p>
                Approval entries and result packets are usually the clearest signs that a workflow is
                approaching completion.
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-none border-2 border-ink/12 bg-[#14101c] p-4 shadow-pixel">
          <p className="pixel-label">Timeline</p>
          <div className="timeline-shell mt-4">
            {mergedTimeline.length > 0 ? (
              mergedTimeline.map((entry) => (
                <div key={entry.id} className="timeline-entry">
                  <div className={`timeline-dot timeline-dot-${entry.lane}`} />
                  <div className="timeline-card">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`timeline-chip timeline-chip-${entry.lane}`}>
                            {entry.lane}
                          </span>
                          {entry.workflowSummary ? (
                            <span className="timeline-workflow">
                              {entry.workflowSummary}
                            </span>
                          ) : null}
                        </div>
                        <h3 className="mt-3 text-base font-bold text-ink">{entry.title}</h3>
                        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-ink/46">
                          {entry.subtitle}
                        </p>
                      </div>
                      <span className="text-[10px] uppercase tracking-[0.18em] text-ink/40">
                        {formatClock(entry.timestamp)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-ink/70">
                      {entry.detail}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-none border-2 border-dashed border-ink/12 p-6 text-sm text-ink/56">
                No timeline activity yet. Submit a request from the Office page to start generating events.
              </div>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}

function buildMessageEntry(
  message: MessageRecord,
  agentById: Map<string, string>,
  workflowById: Map<string, WorkflowRecord>
): TimelineEntry {
  const from = agentById.get(message.fromAgentId) ?? "Gateway";
  const to = agentById.get(message.toAgentId) ?? "Gateway";
  const workflow = workflowById.get(message.workflowId) ?? null;
  const lane =
    message.kind === "handoff"
      ? "handoff"
      : message.kind === "result"
        ? "result"
        : "message";

  return {
    id: message.id,
    timestamp: message.timestamp,
    lane,
    title: `${from} -> ${to}`,
    subtitle:
      message.kind === "handoff"
        ? "Packet handoff"
        : message.kind === "result"
          ? "Final result"
          : "Agent note",
    detail: truncate(message.payload, 200),
    workflowSummary: workflow?.summary ?? null
  };
}

function buildEventEntry(
  event: GatewayEvent,
  index: number,
  agentById: Map<string, string>,
  workflowById: Map<string, WorkflowRecord>
): TimelineEntry {
  const record = asRecord(event.data);
  const workflowId = pickWorkflowId(record);
  const workflow = workflowId ? workflowById.get(workflowId) ?? null : null;

  const base = {
    id: `event-${event.timestamp}-${index}`,
    timestamp: event.timestamp,
    workflowSummary: workflow?.summary ?? null
  };

  switch (event.type) {
    case "workflow_created":
      return {
        ...base,
        lane: "workflow",
        title: "Workflow created",
        subtitle: workflow?.id ?? "New request",
        detail:
          workflow?.prompt ??
          "A new request entered the gateway and is waiting for its first desk."
      };
    case "workflow_completed":
      return {
        ...base,
        lane: "result",
        title: "Workflow completed",
        subtitle: workflow?.id ?? "Delivery ready",
        detail:
          workflow?.finalOutput?.slice(0, 220) ??
          "The workflow finished and the final package is ready."
      };
    case "task_updated": {
      const agentName =
        typeof record.agentId === "string" ? agentById.get(record.agentId) ?? "A desk" : "A desk";
      const status =
        typeof record.status === "string" ? record.status.replaceAll("_", " ") : "updated";
      return {
        ...base,
        lane: status.includes("handoff") ? "handoff" : "system",
        title: `${agentName} updated a task`,
        subtitle: `status: ${status}`,
        detail: workflow
          ? `${workflow.summary} moved to ${status}.`
          : `A task changed status to ${status}.`
      };
    }
    case "handoff_started":
      return {
        ...base,
        lane: "handoff",
        title: "Handoff started",
        subtitle: "Packet in flight",
        detail: "A finished task packet left one desk and is moving to the next role."
      };
    case "handoff_finished":
      return {
        ...base,
        lane: "handoff",
        title: "Handoff finished",
        subtitle: "Desk acknowledged packet",
        detail: "The receiving desk can now continue the workflow."
      };
    case "approval_updated": {
      const approvalStatus =
        typeof record.status === "string" ? record.status : "updated";
      const approvalTitle =
        typeof record.title === "string" ? record.title : "Approval packet";
      return {
        ...base,
        lane: "approval",
        title: approvalTitle,
        subtitle: `approval ${approvalStatus}`,
        detail:
          typeof record.summary === "string"
            ? truncate(record.summary, 200)
            : "A release approval changed status."
      };
    }
    case "openclaw_status_updated":
      return {
        ...base,
        lane: "system",
        title: "OpenClaw status refreshed",
        subtitle: "Status poll completed",
        detail: "Provider windows, recent sessions, and gateway reachability were refreshed."
      };
    case "metrics_updated":
      return {
        ...base,
        lane: "system",
        title: "Metrics recalculated",
        subtitle: "Overview values changed",
        detail: "The global dashboard metrics were recomputed after new activity."
      };
    case "message_logged":
      return {
        ...base,
        lane: "message",
        title: "Message logged",
        subtitle: "Comms channel updated",
        detail: "A new agent message was captured by the gateway."
      };
    default:
      return {
        ...base,
        lane: "system",
        title: String(event.type).replaceAll("_", " "),
        subtitle: "System event",
        detail: "The gateway published a new event."
      };
  }
}

function SummaryCard({
  label,
  value,
  note,
  tone
}: {
  label: string;
  value: string;
  note: string;
  tone: TimelineEntry["lane"];
}) {
  return (
    <article className="rounded-none border-2 border-ink/12 bg-[#0f0c15] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.24em] text-ink/46">{label}</p>
        <span className={`timeline-chip timeline-chip-${tone}`}>{tone}</span>
      </div>
      <p className="mt-3 text-3xl font-bold text-ink">{value}</p>
      <p className="mt-3 text-sm leading-relaxed text-ink/64">{note}</p>
    </article>
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function pickWorkflowId(record: Record<string, unknown>) {
  if (typeof record.workflowId === "string") {
    return record.workflowId;
  }

  if (typeof record.id === "string" && typeof record.prompt === "string") {
    return record.id;
  }

  return null;
}
