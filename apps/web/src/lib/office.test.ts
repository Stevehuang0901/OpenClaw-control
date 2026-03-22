import { describe, expect, it } from "vitest";

import type { AgentRecord } from "../types/contracts";

import {
  buildIdleSceneAssignments,
  getEligibleIdleScenePrograms,
  resolveAgentSceneState
} from "./office";

const makeAgents = (): AgentRecord[] => [
  {
    id: "agent-atlas",
    name: "Atlas",
    role: "analyzer",
    token: "atlas-token",
    status: "idle",
    currentTaskId: null,
    completedTasks: 0,
    accent: "#f29f58",
    desk: { x: 20, y: 24 }
  },
  {
    id: "agent-ember",
    name: "Ember",
    role: "collector",
    token: "ember-token",
    status: "idle",
    currentTaskId: null,
    completedTasks: 0,
    accent: "#7ac7b9",
    desk: { x: 42, y: 24 }
  },
  {
    id: "agent-prism",
    name: "Prism",
    role: "analyzer",
    token: "prism-token",
    status: "idle",
    currentTaskId: null,
    completedTasks: 0,
    accent: "#f3b57a",
    desk: { x: 64, y: 24 }
  },
  {
    id: "agent-quill",
    name: "Quill",
    role: "writer",
    token: "quill-token",
    status: "idle",
    currentTaskId: null,
    completedTasks: 0,
    accent: "#e36d67",
    desk: { x: 20, y: 62 }
  },
  {
    id: "agent-scout",
    name: "Scout",
    role: "collector",
    token: "scout-token",
    status: "idle",
    currentTaskId: null,
    completedTasks: 0,
    accent: "#58a6a6",
    desk: { x: 42, y: 62 }
  },
  {
    id: "agent-sentinel",
    name: "Sentinel",
    role: "validator",
    token: "sentinel-token",
    status: "idle",
    currentTaskId: null,
    completedTasks: 0,
    accent: "#91c46c",
    desk: { x: 64, y: 62 }
  }
];

describe("office idle scene programs", () => {
  it("never stages a partial mahjong table in quiet programs", () => {
    const quietPrograms = getEligibleIdleScenePrograms(true, 6);

    expect(quietPrograms.length).toBeGreaterThan(0);

    for (const program of quietPrograms) {
      const mahjongSeats = program.slots.filter((slot) => slot.room === "mahjong");

      expect([0, 4]).toContain(mahjongSeats.length);
    }
  });

  it("assigns each idle agent to a unique seat in the mahjong program", () => {
    const quietPrograms = getEligibleIdleScenePrograms(true, 6);
    const mahjongProgram = quietPrograms.find((program) => program.key === "mahjong-round");

    expect(mahjongProgram).toBeTruthy();

    const assignments = buildIdleSceneAssignments(makeAgents(), mahjongProgram!);
    const slotKeys = Object.values(assignments).map((slot) => slot.key);
    const mahjongSeats = Object.values(assignments).filter((slot) => slot.room === "mahjong");

    expect(Object.keys(assignments)).toHaveLength(6);
    expect(new Set(slotKeys).size).toBe(slotKeys.length);
    expect(mahjongSeats).toHaveLength(4);
    expect(assignments["agent-atlas"]?.key).toBe("mahjong-top");
    expect(assignments["agent-ember"]?.key).toBe("mahjong-left");
    expect(assignments["agent-prism"]?.key).toBe("mahjong-right");
    expect(assignments["agent-quill"]?.key).toBe("mahjong-bottom");
    expect(assignments["agent-scout"]?.key).toBe("mahjong-pantry");
    expect(assignments["agent-sentinel"]?.key).toBe("mahjong-desk");
  });

  it("keeps an agent on the same assigned slot even if array order changes", () => {
    const agents = makeAgents();
    const quietPrograms = getEligibleIdleScenePrograms(true, 6);
    const screeningProgram = quietPrograms.find((program) => program.key === "screening-break");

    expect(screeningProgram).toBeTruthy();

    const assignments = buildIdleSceneAssignments(agents, screeningProgram!);
    const atlas = agents[0];
    const stateA = resolveAgentSceneState(
      atlas,
      0,
      null,
      [],
      agents,
      0,
      true,
      6,
      screeningProgram!,
      assignments
    );
    const stateB = resolveAgentSceneState(
      atlas,
      5,
      null,
      [],
      [...agents].reverse(),
      0,
      true,
      6,
      screeningProgram!,
      assignments
    );

    expect(stateA.room).toBe(stateB.room);
    expect(stateA.roomX).toBe(stateB.roomX);
    expect(stateA.roomY).toBe(stateB.roomY);
    expect(stateA.pose).toBe(stateB.pose);
  });
});
