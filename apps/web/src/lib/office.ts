import { roleMeta } from "../types/contracts";
import type {
  AgentRecord,
  HandoffRecord,
  TaskRecord
} from "../types/contracts";

export type ScenePose =
  | "game"
  | "mahjong"
  | "coffee"
  | "sleep"
  | "desk"
  | "walk"
  | "working"
  | "handoff";

export type SceneFacing = "left" | "right" | "front";
export type SceneRoom = "work" | "cards" | "coffee" | "nap" | "mahjong";

interface IdleActivitySlot {
  key: string;
  room: SceneRoom;
  pose: ScenePose;
  facing: SceneFacing;
  label: string;
  detail: string;
  x?: number;
  y?: number;
  roomX?: number;
  roomY?: number;
  useDeskAnchor?: boolean;
  deskOffsetX?: number;
  deskOffsetY?: number;
}

export interface IdleSceneProgram {
  key: string;
  room: SceneRoom;
  label: string;
  detail: string;
  durationMs: number;
  minIdleAgents: number;
  conversation: string[];
  slots: IdleActivitySlot[];
}

export type IdleSceneAssignments = Record<string, IdleActivitySlot>;

export interface AgentSceneState {
  x: number;
  y: number;
  pose: ScenePose;
  facing: SceneFacing;
  anchorKey?: string;
  bubble: string | null;
  activityLabel: string;
  activityDetail: string;
  room?: SceneRoom;
  roomX?: number;
  roomY?: number;
}

const roomSlot = (
  key: string,
  room: SceneRoom,
  roomX: number,
  roomY: number,
  pose: ScenePose,
  facing: SceneFacing,
  label: string,
  detail: string
): IdleActivitySlot => ({
  key,
  room,
  roomX,
  roomY,
  pose,
  facing,
  label,
  detail
});

const deskSlot = (
  key: string,
  label: string,
  detail: string,
  facing: SceneFacing = "front",
  deskOffsetX = 0,
  deskOffsetY = 5
): IdleActivitySlot => ({
  key,
  room: "work",
  pose: "desk",
  facing,
  label,
  detail,
  useDeskAnchor: true,
  deskOffsetX,
  deskOffsetY
});

const walkSlot = (
  key: string,
  x: number,
  y: number,
  facing: SceneFacing,
  label: string,
  detail: string
): IdleActivitySlot => ({
  key,
  room: "work",
  x,
  y,
  pose: "walk",
  facing,
  label,
  detail
});

const roomCapacity: Record<SceneRoom, number> = {
  work: 6,
  cards: 2,
  coffee: 2,
  nap: 1,
  mahjong: 4
};

