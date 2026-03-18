import { useEffect, useState } from "react";

import { formatDateTime } from "../lib/format";
import type { GatewayProbeResult, OpenClawStatusSnapshot } from "../types/contracts";

interface GatewayOpsPanelProps {
  openclaw: OpenClawStatusSnapshot;
}

const emptyProbe: GatewayProbeResult | null = null;

export function GatewayOpsPanel({ openclaw }: GatewayOpsPanelProps) {
  const [gatewayUrl, setGatewayUrl] = useState("");
  const [gatewayToken, setGatewayToken] = useState("");
  const [gatewayDisableDevicePairing, setGatewayDisableDevicePairing] = useState(false);
  const [gatewayAllowInsecureTls, setGatewayAllowInsecureTls] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GatewayProbeResult | null>(emptyProbe);

  useEffect(() => {
    if (!gatewayUrl && openclaw.gateway.url) {
      setGatewayUrl(openclaw.gateway.url);
    }
  }, [gatewayUrl, openclaw.gateway.url]);

  const probeGateway = async () => {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/gateway/probe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          gatewayUrl,
          gatewayToken,
          gatewayDisableDevicePairing,
          gatewayAllowInsecureTls
        })
      });

      const payload = (await response.json().catch(() => null)) as
        | GatewayProbeResult
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          payload && "error" in payload && payload.error
            ? payload.error
            : "Unable to probe gateway."
        );
      }

      setResult(payload as GatewayProbeResult);
    } catch (probeError) {
      setError(
        probeError instanceof Error ? probeError.message : "Unable to probe gateway."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="pixel-label">Gateway Ops</p>
          <h2 className="mt-2 text-2xl font-bold text-ink">Probe and configure</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/70">
            Use this when the gateway looks stale or you need to confirm a specific
            `ws://` or `wss://` endpoint is actually reachable.
          </p>
        </div>
        <div className="rounded-none border-2 border-ink/15 bg-[#15101d] px-4 py-3 shadow-pixel">
          <p className="text-[10px] uppercase tracking-[0.24em] text-ink/48">
            Live gateway
          </p>
          <p className="mt-2 text-sm text-ink/72">
            {openclaw.gateway.url ?? "No URL detected from OpenClaw CLI yet"}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <OpsCard
          label="Reachable"
          value={openclaw.gateway.reachable ? "Yes" : "No"}
          note="Detected from the latest OpenClaw status snapshot."
        />
        <OpsCard
          label="Latency"
          value={
            typeof openclaw.gateway.connectLatencyMs === "number"
              ? `${openclaw.gateway.connectLatencyMs}ms`
              : "--"
          }
          note="Round-trip time from the most recent gateway check."
        />
        <OpsCard
          label="Mode"
          value={openclaw.gateway.mode ?? "--"}
          note="The mode reported by the local OpenClaw CLI."
        />
      </div>

      <div className="mt-5 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-none border-2 border-ink/15 bg-[#120e19] p-4 shadow-pixel">
          <div className="grid gap-3">
            <label className="text-xs uppercase tracking-[0.2em] text-ink/52">
              Gateway URL
              <input
                value={gatewayUrl}
                onChange={(event) => setGatewayUrl(event.target.value)}
                className="mt-2 w-full rounded-none border-2 border-ink/20 bg-[#0f0c15] px-4 py-3 text-sm text-ink shadow-pixel outline-none transition focus:border-teal"
                placeholder="wss://gateway.example.com:443"
              />
            </label>

            <label className="text-xs uppercase tracking-[0.2em] text-ink/52">
              Token
              <input
                value={gatewayToken}
                onChange={(event) => setGatewayToken(event.target.value)}
                className="mt-2 w-full rounded-none border-2 border-ink/20 bg-[#0f0c15] px-4 py-3 text-sm text-ink shadow-pixel outline-none transition focus:border-teal"
                placeholder="Optional gateway token"
              />
            </label>

            <label className="flex items-center gap-3 rounded-none border-2 border-ink/15 bg-[#0f0c15] px-4 py-3 text-sm text-ink/72">
              <input
                checked={gatewayDisableDevicePairing}
                onChange={(event) =>
                  setGatewayDisableDevicePairing(event.target.checked)
                }
                type="checkbox"
                className="h-4 w-4 rounded-none border-2 border-ink/40 bg-[#09070d]"
              />
              Disable device pairing
            </label>

            <label className="flex items-center gap-3 rounded-none border-2 border-ink/15 bg-[#0f0c15] px-4 py-3 text-sm text-ink/72">
              <input
                checked={gatewayAllowInsecureTls}
                onChange={(event) =>
                  setGatewayAllowInsecureTls(event.target.checked)
                }
                type="checkbox"
                className="h-4 w-4 rounded-none border-2 border-ink/40 bg-[#09070d]"
              />
              Allow insecure TLS
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-none border-2 border-ink bg-teal px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-[#071111] shadow-pixel disabled:cursor-not-allowed disabled:bg-slate disabled:text-[#f0e5ca]/65"
                disabled={busy}
                onClick={() => void probeGateway()}
              >
                {busy ? "Probing..." : "Run probe"}
              </button>
              <button
                type="button"
                className="rounded-none border-2 border-ink bg-[#1b1526] px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-ink shadow-pixel"
                onClick={() => {
                  setGatewayUrl(openclaw.gateway.url ?? "");
                  setGatewayToken("");
                  setGatewayDisableDevicePairing(false);
                  setGatewayAllowInsecureTls(false);
                }}
              >
                Use detected settings
              </button>
            </div>

            {error ? (
              <div className="rounded-none border-2 border-coral/50 bg-coral/10 px-4 py-3 text-sm text-coral">
                {error}
              </div>
            ) : null}

            <div className="rounded-none border-2 border-ink/15 bg-[#0f0c15] px-4 py-3 text-sm leading-relaxed text-ink/60">
              Use an explicit port. Example: `ws://localhost:3001` or
              `wss://gateway.example.com:443`.
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <article className="rounded-none border-2 border-ink/15 bg-[#120e19] p-4 shadow-pixel">
            <p className="pixel-label">CLI Snapshot</p>
            <div className="mt-4 grid gap-2 text-sm text-ink/72">
              <ProbeLine
                label="Reachable"
                value={openclaw.gateway.reachable ? "Yes" : "No"}
              />
              <ProbeLine label="Mode" value={openclaw.gateway.mode ?? "--"} />
              <ProbeLine
                label="Latency"
                value={
                  typeof openclaw.gateway.connectLatencyMs === "number"
                    ? `${openclaw.gateway.connectLatencyMs}ms`
                    : "--"
                }
              />
              <ProbeLine label="Updated" value={formatDateTime(openclaw.updatedAt)} />
              <ProbeLine
                label="URL"
                value={openclaw.gateway.url ?? "No detected URL"}
              />
            </div>

            {openclaw.gateway.error ? (
              <div className="mt-4 rounded-none border-2 border-coral/45 bg-coral/10 px-4 py-3 text-sm text-coral">
                {openclaw.gateway.error}
              </div>
            ) : null}
          </article>

          <article className="rounded-none border-2 border-ink/15 bg-[#120e19] p-4 shadow-pixel">
            <p className="pixel-label">Probe Result</p>

            {result ? (
              <div className="mt-4 space-y-3">
                <div
                  className={`rounded-none border-2 px-4 py-3 text-sm ${
                    result.reachable
                      ? "border-mint/50 bg-mint/12 text-mint"
                      : "border-coral/50 bg-coral/10 text-coral"
                  }`}
                >
                  {result.message}
                </div>

                <div className="grid gap-2 text-sm text-ink/72">
                  <ProbeLine label="URL" value={result.gatewayUrl} />
                  <ProbeLine label="Secure" value={result.secure ? "wss" : "ws"} />
                  <ProbeLine
                    label="Token supplied"
                    value={result.tokenSupplied ? "Yes" : "No"}
                  />
                  <ProbeLine
                    label="Device pairing"
                    value={result.gatewayDisableDevicePairing ? "Disabled" : "Allowed"}
                  />
                  <ProbeLine
                    label="Insecure TLS"
                    value={result.gatewayAllowInsecureTls ? "Allowed" : "Off"}
                  />
                  <ProbeLine label="Checked" value={formatDateTime(result.checkedAt)} />
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-none border-2 border-dashed border-ink/15 px-4 py-8 text-sm text-ink/52">
                No manual probe yet. Run one from the form on the left to verify a
                target endpoint before you rely on it.
              </div>
            )}
          </article>
        </div>
      </div>
    </section>
  );
}

function OpsCard({
  label,
  value,
  note
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-none border-2 border-ink/15 bg-[#14101c] p-3 shadow-pixel">
      <p className="text-[10px] uppercase tracking-[0.22em] text-ink/48">{label}</p>
      <p className="mt-2 text-xl font-bold text-ink">{value}</p>
      <p className="mt-2 text-xs leading-relaxed text-ink/60">{note}</p>
    </div>
  );
}

function ProbeLine({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-none border-2 border-ink/12 bg-[#0f0c15] px-3 py-2">
      <span className="text-xs uppercase tracking-[0.18em] text-ink/52">{label}</span>
      <span className="text-right text-sm text-ink/82">{value}</span>
    </div>
  );
}
