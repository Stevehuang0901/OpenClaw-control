import { useEffect, useMemo, useRef, type CSSProperties } from "react";

import type { SceneFacing, ScenePose, SceneRoom } from "../lib/office";
import type { AgentRecord } from "../types/contracts";
import type { OverlayRoomStatusTone } from "./officeWorldOverlay";

interface OfficeWorld3DZone {
  room: SceneRoom;
  label: string;
  status: string;
  statusTone: OverlayRoomStatusTone;
  active: boolean;
}

interface OfficeWorld3DAgent {
  id: string;
  name: string;
  accent: string;
  role: AgentRecord["role"];
  status: AgentRecord["status"];
  scene: {
    x: number;
    y: number;
    pose: ScenePose;
    facing: SceneFacing;
    anchorKey?: string;
    room?: SceneRoom;
    roomX?: number;
    roomY?: number;
  };
}

interface OfficeWorld3DDesk {
  id: string;
  name: string;
  accent: string;
  role: AgentRecord["role"];
  desk: AgentRecord["desk"];
  active: boolean;
}

interface OfficeWorld3DProps {
  agents: OfficeWorld3DAgent[];
  desks: OfficeWorld3DDesk[];
  zones: OfficeWorld3DZone[];
  conversation: string | null;
  selectedAgentId?: string | null;
  onSelectRoom?: (room: SceneRoom) => void;
  onSelectAgent?: (agentId: string) => void;
}

interface RoomLayout {
  bounds: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  badge: {
    left: number;
    top: number;
  };
  caption: {
    left: number;
    top: number;
  };
  fallbackSlots: Array<{ x: number; y: number }>;
}

interface AgentPlacement {
  agent: OfficeWorld3DAgent;
  room: SceneRoom;
  left: number;
  top: number;
  zIndex: number;
  pose: ScenePose;
  facing: SceneFacing;
  action: AgentAction;
}

type AgentState =
  | "seated"
  | "stretch"
  | "walking"
  | "acting"
  | "returning"
  | "inter_room_walk";

type AgentAction =
  | "typing"
  | "coding"
  | "playing_mahjong"
  | "making_tea"
  | "watching"
  | "idle";

interface SceneAgent {
  id: string;
  room: SceneRoom;
  homeRoom: SceneRoom;
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  state: AgentState;
  action: AgentAction;
  targetX: number;
  targetY: number;
  stateTimer: number;
  walkFrame: number;
  dir: 1 | -1;
  shirt: string;
  pants: string;
  hair: string;
  skin: string;
  waypoints: Array<{ x: number; y: number }>;
  currentWaypoint: number;
  pendingRoom: SceneRoom | null;
  postInterRoomState: AgentState | null;
  activeDoorIndex: number | null;
}

interface SceneCharacterDraw {
  y: number;
  draw: () => void;
}

interface SceneLayerDraw {
  draw: () => void;
}

type SceneForegroundDraw = SceneLayerDraw;

interface SceneDrawLayers {
  back: SceneLayerDraw[];
  chairs: SceneLayerDraw[];
  surfaces: SceneLayerDraw[];
  characters: SceneCharacterDraw[];
  foreground: SceneForegroundDraw[];
}