const activeIdlePrograms: IdleSceneProgram[] = [
  {
    key: "desk-watch",
    room: "work",
    label: "Desk watch",
    detail: "Idle hands stay on the floor, keep the lanes clear, and hold the office ready for the next packet.",
    durationMs: 32000,
    minIdleAgents: 2,
    conversation: ["Queue is light.", "Keep the aisle open.", "We can pick up fast."],
    slots: [
      deskSlot(
        "desk-watch-a",
        "Desk watch",
        "Holding the home desk and following the live output."
      ),
      walkSlot(
        "desk-watch-west",
        34,
        48,
        "right",
        "Floor walk",
        "Walking the west aisle to keep sightlines open."
      ),
      roomSlot(
        "desk-watch-bar",
        "coffee",
        34,
        28,
        "coffee",
        "right",
        "Tea pantry",
        "Pulling a quick coffee while still watching the floor."
      ),
      deskSlot(
        "desk-watch-b",
        "Desk watch",
        "Staying close to the monitor for a fast reassignment.",
        "front",
        0,
        4
      ),
      walkSlot(
        "desk-watch-east",
        66,
        54,
        "left",
        "Floor walk",
        "Crossing the east aisle and checking the live desks."
      ),
      roomSlot(
        "desk-watch-cooler",
        "coffee",
        52,
        58,
        "coffee",
        "front",
        "Pantry refill",
        "Topping up water before returning to the work floor."
      )
    ]
  },
  {
    key: "queue-reset",
    room: "work",
    label: "Queue reset",
    detail: "The office is still live, so idle lobsters hover near desks, pantry, and the center corridor instead of disappearing into side rooms.",
    durationMs: 28000,
    minIdleAgents: 3,
    conversation: ["Next packet can land anytime.", "Keep the board visible.", "No one drift too far."],
    slots: [
      walkSlot(
        "queue-reset-north",
        49,
        40,
        "left",
        "Floor walk",
        "Looping the north aisle while the queue settles."
      ),
      deskSlot(
        "queue-reset-a",
        "Desk watch",
        "Holding position by the monitor and current notes."
      ),
      roomSlot(
        "queue-reset-bar",
        "coffee",
        50,
        58,
        "coffee",
        "front",
        "Tea pantry",
        "Refilling a mug in the pantry between assignments."
      ),
      walkSlot(
        "queue-reset-south",
        52,
        62,
        "right",
        "Floor walk",
        "Cutting through the south aisle before the next handoff."
      ),
      deskSlot(
        "queue-reset-b",
        "Desk watch",
        "Standing by at the desk so a task can open immediately.",
        "front",
        0,
        4
      ),
      deskSlot(
        "queue-reset-c",
        "Desk watch",
        "Keeping the office floor anchored while other desks move."
      )
    ]
  },
  {
    key: "pantry-loop",
    room: "coffee",
    label: "Pantry loop",
    detail: "Even while work is flowing, the pantry stays active and the spare lobsters orbit between refills and the main aisle.",
    durationMs: 30000,
    minIdleAgents: 4,
    conversation: ["Fresh pot is ready.", "Leave one seat open.", "Back on the floor in a sec."],
    slots: [
      roomSlot(
        "pantry-loop-bar",
        "coffee",
        34,
        28,
        "coffee",
        "right",
        "Coffee run",
        "Running the machine for a quick refill."
      ),
      roomSlot(
        "pantry-loop-cooler",
        "coffee",
        52,
        58,
        "coffee",
        "front",
        "Water run",
        "Stopping by the water dispenser before heading back."
      ),
      walkSlot(
        "pantry-loop-west",
        36,
        56,
        "right",
        "Floor walk",
        "Walking a short lap with a fresh cup."
      ),
      deskSlot(
        "pantry-loop-a",
        "Desk watch",
        "Waiting at the desk while the office stays active."
      ),
      walkSlot(
        "pantry-loop-east",
        64,
        44,
        "left",
        "Floor walk",
        "Crossing back toward the center aisle."
      ),
      deskSlot(
        "pantry-loop-b",
        "Desk watch",
        "Keeping one desk warm for the next request.",
        "front",
        0,
        4
      )
    ]
  }
];

