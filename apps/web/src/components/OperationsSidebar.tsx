import { formatNumber } from "../lib/format";
import type {
  ApprovalRecord,
  MetricSnapshot,
  OpenClawStatusSnapshot,
  WorkflowRecord
} from "../types/contracts";

interface OperationsSidebarProps {
  connected: boolean;
  metrics: MetricSnapshot;
  openclaw: OpenClawStatusSnapshot;
  approvals: ApprovalRecord[];
  workflows: WorkflowRecord[];
}

const sections = [
  {
    id: "mission-input",
    label: "Dispatch",
    note: "Submit tasks and watch output stream in."
  },
  {
    id: "office-floor",
    label: "Office",
    note: "Live pixel floor with handoffs and idle antics."
  },
  {
    id: "task-board",
    label: "Board",
    note: "Kanban view across every active workflow."
  },
  {
    id: "approvals",
    label: "Approvals",
    note: "Approve or reject final delivery packages."
  },
  {
    id: "gateway-ops",
    label: "Gateway",
    note: "Probe ws and wss endpoints before routing."
  },
  {
    id: "skills",
    label: "Skills",
    note: "Install, update, inspect, and remove skills."
  }
];

export function OperationsSidebar({
  connected,
  metrics,
  openclaw,
  approvals,
  workflows
}: OperationsSidebarProps) {
  const pendingApprovals = approvals.filter(
    (approval) => approval.status === "pending"
  ).length;
  const liveWorkflows = workflows.filter(
    (workflow) => workflow.status !== "completed"
  ).length;

  return (
    <aside className="panel lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:overflow-auto">
      <div className="border-b-2 border-ink/15 px-5 py-5">
        <p className="pixel-label">Night Shift</p>
        <h2 className="mt-3 text-2xl font-bold text-ink">Mission control</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink/70">
          Multi-agent office ops with a dark pixel shell, live OpenClaw wiring,
          approvals, and marketplace tools in one room.
        </p>
      </div>

      <div className="grid gap-3 border-b-2 border-ink/15 px-5 py-5">
        <StatusRow
          label="Gateway"
          value={connected ? "online" : "offline"}
          tone={connected ? "good" : "warn"}
        />
        <StatusRow
          label="OpenClaw"
          value={openclaw.available ? "live" : "cold"}
          tone={openclaw.available ? "good" : "warn"}
        />
        <StatusRow
          label="Requests"
          value={`${liveWorkflows} live`}
          tone="neutral"
        />
        <StatusRow
          label="Approvals"
          value={`${pendingApprovals} pending`}
          tone={pendingApprovals > 0 ? "warn" : "good"}
        />
      </div>

      <div className="grid gap-3 border-b-2 border-ink/15 px-5 py-5 sm:grid-cols-2 lg:grid-cols-1">
        <MiniStat
          label="Completed"
          value={formatNumber(metrics.completedWorkflows)}
          note="Delivered workflows"
        />
        <MiniStat
          label="Tokens"
          value={formatNumber(metrics.estimatedTotalTokens)}
          note="Current est total"
        />
      </div>

      <nav className="px-4 py-5">
        <p className="pixel-label">Sections</p>
        <div className="mt-4 space-y-2">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              className="w-full rounded-none border-2 border-ink/15 bg-[#15101d] px-4 py-3 text-left shadow-pixel transition hover:-translate-y-0.5 hover:border-ink hover:bg-[#1b1526]"
              onClick={() =>
                document
                  .getElementById(section.id)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold uppercase tracking-[0.18em] text-ink">
                  {section.label}
                </span>
                <span className="text-[10px] uppercase tracking-[0.22em] text-ink/45">
                  jump
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-ink/62">
                {section.note}
              </p>
            </button>
          ))}
        </div>
      </nav>
    </aside>
  );
}

function MiniStat({
  label,
  value,
  note
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="rounded-none border-2 border-ink/15 bg-[#15101d] px-4 py-3 shadow-pixel">
      <p className="text-[10px] uppercase tracking-[0.24em] text-ink/48">{label}</p>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
      <p className="mt-2 text-xs text-ink/58">{note}</p>
    </article>
  );
}

function StatusRow({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "good" | "warn" | "neutral";
}) {
  const toneClass =
    tone === "good"
      ? "bg-mint/20 text-mint"
      : tone === "warn"
        ? "bg-coral/18 text-coral"
        : "bg-[#1b1526] text-ink";

  return (
    <div className="flex items-center justify-between gap-3 rounded-none border-2 border-ink/15 bg-[#100d17] px-4 py-3">
      <span className="text-xs uppercase tracking-[0.24em] text-ink/52">{label}</span>
      <span
        className={`rounded-none border-2 border-current px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${toneClass}`}
      >
        {value}
      </span>
    </div>
  );
}