interface MotionBounds {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface MotionZone {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface DoorConnection {
  from: SceneRoom;
  to: SceneRoom;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface SceneSteamParticle {
  x: number;
  y: number;
  alpha: number;
  age: number;
}

interface SceneRuntime {
  mahjongCycle: number;
  mahjongActiveIndex: number;
  loungeCycle: number;
  loungeRaisedIndex: number;
  steamParticles: SceneSteamParticle[];
}

const STAGE_WIDTH = 880;
const STAGE_HEIGHT = 560;
const DESK_WIDTH = 44;
const DESK_HEIGHT = 24;
const MONITOR_WIDTH = 24;
const MONITOR_HEIGHT = 18;
const CHAIR_OFFSET = 26;
const CHAIR_WIDTH = 50;
const CHAIR_HEIGHT = 12;
const MAHJONG_ROOM_X = 18;
const MAHJONG_ROOM_Y = 60;
const MAHJONG_ROOM_WIDTH = 238;
const MAHJONG_ROOM_HEIGHT = 184;
const MAHJONG_TABLE_SIZE = 80;
const MAHJONG_TABLE_X = Math.round(MAHJONG_ROOM_X + (MAHJONG_ROOM_WIDTH - MAHJONG_TABLE_SIZE) / 2);
const MAHJONG_TABLE_Y = Math.round(MAHJONG_ROOM_Y + (MAHJONG_ROOM_HEIGHT - MAHJONG_TABLE_SIZE) / 2);
const MAHJONG_TABLE_CENTER_X = MAHJONG_TABLE_X + MAHJONG_TABLE_SIZE / 2;
const MAHJONG_TABLE_CENTER_Y = MAHJONG_TABLE_Y + MAHJONG_TABLE_SIZE / 2;
const PANTRY_KETTLE_X = 305;
const PANTRY_KETTLE_Y = 138;

const WORK_FLOOR_BOUNDS = { x1: 395, y1: 262, x2: 708, y2: 455 } as const;
const MAHJONG_BOUNDS = { x1: 25, y1: 65, x2: 248, y2: 238 } as const;
const PANTRY_BOUNDS = { x1: 268, y1: 20, x2: 452, y2: 238 } as const;
const QUIET_BOUNDS = { x1: 472, y1: 62, x2: 668, y2: 238 } as const;
const LOUNGE_BOUNDS = { x1: 22, y1: 256, x2: 358, y2: 458 } as const;

const MAHJONG_TABLE_AVOID = { x: 98, y: 145, w: 104, h: 70 } as const;
const WORK_DESK_ROW1_AVOID = { x: 390, y: 305, w: 325, h: 45 } as const;
const WORK_DESK_ROW2_AVOID = { x: 390, y: 365, w: 325, h: 40 } as const;
const LOUNGE_SOFA_AVOID = { x: 128, y: 385, w: 140, h: 55 } as const;
const QUIET_DESK_AVOID = { x: 515, y: 155, w: 125, h: 45 } as const;
const WORK_ROAM = [
  { x: 395, y: 460, label: "bottom_left_corner" },
  { x: 700, y: 460, label: "bottom_right_corner" },
  { x: 550, y: 268, label: "top_middle" },
  { x: 410, y: 350, label: "between_desks" }
] as const;
const DOORS: DoorConnection[] = [
  { from: "mahjong", to: "coffee", x: 256, y: 168, w: 8, h: 40 },
  { from: "coffee", to: "nap", x: 460, y: 108, w: 8, h: 44 },
  { from: "mahjong", to: "cards", x: 90, y: 244, w: 55, h: 12 },
  { from: "coffee", to: "work", x: 302, y: 244, w: 72, h: 12 },
  { from: "nap", to: "work", x: 576, y: 244, w: 55, h: 12 },
  { from: "cards", to: "work", x: 374, y: 338, w: 12, h: 57 }
];

const ROOM_MOTION: Record<
  SceneRoom,
  {
    bounds: MotionBounds;
    avoidZones: MotionZone[];
    actionPoints: Array<{ x: number; y: number }>;
  }
> = {
  mahjong: {
    bounds: MAHJONG_BOUNDS,
    avoidZones: [MAHJONG_TABLE_AVOID],
    actionPoints: [
      { x: 42, y: 112 },
      { x: 226, y: 108 },
      { x: 48, y: 214 },
      { x: 224, y: 214 }
    ]
  },
  coffee: {
    bounds: PANTRY_BOUNDS,
    avoidZones: [],
    actionPoints: [
      { x: 444, y: 122 },
      { x: 332, y: 172 },
      { x: 416, y: 174 }
    ]
  },
  nap: {
    bounds: QUIET_BOUNDS,
    avoidZones: [QUIET_DESK_AVOID],
    actionPoints: [
      { x: 662, y: 168 },
      { x: 660, y: 206 }
    ]
  },
  cards: {
    bounds: LOUNGE_BOUNDS,
    avoidZones: [LOUNGE_SOFA_AVOID],
    actionPoints: [
      { x: 58, y: 322 },
      { x: 312, y: 282 }
    ]
  },
  work: {
    bounds: WORK_FLOOR_BOUNDS,
    avoidZones: [WORK_DESK_ROW1_AVOID, WORK_DESK_ROW2_AVOID],
    actionPoints: [
      { x: 398, y: 276 },
      { x: 704, y: 276 },
      { x: 504, y: 354 },
      { x: 596, y: 354 },
      { x: 650, y: 424 }
    ]
  }
};

const ROOM_LAYOUT: Record<SceneRoom, RoomLayout> = {
  mahjong: {
    bounds: { left: 2, top: 10.5, width: 27, height: 33 },
    badge: { left: 2, top: 7 },
    caption: { left: 5, top: 13 },
    fallbackSlots: [
      { x: 32, y: 54 },
      { x: 50, y: 28 },
      { x: 68, y: 54 },
      { x: 50, y: 75 }
    ]
  },
  coffee: {
    bounds: { left: 30, top: 2.5, width: 22.5, height: 42 },
    badge: { left: 31.5, top: 0.5 },
    caption: { left: 32.5, top: 7 },
    fallbackSlots: [
      { x: 30, y: 68 },
      { x: 58, y: 64 },
      { x: 74, y: 84 }
    ]
  },
  nap: {
    bounds: { left: 53, top: 10, width: 29, height: 34 },
    badge: { left: 69, top: 7 },
    caption: { left: 55.5, top: 12.5 },
    fallbackSlots: [
      { x: 24, y: 42 },
      { x: 47, y: 66 },
      { x: 76, y: 78 }
    ]
  },
  cards: {
    bounds: { left: 2, top: 44.5, width: 40.5, height: 38 },
    badge: { left: 9, top: 90 },
    caption: { left: 5, top: 48.5 },
    fallbackSlots: [
      { x: 42, y: 74 },
      { x: 60, y: 82 },
      { x: 74, y: 60 },
      { x: 84, y: 42 }
    ]
  },
  work: {
    bounds: { left: 43, top: 44.5, width: 39, height: 38 },
    badge: { left: 68, top: 57 },
    caption: { left: 46, top: 48.5 },
    fallbackSlots: [
      { x: 18, y: 32 },
      { x: 38, y: 32 },
      { x: 58, y: 32 },
      { x: 25, y: 64 },
      { x: 48, y: 68 },
      { x: 72, y: 72 }
    ]
  }
};

const STATUS_TONE_COLOR: Record<OverlayRoomStatusTone, string> = {
  open: "#4ade80",
  occupied: "#f97316",
  seated: "#facc15"
};

const STATUS_TONE_CLASS: Record<OverlayRoomStatusTone, string> = {
  open: "is-open",
  occupied: "is-occupied",
  seated: "is-seated"
};

const ROLE_SPRITE_CLASS: Record<AgentRecord["role"], string> = {
  collector: "is-collector",
  analyzer: "is-analyzer",
  writer: "is-writer",
  validator: "is-validator"
};

const getAgentStateLabel = (status: AgentRecord["status"]) => {
  if (status === "thinking") {
    return "working";
  }

  if (status === "handoff") {
    return "handoff";
  }

  return "idle";
};

const resolveRoomAction = (room: SceneRoom): AgentAction => {
  if (room === "mahjong") {
    return "playing_mahjong";
  }

  if (room === "coffee") {
    return "making_tea";
  }

  if (room === "nap") {
    return "typing";
  }

  if (room === "cards") {
    return "watching";
  }

  if (room === "work") {
    return "coding";
  }

  return "idle";
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const lerp = (start: number, end: number, progress: number) =>
  start + (end - start) * progress;

const randInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const randChoice = <T,>(items: readonly T[]) =>
  items[Math.floor(Math.random() * items.length)];

const scaleRoomPoint = (
  room: SceneRoom,
  localX: number,
  localY: number
) => {
  const bounds = ROOM_LAYOUT[room].bounds;
  return {
    left: bounds.left + bounds.width * (clamp(localX, 6, 94) / 100),
    top: bounds.top + bounds.height * (clamp(localY, 8, 92) / 100)
  };
};

const hashSeed = (value: string) => {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
};

const stagePointToPercent = (x: number, y: number) => ({
  left: (x / STAGE_WIDTH) * 100,
  top: (y / STAGE_HEIGHT) * 100
});

const SCENE_SLOT_STAGE_POINTS: Record<string, { x: number; y: number }> = {
  "desk-watch-bar": { x: 352, y: 174 },
  "desk-watch-cooler": { x: 320, y: 186 },
  "queue-reset-bar": { x: 352, y: 174 },
  "pantry-loop-bar": { x: 352, y: 174 },
  "pantry-loop-cooler": { x: 320, y: 186 },
  "screening-left": { x: 168, y: 406 },
  "screening-right": { x: 222, y: 412 },
  "screening-bar": { x: 352, y: 174 },
  "screening-nap": { x: 575, y: 188 },
  "mahjong-top": { x: 137, y: 98 },
  "mahjong-left": { x: 83, y: 152 },
  "mahjong-right": { x: 181, y: 152 },
  "mahjong-bottom": { x: 137, y: 196 },
  "mahjong-pantry": { x: 352, y: 174 },
  "tea-reset-bar": { x: 352, y: 174 },
  "tea-reset-cooler": { x: 320, y: 186 },
  "tea-reset-lounge": { x: 168, y: 406 },
  "tea-reset-nap": { x: 575, y: 188 }
};

const pointInZone = (x: number, y: number, zone: MotionZone) =>
  x >= zone.x &&
  x <= zone.x + zone.w &&
  y >= zone.y &&
  y <= zone.y + zone.h;

const pointInBounds = (x: number, y: number, bounds: MotionBounds) =>
  x >= bounds.x1 &&
  x <= bounds.x2 &&
  y >= bounds.y1 &&
  y <= bounds.y2;

const clampPointToBounds = (x: number, y: number, bounds: MotionBounds) => ({
  x: clamp(x, bounds.x1, bounds.x2),
  y: clamp(y, bounds.y1, bounds.y2)
});

const distanceBetween = (ax: number, ay: number, bx: number, by: number) =>
  Math.hypot(bx - ax, by - ay);

const getInitialSeatedTimer = (_room: SceneRoom, id: string) => {
  const seed = hashSeed(id);
  return 300 + (seed % 401);
};

const createInitialSceneRuntime = (): SceneRuntime => ({
  mahjongCycle: -1,
  mahjongActiveIndex: 0,
  loungeCycle: -1,
  loungeRaisedIndex: 0,
  steamParticles: []
});

const createSceneAgent = (
  input: Omit<
    SceneAgent,
    | "x"
    | "y"
    | "targetX"
    | "targetY"
    | "stateTimer"
    | "walkFrame"
    | "waypoints"
    | "currentWaypoint"
    | "pendingRoom"
    | "postInterRoomState"
    | "activeDoorIndex"
  >
): SceneAgent => ({
  ...input,
  x: input.homeX,
  y: input.homeY,
  targetX: input.homeX,
  targetY: input.homeY,
  stateTimer: getInitialSeatedTimer(input.room, input.id),
  walkFrame: hashSeed(input.id) % 24,
  waypoints: [],
  currentWaypoint: 0,
  pendingRoom: null,
  postInterRoomState: null,
  activeDoorIndex: null
});

const resolveAgentLocalPoint = (
  agent: OfficeWorld3DAgent,
  roomIndex: number
) => {
  const exactStagePoint =
    agent.scene.anchorKey ? SCENE_SLOT_STAGE_POINTS[agent.scene.anchorKey] : null;

  if (exactStagePoint) {
    return {
      ...stagePointToPercent(exactStagePoint.x, exactStagePoint.y),
      isAbsolute: true as const
    };
  }

  const room = agent.scene.room ?? "work";
  const fallbackSlots = ROOM_LAYOUT[room].fallbackSlots;
  const fallback = fallbackSlots[roomIndex % fallbackSlots.length] ?? { x: 50, y: 50 };

  if (
    typeof agent.scene.roomX === "number" &&
    typeof agent.scene.roomY === "number"
  ) {
    return {
      x: agent.scene.roomX,
      y: agent.scene.roomY,
      isAbsolute: false as const
    };
  }

  if (typeof agent.scene.x === "number" && typeof agent.scene.y === "number") {
    return {
      x: agent.scene.x,
      y: agent.scene.y,
      isAbsolute: false as const
    };
  }

  return {
    ...fallback,
    isAbsolute: false as const
  };
};

const resolveAgentStagePlacement = (
  agent: OfficeWorld3DAgent,
  roomIndex: number
) => {
  const room = agent.scene.room ?? "work";
  const localPoint = resolveAgentLocalPoint(agent, roomIndex);
  const basePoint = localPoint.isAbsolute
    ? { left: localPoint.left, top: localPoint.top }
    : scaleRoomPoint(room, localPoint.x, localPoint.y);
  const seed = hashSeed(agent.id);
  const offsetX = localPoint.isAbsolute ? 0 : ((seed % 7) - 3) * 0.32;
  const offsetY = localPoint.isAbsolute ? 0 : ((((seed / 7) | 0) % 5) - 2) * 0.26;

  return {
    room,
    left: clamp(basePoint.left + offsetX, 2, 96),
    top: clamp(basePoint.top + offsetY, 4, 96),
    zIndex: 140 + Math.round(basePoint.top * 3),
    pose: agent.scene.pose,
    facing: agent.scene.facing,
    action: resolveRoomAction(room)
  } satisfies Omit<AgentPlacement, "agent">;
};

const resolveStagePoint = (left: number, top: number) => ({
  x: (left / 100) * STAGE_WIDTH,
  y: (top / 100) * STAGE_HEIGHT
});

const resolveRenderableState = (agent: OfficeWorld3DAgent): AgentState =>
  agent.status === "handoff" || agent.scene.pose === "walk" || agent.scene.pose === "handoff"
    ? "walking"
    : "seated";

const HAIR_COLORS = ["#181010", "#22170d", "#3a2414", "#786078", "#141a24", "#4f361f"] as const;
const SKIN_COLORS = ["#e8b888", "#e6b88a", "#d09060", "#e0a070", "#e0d0b0", "#e0a8c8"] as const;
const PANTS_COLORS = ["#242b3b", "#2f2430", "#213025", "#1f2736"] as const;

const resolveRenderableAppearance = (agent: OfficeWorld3DAgent) => {
  const seed = hashSeed(agent.id);

  return {
    shirt: agent.accent,
    pants: PANTS_COLORS[(seed >>> 3) % PANTS_COLORS.length],
    hair: HAIR_COLORS[(seed >>> 5) % HAIR_COLORS.length],
    skin: SKIN_COLORS[(seed >>> 7) % SKIN_COLORS.length]
  };
};

const createRenderableSceneAgents = (
  agents: OfficeWorld3DAgent[],
  frame: number
): SceneAgent[] => {
  const roomOccupancy = {
    work: 0,
    cards: 0,
    coffee: 0,
    nap: 0,
    mahjong: 0
  } satisfies Record<SceneRoom, number>;

  return agents.map((agent) => {
    const room = agent.scene.room ?? "work";
    const roomIndex = roomOccupancy[room];
    roomOccupancy[room] += 1;
    const placement = resolveAgentStagePlacement(agent, roomIndex);
    const point = resolveStagePoint(placement.left, placement.top);
    const sceneAgent = createSceneAgent({
      id: agent.id,
      room: placement.room,
      homeRoom: placement.room,
      homeX: point.x,
      homeY: point.y,
      state: resolveRenderableState(agent),
      action: placement.action,
      dir: placement.facing === "left" ? -1 : 1,
      ...resolveRenderableAppearance(agent)
    });

    sceneAgent.walkFrame = frame + (hashSeed(agent.id) % 24);
    sceneAgent.stateTimer = 0;

    return sceneAgent;
  });
};

const buildAgentPlacements = (agents: OfficeWorld3DAgent[]) => {
  const roomOccupancy = {
    work: 0,
    cards: 0,
    coffee: 0,
    nap: 0,
    mahjong: 0
  } satisfies Record<SceneRoom, number>;

  return agents
    .map((agent) => {
      const room = agent.scene.room ?? "work";
      const roomIndex = roomOccupancy[room];
      roomOccupancy[room] += 1;
      const placement = resolveAgentStagePlacement(agent, roomIndex);

      return {
        agent,
        ...placement
      } satisfies AgentPlacement;
    })
    .sort((left, right) => left.top - right.top);
};

const buildDeskSignals = (desks: OfficeWorld3DDesk[]) =>
  desks
    .filter((desk) => desk.active)
    .map((desk) => {
      const point = scaleRoomPoint("work", desk.desk.x, desk.desk.y);

      return {
        id: desk.id,
        left: point.left,
        top: point.top,
        accent: desk.accent
      };
    });

const buildDeskWorkstations = (desks: OfficeWorld3DDesk[]) =>
  desks.map((desk, index) => {
    const point = scaleRoomPoint("work", desk.desk.x, desk.desk.y);
    const stagePoint = resolveStagePoint(point.left, point.top);

    return {
      id: desk.id,
      index,
      x: stagePoint.x - DESK_WIDTH / 2,
      y: stagePoint.y - CHAIR_OFFSET,
      chairY: stagePoint.y
    };
  });

const getRoomAgents = (agents: SceneAgent[], room: SceneRoom) =>
  agents.filter((agent) => agent.room === room);

const getHomeRoomAgents = (agents: SceneAgent[], room: SceneRoom) =>
  agents.filter((agent) => agent.homeRoom === room);

const isSeatOccupied = (agent: SceneAgent) =>
  agent.state === "seated" || agent.state === "stretch";

const isWalkingState = (agent: SceneAgent) =>
  agent.state === "walking" ||
  agent.state === "returning" ||
  agent.state === "inter_room_walk";

const getDoorMidpoint = (door: DoorConnection) => ({
  x: door.x + door.w / 2,
  y: door.y + door.h / 2
});

const getConnectedDoors = (room: SceneRoom) =>
  DOORS
    .map((door, index) => ({ door, index }))
    .filter(({ door }) => door.from === room || door.to === room);

const getDoorDestinationRoom = (door: DoorConnection, room: SceneRoom): SceneRoom =>
  door.from === room ? door.to : door.from;

const getDoorForRooms = (from: SceneRoom, to: SceneRoom) =>
  DOORS.find((door) =>
    (door.from === from && door.to === to) ||
    (door.from === to && door.to === from)
  ) ?? null;

const getMahjongFacing = (agent: SceneAgent) => {
  const dx = agent.homeX - MAHJONG_TABLE_CENTER_X;
  const dy = agent.homeY - MAHJONG_TABLE_CENTER_Y;

  if (Math.abs(dy) >= Math.abs(dx)) {
    return dy < 0 ? ("down" as const) : ("up" as const);
  }

  return dx < 0 ? ("right" as const) : ("left" as const);
};

const orderMahjongAgents = (agents: SceneAgent[]) => {
  const seats = {
    north: null as SceneAgent | null,
    south: null as SceneAgent | null,
    west: null as SceneAgent | null,
    east: null as SceneAgent | null
  };

  agents.forEach((agent) => {
    const facing = getMahjongFacing(agent);

    if (facing === "down") {
      seats.north = agent;
      return;
    }

    if (facing === "up") {
      seats.south = agent;
      return;
    }

    if (facing === "right") {
      seats.west = agent;
      return;
    }

    seats.east = agent;
  });

  return [seats.north, seats.south, seats.west, seats.east].filter(
    (agent): agent is SceneAgent => Boolean(agent)
  );
};

const getAgentFacing = (agent: SceneAgent) => {
  if (agent.room === "mahjong") {
    return getMahjongFacing(agent);
  }

  if (agent.room === "cards") {
    return "left" as const;
  }

  if (agent.room === "coffee" || agent.room === "nap" || agent.room === "work") {
    return "up" as const;
  }

  return agent.dir < 0 ? ("left" as const) : ("right" as const);
};

const isPointInAvoidZone = (room: SceneRoom, x: number, y: number) =>
  ROOM_MOTION[room].avoidZones.some((zone) => pointInZone(x, y, zone));

const canOccupyPoint = (agent: SceneAgent, x: number, y: number) => {
  const door = agent.activeDoorIndex !== null ? DOORS[agent.activeDoorIndex] : null;
  const roomBounds = ROOM_MOTION[agent.room].bounds;
  const bounds =
    agent.state === "inter_room_walk" && agent.currentWaypoint === 0 && door
      ? {
          x1: Math.min(roomBounds.x1, door.x),
          y1: Math.min(roomBounds.y1, door.y),
          x2: Math.max(roomBounds.x2, door.x + door.w),
          y2: Math.max(roomBounds.y2, door.y + door.h)
        }
      : roomBounds;

  if (!pointInBounds(x, y, bounds)) {
    return false;
  }

  if (
    distanceBetween(x, y, agent.homeX, agent.homeY) <= 8 ||
    distanceBetween(x, y, agent.targetX, agent.targetY) <= 8
  ) {
    return true;
  }

  return !isPointInAvoidZone(agent.room, x, y);
};

const getAgentMovementBounds = (agent: SceneAgent): MotionBounds => {
  const door = agent.activeDoorIndex !== null ? DOORS[agent.activeDoorIndex] : null;
  const roomBounds = ROOM_MOTION[agent.room].bounds;

  if (!(agent.state === "inter_room_walk" && agent.currentWaypoint === 0 && door)) {
    return roomBounds;
  }

  return {
    x1: Math.min(roomBounds.x1, door.x),
    y1: Math.min(roomBounds.y1, door.y),
    x2: Math.max(roomBounds.x2, door.x + door.w),
    y2: Math.max(roomBounds.y2, door.y + door.h)
  };
};

const pickPointFromBounds = (bounds: MotionBounds) => ({
  x: randInt(bounds.x1, bounds.x2),
  y: randInt(bounds.y1, bounds.y2)
});

const isActionTarget = (agent: SceneAgent) =>
  ROOM_MOTION[agent.room].actionPoints.some(
    (point) => distanceBetween(agent.targetX, agent.targetY, point.x, point.y) <= 1
  );

const setAgentTarget = (agent: SceneAgent, point: { x: number; y: number }) => {
  agent.targetX = point.x;
  agent.targetY = point.y;
  agent.dir = point.x < agent.x ? -1 : 1;
};

const pickRoamTarget = (agent: SceneAgent) => {
  const profile = ROOM_MOTION[agent.room];

  for (let attempt = 0; attempt < 32; attempt += 1) {
    const point = pickPointFromBounds(profile.bounds);

    if (
      !isPointInAvoidZone(agent.room, point.x, point.y) &&
      distanceBetween(agent.x, agent.y, point.x, point.y) > 18
    ) {
      return point;
    }
  }

  return { x: agent.homeX, y: agent.homeY };
};

const pickActionTarget = (agent: SceneAgent) =>
  randChoice(ROOM_MOTION[agent.room].actionPoints);

const pickRoomRoamTarget = (
  agent: SceneAgent,
  agents: SceneAgent[]
) => {
  if (agent.room === "work") {
    return pickWorkRoamTarget(agent, agents);
  }

  return pickRoamTarget(agent);
};

const pickDepartureTarget = (
  agent: SceneAgent,
  agents: SceneAgent[]
) => {
  if (Math.random() < 0.35) {
    return pickActionTarget(agent);
  }

  return pickRoomRoamTarget(agent, agents);
};

const startInterRoomWalk = (
  agent: SceneAgent,
  doorIndex: number,
  destinationRoom: SceneRoom,
  destination: { x: number; y: number },
  postState: AgentState
) => {
  const door = DOORS[doorIndex];
  const midpoint = getDoorMidpoint(door);
  agent.state = "inter_room_walk";
  agent.action = "idle";
  agent.pendingRoom = destinationRoom;
  agent.postInterRoomState = postState;
  agent.activeDoorIndex = doorIndex;
  agent.currentWaypoint = 0;
  agent.waypoints = [midpoint, destination];
  setAgentTarget(agent, midpoint);
};

const pickInterRoomVisit = (
  agent: SceneAgent
): {
  doorIndex: number;
  destinationRoom: SceneRoom;
  destination: { x: number; y: number };
} | null => {
  const adjacentDoors = getConnectedDoors(agent.room);

  if (adjacentDoors.length === 0) {
    return null;
  }

  const { door, index } = randChoice(adjacentDoors);
  const destinationRoom = getDoorDestinationRoom(door, agent.room);
  const destination =
    ROOM_MOTION[destinationRoom].actionPoints.length > 0
      ? randChoice(ROOM_MOTION[destinationRoom].actionPoints)
      : pickPointFromBounds(ROOM_MOTION[destinationRoom].bounds);

  return {
    doorIndex: index,
    destinationRoom,
    destination
  };
};

const moveAgentTowardTarget = (agent: SceneAgent, speed = 1.2) => {
  const movementBounds = getAgentMovementBounds(agent);
  const dx = agent.targetX - agent.x;
  const dy = agent.targetY - agent.y;
  const distance = Math.hypot(dx, dy);

  if (distance <= 3) {
    agent.x = agent.targetX;
    agent.y = agent.targetY;
    return true;
  }

  const nextX = agent.x + (dx / distance) * speed;
  const nextY = agent.y + (dy / distance) * speed;
  const clampedNext = clampPointToBounds(nextX, nextY, movementBounds);
  agent.dir = dx < 0 ? -1 : 1;

  if (canOccupyPoint(agent, clampedNext.x, clampedNext.y)) {
    agent.x = clampedNext.x;
    agent.y = clampedNext.y;
    return distanceBetween(agent.x, agent.y, agent.targetX, agent.targetY) <= 3;
  }

  const blockingZone = ROOM_MOTION[agent.room].avoidZones.find((zone) =>
    pointInZone(clampedNext.x, clampedNext.y, zone)
  );

  if (blockingZone) {
    const zoneCenterX = blockingZone.x + blockingZone.w / 2;
    const zoneCenterY = blockingZone.y + blockingZone.h / 2;
    const deflectX =
      Math.abs(dx) < Math.abs(dy)
        ? agent.x + (agent.x < zoneCenterX ? -speed : speed)
        : agent.x;
    const deflectY =
      Math.abs(dx) < Math.abs(dy)
        ? agent.y
        : agent.y + (agent.y < zoneCenterY ? -speed : speed);
    const deflectedPoint = clampPointToBounds(deflectX, deflectY, movementBounds);

    if (canOccupyPoint(agent, deflectedPoint.x, deflectedPoint.y)) {
      agent.x = deflectedPoint.x;
      agent.y = deflectedPoint.y;
    }
  }

  return distanceBetween(agent.x, agent.y, agent.targetX, agent.targetY) <= 3;
};

const pickWorkRoamTarget = (agent: SceneAgent, agents: SceneAgent[]) => {
  void agent;
  void agents;
  const point = randChoice(WORK_ROAM);
  return {
    x: clamp(point.x, WORK_FLOOR_BOUNDS.x1, WORK_FLOOR_BOUNDS.x2),
    y: clamp(point.y, WORK_FLOOR_BOUNDS.y1, WORK_FLOOR_BOUNDS.y2)
  };
};

const updateSceneRuntime = (
  runtime: SceneRuntime,
  agents: SceneAgent[],
  frame: number
) => {
  const mahjongCycle = Math.floor(frame / 80);
  if (runtime.mahjongCycle !== mahjongCycle) {
    runtime.mahjongCycle = mahjongCycle;
    const mahjongAgents = orderMahjongAgents(getHomeRoomAgents(agents, "mahjong"));
    const seatedAgents = mahjongAgents.filter((agent) => isSeatOccupied(agent));
    const activeAgent = seatedAgents.length > 0 ? randChoice(seatedAgents) : null;
    runtime.mahjongActiveIndex = activeAgent ? mahjongAgents.indexOf(activeAgent) : 0;
  }

  const loungeAgents = getHomeRoomAgents(agents, "cards");
  const loungeCycle = Math.floor(frame / 400);
  if (runtime.loungeCycle !== loungeCycle) {
    runtime.loungeCycle = loungeCycle;
    const seatedLoungeIndices = loungeAgents
      .map((agent, index) => (isSeatOccupied(agent) ? index : -1))
      .filter((index) => index >= 0);
    runtime.loungeRaisedIndex =
      seatedLoungeIndices.length > 0 ? randChoice(seatedLoungeIndices) : 0;
  }

  runtime.steamParticles = runtime.steamParticles
    .map((particle) => {
      const age = particle.age + 1;
      const alpha = 0.6 * (1 - age / 40);

      return {
        ...particle,
        age,
        y: particle.y - 0.5,
        alpha
      };
    })
    .filter((particle) => particle.alpha > 0);

  const pantryAgent = getHomeRoomAgents(agents, "coffee")[0];
  if (pantryAgent?.state === "seated" && frame % 5 === 0) {
    runtime.steamParticles.push({
      x: PANTRY_KETTLE_X,
      y: PANTRY_KETTLE_Y,
      alpha: 0.6,
      age: 0
    });
  }
};

const resetSeatedTimer = (_agent: SceneAgent) => {
  _agent.stateTimer = randInt(300, 700);
};

const advanceSceneAgents = (
  agents: SceneAgent[],
  _runtime: SceneRuntime,
  frame: number
) => {
  agents.forEach((agent) => {
    agent.walkFrame += 1;

    switch (agent.state) {
      case "seated": {
        agent.action = resolveRoomAction(agent.room);
        agent.x = agent.homeX;
        agent.y = agent.homeY;
        agent.targetX = agent.homeX;
        agent.targetY = agent.homeY;
        if (agent.room === "cards") {
          agent.dir = -1;
        }
        agent.stateTimer -= 1;

        if (agent.room === "work" && frame % 200 === 0 && Math.random() < 0.2) {
          agent.state = "stretch";
          agent.action = "idle";
          agent.stateTimer = 40;
          return;
        }

        if (agent.stateTimer > 0) {
          return;
        }

        const roll = Math.random();

        if (roll < 0.6) {
          resetSeatedTimer(agent);
          return;
        }

        if (roll < 0.9) {
          const departureTarget = pickRoomRoamTarget(agent, agents);

          if (distanceBetween(agent.homeX, agent.homeY, departureTarget.x, departureTarget.y) <= 3) {
            resetSeatedTimer(agent);
            return;
          }

          agent.state = "walking";
          agent.action = "idle";
          setAgentTarget(agent, departureTarget);
          agent.stateTimer = 0;
          return;
        }

        const interRoomVisit = pickInterRoomVisit(agent);

        if (!interRoomVisit) {
          resetSeatedTimer(agent);
          return;
        }

        startInterRoomWalk(
          agent,
          interRoomVisit.doorIndex,
          interRoomVisit.destinationRoom,
          interRoomVisit.destination,
          "acting"
        );
        agent.stateTimer = 0;
        return;
      }

      case "stretch": {
        agent.action = "idle";
        agent.x = agent.homeX;
        agent.y = agent.homeY;
        agent.targetX = agent.homeX;
        agent.targetY = agent.homeY;
        agent.stateTimer -= 1;

        if (agent.stateTimer > 0) {
          return;
        }

        agent.state = "seated";
        agent.action = resolveRoomAction(agent.room);
        resetSeatedTimer(agent);
        return;
      }

      case "walking": {
        agent.action = "idle";
        const arrived = moveAgentTowardTarget(agent);

        if (!arrived) {
          return;
        }

        if (isActionTarget(agent)) {
          agent.state = "acting";
          agent.stateTimer = randInt(60, 180);
          return;
        }

        if (Math.random() < 0.5) {
          setAgentTarget(agent, pickRoomRoamTarget(agent, agents));
          return;
        }

        agent.state = "returning";
        if (agent.room !== agent.homeRoom) {
          const door = getDoorForRooms(agent.room, agent.homeRoom);
          if (door) {
            const doorIndex = DOORS.findIndex((candidate) => candidate === door);
            startInterRoomWalk(
              agent,
              doorIndex,
              agent.homeRoom,
              { x: agent.homeX, y: agent.homeY },
              "returning"
            );
            return;
          }
        }

        setAgentTarget(agent, { x: agent.homeX, y: agent.homeY });
        return;
      }

      case "acting": {
        agent.action = "idle";
        agent.stateTimer -= 1;

        if (agent.stateTimer > 0) {
          return;
        }

        if (agent.room !== agent.homeRoom) {
          const door = getDoorForRooms(agent.room, agent.homeRoom);
          if (door) {
            const doorIndex = DOORS.findIndex((candidate) => candidate === door);
            startInterRoomWalk(
              agent,
              doorIndex,
              agent.homeRoom,
              { x: agent.homeX, y: agent.homeY },
              "returning"
            );
            return;
          }
        }

        agent.state = "returning";
        setAgentTarget(agent, { x: agent.homeX, y: agent.homeY });
        return;
      }

      case "inter_room_walk": {
        const arrived = moveAgentTowardTarget(agent);

        if (!arrived) {
          return;
        }

        if (agent.currentWaypoint === 0) {
          agent.room = agent.pendingRoom ?? agent.room;
          agent.currentWaypoint = 1;
          const nextPoint = agent.waypoints[1];

          if (!nextPoint) {
            agent.state = "acting";
            agent.stateTimer = randInt(60, 180);
            agent.pendingRoom = null;
            agent.postInterRoomState = null;
            agent.activeDoorIndex = null;
            return;
          }

          agent.activeDoorIndex = null;
          setAgentTarget(agent, nextPoint);
          return;
        }

        const postState = agent.postInterRoomState;
        agent.waypoints = [];
        agent.currentWaypoint = 0;
        agent.pendingRoom = null;
        agent.postInterRoomState = null;
        agent.activeDoorIndex = null;

        if (postState === "acting") {
          agent.state = "acting";
          agent.stateTimer = randInt(60, 180);
          return;
        }

        if (postState === "returning") {
          agent.state = "returning";
          setAgentTarget(agent, { x: agent.homeX, y: agent.homeY });
          return;
        }

        agent.state = "walking";
        setAgentTarget(agent, pickRoomRoamTarget(agent, agents));
        return;
      }

      case "returning": {
        agent.action = "idle";
        const arrived = moveAgentTowardTarget(agent);

        if (!arrived) {
          return;
        }

        agent.room = agent.homeRoom;
        agent.x = agent.homeX;
        agent.y = agent.homeY;
        agent.state = "seated";
        agent.action = resolveRoomAction(agent.room);
        resetSeatedTimer(agent);
        return;
      }
    }
  });
};

const getTypingOffset = (agent: SceneAgent, cadence = 5) =>
  Math.floor(agent.walkFrame / cadence) % 2 === 0 ? -2 : 2;

function drawRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string
) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(0, Math.round(width)), Math.max(0, Math.round(height)));
}

function drawGlow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string
) {
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = gradient;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  ctx.restore();
}

function drawThoughtBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  kind: "dots" | "z"
) {
  drawRect(ctx, x - 11, y - 10, 22, 10, "rgba(8,12,18,0.86)");
  drawRect(ctx, x - 10, y - 9, 20, 8, "#eef5ff");
  if (kind === "dots") {
    drawRect(ctx, x - 6, y - 6, 2, 2, "#465974");
    drawRect(ctx, x - 1, y - 6, 2, 2, "#465974");
    drawRect(ctx, x + 4, y - 6, 2, 2, "#465974");
    return;
  }

  drawRect(ctx, x - 6, y - 8, 5, 2, "#465974");
  drawRect(ctx, x - 4, y - 6, 3, 2, "#465974");
  drawRect(ctx, x - 6, y - 4, 5, 2, "#465974");
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  drawRect(ctx, 0, 0, STAGE_WIDTH, STAGE_HEIGHT, "#080d1a");

  const stars = [
    [42, 22], [94, 34], [138, 18], [196, 26], [242, 44], [304, 20], [352, 34], [412, 22],
    [762, 26], [804, 18], [846, 34], [892, 20], [936, 32], [984, 18], [1028, 30]
  ] as const;
  ctx.fillStyle = "rgba(214,228,255,0.62)";
  stars.forEach(([x, y]) => ctx.fillRect(x, y, 2, 2));

  drawRect(ctx, 10, 8, 720, 472, "#131d30");
  drawRect(ctx, 10, 8, 720, 2, "#223350");
  drawRect(ctx, 10, 8, 2, 472, "#223350");
  drawRect(ctx, 728, 8, 2, 472, "#0c1520");
  drawRect(ctx, 10, 478, 720, 2, "#0c1520");

  drawRect(ctx, 748, 56, 98, 372, "#0f1728");
  drawRect(ctx, 748, 56, 98, 2, "#223350");
  drawRect(ctx, 748, 56, 2, 372, "#223350");
  drawRect(ctx, 844, 56, 2, 372, "#0c1520");
  drawRect(ctx, 748, 426, 98, 2, "#0c1520");

  [[770, 88], [812, 88], [770, 136], [812, 136], [770, 184], [812, 184]].forEach(([x, y], index) => {
    drawRect(ctx, x, y, 24, 24, index % 2 === 0 ? "#17253a" : "#142132");
    drawRect(ctx, x, y, 24, 2, "#23354f");
    drawRect(ctx, x, y, 2, 24, "#23354f");
    drawRect(ctx, x + 7, y + 8, 10, 8, index % 3 === 0 ? "#38bdf8" : index % 3 === 1 ? "#f59e0b" : "#22c55e");
  });
}

