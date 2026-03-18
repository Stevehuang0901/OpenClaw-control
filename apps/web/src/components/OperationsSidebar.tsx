import { formatNumber } from "../lib/format";
import type {
  ApprovalRecord,
  MetricSnapshot,
  OpenClawStatusSnapshot,
  WorkflowRecord
} from "../types/contracts";

export type DashboardPage =
  | "office"
  | "dashboard"
  | "activity"
  | "approvals"
  | "operations"
  | "skills";

interface OperationsSidebarProps {
  activePage: DashboardPage;
  approvals: ApprovalRecord[];
  connected: boolean;
  metrics: MetricSnapshot;
  openclaw: OpenClawStatusSnapshot;
  workflows: WorkflowRecord[];
  onSelectPage: (page: DashboardPage) => void;
}

const navigationGroups: Array<{
  label: string;
  items: Array<{
    id: DashboardPage;
    code: string;
    label: string;
    note: string;
  }>;
}> = [
  {
    label: "Overview",
    items: [
      {
        id: "office",
        code: "01",
        label: "Office",
        note: "Main pixel floor, prompt input, and live output."
      },
      {
        id: "dashboard",
        code: "02",
        label: "Dashboard",
        note: "Metrics, board state, workflow trace, and crew summary."
      },
      {
        id: "activity",
        code: "03",
        label: "Activity",
        note: "Message log and system event stream."
      }
    ]
  },
  {
    label: "Workflow",
    items: [
      {
        id: "approvals",
        code: "04",
        label: "Approvals",
        note: "Review validator output and sign off releases."
      }
    ]
  },
  {
    label: "Platform",
    items: [
      {
        id: "operations",
        code: "05",
        label: "Operations",
        note: "Gateway probe plus token and provider monitoring."
      },
      {
        id: "skills",
        code: "06",
        label: "Skills",
        note: "Browse, install, update, and inspect skill packs."
      }
    ]
  }
];

export function OperationsSidebar({
  activePage,
  connected,
  metrics,
  openclaw,
  approvals,
  workflows,
  onSelectPage
}: OperationsSidebarProps) {
  const pendingApprovals = approvals.filter(
    (approval) => approval.status === "pending"
  ).length;
  const liveWorkflows = workflows.filter(
    (workflow) => workflow.status !== "completed"
  ).length;

  return (
    <aside className="panel lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:overflow-auto">
      <div className="border-b-2 border-ink/12 px-5 py-5">
        <p className="pixel-label">ClawControl</p>
        <h2 className="mt-3 text-2xl font-bold text-ink">Mission dashboard</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink/66">
          Split the control room into clean pages, keep the office alive, and let
          each concern breathe in its own view.
        </p>
      </div>

      <div className="grid gap-3 border-b-2 border-ink/12 px-5 py-5">
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

      <div className="grid gap-3 border-b-2 border-ink/12 px-5 py-5 sm:grid-cols-2 lg:grid-cols-1">
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
        <div className="space-y-5">
          {navigationGroups.map((group) => (
            <div key={group.label}>
              <p className="px-1 text-[10px] uppercase tracking-[0.28em] text-ink/42">
                {group.label}
              </p>
              <div className="mt-3 space-y-2">
                {group.items.map((item) => {
                  const active = activePage === item.id;
                  const badge = resolveBadge(item.id, {
                    liveWorkflows,
                    pendingApprovals,
                    openclaw
                  });

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`w-full rounded-none border-2 px-4 py-3 text-left shadow-pixel transition hover:-translate-y-0.5 ${
                        active
                          ? "border-ink bg-[#241b30]"
                          : "border-ink/12 bg-[#14101c] hover:border-ink/50 hover:bg-[#1a1424]"
                      }`}
                      onClick={() => onSelectPage(item.id)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="rounded-none border-2 border-ink/20 bg-[#0f0c15] px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-ink/60">
                            {item.code}
                          </span>
                          <span className="text-sm font-bold uppercase tracking-[0.16em] text-ink">
                            {item.label}
                          </span>
                        </div>
                        <span
                          className={`rounded-none border-2 border-current px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${
                            active ? "bg-teal/18 text-teal" : "bg-[#0f0c15] text-ink/62"
                          }`}
                        >
                          {badge}
                        </span>
                      </div>
                      <p className="mt-3 text-xs leading-relaxed text-ink/58">
                        {item.note}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
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
    <article className="rounded-none border-2 border-ink/12 bg-[#14101c] px-4 py-3 shadow-pixel">
      <p className="text-[10px] uppercase tracking-[0.24em] text-ink/46">{label}</p>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
      <p className="mt-2 text-xs text-ink/56">{note}</p>
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
        : "bg-[#0f0c15] text-ink";

  return (
    <div className="flex items-center justify-between gap-3 rounded-none border-2 border-ink/12 bg-[#100d17] px-4 py-3">
      <span className="text-xs uppercase tracking-[0.24em] text-ink/50">{label}</span>
      <span
        className={`rounded-none border-2 border-current px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${toneClass}`}
      >
        {value}
      </span>
    </div>
  );
}

function resolveBadge(
  page: DashboardPage,
  input: {
    liveWorkflows: number;
    pendingApprovals: number;
    openclaw: OpenClawStatusSnapshot;
  }
) {
  switch (page) {
    case "office":
      return `${input.liveWorkflows} live`;
    case "dashboard":
      return "overview";
    case "activity":
      return "feed";
    case "approvals":
      return `${input.pendingApprovals} wait`;
    case "operations":
      return input.openclaw.available ? "cli" : "offline";
    case "skills":
      return "market";
    default:
      return "view";
  }
}
