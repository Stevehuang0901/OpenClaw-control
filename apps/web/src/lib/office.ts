import { roleMeta } from "../types/contracts";
import type {
  AgentRecord,
  HandoffRecord,
  TaskRecord
} from "../types/contracts";

export type ScenePose =
  | "cards"
  | "mahjong"
  | "coffee"
  | "sleep"
  | "working"
  | "handoff";

export type SceneFacing = "left" | "right" | "front";
export type SceneRoom = "work" | "cards" | "coffee" | "nap" | "mahjong";

interface IdleActivitySlot {
  key: string;
  x: number;
  y: number;
  room: SceneRoom;
  roomX: number;
  roomY: number;
  pose: ScenePose;
  facing: SceneFacing;
  label: string;
  detail: string;
}

export interface AgentSceneState {
  x: number;
  y: number;
  pose: ScenePose;
  facing: SceneFacing;
  bubble: string | null;
  activityLabel: string;
  activityDetail: string;
  room?: SceneRoom;
  roomX?: number;
  roomY?: number;
}

const idleActivitySlots: IdleActivitySlot[] = [
  {
    key: "cards-west",
    x: 18,
    y: 79,
    room: "cards",
    roomX: 32,
    roomY: 16,
    pose: "cards",
    facing: "right",
    label: "Cards club",
    detail: "Playing a quick hand in the game room until a new request lands."
  },
  {
    key: "cards-east",
    x: 26,
    y: 79,
    room: "cards",
    roomX: 64,
    roomY: 16,
    pose: "cards",
    facing: "left",
    label: "Cards club",
    detail: "Shuffling another hand in the game room while the queue stays quiet."
  },
  {
    key: "coffee-bar",
    x: 43,
    y: 77,
    room: "coffee",
    roomX: 54,
    roomY: 14,
    pose: "coffee",
    facing: "right",
    label: "Tea pantry",
    detail: "Taking a quick tea and coffee reset while the queue stays quiet."
  },
  {
    key: "sleep",
    x: 63,
    y: 78,
    room: "nap",
    roomX: 56,
    roomY: 20,
    pose: "sleep",
    facing: "left",
    label: "Nap pod",
    detail: "Taking a quick recharge in the quiet suite until the next task arrives."
  },
  {
    key: "mahjong-west",
    x: 82,
    y: 79,
    room: "mahjong",
    roomX: 34,
    roomY: 16,
    pose: "mahjong",
    facing: "right",
    label: "Mahjong den",
    detail: "Playing a fast round of mahjong in the play room while the office is idle."
  },
  {
    key: "mahjong-east",
    x: 88,
    y: 79,
    room: "mahjong",
    roomX: 74,
    roomY: 16,
    pose: "mahjong",
    facing: "left",
    label: "Mahjong den",
    detail: "Keeping the mahjong table moving in the play room until the gateway rings."
  }
];

export const resolveAgentSceneState = (
  agent: AgentRecord,
  index: number,
  task: TaskRecord | null,
  handoffs: HandoffRecord[],
  agents: AgentRecord[],
  motionTick = 0
): AgentSceneState => {
  const agentById = new Map(agents.map((entry) => [entry.id, entry]));
  const outgoingHandoff =
    handoffs.find((entry) => entry.fromAgentId === agent.id) ?? null;
  const incomingHandoff =
    handoffs.find((entry) => entry.toAgentId === agent.id) ?? null;

  if (task || agent.status === "thinking") {
    return {
      x: agent.desk.x,
      y: agent.desk.y + 9,
      pose: "working",
      facing: "front",
      bubble: task ? `On it: ${task.title}` : "Reviewing queue",
      activityLabel: "At desk",
      activityDetail: task
        ? `${task.title} is underway at the ${roleMeta[agent.role].label.toLowerCase()} desk.`
        : `${roleMeta[agent.role].label} is monitoring the queue for the next assignment.`,
      room: "work"
    };
  }

  if (outgoingHandoff) {
    const recipient =
      agentById.get(outgoingHandoff.toAgentId)?.name ?? "the next desk";

    return {
      x: interpolate(agent.desk.x, agentById.get(outgoingHandoff.toAgentId)?.desk.x, 0.42),
      y:
        interpolate(agent.desk.y, agentById.get(outgoingHandoff.toAgentId)?.desk.y, 0.42) +
        10,
      pose: "handoff",
      facing:
        (agentById.get(outgoingHandoff.toAgentId)?.desk.x ?? agent.desk.x) >= agent.desk.x
          ? "right"
          : "left",
      bubble: `Packet to ${recipient}!`,
      activityLabel: "In transit",
      activityDetail: `Passing a finished packet over to ${recipient}.`,
      room: "work"
    };
  }

  if (incomingHandoff) {
    const sender =
      agentById.get(incomingHandoff.fromAgentId)?.name ?? "another desk";

    return {
      x: interpolate(agent.desk.x, agentById.get(incomingHandoff.fromAgentId)?.desk.x, 0.18),
      y:
        interpolate(agent.desk.y, agentById.get(incomingHandoff.fromAgentId)?.desk.y, 0.18) +
        9,
      pose: "handoff",
      facing:
        (agentById.get(incomingHandoff.fromAgentId)?.desk.x ?? agent.desk.x) >= agent.desk.x
          ? "right"
          : "left",
      bubble: `Incoming from ${sender}!`,
      activityLabel: "Packet intake",
      activityDetail: `Waiting for ${sender} to finish the handoff and open the next step.`,
      room: "work"
    };
  }

  const idlePhase = Math.floor(motionTick / 7000);
  const slot = idleActivitySlots[(index + idlePhase) % idleActivitySlots.length];
  return {
    x: slot.x,
    y: slot.y,
    pose: slot.pose,
    facing: slot.facing,
    bubble: null,
    activityLabel: slot.label,
    activityDetail: slot.detail,
    room: slot.room,
    roomX: slot.roomX,
    roomY: slot.roomY
  };
};

const interpolate = (
  start: number,
  end: number | undefined,
  ratio: number
) => {
  if (typeof end !== "number") {
    return start;
  }

  return start + (end - start) * ratio;
};