function drawThresholds(ctx: CanvasRenderingContext2D) {
  [
    [258, 172, 6, 28],
    [462, 114, 6, 30],
    [312, 244, 56, 8],
    [374, 346, 8, 44]
  ].forEach(([x, y, width, height]) => {
    drawRect(ctx, x, y, width, height, "#7b8796");
    drawRect(ctx, x, y, width, 2, "#c6d1db");
  });
}

function drawFloors(ctx: CanvasRenderingContext2D) {
  const roomFills = [
    ["mahjong", "#1c3820"],
    ["coffee", "#3a2810"],
    ["nap", "#12102a"],
    ["cards", "#181e2c"],
    ["work", "#2c1e0a"]
  ] as const;

  for (const [room, color] of roomFills) {
    const bounds = ROOM_LAYOUT[room].bounds;
    const x = bounds.left * 8.8;
    const y = bounds.top * 5.6;
    const width = bounds.width * 8.8;
    const height = bounds.height * 5.6;
    drawRect(ctx, x, y, width, height, color);

    ctx.save();
    ctx.globalAlpha = 0.04;
    ctx.strokeStyle = "#aabbcc";
    ctx.lineWidth = 0.5;
    for (let gridX = x; gridX <= x + width; gridX += 20) {
      ctx.beginPath();
      ctx.moveTo(gridX, y);
      ctx.lineTo(gridX, y + height);
      ctx.stroke();
    }
    for (let gridY = y; gridY <= y + height; gridY += 20) {
      ctx.beginPath();
      ctx.moveTo(x, gridY);
      ctx.lineTo(x + width, gridY);
      ctx.stroke();
    }
    ctx.restore();
  }

  const lounge = ROOM_LAYOUT.cards.bounds;
  const loungeX = lounge.left * 8.8;
  const loungeY = lounge.top * 5.6;
  const loungeWidth = lounge.width * 8.8;
  const loungeHeight = lounge.height * 5.6;

  ctx.save();
  ctx.globalAlpha = 0.06;
  for (let x = loungeX; x < loungeX + loungeWidth; x += 28) {
    for (let y = loungeY; y < loungeY + loungeHeight; y += 22) {
      const offset = (Math.floor((y - loungeY) / 22) % 2) * 14;
      drawRect(
        ctx,
        x + offset,
        y,
        27,
        21,
        (x + y) % 56 < 28 ? "#ffffff" : "#000000"
      );
    }
  }
  ctx.restore();

  const work = ROOM_LAYOUT.work.bounds;
  const workX = work.left * 8.8;
  const workY = work.top * 5.6;
  const workWidth = work.width * 8.8;
  const workHeight = work.height * 5.6;

  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = "#c8a060";
  ctx.lineWidth = 1;
  for (let y = workY; y < workY + workHeight; y += 5) {
    ctx.beginPath();
    ctx.moveTo(workX, y);
    ctx.lineTo(workX + workWidth, y);
    ctx.stroke();
  }
  ctx.restore();

  const mahjong = ROOM_LAYOUT.mahjong.bounds;
  const mahjongX = mahjong.left * 8.8;
  const mahjongY = mahjong.top * 5.6;
  const mahjongWidth = mahjong.width * 8.8;
  const mahjongHeight = mahjong.height * 5.6;

  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.strokeStyle = "#4a8040";
  ctx.lineWidth = 4;
  ctx.strokeRect(mahjongX + 6, mahjongY + 6, mahjongWidth - 12, mahjongHeight - 12);
  ctx.restore();
}

function drawWalls(ctx: CanvasRenderingContext2D) {
  drawRect(ctx, 256, 60, 8, 108, "#131d30");
  drawRect(ctx, 256, 205, 8, 39, "#131d30");
  drawRect(ctx, 254, 166, 2, 41, "#223350");
  drawRect(ctx, 264, 166, 2, 41, "#223350");
  drawRect(ctx, 254, 166, 12, 2, "#223350");

  drawRect(ctx, 460, 16, 8, 94, "#131d30");
  drawRect(ctx, 460, 150, 8, 94, "#131d30");
  drawRect(ctx, 458, 108, 2, 44, "#223350");
  drawRect(ctx, 468, 108, 2, 44, "#223350");
  drawRect(ctx, 458, 108, 12, 2, "#223350");

  drawRect(ctx, 18, 244, 238, 8, "#131d30");
  drawRect(ctx, 264, 244, 38, 8, "#131d30");
  drawRect(ctx, 372, 244, 92, 8, "#131d30");
  drawRect(ctx, 300, 242, 2, 10, "#223350");
  drawRect(ctx, 374, 242, 2, 10, "#223350");
  drawRect(ctx, 468, 244, 250, 8, "#131d30");

  drawRect(ctx, 374, 252, 8, 88, "#131d30");
  drawRect(ctx, 374, 395, 8, 69, "#131d30");
  drawRect(ctx, 372, 338, 2, 59, "#223350");
  drawRect(ctx, 382, 338, 2, 59, "#223350");
  drawRect(ctx, 372, 338, 12, 2, "#223350");

  drawRect(ctx, 18, 58, 238, 2, "#223350");
  drawRect(ctx, 264, 14, 196, 2, "#223350");
  drawRect(ctx, 468, 56, 250, 2, "#223350");
  drawRect(ctx, 18, 250, 356, 2, "#223350");
  drawRect(ctx, 382, 250, 340, 2, "#223350");

  drawRect(ctx, 16, 60, 2, 184, "#223350");
  drawRect(ctx, 262, 16, 2, 228, "#223350");
  drawRect(ctx, 466, 58, 2, 186, "#223350");
  drawRect(ctx, 16, 252, 2, 212, "#223350");
  drawRect(ctx, 380, 252, 2, 212, "#223350");
}

