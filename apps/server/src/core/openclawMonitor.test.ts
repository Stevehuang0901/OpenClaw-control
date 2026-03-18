import { describe, expect, test } from "vitest";

import { normalizeOpenClawStatus, parseOpenClawJson } from "./openclawMonitor";

describe("openclawMonitor", () => {
  test("parses status output with leading warnings", () => {
    const raw = parseOpenClawJson(`
[telegram] warning line here
{
  "sessions": {
    "recent": [
      {
        "agentId": "main",
        "key": "agent:main:main",
        "kind": "direct",
        "sessionId": "session-1",
        "updatedAt": 1773825696917,
        "age": 290601,
        "inputTokens": 1000,
        "outputTokens": 120,
        "cacheRead": 300,
        "cacheWrite": 0,
        "totalTokens": 1420,
        "totalTokensFresh": true,
        "remainingTokens": 10000,
        "percentUsed": 12,
        "model": "gpt-5.4",
        "contextTokens": 120000
      }
    ]
  },
  "usage": {
    "updatedAt": 1773825987876,
    "providers": [
      {
        "provider": "openai-codex",
        "displayName": "Codex",
        "plan": "pro ($0.00)",
        "windows": [
          {
            "label": "5h",
            "usedPercent": 11,
            "resetAt": 1773828269000
          }
        ]
      }
    ]
  },
  "gateway": {
    "mode": "local",
    "url": "ws://127.0.0.1:18789",
    "reachable": false,
    "connectLatencyMs": 67,
    "error": "missing scope: operator.read"
  }
}
    `);

    const status = normalizeOpenClawStatus(raw);

    expect(status.available).toBe(true);
    expect(status.providers[0]?.provider).toBe("openai-codex");
    expect(status.totals.totalTokens).toBe(1420);
    expect(status.recentSessions[0]?.inputTokens).toBe(1000);
    expect(status.gateway.error).toContain("operator.read");
  });
});
