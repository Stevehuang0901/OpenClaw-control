import type { AgentRecord } from "../../../../packages/shared/src/index";

export const seedAgents = (): AgentRecord[] => [
  {
    id: "agent-scout",
    name: "Scout",
    role: "collector",
    token: "collector-scout-token",
    status: "idle",
    currentTaskId: null,
    completedTasks: 0,
    accent: "#58a6a6",
    desk: { x: 16, y: 26 }
  },
  {
    id: "agent-ember",
    name: "Ember",
    role: "collector",
    token: "collector-ember-token",
    status: "idle",
    currentTaskId: null,
    completedTasks: 0,
    accent: "#7ac7b9",
    desk: { x: 50, y: 26 }
  },
  {
    id: "agent-atlas",
    name: "Atlas",
    role: "analyzer",
    token: "analyzer-atlas-token",
    status: "idle",
    currentTaskId: null,
    completedTasks: 0,
    accent: "#f29f58",
    desk: { x: 84, y: 26 }
  },
  {
    id: "agent-prism",
    name: "Prism",
    role: "analyzer",
    token: "analyzer-prism-token",
    status: "idle",
    currentTaskId: null,
    completedTasks: 0,
    accent: "#f3b57a",
    desk: { x: 16, y: 72 }
  },
  {
    id: "agent-quill",
    name: "Quill",
    role: "writer",
    token: "writer-quill-token",
    status: "idle",
    currentTaskId: null,
    completedTasks: 0,
    accent: "#e36d67",
    desk: { x: 50, y: 72 }
  },
  {
    id: "agent-sentinel",
    name: "Sentinel",
    role: "validator",
    token: "validator-sentinel-token",
    status: "idle",
    currentTaskId: null,
    completedTasks: 0,
    accent: "#91c46c",
    desk: { x: 84, y: 72 }
  }
];