function drawLighting(ctx: CanvasRenderingContext2D, time: number) {
  const flicker = 1 + Math.sin(time * 0.002) * 0.03;
  drawGlow(ctx, 148, 152, 140, `rgba(255,185,60,${0.12 * flicker})`);
  drawGlow(ctx, 35, 125, 50, `rgba(255,160,40,${0.15 * flicker})`);
  drawGlow(ctx, 360, 110, 120, `rgba(255,200,80,${0.12 * flicker})`);
  drawGlow(ctx, 620, 155, 130, "rgba(60,80,220,0.10)");
  drawGlow(ctx, 560, 120, 60, "rgba(180,120,255,0.08)");
  drawGlow(ctx, 95, 340, 150, "rgba(30,80,220,0.14)");
  drawGlow(ctx, 550, 390, 200, `rgba(220,160,60,${0.1 * flicker})`);
}

function drawMahjongPlayer(
  ctx: CanvasRenderingContext2D,
  agent: SceneAgent,
  options: {
    armReach?: number;
    headTilt?: number;
  } = {}
) {
  const centerX = agent.x;
  const centerY = agent.y;
  const direction = getMahjongFacing(agent);
  const armReach = options.armReach ?? 0;
  const headTilt = options.headTilt ?? 0;

  if (direction === "down" || direction === "up") {
    const torsoY = direction === "down" ? centerY - 2 : centerY - 12;
    const headY = direction === "down" ? centerY - 12 : centerY;
    const armY = torsoY + 1 + armReach;

    drawRect(ctx, centerX - 6, torsoY, 12, 10, agent.shirt);
    drawRect(ctx, centerX - 8, armY, 2, 7, agent.shirt);
    drawRect(ctx, centerX + 6, armY, 2, 7, agent.shirt);
    drawRect(ctx, centerX - 4, torsoY + 10, 3, 4, agent.pants);
    drawRect(ctx, centerX + 1, torsoY + 10, 3, 4, agent.pants);
    drawRect(ctx, centerX - 5 + headTilt, headY, 10, 10, agent.skin);
    drawRect(
      ctx,
      centerX - 5 + headTilt,
      direction === "down" ? headY : headY + 7,
      10,
      3,
      agent.hair
    );
    drawRect(ctx, centerX - 3 + headTilt, headY + 3, 1, 1, "#181010");
    drawRect(ctx, centerX + 2 + headTilt, headY + 3, 1, 1, "#181010");
    return;
  }

  const torsoX = direction === "right" ? centerX - 2 : centerX - 10;
  const headX = direction === "right" ? centerX - 13 : centerX + 3;
  const armX = torsoX + 10 + armReach;

  drawRect(ctx, torsoX, centerY - 6, 10, 12, agent.shirt);
  drawRect(ctx, armX, centerY - 8, 4, 3, agent.shirt);
  drawRect(ctx, armX, centerY + 5, 4, 3, agent.shirt);
  drawRect(ctx, torsoX + 2, centerY + 6, 3, 4, agent.pants);
  drawRect(ctx, torsoX + 5, centerY + 6, 3, 4, agent.pants);
  drawRect(ctx, headX, centerY - 5 + headTilt, 10, 10, agent.skin);
  drawRect(
    ctx,
    direction === "right" ? headX : headX + 7,
    centerY - 5 + headTilt,
    3,
    10,
    agent.hair
  );
  drawRect(ctx, headX + 3, centerY - 2 + headTilt, 1, 1, "#181010");
  drawRect(ctx, headX + 3, centerY + 1 + headTilt, 1, 1, "#181010");
}

function drawStandingAgent(
  ctx: CanvasRenderingContext2D,
  agent: SceneAgent,
  options: {
    armOffset?: number;
    headTilt?: number;
    stretch?: boolean;
    facing?: "up" | "down" | "left" | "right";
  } = {}
) {
  const armOffset = options.armOffset ?? 0;
  const headTilt = options.headTilt ?? 0;
  const heightBonus = options.stretch ? 4 : 0;
  const facing = options.facing ?? getAgentFacing(agent);
  const x = agent.x;
  const y = agent.y - heightBonus;

  if (facing === "left" || facing === "right") {
    const dir = facing === "right" ? 1 : -1;
    const headX = facing === "right" ? x - 10 : x;
    const torsoX = facing === "right" ? x : x - 8;
    drawRect(ctx, headX, y - 16 + headTilt, 8, 8, agent.skin);
    drawRect(ctx, facing === "right" ? headX : headX + 6, y - 16 + headTilt, 2, 8, agent.hair);
    drawRect(ctx, torsoX, y - 8, 8, 11 + heightBonus, agent.shirt);
    drawRect(ctx, torsoX + 8 * dir, y - 7 + armOffset, 3, 8, agent.shirt);
    drawRect(ctx, torsoX + 1, y + 3 + heightBonus, 2, 7, agent.pants);
    drawRect(ctx, torsoX + 4, y + 3 + heightBonus, 2, 7, agent.pants);
    return;
  }

  const torsoY = y - 8;
  const headY = y - 17;
  drawRect(ctx, x - 5, torsoY, 10, 11 + heightBonus, agent.shirt);
  drawRect(ctx, x - 8, torsoY + 1 + armOffset, 2, 7, agent.shirt);
  drawRect(ctx, x + 6, torsoY + 1 - armOffset, 2, 7, agent.shirt);
  drawRect(ctx, x - 3, torsoY + 10 + heightBonus, 2, 6, agent.pants);
  drawRect(ctx, x + 1, torsoY + 10 + heightBonus, 2, 6, agent.pants);
  drawRect(ctx, x - 5 + headTilt, headY, 10, 9, agent.skin);
  drawRect(ctx, x - 5 + headTilt, facing === "down" ? headY : headY + 6, 10, 3, agent.hair);
}

function drawWalkingAgent(
  ctx: CanvasRenderingContext2D,
  agent: SceneAgent
) {
  const facing = agent.dir < 0 ? "left" : "right";
  const frame = Math.floor(agent.walkFrame / 8) % 4;
  const stride = facing === "right" ? 8 : -8;
  const x = agent.x;
  const y = agent.y;
  const headX = facing === "right" ? x - 10 : x;
  const torsoX = facing === "right" ? x : x - 8;
  const leftLegX = x + [-5, -5 + stride, -5, -5 - stride][frame];
  const rightLegX = x + [1, 1 - stride, 1, 1 + stride][frame];
  const leftArmX = x + [-9, -13, -9, -5][frame];
  const rightArmX = x + [6, 10, 6, 2][frame];

  drawRect(ctx, headX, y - 16, 8, 8, agent.skin);
  drawRect(ctx, facing === "right" ? headX : headX + 6, y - 16, 2, 8, agent.hair);
  drawRect(ctx, torsoX, y - 8, 8, 10, agent.shirt);
  drawRect(ctx, leftArmX, y - 7, 3, 8, agent.shirt);
  drawRect(ctx, rightArmX, y - 7, 3, 8, agent.shirt);
  drawRect(ctx, leftLegX, y, 5, 10, agent.pants);
  drawRect(ctx, rightLegX, y, 5, 10, agent.pants);
}

function drawDeskWorker(
  ctx: CanvasRenderingContext2D,
  agent: SceneAgent,
  options: {
    typingOffset?: number;
    leanBack?: boolean;
    thought?: boolean;
    stretch?: boolean;
  } = {}
) {
  const typingOffset = options.typingOffset ?? 0;
  const leanY = options.leanBack ? -3 : 0;
  const stretchHeight = options.stretch ? 4 : 0;
  const x = agent.x;
  const y = agent.y + leanY - stretchHeight;

  drawRect(ctx, x - 6, y - 6, 12, 10 + stretchHeight, agent.shirt);
  drawRect(ctx, x - 9, y - 5 + typingOffset, 3, 7, agent.shirt);
  drawRect(ctx, x + 6, y - 5 - typingOffset, 3, 7, agent.shirt);
  drawRect(ctx, x - 5, y + 4 + stretchHeight, 4, 5, agent.pants);
  drawRect(ctx, x + 1, y + 4 + stretchHeight, 4, 5, agent.pants);
  drawRect(ctx, x - 5, y - 15, 10, 9, agent.skin);
  drawRect(ctx, x - 5, y - 15, 10, 3, agent.hair);
  drawRect(ctx, x - 3, y - 11, 1, 1, "#181010");
  drawRect(ctx, x + 2, y - 11, 1, 1, "#181010");

  if (options.thought) {
    drawThoughtBubble(ctx, x, y - 19, "dots");
  }
}

function drawLoungeWatcher(
  ctx: CanvasRenderingContext2D,
  agent: SceneAgent,
  frame: number,
  armLift = 0
) {
  const x = agent.x;
  const bob = Math.sin(((frame + hashSeed(agent.id)) / 120) * Math.PI * 2) * 0.8;
  const y = agent.y + bob;
  drawRect(ctx, x - 6, y - 4, 12, 9, agent.shirt);
  drawRect(ctx, x - 8, y - 2 + armLift, 2, 6, agent.shirt);
  drawRect(ctx, x + 6, y - 2, 2, 6, agent.shirt);
  drawRect(ctx, x - 4, y + 5, 3, 4, agent.pants);
  drawRect(ctx, x + 1, y + 5, 3, 4, agent.pants);
  drawRect(ctx, x - 12, y - 5, 8, 8, agent.skin);
  drawRect(ctx, x - 6, y - 5, 2, 8, agent.hair);
}

