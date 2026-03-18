import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  emptyOpenClawStatus,
  type OpenClawProviderUsage,
  type OpenClawSessionUsage,
  type OpenClawStatusSnapshot
} from "../../../../packages/shared/src/index";

const execFileAsync = promisify(execFile);

export const fetchOpenClawStatus = async (): Promise<OpenClawStatusSnapshot> => {
  try {
    const { stdout, stderr } = await execFileAsync("openclaw", [
      "status",
      "--usage",
      "--json"
    ]);

    const raw = parseOpenClawJson(`${stdout}\n${stderr}`);
    return normalizeOpenClawStatus(raw);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to query OpenClaw.";

    return {
      ...emptyOpenClawStatus(),
      error: message
    };
  }
};

export const parseOpenClawJson = (value: string) => {
  const trimmed = value.trim();
  const startIndex = trimmed.indexOf("{");
  const endIndex = trimmed.lastIndexOf("}");

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error("OpenClaw status output did not contain a JSON object.");
  }

  return JSON.parse(trimmed.slice(startIndex, endIndex + 1)) as Record<string, unknown>;
};

export const normalizeOpenClawStatus = (
  raw: Record<string, unknown>
): OpenClawStatusSnapshot => {
  const usage = asRecord(raw.usage);
  const sessions = asRecord(raw.sessions);
  const gateway = asRecord(raw.gateway);

  const providers = Array.isArray(usage.providers)
    ? (usage.providers as Array<Record<string, unknown>>).map(normalizeProvider)
    : [];

  const recentSessions = Array.isArray(sessions.recent)
    ? (sessions.recent as Array<Record<string, unknown>>).map(normalizeSession)
    : [];

  const percentValues = recentSessions
    .map((session) => session.percentUsed)
    .filter((value): value is number => typeof value === "number");

  return {
    available: true,
    source: "cli",
    updatedAt: normalizeTimestampNumber(usage.updatedAt),
    error: typeof gateway.error === "string" ? gateway.error : null,
    providers,
    recentSessions,
    totals: {
      recentSessionCount: recentSessions.length,
      inputTokens: sum(recentSessions, "inputTokens"),
      outputTokens: sum(recentSessions, "outputTokens"),
      cacheRead: sum(recentSessions, "cacheRead"),
      cacheWrite: sum(recentSessions, "cacheWrite"),
      totalTokens: sum(recentSessions, "totalTokens"),
      averagePercentUsed:
        percentValues.length === 0
          ? 0
          : Math.round(
              percentValues.reduce((total, value) => total + value, 0) /
                percentValues.length
            )
    },
    gateway: {
      mode: typeof gateway.mode === "string" ? gateway.mode : null,
      url: typeof gateway.url === "string" ? gateway.url : null,
      reachable: Boolean(gateway.reachable),
      connectLatencyMs:
        typeof gateway.connectLatencyMs === "number"
          ? gateway.connectLatencyMs
          : null,
      error: typeof gateway.error === "string" ? gateway.error : null
    }
  };
};

const normalizeProvider = (provider: Record<string, unknown>): OpenClawProviderUsage => ({
  provider: typeof provider.provider === "string" ? provider.provider : "unknown",
  displayName:
    typeof provider.displayName === "string"
      ? provider.displayName
      : typeof provider.provider === "string"
        ? provider.provider
        : "Unknown",
  plan: typeof provider.plan === "string" ? provider.plan : null,
  windows: Array.isArray(provider.windows)
    ? provider.windows.map((window) => ({
        label:
          typeof (window as Record<string, unknown>).label === "string"
            ? ((window as Record<string, unknown>).label as string)
            : "window",
        usedPercent:
          typeof (window as Record<string, unknown>).usedPercent === "number"
            ? ((window as Record<string, unknown>).usedPercent as number)
            : 0,
        resetAt:
          typeof (window as Record<string, unknown>).resetAt === "number"
            ? ((window as Record<string, unknown>).resetAt as number)
            : null
      }))
    : []
});

const normalizeSession = (session: Record<string, unknown>): OpenClawSessionUsage => ({
  agentId: typeof session.agentId === "string" ? session.agentId : "unknown",
  key: typeof session.key === "string" ? session.key : "unknown",
  kind: typeof session.kind === "string" ? session.kind : "session",
  sessionId: typeof session.sessionId === "string" ? session.sessionId : "unknown",
  updatedAt: typeof session.updatedAt === "number" ? session.updatedAt : Date.now(),
  ageMs: typeof session.age === "number" ? session.age : null,
  inputTokens: numberOrZero(session.inputTokens),
  outputTokens: numberOrZero(session.outputTokens),
  cacheRead: numberOrZero(session.cacheRead),
  cacheWrite: numberOrZero(session.cacheWrite),
  totalTokens: numberOrZero(session.totalTokens),
  totalTokensFresh: Boolean(session.totalTokensFresh),
  remainingTokens:
    typeof session.remainingTokens === "number" ? session.remainingTokens : null,
  percentUsed: typeof session.percentUsed === "number" ? session.percentUsed : null,
  model: typeof session.model === "string" ? session.model : null,
  contextTokens:
    typeof session.contextTokens === "number" ? session.contextTokens : null
});

const numberOrZero = (value: unknown) => (typeof value === "number" ? value : 0);

const normalizeTimestampNumber = (value: unknown) =>
  typeof value === "number" ? new Date(value).toISOString() : null;

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

const sum = <Key extends keyof OpenClawSessionUsage>(
  sessions: OpenClawSessionUsage[],
  key: Key
) =>
  sessions.reduce((total, session) => {
    const value = session[key];
    return total + (typeof value === "number" ? value : 0);
  }, 0);