const quietIdlePrograms: IdleSceneProgram[] = [
  {
    key: "screening-break",
    room: "cards",
    label: "Screening break",
    detail: "The queue is empty, so two lobsters took the screening lounge while the rest of the office split cleanly between pantry, quiet pod, and a light work-floor hold.",
    durationMs: 42000,
    minIdleAgents: 6,
    conversation: ["Trailer queue looks good.", "Keep one desk warm.", "Tea first, then back to the floor."],
    slots: [
      roomSlot(
        "screening-left",
        "cards",
        35,
        30,
        "game",
        "right",
        "Screening lounge",
        "Settled into the left sofa seat for a short screening break."
      ),
      roomSlot(
        "screening-right",
        "cards",
        65,
        30,
        "game",
        "left",
        "Screening lounge",
        "Holding the right sofa seat while the office stays calm."
      ),
      roomSlot(
        "screening-bar",
        "coffee",
        34,
        28,
        "coffee",
        "right",
        "Tea pantry",
        "Running a fast tea refill before heading back out."
      ),
      roomSlot(
        "screening-nap",
        "nap",
        56,
        24,
        "sleep",
        "left",
        "Nap pod",
        "Taking a short recharge in the quiet pod."
      ),
      deskSlot(
        "screening-desk",
        "Desk watch",
        "Keeping one station live so the office can snap back instantly."
      ),
      walkSlot(
        "screening-aisle",
        52,
        58,
        "left",
        "Floor walk",
        "Looping the aisle so the quiet office still feels staffed."
      )
    ]
  },
  {
    key: "mahjong-round",
    room: "mahjong",
    label: "Mahjong round",
    detail: "The office fully committed to one real mahjong table: four seats filled, one pantry runner, and one desk still holding the floor.",
    durationMs: 46000,
    minIdleAgents: 6,
    conversation: ["East wind again?", "Keep the tiles square.", "Loser refills the tea."],
    slots: [
      roomSlot(
        "mahjong-top",
        "mahjong",
        50,
        64,
        "mahjong",
        "front",
        "Mahjong room",
        "Holding the head seat and reading the table."
      ),
      roomSlot(
        "mahjong-left",
        "mahjong",
        16,
        38,
        "mahjong",
        "right",
        "Mahjong room",
        "Working the west side of the table in a quiet round."
      ),
      roomSlot(
        "mahjong-right",
        "mahjong",
        84,
        38,
        "mahjong",
        "left",
        "Mahjong room",
        "Covering the east side while the office stays still."
      ),
      roomSlot(
        "mahjong-bottom",
        "mahjong",
        50,
        12,
        "mahjong",
        "front",
        "Mahjong room",
        "Anchoring the south seat and keeping the round honest."
      ),
      roomSlot(
        "mahjong-pantry",
        "coffee",
        34,
        28,
        "coffee",
        "right",
        "Tea pantry",
        "Pouring tea for the table before the next draw."
      ),
      deskSlot(
        "mahjong-desk",
        "Desk watch",
        "Keeping one desk visibly on standby while the table runs."
      )
    ]
  },
  {
    key: "tea-reset",
    room: "coffee",
    label: "Tea reset",
    detail: "The queue cleared, so the office settled into a believable reset: pantry traffic, one lounge seat, one nap pod, and two lobsters still near the floor.",
    durationMs: 38000,
    minIdleAgents: 6,
    conversation: ["Who restocked the beans?", "One of us stay near the board.", "Ping me if approvals wake up."],
    slots: [
      roomSlot(
        "tea-reset-bar",
        "coffee",
        34,
        28,
        "coffee",
        "right",
        "Coffee bar",
        "Pulling espresso at the bar before heading back out."
      ),
      roomSlot(
        "tea-reset-cooler",
        "coffee",
        52,
        58,
        "coffee",
        "front",
        "Water station",
        "Refilling water in the pantry."
      ),
      roomSlot(
        "tea-reset-lounge",
        "cards",
        35,
        30,
        "game",
        "right",
        "Screening lounge",
        "Holding the left sofa seat while the floor resets."
      ),
      roomSlot(
        "tea-reset-nap",
        "nap",
        56,
        24,
        "sleep",
        "left",
        "Nap pod",
        "Taking a short quiet reset off the main floor."
      ),
      deskSlot(
        "tea-reset-desk",
        "Desk watch",
        "Holding the main desk while the rest of the team resets."
      ),
      walkSlot(
        "tea-reset-aisle",
        48,
        56,
        "right",
        "Floor walk",
        "Crossing the aisle and keeping the work floor feeling occupied."
      )
    ]
  }
];

const validateIdlePrograms = (programs: IdleSceneProgram[]) => {
  for (const program of programs) {
    const roomOccupancy = program.slots.reduce<Record<SceneRoom, number>>(
      (counts, slot) => ({
        ...counts,
        [slot.room]: counts[slot.room] + 1
      }),
      {
        work: 0,
        cards: 0,
        coffee: 0,
        nap: 0,
        mahjong: 0
      }
    );

    for (const [room, count] of Object.entries(roomOccupancy) as [SceneRoom, number][]) {
      if (count > roomCapacity[room]) {
        throw new Error(
          `Idle scene program "${program.key}" exceeds ${room} capacity (${count}/${roomCapacity[room]}).`
        );
      }
    }

    if (roomOccupancy.mahjong !== 0 && roomOccupancy.mahjong !== roomCapacity.mahjong) {
      throw new Error(
        `Idle scene program "${program.key}" must either leave mahjong empty or fill all four seats.`
      );
    }
  }
};

validateIdlePrograms([...activeIdlePrograms, ...quietIdlePrograms]);

export const getEligibleIdleScenePrograms = (
  officeIsQuiet = true,
  idleAgentCount = 0
) => {
  const programs = officeIsQuiet ? quietIdlePrograms : activeIdlePrograms;
  const eligiblePrograms = programs.filter((program) => idleAgentCount >= program.minIdleAgents);

  return eligiblePrograms.length > 0 ? eligiblePrograms : programs;
};

export const getIdleSceneProgram = (
  motionTick = 0,
  officeIsQuiet = true,
  idleAgentCount = 0
): IdleSceneProgram => {
  const programs = getEligibleIdleScenePrograms(officeIsQuiet, idleAgentCount);
  const phase = Math.floor(motionTick / 7000);

  return programs[phase % programs.length];
};