function drawMahjongFurniture(
  ctx: CanvasRenderingContext2D,
  frame: number,
  runtime: SceneRuntime,
  sceneAgents: SceneAgent[],
  layers: SceneDrawLayers
) {
  const tileWidth = 10;
  const tileHeight = 6;
  const tileGap = 4;
  const tileRowStartX = MAHJONG_TABLE_X + Math.round((MAHJONG_TABLE_SIZE - (tileWidth * 4 + tileGap * 3)) / 2);
  const tileRowStartY = MAHJONG_TABLE_Y + 27;
  const tileColors = ["#efe5cb", "#ddd2b3", "#f3ead5", "#e7ddc0"] as const;
  const orderedMahjongAgents = orderMahjongAgents(getHomeRoomAgents(sceneAgents, "mahjong"));

  const chairColor = "#3a2208";
  const chairSeatColor = "#4a2e10";
  const chairSlots = [
    { x: MAHJONG_TABLE_CENTER_X, y: MAHJONG_TABLE_Y - 14, horizontal: true },
    { x: MAHJONG_TABLE_CENTER_X, y: MAHJONG_TABLE_Y + MAHJONG_TABLE_SIZE + 4, horizontal: true },
    { x: MAHJONG_TABLE_X - 14, y: MAHJONG_TABLE_CENTER_Y, horizontal: false },
    { x: MAHJONG_TABLE_X + MAHJONG_TABLE_SIZE + 4, y: MAHJONG_TABLE_CENTER_Y, horizontal: false }
  ] as const;

  layers.back.push({
    draw: () => {
      drawRect(ctx, 24, 68, 68, 46, "#3a2810");
      drawRect(ctx, 27, 71, 62, 40, "#4a5c38");
      drawRect(ctx, 27, 86, 62, 10, "#384828");
      drawRect(ctx, 48, 72, 14, 26, "#608855");
      drawRect(ctx, 35, 76, 12, 22, "#507848");
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = "#8a6020";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(27, 71, 62, 40);
      ctx.restore();

      drawRect(ctx, 26, 116, 10, 18, "#c88820");
      drawRect(ctx, 29, 134, 4, 4, "#f0a820");
      drawRect(ctx, 237, 100, 10, 18, "#c88820");
      drawRect(ctx, 240, 118, 4, 4, "#f0a820");
      drawRect(ctx, 22, 210, 14, 10, "#5a3a18");
      drawRect(ctx, 18, 195, 18, 16, "#1a6016");
      drawRect(ctx, 20, 185, 14, 12, "#228018");
      drawRect(ctx, 24, 178, 8, 8, "#2a9020");
      drawRect(ctx, 240, 210, 14, 10, "#5a3a18");
      drawRect(ctx, 238, 196, 16, 14, "#1a6016");
      drawRect(ctx, 240, 188, 12, 10, "#228018");
      drawRect(ctx, 214, 74, 26, 8, "#1e2430");
      drawRect(ctx, 216, 76, 22, 4, "#2b364a");
    }
  });

  layers.chairs.push({
    draw: () => {
      chairSlots.forEach((slot) => {
        if (slot.horizontal) {
          drawRect(ctx, slot.x - 14, slot.y - 6, 28, 12, chairColor);
          drawRect(ctx, slot.x - 11, slot.y - 4, 22, 8, chairSeatColor);
          return;
        }

        drawRect(ctx, slot.x - 6, slot.y - 14, 12, 28, chairColor);
        drawRect(ctx, slot.x - 4, slot.y - 11, 8, 22, chairSeatColor);
      });
    }
  });

  layers.surfaces.push({
    draw: () => {
      drawRect(ctx, MAHJONG_TABLE_X, MAHJONG_TABLE_Y, MAHJONG_TABLE_SIZE, MAHJONG_TABLE_SIZE, "#4a2e10");
      drawRect(ctx, MAHJONG_TABLE_X + 4, MAHJONG_TABLE_Y + 4, MAHJONG_TABLE_SIZE - 8, MAHJONG_TABLE_SIZE - 8, "#1f5a1c");
      drawRect(ctx, MAHJONG_TABLE_X + 3, MAHJONG_TABLE_Y + 3, MAHJONG_TABLE_SIZE - 6, 2, "#d9b45a");
      drawRect(ctx, MAHJONG_TABLE_X + 3, MAHJONG_TABLE_Y + MAHJONG_TABLE_SIZE - 5, MAHJONG_TABLE_SIZE - 6, 2, "#d9b45a");
      drawRect(ctx, MAHJONG_TABLE_X + 3, MAHJONG_TABLE_Y + 3, 2, MAHJONG_TABLE_SIZE - 6, "#d9b45a");
      drawRect(ctx, MAHJONG_TABLE_X + MAHJONG_TABLE_SIZE - 5, MAHJONG_TABLE_Y + 3, 2, MAHJONG_TABLE_SIZE - 6, "#d9b45a");
    }
  });

  if (orderedMahjongAgents.length !== 4) {
    return;
  }

  const activePhase = frame % 80;
  const activePlayerIndex = runtime.mahjongActiveIndex % orderedMahjongAgents.length;
  const activeMahjongAgent = orderedMahjongAgents[activePlayerIndex];
  const getMahjongHandPosition = (agent: SceneAgent) => {
    const facing = getMahjongFacing(agent);

    if (facing === "down") {
      return { x: agent.homeX, y: agent.homeY + 8 };
    }

    if (facing === "up") {
      return { x: agent.homeX, y: agent.homeY - 8 };
    }

    if (facing === "right") {
      return { x: agent.homeX + 8, y: agent.homeY };
    }

    return { x: agent.homeX - 8, y: agent.homeY };
  };
  const tileFrom =
    activeMahjongAgent && isSeatOccupied(activeMahjongAgent)
      ? getMahjongHandPosition(activeMahjongAgent)
      : null;
  const tileCenter = { x: MAHJONG_TABLE_CENTER_X, y: MAHJONG_TABLE_CENTER_Y + 2 };

  orderedMahjongAgents.forEach((player, index) => {
    if (isWalkingState(player)) {
      layers.characters.push({
        y: player.y,
        draw: () => drawWalkingAgent(ctx, player)
      });
      return;
    }

    if (!isSeatOccupied(player)) {
      layers.characters.push({
        y: player.y,
        draw: () =>
          drawStandingAgent(ctx, player, {
            armOffset: Math.round(Math.sin(player.walkFrame * 0.12) * 2),
            stretch: true,
            facing: player.dir < 0 ? "left" : "right"
          })
      });
      return;
    }

    const facing = getMahjongFacing(player);
    const isActive = activeMahjongAgent?.id === player.id;
    const armReach =
      isActive && activePhase < 15
        ? facing === "left"
          ? -6
          : facing === "right"
            ? 6
            : facing === "down"
              ? 6
              : -6
        : 0;
    const headTilt =
      !isActive && activePhase >= 15 && activePhase < 25
        ? index % 2 === 0
          ? -2
          : 2
        : 0;

    const drawY = player.y + (facing === "down" ? 2 : facing === "up" ? -2 : 0);
    layers.characters.push({
      y: drawY,
      draw: () => {
        const previousY = player.y;
        player.y = drawY;
        drawMahjongPlayer(ctx, player, {
          armReach,
          headTilt
        });
        player.y = previousY;
      }
    });
  });

  layers.foreground.push({
    draw: () => {
      for (let index = 0; index < 4; index += 1) {
        const tileX = tileRowStartX + index * (tileWidth + tileGap);
        drawRect(ctx, tileX, tileRowStartY, tileWidth, tileHeight, tileColors[index]);
        drawRect(ctx, tileX, tileRowStartY + 12, tileWidth, tileHeight, tileColors[(index + 1) % 4]);
        drawRect(ctx, tileX + 3, tileRowStartY + 2, 2, 2, "#bf3d3d");
        drawRect(ctx, tileX + 4, tileRowStartY + 14, 2, 2, "#2d6cdf");
      }

      if (tileFrom && activePhase >= 15 && activePhase < 35) {
        const progress = (activePhase - 15) / 20;
        const tileX = lerp(tileFrom.x, tileCenter.x, progress);
        const tileY = lerp(tileFrom.y, tileCenter.y, progress);
        drawRect(ctx, tileX - 4, tileY - 2, 8, 4, tileColors[(activePlayerIndex + 2) % tileColors.length]);
        drawRect(ctx, tileX - 1, tileY - 1, 2, 2, activePlayerIndex % 2 === 0 ? "#bf3d3d" : "#2d6cdf");
      }

      if (tileFrom && activePhase >= 35 && activePhase < 45) {
        drawRect(ctx, tileCenter.x - 4, tileCenter.y - 2, 8, 4, tileColors[(activePlayerIndex + 2) % tileColors.length]);
        drawRect(ctx, tileCenter.x - 1, tileCenter.y - 1, 2, 2, activePlayerIndex % 2 === 0 ? "#bf3d3d" : "#2d6cdf");
      }
    }
  });
}

function drawPantryFurniture(
  ctx: CanvasRenderingContext2D,
  _frame: number,
  runtime: SceneRuntime,
  sceneAgents: SceneAgent[],
  layers: SceneDrawLayers
) {
  const bottleColors = ["#b02020", "#204090", "#208040", "#a06020"] as const;
  const lowerShelfColors = ["#c03050", "#306080", "#208060"] as const;
  const pantryAgent = getHomeRoomAgents(sceneAgents, "coffee")[0];
  const armOffset =
    pantryAgent?.state === "seated"
      ? Math.round(Math.sin((pantryAgent.walkFrame / 40) * Math.PI * 2) * 3)
      : pantryAgent
        ? Math.round(Math.sin(pantryAgent.walkFrame * 0.12) * 2)
        : 0;

  layers.back.push({
    draw: () => {
      drawRect(ctx, 264, 16, 196, 32, "#3a2510");
      drawRect(ctx, 264, 16, 196, 3, "#5a3a18");
      for (let index = 0; index < 5; index += 1) {
        drawRect(ctx, 267 + index * 38, 20, 34, 24, "#321e08");
      }
      drawRect(ctx, 432, 64, 28, 54, "#2840a0");
      drawRect(ctx, 434, 66, 24, 50, "#1a3080");
      drawRect(ctx, 434, 66, 24, 25, "#243898");
      drawRect(ctx, 458, 80, 4, 8, "#a8b8d0");
      drawRect(ctx, 430, 125, 34, 2, "#3a2810");
      drawRect(ctx, 430, 145, 34, 2, "#3a2810");
      drawRect(ctx, 430, 165, 34, 2, "#3a2810");
      drawRect(ctx, 430, 125, 2, 44, "#3a2810");
      drawRect(ctx, 462, 125, 2, 44, "#3a2810");
      for (let index = 0; index < bottleColors.length; index += 1) {
        drawRect(ctx, 434 + index * 6, 108, 5, 17, bottleColors[index]);
      }
      for (let index = 0; index < lowerShelfColors.length; index += 1) {
        drawRect(ctx, 434 + index * 9, 128, 8, 14, lowerShelfColors[index]);
      }
      drawRect(ctx, 334, 210, 12, 12, "#5a3a18");
      drawRect(ctx, 330, 193, 18, 18, "#1a6016");
      drawRect(ctx, 333, 182, 12, 14, "#228018");
      drawRect(ctx, 356, 16, 28, 6, "#c89828");
      drawRect(ctx, 367, 22, 6, 4, "#f0c020");
      drawRect(ctx, 276, 74, 58, 12, "#212938");
      drawRect(ctx, 278, 76, 54, 8, "#2b3648");
      drawRect(ctx, 282, 79, 8, 2, "#8fd3ff");
      drawRect(ctx, 294, 79, 10, 2, "#7ce38b");
      drawRect(ctx, 308, 79, 18, 2, "#f0c020");
    }
  });

  layers.chairs.push({
    draw: () => {
      drawRect(ctx, 296, 165, 12, 8, "#3a2208");
      drawRect(ctx, 356, 165, 12, 8, "#3a2208");
      drawRect(ctx, 310, 188, 16, 8, "#3a2208");
    }
  });

  layers.surfaces.push({
    draw: () => {
      drawRect(ctx, 264, 48, 196, 18, "#4a2e10");
      drawRect(ctx, 264, 48, 196, 3, "#6a4820");
      drawRect(ctx, 275, 40, 10, 8, "#9060a0");
      drawRect(ctx, 290, 42, 8, 6, "#808078");
      drawRect(ctx, 305, 40, 12, 8, "#b06030");
      drawRect(ctx, 322, 43, 7, 5, "#d09040");
      drawRect(ctx, 395, 38, 18, 10, "#3050a0");
      drawRect(ctx, 420, 40, 14, 8, "#606050");
      drawRect(ctx, 440, 38, 16, 10, "#a03020");
      drawRect(ctx, 300, 160, 60, 38, "#4a2e10");
      drawRect(ctx, 300, 160, 60, 3, "#6a4820");
      drawRect(ctx, PANTRY_KETTLE_X, PANTRY_KETTLE_Y, 10, 7, "#6c4c2c");
      drawRect(ctx, PANTRY_KETTLE_X + 7, PANTRY_KETTLE_Y - 2, 4, 2, "#d8c8a8");
    }
  });

  if (pantryAgent) {
    layers.characters.push({
      y: pantryAgent.y,
      draw: () => {
        if (isWalkingState(pantryAgent)) {
          drawWalkingAgent(ctx, pantryAgent);
          return;
        }

        drawStandingAgent(ctx, pantryAgent, {
          armOffset,
          facing:
            pantryAgent.state === "seated"
              ? "up"
              : pantryAgent.dir < 0
                ? "left"
                : "right"
        });
      }
    });
  }

  layers.foreground.push({
    draw: () => {
      runtime.steamParticles.forEach((particle) => {
        drawRect(ctx, particle.x, particle.y, 2, 2, `rgba(255,255,255,${particle.alpha})`);
      });
    }
  });
}

