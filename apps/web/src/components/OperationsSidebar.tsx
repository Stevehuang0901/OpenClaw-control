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
  }>;
}> = [
  {
    label: "Main",
    items: [
      { id: "office", code: "01", label: "Office" },
      { id: "dashboard", code: "02", label: "Dashboard" },
      { id: "activity", code: "03", label: "Activity" }
    ]
  },
  {
    label: "Workflow",
    items: [{ id: "approvals", code: "04", label: "Approvals" }]
  },
  {
    label: "Tools",
    items: [
      { id: "operations", code: "05", label: "Operations" },
      { id: "skills", code: "06", label: "Skills" }
    ]
  }
];

export function OperationsSidebar({
  activePage,
  approvals,
  connected,
  metrics,
  openclaw,
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
      <div className="border-b-2 border-ink/12 px-4 py-5">
        <p className="pixel-label">ClawControl</p>
        <h2 className="mt-3 text-xl font-bold text-ink">Mission dashboard</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink/62">
          Cleaner navigation, faster scanning, less wall-of-text.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 border-b-2 border-ink/12 px-4 py-4">
        <CompactStat
          label="Live"
          value={String(liveWorkflows)}
          tone="neutral"
        />
        <CompactStat
          label="Approvals"
          value={String(pendingApprovals)}
          tone={pendingApprovals > 0 ? "warn" : "good"}
        />
        <CompactStat
          label="Gateway"
          value={connected ? "up" : "down"}
          tone={connected ? "good" : "warn"}
        />
        <CompactStat
          label="Tokens"
          value={formatNumber(metrics.estimatedTotalTokens)}
          tone="neutral"
        />
      </div>

      <div className="border-b-2 border-ink/12 px-4 py-4">
        <div className="rounded-none border-2 border-ink/12 bg-[#100d17] px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] uppercase tracking-[0.22em] text-ink/46">
              OpenClaw
            </span>
            <span
              className={`rounded-none border-2 border-current px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${
                openclaw.available
                  ? "bg-mint/18 text-mint"
                  : "bg-coral/18 text-coral"
              }`}
            >
              {openclaw.available ? "live" : "cold"}
            </span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ink/62">
            {openclaw.gateway.reachable
              ? "Gateway reachable."
              : openclaw.gateway.error ?? "Run a gateway probe from Operations if needed."}
          </p>
        </div>
      </div>

      <nav className="px-3 py-4">
        <div className="space-y-5">
          {navigationGroups.map((group) => (
            <div key={group.label}>
              <p className="px-2 text-[10px] uppercase tracking-[0.28em] text-ink/40">
                {group.label}
              </p>
              <div className="mt-2 space-y-2">
                {group.items.map((item) => {
                  const active = activePage === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`w-full rounded-none border-2 px-3 py-3 text-left shadow-pixel transition hover:-translate-y-0.5 ${
                        active
                          ? "border-teal/55 bg-[#21192c]"
                          : "border-ink/12 bg-[#14101c] hover:border-ink/40"
                      }`}
                      onClick={() => onSelectPage(item.id)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="rounded-none border-2 border-ink/15 bg-[#0f0c15] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-ink/54">
                            {item.code}
                          </span>
                          <span className="text-sm font-bold uppercase tracking-[0.14em] text-ink">
                            {item.label}
                          </span>
                        </div>
                        <span className="text-[10px] uppercase tracking-[0.18em] text-ink/42">
                          {resolveBadge(item.id, pendingApprovals, liveWorkflows)}
                        </span>
                      </div>
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

function CompactStat({
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
      ? "border-mint/35 bg-mint/10 text-mint"
      : tone === "warn"
        ? "border-coral/35 bg-coral/10 text-coral"
        : "border-ink/12 bg-[#100d17] text-ink";

  return (
    <div className={`rounded-none border-2 px-3 py-3 shadow-pixel ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-[0.24em] text-current">{label}</p>
      <p className="mt-2 text-xl font-bold text-current">{value}</p>
    </div>
  );
}

function resolveBadge(
  page: DashboardPage,
  pendingApprovals: number,
  liveWorkflows: number
) {
  switch (page) {
    case "office":
      return `${liveWorkflows} live`;
    case "dashboard":
      return "overview";
    case "activity":
      return "timeline";
    case "approvals":
      return `${pendingApprovals} wait`;
    case "operations":
      return "ops";
    case "skills":
      return "market";
    default:
      return "";
  }
}
