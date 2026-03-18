import { describe, expect, test, vi } from "vitest";

import { buildGateway } from "./gateway";
import { seedAgents } from "../data/seedAgents";

describe("Gateway", () => {
  test("runs a workflow through all agent stages", async () => {
    vi.useFakeTimers();

    const gateway = buildGateway(seedAgents(), {
      durationMultiplier: 0.02,
      handoffDurationMs: 20
    });

    gateway.submitWorkflow("Implement a multi-agent office dashboard.");

    await vi.advanceTimersByTimeAsync(2_000);

    const snapshot = gateway.getSnapshot();
    expect(snapshot.workflows).toHaveLength(1);
    expect(snapshot.workflows[0]?.status).toBe("completed");
    expect(snapshot.workflows[0]?.finalOutput).toContain("Workflow");
    expect(snapshot.metrics.completedWorkflows).toBe(1);
    expect(snapshot.messages.some((message) => message.kind === "handoff")).toBe(true);

    vi.useRealTimers();
  });
});