function drawQuietFurniture(
  ctx: CanvasRenderingContext2D,
  _frame: number,
  sceneAgents: SceneAgent[],
  layers: SceneDrawLayers
) {
  const bookColors = ["#b02020", "#2050a0", "#208040", "#a06020", "#702090", "#c04828", "#1868a0", "#8a2040"];
  layers.back.push({
    draw: () => {
      drawRect(ctx, 680, 58, 40, 186, "#2a1e0e");
      drawRect(ctx, 680, 58, 40, 3, "#3a2a14");
      [80, 118, 156, 194].forEach((offset) => drawRect(ctx, 680, 58 + offset, 40, 3, "#3a2a14"));
      for (let row = 0; row < 4; row += 1) {
        for (let col = 0; col < 5; col += 1) {
          drawRect(ctx, 682 + col * 7, 68 + row * 38, 6, 28, bookColors[(row * 5 + col) % bookColors.length]);
        }
      }
      drawRect(ctx, 718, 62, 28, 26, "#b02020");
      drawRect(ctx, 720, 64, 24, 22, "#c83030");
      drawRect(ctx, 720, 64, 24, 6, "#e04040");
      drawRect(ctx, 476, 75, 10, 16, "#c88820");
      drawRect(ctx, 479, 91, 4, 3, "#f0a820");
      drawRect(ctx, 480, 218, 12, 10, "#5a3a18");
      drawRect(ctx, 477, 204, 16, 15, "#1a6016");
      drawRect(ctx, 479, 196, 12, 10, "#228018");
      drawRect(ctx, 606, 74, 44, 10, "#251f2d");
      drawRect(ctx, 608, 76, 40, 6, "#3a3148");
      drawRect(ctx, 612, 78, 12, 2, "#b68cff");
    }
  });

  layers.chairs.push({
    draw: () => {
      drawRect(ctx, 540, 192, 36, 28, "#1a2438");
      drawRect(ctx, 540, 192, 36, 4, "#242e48");
      drawRect(ctx, 536, 196, 6, 18, "#151e30");
      drawRect(ctx, 570, 196, 6, 18, "#151e30");
      drawRect(ctx, 538, 214, 6, 10, "#111820");
      drawRect(ctx, 566, 214, 6, 10, "#111820");
    }
  });

  layers.surfaces.push({
    draw: () => {
      drawRect(ctx, 518, 158, 120, 38, "#5a3818");
      drawRect(ctx, 518, 158, 120, 3, "#7a4e28");
      drawRect(ctx, 518, 196, 8, 42, "#4a2e10");
      drawRect(ctx, 630, 196, 8, 42, "#4a2e10");
      drawRect(ctx, 548, 126, 36, 28, "#151e30");
      drawRect(ctx, 550, 128, 32, 24, "#0a1220");
      drawRect(ctx, 552, 130, 28, 20, "#1840b0");
      drawRect(ctx, 555, 133, 22, 2, "#8ecbff");
      drawRect(ctx, 557, 139, 14, 2, "#5a8cff");
      drawRect(ctx, 562, 154, 12, 4, "#1a2030");
      drawRect(ctx, 628, 152, 4, 8, "#8090a0");
      drawRect(ctx, 624, 150, 12, 4, "#fff07a");
    }
  });

  const quietAgent = getHomeRoomAgents(sceneAgents, "nap")[0];
  const typingOffset = quietAgent?.state === "seated" ? getTypingOffset(quietAgent, 10) : 0;

  if (quietAgent) {
    layers.characters.push({
      y: quietAgent.y,
      draw: () => {
        if (isSeatOccupied(quietAgent)) {
          drawDeskWorker(ctx, quietAgent, {
            typingOffset,
            leanBack: false,
            thought: false
          });
          return;
        }

        if (isWalkingState(quietAgent)) {
          drawWalkingAgent(ctx, quietAgent);
          return;
        }

        drawStandingAgent(ctx, quietAgent, {
          armOffset: Math.round(Math.sin(quietAgent.walkFrame * 0.12) * 2),
          headTilt: Math.round(Math.sin(quietAgent.walkFrame * 0.08) * 1.5),
          facing: quietAgent.dir < 0 ? "left" : "right"
        });
      }
    });
  }
}

function drawLoungeFurniture(
  ctx: CanvasRenderingContext2D,
  frame: number,
  runtime: SceneRuntime,
  sceneAgents: SceneAgent[],
  layers: SceneDrawLayers
) {
  const snackColors = ["#e8a020", "#20b040", "#c02828", "#2060b0"] as const;
  const stars = [
    [55, 275], [80, 278], [100, 272], [120, 280], [140, 274], [160, 278], [175, 271],
    [65, 290], [95, 298], [130, 285], [158, 292], [170, 285], [58, 308], [88, 315],
    [115, 305], [145, 310], [168, 302], [175, 312], [60, 325], [90, 328], [118, 320],
    [148, 325], [170, 318], [55, 340], [85, 345], [110, 338], [140, 342], [168, 335], [180, 348]
  ] as const;
  const starOffset = (frame * 0.2) % 20;
  const craftX = 130 + Math.sin(frame * 0.015) * 9;
  const craftY = 316 + Math.cos(frame * 0.012) * 4;

  layers.back.push({
    draw: () => {
      drawRect(ctx, 20, 268, 28, 68, "#b02020");
      drawRect(ctx, 22, 272, 24, 36, "#08202e");
      for (let row = 0; row < 2; row += 1) {
        for (let col = 0; col < 2; col += 1) {
          drawRect(ctx, 24 + col * 10, 274 + row * 16, 9, 13, snackColors[row * 2 + col]);
        }
      }
      drawRect(ctx, 22, 312, 24, 8, "#303030");
      drawRect(ctx, 28, 322, 12, 8, "#909090");

      drawRect(ctx, 50, 268, 140, 96, "#0d1830");
      drawRect(ctx, 52, 270, 136, 92, "#060e1e");
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      stars.forEach(([x, y]) => {
        const nextX = 52 + ((x - 52 + starOffset) % 136);
        ctx.fillRect(nextX, y, 1, 1);
      });
      ctx.fillStyle = "#3a4a60";
      ctx.beginPath();
      ctx.arc(108, 340, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#4a5a70";
      ctx.beginPath();
      ctx.arc(104, 336, 16, 0, Math.PI * 2);
      ctx.fill();
      drawRect(ctx, craftX, craftY, 24, 12, "#3a4050");
      drawRect(ctx, craftX - 2, craftY + 3, 4, 6, "#4a5068");
      drawRect(ctx, craftX + 20, craftY + 3, 4, 6, "#4a5068");
      drawRect(ctx, craftX + 10, craftY - 6, 6, 10, "#5060a0");
      drawGlow(ctx, 120, 316, 110, `rgba(30,60,200,${0.16 + Math.sin(frame * 0.05) * 0.01})`);
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = "#2a3848";
      ctx.lineWidth = 2;
      ctx.strokeRect(50, 268, 140, 96);
      ctx.restore();
      drawRect(ctx, 195, 260, 64, 14, "#2a3020");
      drawRect(ctx, 197, 262, 60, 10, "#344028");
      for (let offset = 4; offset <= 52; offset += 8) {
        drawRect(ctx, 199 + offset, 265, 4, 3, "#5d7f48");
      }
      drawRect(ctx, 296, 265, 14, 12, "#5a3a18");
      drawRect(ctx, 292, 250, 18, 16, "#1a6016");
      drawRect(ctx, 295, 240, 12, 13, "#228018");
      drawRect(ctx, 344, 268, 14, 12, "#5a3a18");
      drawRect(ctx, 340, 254, 18, 14, "#1a6016");
      drawRect(ctx, 343, 244, 12, 11, "#228018");
      drawRect(ctx, 188, 260, 12, 18, "#c88820");
      drawRect(ctx, 191, 278, 5, 4, "#f0a820");
      drawRect(ctx, 320, 260, 12, 18, "#c88820");
      drawRect(ctx, 323, 278, 5, 4, "#f0a820");
      drawRect(ctx, 70, 430, 40, 8, "#101829");
      drawRect(ctx, 74, 432, 32, 4, "#69b8ff");
    }
  });

  layers.chairs.push({
    draw: () => {
      drawRect(ctx, 130, 390, 130, 38, "#1e2a48");
      drawRect(ctx, 128, 388, 134, 10, "#182038");
      drawRect(ctx, 128, 388, 8, 38, "#182038");
      drawRect(ctx, 254, 388, 8, 38, "#182038");
      drawRect(ctx, 130, 365, 130, 26, "#182038");
      drawRect(ctx, 130, 362, 130, 4, "#22304e");
      drawRect(ctx, 136, 378, 52, 10, "#1a2640");
      drawRect(ctx, 192, 378, 52, 10, "#1a2640");
    }
  });

  layers.surfaces.push({
    draw: () => {
      drawRect(ctx, 165, 428, 80, 18, "#3a2810");
      drawRect(ctx, 165, 428, 80, 3, "#5a3a18");
      drawRect(ctx, 167, 440, 8, 8, "#2a1e0a");
      drawRect(ctx, 231, 440, 8, 8, "#2a1e0a");
    }
  });

  const loungeAgents = getHomeRoomAgents(sceneAgents, "cards");
  const loungePhase = frame % 400;
  loungeAgents.forEach((agent, index) => {
    layers.characters.push({
      y: agent.y,
      draw: () => {
        if (isSeatOccupied(agent)) {
          drawLoungeWatcher(
            ctx,
            agent,
            frame,
            runtime.loungeRaisedIndex === index && loungePhase < 30 ? -5 : 0
          );
          return;
        }

        if (isWalkingState(agent)) {
          drawWalkingAgent(ctx, agent);
          return;
        }

        drawStandingAgent(ctx, agent, {
          armOffset: Math.round(Math.sin(agent.walkFrame * 0.18) * 2),
          facing: agent.dir < 0 ? "left" : "right"
        });
      }
    });
  });

  layers.foreground.push({
    draw: () => {
      drawRect(ctx, 180, 422, 8, 6, "#b04020");
      drawRect(ctx, 230, 422, 8, 6, "#507060");
    }
  });
}

function drawSeatedWorkAgent(
  ctx: CanvasRenderingContext2D,
  agent: SceneAgent,
  options: {
    stretch?: boolean;
  } = {}
) {
  const stretch = options.stretch ?? false;
  const typingPhase = Math.floor(agent.walkFrame / 10) % 2;
  const leftHandOffset = stretch ? 18 : typingPhase === 0 ? 8 : 12;
  const rightHandOffset = stretch ? 18 : typingPhase === 0 ? 12 : 8;
  const bodyX = agent.x - 7;
  const bodyY = agent.y - 17 - (stretch ? 5 : 0);
  const torsoHeight = 11 + (stretch ? 5 : 0);
  const armTopY = stretch ? bodyY - 2 : bodyY + 10;

  drawRect(ctx, bodyX + 2, bodyY + 18, 4, 6, agent.pants);
  drawRect(ctx, bodyX + 8, bodyY + 18, 4, 6, agent.pants);
  drawRect(ctx, bodyX, bodyY + 8, 14, torsoHeight, agent.shirt);
  drawRect(ctx, bodyX - 2, armTopY, 3, stretch ? 10 : 7, agent.shirt);
  drawRect(ctx, bodyX + 13, armTopY, 3, stretch ? 10 : 7, agent.shirt);
  drawRect(ctx, agent.x - 6, agent.y - leftHandOffset, 4, 4, agent.skin);
  drawRect(ctx, agent.x + 3, agent.y - rightHandOffset, 4, 4, agent.skin);
  drawRect(ctx, bodyX + 3, bodyY, 8, 9, agent.skin);
  drawRect(ctx, bodyX + 3, bodyY, 8, 3, agent.hair);
  drawRect(ctx, bodyX + 4, bodyY + 4, 1, 1, "#181010");
  drawRect(ctx, bodyX + 8, bodyY + 4, 1, 1, "#181010");
}

function drawWorkFloor(
  ctx: CanvasRenderingContext2D,
  _frame: number,
  desks: OfficeWorld3DDesk[],
  sceneAgents: SceneAgent[],
  layers: SceneDrawLayers
) {
  const workstations = buildDeskWorkstations(desks);
  const workAgents = getRoomAgents(sceneAgents, "work");

  layers.back.push({
    draw: () => {
      [[460, 256], [540, 256], [640, 256]].forEach(([x, y]) => {
        drawRect(ctx, x, y, 34, 5, "#c89828");
        drawRect(ctx, x + 13, y + 5, 8, 4, "#f0c020");
      });

      drawRect(ctx, 384, 260, 12, 12, "#5a3a18");
      drawRect(ctx, 380, 245, 16, 16, "#1a6016");
      drawRect(ctx, 383, 235, 10, 12, "#228018");
      drawRect(ctx, 706, 260, 12, 12, "#5a3a18");
      drawRect(ctx, 702, 245, 16, 16, "#1a6016");
      drawRect(ctx, 705, 235, 10, 12, "#228018");
    }
  });

  layers.chairs.push({
    draw: () => {
      workstations.forEach(({ x, chairY }) => {
        drawRect(ctx, x - 3, chairY, CHAIR_WIDTH, CHAIR_HEIGHT, "#2a1e10");
        drawRect(ctx, x + 1, chairY + 2, CHAIR_WIDTH - 8, CHAIR_HEIGHT - 4, "#1a2840");
      });
    }
  });

  layers.surfaces.push({
    draw: () => {
      workstations.forEach(({ x, y }) => {
        drawRect(ctx, x, y, DESK_WIDTH, DESK_HEIGHT, "#5a3818");
        drawRect(ctx, x, y, DESK_WIDTH, 3, "#7a4e28");
        drawRect(ctx, x + 12, y - MONITOR_HEIGHT + 2, MONITOR_WIDTH, MONITOR_HEIGHT, "#151e30");
        drawRect(ctx, x + 13, y - MONITOR_HEIGHT + 3, MONITOR_WIDTH - 2, MONITOR_HEIGHT - 3, "#0a1220");
        drawRect(ctx, x + 14, y - MONITOR_HEIGHT + 4, MONITOR_WIDTH - 4, MONITOR_HEIGHT - 5, "#1840b0");
        drawRect(ctx, x + 17, y - MONITOR_HEIGHT + 7, MONITOR_WIDTH - 10, 2, "#94d3ff");
        drawRect(ctx, x + 19, y - MONITOR_HEIGHT + 12, MONITOR_WIDTH - 14, 2, "#5785ff");
        drawRect(ctx, x + 17, y + DESK_HEIGHT, 10, 4, "#1a2030");
      });
    }
  });

  workAgents.forEach((agent) => {
    layers.characters.push({
      y: agent.y,
      draw: () => {
        if (agent.state === "seated" || agent.state === "stretch") {
          drawSeatedWorkAgent(ctx, agent, {
            stretch: agent.state === "stretch"
          });
          return;
        }

        if (isWalkingState(agent)) {
          drawWalkingAgent(ctx, agent);
          return;
        }

        drawStandingAgent(ctx, agent, {
          armOffset: Math.round(Math.sin(agent.walkFrame * 0.18) * 2),
          headTilt: Math.round(Math.sin(agent.walkFrame * 0.1) * 1.5),
          facing: agent.dir < 0 ? "left" : "right"
        });
      }
    });
  });

  layers.foreground.push({
    draw: () => {
      workstations.forEach(({ index, x, y }) => {
        drawRect(ctx, x + 7, y - 3, 8, 4, index % 2 === 0 ? "#e1d6a9" : "#e6c57a");
        drawRect(ctx, x + 29, y - 3, 6, 5, index % 2 === 0 ? "#b04020" : "#507060");
      });
    }
  });
}

function drawRoomHighlight(
  ctx: CanvasRenderingContext2D,
  room: SceneRoom
) {
  const bounds = ROOM_LAYOUT[room].bounds;
  const x = bounds.left * 8.8;
  const y = bounds.top * 5.6;
  const width = bounds.width * 8.8;
  const height = bounds.height * 5.6;

  ctx.save();
  ctx.fillStyle = "rgba(255,235,150,0.08)";
  ctx.strokeStyle = "rgba(255,235,150,0.45)";
  ctx.lineWidth = 3;
  ctx.shadowColor = "rgba(255,220,120,0.32)";
  ctx.shadowBlur = 24;
  ctx.fillRect(x, y, width, height);
  ctx.strokeRect(x + 1.5, y + 1.5, width - 3, height - 3);
  ctx.restore();
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  time: number,
  activeRoom: SceneRoom,
  agents: OfficeWorld3DAgent[],
  desks: OfficeWorld3DDesk[],
  runtime: SceneRuntime
) {
  const frame = Math.floor(time / (1000 / 60));
  const sceneAgents = createRenderableSceneAgents(agents, frame);
  const layers: SceneDrawLayers = {
    back: [],
    chairs: [],
    surfaces: [],
    characters: [],
    foreground: []
  };
  updateSceneRuntime(runtime, sceneAgents, frame);
  ctx.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);
  drawBackground(ctx);
  drawFloors(ctx);
  drawWalls(ctx);
  drawThresholds(ctx);
  drawLighting(ctx, time);
  drawMahjongFurniture(ctx, frame, runtime, sceneAgents, layers);
  drawPantryFurniture(ctx, frame, runtime, sceneAgents, layers);
  drawQuietFurniture(ctx, frame, sceneAgents, layers);
  drawLoungeFurniture(ctx, frame, runtime, sceneAgents, layers);
  drawWorkFloor(ctx, frame, desks, sceneAgents, layers);
  layers.back.forEach((entry) => entry.draw());
  layers.chairs.forEach((entry) => entry.draw());
  layers.surfaces.forEach((entry) => entry.draw());
  layers.characters.sort((left, right) => left.y - right.y).forEach((entry) => entry.draw());
  layers.foreground.forEach((entry) => entry.draw());
  drawRoomHighlight(ctx, activeRoom);
}