export const getNextIdleSceneProgram = (
  previousKey: string | null,
  officeIsQuiet = true,
  idleAgentCount = 0
) => {
  const programs = getEligibleIdleScenePrograms(officeIsQuiet, idleAgentCount);

  if (programs.length === 0) {
    return null;
  }

  if (!previousKey) {
    return programs[0];
  }

  const currentIndex = programs.findIndex((program) => program.key === previousKey);
  return programs[(currentIndex + 1 + programs.length) % programs.length];
};

export const resolveAgentSceneState = (
  agent: AgentRecord,
  index: number,
  task: TaskRecord | null,
  handoffs: HandoffRecord[],
  agents: AgentRecord[],
  motionTick = 0,
  officeIsQuiet = true,
  idleAgentCount = 0,
  idleProgramOverride: IdleSceneProgram | null = null,
  idleAssignments: IdleSceneAssignments | null = null
): AgentSceneState => {
  const agentById = new Map(agents.map((entry) => [entry.id, entry]));
  const outgoingHandoff =
    handoffs.find((entry) => entry.fromAgentId === agent.id) ?? null;
  const incomingHandoff =
    handoffs.find((entry) => entry.toAgentId === agent.id) ?? null;

  if (task || agent.status === "thinking") {
    return {
      x: agent.desk.x,
      y: agent.desk.y + 5,
      pose: "working",
      facing: "front",
      anchorKey: undefined,
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
        6,
      pose: "handoff",
      facing:
        (agentById.get(outgoingHandoff.toAgentId)?.desk.x ?? agent.desk.x) >= agent.desk.x
          ? "right"
          : "left",
      anchorKey: undefined,
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
        5,
      pose: "handoff",
      facing:
        (agentById.get(incomingHandoff.fromAgentId)?.desk.x ?? agent.desk.x) >= agent.desk.x
          ? "right"
          : "left",
      anchorKey: undefined,
      bubble: `Incoming from ${sender}!`,
      activityLabel: "Packet intake",
      activityDetail: `Waiting for ${sender} to finish the handoff and open the next step.`,
      room: "work"
    };
  }

  const idleProgram =
    idleProgramOverride ?? getIdleSceneProgram(motionTick, officeIsQuiet, idleAgentCount);
  const handoffAgentIds = new Set(
    handoffs.flatMap((entry) => [entry.fromAgentId, entry.toAgentId])
  );
  const idleAgents = agents.filter(
    (entry) => entry.status === "idle" && !entry.currentTaskId && !handoffAgentIds.has(entry.id)
  );
  const idleIndex = idleAgents.findIndex((entry) => entry.id === agent.id);
  const fallbackSlotIndex = idleIndex >= 0 ? idleIndex : index;
  const slot =
    idleAssignments?.[agent.id] ??
    idleProgram.slots[fallbackSlotIndex % idleProgram.slots.length];
  const x = slot.useDeskAnchor
    ? agent.desk.x + (slot.deskOffsetX ?? 0)
    : slot.x ?? agent.desk.x;
  const y = slot.useDeskAnchor
    ? agent.desk.y + (slot.deskOffsetY ?? 5)
    : slot.y ?? agent.desk.y + 5;

  return {
    x,
    y,
    pose: slot.pose,
    facing: slot.facing,
    anchorKey: slot.key,
    bubble: null,
    activityLabel: slot.label,
    activityDetail: slot.detail,
    room: slot.room,
    roomX: slot.roomX,
    roomY: slot.roomY
  };
};

export const buildIdleSceneAssignments = (
  idleAgents: AgentRecord[],
  idleProgram: IdleSceneProgram
): IdleSceneAssignments => {
  const orderedAgents = [...idleAgents].sort(compareIdleAgents);
  const assignments: IdleSceneAssignments = {};

  for (const [index, agent] of orderedAgents.entries()) {
    const slot = idleProgram.slots[index];

    if (!slot) {
      break;
    }

    assignments[agent.id] = slot;
  }

  return assignments;
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

const compareIdleAgents = (left: AgentRecord, right: AgentRecord) =>
  left.desk.y - right.desk.y ||
  left.desk.x - right.desk.x ||
  left.name.localeCompare(right.name) ||
  left.id.localeCompare(right.id);
