import {
  formatDateTime,
  formatNumber,
  formatPercent,
  truncate
} from "../lib/format";
import type { OpenClawStatusSnapshot } from "../types/contracts";

interface OpenClawUsagePanelProps {
  openclaw: OpenClawStatusSnapshot;
}

export function OpenClawUsagePanel({ openclaw }: OpenClawUsagePanelProps) {
  return (
    <section className="panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="pixel-label">OpenClaw Usage</p>
          <h2 className="mt-2 text-2xl font-bold text-ink">Token monitor</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/66">
            This panel shows the latest `openclaw status --usage --json` snapshot:
            token totals, provider windows, and recent session activity.
          </p>
        </div>
        <span
          className={`rounded-none border-2 border-current px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${
            openclaw.available ? "bg-mint/18 text-mint" : "bg-coral/15 text-coral"
          }`}
        >
          {openclaw.available ? "CLI live" : "Unavailable"}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <UsageCard
          label="Recent Tokens"
          value={formatNumber(openclaw.totals.totalTokens)}
          note={`${openclaw.totals.recentSessionCount} recent sessions`}
        />
        <UsageCard
          label="Input / Output"
          value={`${formatNumber(openclaw.totals.inputTokens)} / ${formatNumber(
            openclaw.totals.outputTokens
          )}`}
          note="Provider-reported when available"
        />
        <UsageCard
          label="Cache Read"
          value={formatNumber(openclaw.totals.cacheRead)}
          note={`${formatNumber(openclaw.totals.cacheWrite)} cache writes`}
        />
        <UsageCard
          label="Avg Context"
          value={formatPercent(openclaw.totals.averagePercentUsed)}
          note="Across recent sessions"
        />
      </div>

      <div className="mt-5 grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-4">
          <div className="rounded-none border-2 border-ink/15 bg-[#0f0c15] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-bold text-ink">Gateway snapshot</p>
              <span className="text-[10px] uppercase tracking-[0.18em] text-ink/48">
                Updated {formatDateTime(openclaw.updatedAt)}
              </span>
            </div>
            <div className="mt-3 grid gap-2 text-sm text-ink/74">
              <UsageLine
                label="Status"
                value={openclaw.gateway.reachable ? "Reachable" : "Not reachable"}
                tone={openclaw.gateway.reachable ? "good" : "warn"}
              />
              <UsageLine label="Mode" value={openclaw.gateway.mode ?? "--"} />
              <UsageLine
                label="Latency"
                value={
                  typeof openclaw.gateway.connectLatencyMs === "number"
                    ? `${openclaw.gateway.connectLatencyMs}ms`
                    : "--"
                }
              />
              <UsageLine
                label="Source"
                value={truncate(
                  openclaw.gateway.url ?? openclaw.error ?? "No OpenClaw status data.",
                  72
                )}
              />
            </div>
            {openclaw.error ? (
              <div className="mt-3 rounded-none border-2 border-coral/40 bg-coral/10 px-3 py-2 text-xs text-coral">
                {truncate(openclaw.error, 140)}
              </div>
            ) : null}
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-ink/50">
              Recent sessions
            </p>
            <div className="mt-3 space-y-3">
              {openclaw.recentSessions.length === 0 ? (
                <div className="rounded-none border-2 border-dashed border-ink/15 p-4 text-sm text-ink/55">
                  No recent sessions were reported.
                </div>
              ) : null}

              {openclaw.recentSessions.slice(0, 5).map((session) => (
                <article
                  key={session.sessionId}
                  className="rounded-none border-2 border-ink/15 bg-[#14101c] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-ink">
                        {session.model ?? "unknown model"}
                      </p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-ink/48">
                        {truncate(session.key, 44)}
                      </p>
                    </div>
                    <span className="text-xs text-ink/60">
                      {formatNumber(session.totalTokens)} tok
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs uppercase tracking-[0.16em] text-ink/55">
                    <span>In {formatNumber(session.inputTokens)}</span>
                    <span>Out {formatNumber(session.outputTokens)}</span>
                    <span>Cache {formatNumber(session.cacheRead)}</span>
                    <span>
                      Used{" "}
                      {session.percentUsed === null
                        ? "--"
                        : formatPercent(session.percentUsed)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-ink/50">
            Provider windows
          </p>
          <div className="mt-3 space-y-3">
            {openclaw.providers.length === 0 ? (
              <div className="rounded-none border-2 border-dashed border-ink/15 p-4 text-sm text-ink/55">
                No provider quota windows were reported by OpenClaw.
              </div>
            ) : null}

            {openclaw.providers.map((provider) => (
              <article
                key={provider.provider}
                className="rounded-none border-2 border-ink/15 bg-[#14101c] p-4 shadow-pixel"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-ink">{provider.displayName}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-ink/48">
                      {provider.provider}
                    </p>
                  </div>
                  <span className="text-xs text-ink/55">
                    {provider.plan ?? "No plan info"}
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {provider.windows.map((window) => (
                    <div key={`${provider.provider}-${window.label}`}>
                      <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-ink/55">
                        <span>{window.label}</span>
                        <span>{formatPercent(window.usedPercent)}</span>
                      </div>
                      <div className="mt-2 h-3 border-2 border-ink/20 bg-[#0f0c15]">
                        <div
                          className="h-full bg-teal"
                          style={{
                            width: `${Math.min(100, Math.max(0, window.usedPercent))}%`
                          }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-ink/42">
                        Reset {formatDateTime(window.resetAt)}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

interface UsageCardProps {
  label: string;
  value: string;
  note: string;
}

function UsageCard({ label, value, note }: UsageCardProps) {
  return (
    <div className="rounded-none border-2 border-ink/15 bg-[#14101c] p-3 shadow-pixel">
      <p className="text-[10px] uppercase tracking-[0.22em] text-ink/48">{label}</p>
      <p className="mt-2 text-xl font-bold text-ink">{value}</p>
      <p className="mt-2 text-xs text-ink/58">{note}</p>
    </div>
  );
}

function UsageLine({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone?: "good" | "warn";
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-none border-2 border-ink/12 bg-[#14101c] px-3 py-2">
      <span className="text-xs uppercase tracking-[0.16em] text-ink/52">{label}</span>
      <span
        className={`text-right text-sm ${
          tone === "good" ? "text-mint" : tone === "warn" ? "text-coral" : "text-ink/82"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