export function OfficeWorld3D({
  agents,
  desks,
  zones,
  conversation,
  selectedAgentId = null,
  onSelectRoom,
  onSelectAgent
}: OfficeWorld3DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const agentsRef = useRef<OfficeWorld3DAgent[]>(agents);
  const desksRef = useRef<OfficeWorld3DDesk[]>(desks);
  const sceneRuntimeRef = useRef<SceneRuntime | null>(null);
  const activeRoom = zones.find((zone) => zone.active)?.room ?? "work";
  const activeRoomRef = useRef<SceneRoom>(activeRoom);
  const placements = useMemo(() => buildAgentPlacements(agents), [agents]);
  const deskSignals = useMemo(() => buildDeskSignals(desks), [desks]);

  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  useEffect(() => {
    desksRef.current = desks;
  }, [desks]);

  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    let frameId = 0;

    if (!sceneRuntimeRef.current) {
      sceneRuntimeRef.current = createInitialSceneRuntime();
    }

    const tick = (time: number) => {
      if (!sceneRuntimeRef.current) {
        sceneRuntimeRef.current = createInitialSceneRuntime();
      }

      drawScene(
        context,
        time,
        activeRoomRef.current,
        agentsRef.current,
        desksRef.current,
        sceneRuntimeRef.current
      );
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  return (
    <div className="oc-world3d-shell oc-world-plan-shell">
      <canvas
        ref={canvasRef}
        className="oc-world-plan-canvas"
        width={STAGE_WIDTH}
        height={STAGE_HEIGHT}
        aria-hidden="true"
      />

      <div className="oc-world-plan-overlay">
        {zones.map((zone) => {
          const layout = ROOM_LAYOUT[zone.room];

          return (
            <button
              key={`${zone.room}-zone`}
              type="button"
              className={`oc-world-plan-zone ${zone.active ? "is-active" : ""}`}
              style={
                {
                  left: `${layout.bounds.left}%`,
                  top: `${layout.bounds.top}%`,
                  width: `${layout.bounds.width}%`,
                  height: `${layout.bounds.height}%`
                } satisfies CSSProperties
              }
              onClick={() => onSelectRoom?.(zone.room)}
              aria-label={`${zone.label}, ${zone.status}`}
              aria-pressed={zone.active}
            >
              <span className="oc-world-plan-zone-highlight" />
            </button>
          );
        })}

        {zones.map((zone) => {
          const layout = ROOM_LAYOUT[zone.room];

          return (
            <div
              key={`${zone.room}-caption`}
              className={`oc-world-plan-room-caption ${zone.active ? "is-active" : ""}`}
              style={
                {
                  left: `${layout.caption.left}%`,
                  top: `${layout.caption.top}%`
                } satisfies CSSProperties
              }
              aria-hidden="true"
            >
              <strong>{zone.label}</strong>
              <span>{zone.status.toLowerCase()}</span>
            </div>
          );
        })}

        {zones.map((zone) => {
          const layout = ROOM_LAYOUT[zone.room];

          return (
            <button
              key={`${zone.room}-badge`}
              type="button"
              className={`oc-world-plan-badge ${STATUS_TONE_CLASS[zone.statusTone]} ${zone.active ? "is-active" : ""}`}
              style={
                {
                  left: `${layout.badge.left}%`,
                  top: `${layout.badge.top}%`
                } satisfies CSSProperties
              }
              onClick={() => onSelectRoom?.(zone.room)}
            >
              <span
                className="oc-world-plan-badge-dot"
                style={{ backgroundColor: STATUS_TONE_COLOR[zone.statusTone] }}
              />
              <span className="oc-world-plan-badge-label">{zone.label}</span>
              <strong
                className="oc-world-plan-badge-status"
                style={{ color: STATUS_TONE_COLOR[zone.statusTone] }}
              >
                {zone.status}
              </strong>
            </button>
          );
        })}

        {deskSignals.map((signal) => (
          <span
            key={`${signal.id}-desk-signal`}
            className="oc-world-plan-desk-signal"
            style={
              {
                left: `${signal.left}%`,
                top: `${signal.top}%`,
                "--desk-signal": signal.accent
              } as CSSProperties & Record<"--desk-signal", string>
            }
            aria-hidden="true"
          />
        ))}

        {placements.map((placement) => (
          <button
            key={placement.agent.id}
            type="button"
            className={`oc-world-plan-agent ${ROLE_SPRITE_CLASS[placement.agent.role]} ${selectedAgentId === placement.agent.id ? "is-selected" : ""}`}
            style={
              {
                left: `${placement.left}%`,
                top: `${placement.top}%`,
                zIndex: placement.zIndex,
                "--agent-accent": placement.agent.accent
              } as CSSProperties & Record<"--agent-accent", string>
            }
            onClick={() => onSelectAgent?.(placement.agent.id)}
            aria-label={`${placement.agent.name}, ${placement.agent.role}, ${placement.room}`}
            title={`${placement.agent.name} · ${placement.room}`}
            data-action={placement.action}
          >
            <span
              aria-hidden="true"
              className={`oc-world-plan-agent-sprite is-${placement.pose} facing-${placement.facing}`}
            />
            {placement.action === "typing" &&
            (placement.agent.scene.pose === "walk" || placement.agent.status === "handoff") ? (
              <span className="oc-world-plan-agent-mug" aria-hidden="true" />
            ) : null}
            <span className="oc-world-plan-agent-name">
              <strong>{placement.agent.name}</strong>
              <em>{getAgentStateLabel(placement.agent.status)}</em>
            </span>
          </button>
        ))}

        {conversation ? (
          <div className="oc-world-plan-chat">
            <strong>Floor radio</strong>
            <span>{conversation}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
