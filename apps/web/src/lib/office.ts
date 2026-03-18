import { roleMeta } from "../types/contracts";
import type {
  AgentRecord,
  HandoffRecord,
  TaskRecord
} from "../types/contracts";

export type ScenePose =
  | "cards"
  | "mahjong"
  | "arcade"
  | "sleep"
  | "working"
  | "handoff";

interface IdleActivitySlot {
  key: string;
  x: number;
  y: number;
  pose: ScenePose;
  label: string;
  detail: string;
}

export interface AgentSceneState {
  x: number;
  y: number;
  pose: ScenePose;
  bubble: string | null;
  activityLabel: string;
  activityDetail: string;
}

const idleActivitySlots: IdleActivitySlot[] = [
  {
    key: "cards-west",
    x: 20,
    y: 83,
    pose: "cards",
    label: "Cards table",
    detail: "Playing cards on standby until a new request lands."
  },
  {
    key: "cards-east",
    x: 30,
    y: 83,
    pose: "cards",
    label: "Cards table",
    detail: "Shuffling another hand while the queue stays quiet."
  },
  {
    key: "arcade",
    x: 49,
    y: 82,
    pose: "arcade",
    label: "Arcade cabinet",
    detail: "Camping by the arcade machine with one eye on the gateway."
  },
  {
    key: "sleep",
    x: 61,
    y: 70,
    pose: "sleep",
    label: "Nap nook",
    detail: "Taking a quick beanbag nap until the next task arrives."
  },
  {
    key: "mahjong-west",
    x: 76,
    y: 83,
    pose: "mahjong",
    label: "Mahjong table",
    detail: "Playing a fast round of mahjong while the office is idle."
  },
  {
    key: "mahjong-east",
    x: 86,
    y: 83,
    pose: "mahjong",
    label: "Mahjong table",
    detail: "Keeping the mahjong game moving until the gateway rings."
  }
];

export const resolveAgentSceneState = (
  agent: AgentRecord,
  index: number,
  task: TaskRecord | null,
  handoffs: HandoffRecord[],
  agents: AgentRecord[]
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
      bubble: task ? `On it: ${task.title}` : "Reviewing queue",
      activityLabel: "At desk",
      activityDetail: task
        ? `${task.title} is underway at the ${roleMeta[agent.role].label.toLowerCase()} desk.`
        : `${roleMeta[agent.role].label} is monitoring the queue for the next assignment.`
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
      bubble: `Packet to ${recipient}!`,
      activityLabel: "In transit",
      activityDetail: `Passing a finished packet over to ${recipient}.`
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
      bubble: `Incoming from ${sender}!`,
      activityLabel: "Packet intake",
      activityDetail: `Waiting for ${sender} to finish the handoff and open the next step.`
    };
  }

  const slot = idleActivitySlots[index % idleActivitySlots.length];
  return {
    x: slot.x,
    y: slot.y,
    pose: slot.pose,
    bubble: null,
    activityLabel: slot.label,
    activityDetail: slot.detail
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
