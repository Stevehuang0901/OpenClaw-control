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

type NavIconName =
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
    meta: string;
    icon: NavIconName;
  }>;
}> = [
  {
    label: "Main",
    items: [
      {
        id: "office",
        code: "01",
        label: "Office",
        meta: "Live floor scene",
        icon: "office"
      },
      {
        id: "dashboard",
        code: "02",
        label: "Dashboard",
        meta: "Crew and metrics",
        icon: "dashboard"
      },
      {
        id: "activity",
        code: "03",
        label: "Activity",
        meta: "Messages and events",
        icon: "activity"
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
        meta: "Release review desk",
        icon: "approvals"
      }
    ]
  },
  {
    label: "Tools",
    items: [
      {
        id: "operations",
        code: "05",
        label: "Operations",
        meta: "Gateway and usage",
        icon: "operations"
      },
      {
        id: "skills",
        code: "06",
        label: "Skills",
        meta: "Install and inspect",
        icon: "skills"
      }
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
  const gatewayTone = connected ? "good" : "warn";
  const openclawSummary = openclaw.gateway.reachable
    ? "Gateway healthy"
    : openclaw.gateway.error ?? "Gateway probe needed";

  return (
    <aside className="panel flex lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:flex-col">
      <div className="border-b-2 border-ink/12 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark />
            <div className="min-w-0">
              <p className="pixel-label">OpenClaw</p>
              <h2 className="mt-2 truncate text-lg font-bold tracking-[0.04em] text-ink">
                Bot Dashboard
              </h2>
              <p className="mt-2 text-[10px] uppercase tracking-[0.22em] text-ink/42">
                Pixel office control
              </p>
            </div>
          </div>
          <StatusPill
            label={connected ? "Live" : "Offline"}
            tone={gatewayTone}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-b-2 border-ink/12 px-4 py-4">
        <CompactStat label="Live" value={String(liveWorkflows)} tone="neutral" />
        <CompactStat
          label="Approvals"
          value={String(pendingApprovals)}
          tone={pendingApprovals > 0 ? "warn" : "good"}
        />
        <CompactStat
          label="Gateway"
          value={connected ? "up" : "down"}
          tone={gatewayTone}
        />
        <CompactStat
          label="Tokens"
          value={formatNumber(metrics.estimatedTotalTokens)}
          tone="neutral"
        />
      </div>

      <nav className="flex-1 overflow-auto px-3 py-4">
        <div className="space-y-5">
          {navigationGroups.map((group) => (
            <div key={group.label}>
              <div className="flex items-center justify-between px-2">
                <p className="text-[10px] uppercase tracking-[0.28em] text-ink/40">
                  {group.label}
                </p>
                <span className="text-[10px] text-ink/24">-</span>
              </div>

              <div className="mt-2 space-y-1.5">
                {group.items.map((item) => {
                  const active = activePage === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`w-full rounded-none border px-3 py-3 text-left transition ${
                        active
                          ? "border-teal/55 bg-[#21192c] text-ink shadow-pixel"
                          : "border-ink/12 bg-[#14101c] text-ink/80 hover:border-ink/32 hover:bg-[#181320]"
                      }`}
                      onClick={() => onSelectPage(item.id)}
                    >
                      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
                        <NavItemIcon name={item.icon} active={active} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex h-7 min-w-7 items-center justify-center border px-1.5 text-[10px] uppercase tracking-[0.18em] ${
                                active
                                  ? "border-teal/38 bg-teal/10 text-teal"
                                  : "border-ink/14 bg-[#0f0c15] text-ink/54"
                              }`}
                            >
                              {item.code}
                            </span>
                            <span className="truncate text-xs font-bold uppercase tracking-[0.18em] text-current">
                              {item.label}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span className="truncate text-[10px] uppercase tracking-[0.18em] text-current opacity-60">
                              {item.meta}
                            </span>
                            <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-current opacity-50">
                              {resolveBadge(item.id, pendingApprovals, liveWorkflows)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      <div className="border-t-2 border-ink/12 px-3 py-3">
        <div className="rounded-none border border-ink/12 bg-[#120e19] px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="pixel-label">Control Bus</p>
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-ink">
                {openclaw.available ? "OpenClaw linked" : "OpenClaw cold"}
              </p>
            </div>
            <StatusPill
              label={openclaw.gateway.reachable ? "Ready" : "Check"}
              tone={openclaw.gateway.reachable ? "good" : "warn"}
            />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ink/62">
            {openclawSummary}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <FooterChip label={`${openclaw.providers.length} providers`} />
            <FooterChip label={`${metrics.runningWorkflows} running`} />
          </div>
        </div>
      </div>
    </aside>
  );
}

function BrandMark() {
  return (
    <div className="inline-flex h-11 w-11 items-center justify-center border-2 border-ink bg-[#100d17] shadow-pixel">
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="h-6 w-6 text-teal"
        style={{ imageRendering: "pixelated", shapeRendering: "crispEdges" }}
      >
        <rect x="5" y="1" width="6" height="1" fill="currentColor" opacity="0.7" />
        <rect x="4" y="2" width="8" height="1" fill="currentColor" />
        <rect x="3" y="4" width="10" height="1" fill="currentColor" />
        <rect x="2" y="5" width="12" height="5" fill="currentColor" opacity="0.78" />
        <rect x="4" y="10" width="8" height="2" fill="currentColor" />
        <rect x="6" y="12" width="4" height="2" fill="currentColor" opacity="0.6" />
      </svg>
    </div>
  );
}

function NavItemIcon({
  name,
  active
}: {
  name: NavIconName;
  active: boolean;
}) {
  const tone = active ? "text-teal" : "text-ink/68";

  return (
    <span
      className={`inline-flex h-10 w-10 items-center justify-center border ${
        active
          ? "border-teal/42 bg-teal/10"
          : "border-ink/12 bg-[#0f0c15]"
      } ${tone}`}
    >
      <SidebarPixelIcon name={name} />
    </span>
  );
}

function SidebarPixelIcon({ name }: { name: NavIconName }) {
  const className = "h-4 w-4";

  switch (name) {
    case "office":
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true" className={className}>
          <rect x="1" y="5" width="14" height="1" fill="currentColor" opacity="0.55" />
          <rect x="2" y="6" width="3" height="7" fill="currentColor" opacity="0.85" />
          <rect x="11" y="6" width="3" height="7" fill="currentColor" opacity="0.85" />
          <rect x="5" y="2" width="6" height="2" fill="currentColor" />
          <rect x="6" y="8" width="4" height="3" fill="currentColor" opacity="0.62" />
        </svg>
      );

    case "dashboard":
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true" className={className}>
          <rect x="2" y="11" width="3" height="3" fill="currentColor" opacity="0.7" />
          <rect x="7" y="8" width="3" height="6" fill="currentColor" />
          <rect x="12" y="4" width="2" height="10" fill="currentColor" opacity="0.55" />
          <rect x="2" y="3" width="2" height="2" fill="currentColor" opacity="0.5" />
        </svg>
      );

    case "activity":
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true" className={className}>
          <rect x="1" y="11" width="14" height="1" fill="currentColor" opacity="0.35" />
          <rect x="2" y="8" width="2" height="2" fill="currentColor" opacity="0.5" />
          <rect x="5" y="6" width="2" height="2" fill="currentColor" opacity="0.72" />
          <rect x="8" y="4" width="2" height="2" fill="currentColor" />
          <rect x="11" y="2" width="2" height="2" fill="currentColor" opacity="0.72" />
          <rect x="3" y="9" width="3" height="1" fill="currentColor" opacity="0.65" />
          <rect x="6" y="7" width="3" height="1" fill="currentColor" opacity="0.82" />
          <rect x="9" y="5" width="3" height="1" fill="currentColor" opacity="0.82" />
        </svg>
      );

    case "approvals":
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true" className={className}>
          <rect x="3" y="2" width="10" height="12" fill="currentColor" opacity="0.24" />
          <rect x="5" y="4" width="6" height="1" fill="currentColor" />
          <rect x="5" y="7" width="4" height="1" fill="currentColor" opacity="0.74" />
          <rect x="5" y="10" width="3" height="1" fill="currentColor" opacity="0.54" />
          <rect x="10" y="8" width="2" height="3" fill="currentColor" />
        </svg>
      );

    case "operations":
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true" className={className}>
          <rect x="2" y="3" width="12" height="2" fill="currentColor" opacity="0.78" />
          <rect x="3" y="6" width="3" height="3" fill="currentColor" opacity="0.6" />
          <rect x="7" y="6" width="3" height="6" fill="currentColor" />
          <rect x="11" y="6" width="2" height="4" fill="currentColor" opacity="0.55" />
          <rect x="2" y="13" width="12" height="1" fill="currentColor" opacity="0.38" />
        </svg>
      );

    case "skills":
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true" className={className}>
          <rect x="6" y="1" width="4" height="2" fill="currentColor" />
          <rect x="4" y="3" width="8" height="3" fill="currentColor" opacity="0.8" />
          <rect x="2" y="6" width="12" height="5" fill="currentColor" opacity="0.54" />
          <rect x="5" y="11" width="6" height="3" fill="currentColor" />
        </svg>
      );

    default:
      return null;
  }
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
      <p className="text-[9px] uppercase tracking-[0.24em] text-current">{label}</p>
      <p className="mt-1.5 text-lg font-bold text-current">{value}</p>
    </div>
  );
}

function StatusPill({
  label,
  tone
}: {
  label: string;
  tone: "good" | "warn";
}) {
  return (
    <span
      className={`inline-flex items-center justify-center border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${
        tone === "good"
          ? "border-mint/35 bg-mint/10 text-mint"
          : "border-coral/35 bg-coral/10 text-coral"
      }`}
    >
      {label}
    </span>
  );
}

function FooterChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center justify-center border border-ink/12 bg-[#0f0c15] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-ink/60">
      {label}
    </span>
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
      return "metrics";
    case "activity":
      return "feed";
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
