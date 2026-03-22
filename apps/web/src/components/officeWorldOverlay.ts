import type { AgentSceneState, SceneFacing, SceneRoom } from "../lib/office";
import type { AgentRecord } from "../types/contracts";

export const OFFICE_BACKGROUND_SRC = "/office-assets/startup-office-isometric-bg.png";
export const OFFICE_SPRITESHEET_SRC = "/office-assets/startup-office-agents.png";

export type OverlayFacing = SceneFacing | "back";
export type OverlaySpriteMotion = "stand" | "walk" | "sit";

export interface OverlaySlot {
  x: number;
  y: number;
  facing?: OverlayFacing;
}

export interface OverlayRoomConfig {
  room: SceneRoom;
  label: string;
  badgeAnchor: OverlaySlot;
  bounds: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  theme: "mahjong" | "coffee" | "nap" | "cards" | "work";
  statusMode: "open" | "occupied" | "seated";
  slots: OverlaySlot[];
}

export type OverlayRoomStatusTone = "open" | "occupied" | "seated";

export interface OverlayRoomStatus {
  label: string;
  tone: OverlayRoomStatusTone;
}

export const ROOM_OVERLAY_LAYOUT: Record<SceneRoom, OverlayRoomConfig> = {
  mahjong: {
    room: "mahjong",
    label: "Mahjong room",
    badgeAnchor: { x: 12.6, y: 18.7 },
    bounds: { left: 6.5, top: 16.5, width: 25.8, height: 25.4 },
    theme: "mahjong",
    statusMode: "seated",
    slots: [
      { x: 17.8, y: 30.7, facing: "right" },
      { x: 23.8, y: 28.8, facing: "front" },
      { x: 26.2, y: 34.6, facing: "left" },
      { x: 20.3, y: 36.5, facing: "back" }
    ]
  },
  coffee: {
    room: "coffee",
    label: "Tea pantry",
    badgeAnchor: { x: 49.8, y: 7.1 },
    bounds: { left: 37, top: 8.4, width: 23.8, height: 22.8 },
    theme: "coffee",
    statusMode: "occupied",
    slots: [
      { x: 44.8, y: 21.1, facing: "back" },
      { x: 49.4, y: 22.2, facing: "right" },
      { x: 54.4, y: 18.8, facing: "left" }
    ]
  },
  nap: {
    room: "nap",
    label: "Quiet pod",
    badgeAnchor: { x: 73.7, y: 18.1 },
    bounds: { left: 69.2, top: 16.2, width: 24.8, height: 27.2 },
    theme: "nap",
    statusMode: "seated",
    slots: [
      { x: 69.3, y: 28.9, facing: "front" },
      { x: 77.3, y: 41.2, facing: "left" },
      { x: 87.6, y: 46.9, facing: "back" }
    ]
  },
  cards: {
    room: "cards",
    label: "Screening lounge",
    badgeAnchor: { x: 21.2, y: 86.7 },
    bounds: { left: 2.4, top: 44.7, width: 35.2, height: 42.4 },
    theme: "cards",
    statusMode: "seated",
    slots: [
      { x: 15.5, y: 71.8, facing: "right" },
      { x: 21.2, y: 77.2, facing: "front" },
      { x: 27.2, y: 73.2, facing: "left" },
      { x: 24.4, y: 69.6, facing: "back" }
    ]
  },
  work: {
    room: "work",
    label: "Work floor",
    badgeAnchor: { x: 73.2, y: 69.9 },
    bounds: { left: 37.6, top: 50.8, width: 57.5, height: 38.7 },
    theme: "work",
    statusMode: "occupied",
    slots: [
      { x: 57.8, y: 75.4, facing: "back" },
      { x: 69.3, y: 72.3, facing: "back" },
      { x: 81.7, y: 69.2, facing: "back" },
      { x: 58.3, y: 86.4, facing: "front" },
      { x: 70.4, y: 83.1, facing: "front" },
      { x: 82.8, y: 80.2, facing: "front" },
      { x: 63.8, y: 63.4, facing: "back" },
      { x: 77.2, y: 61.9, facing: "back" }
    ]
  }
};

export const CORRIDOR_SLOTS: OverlaySlot[] = [
  { x: 33.7, y: 36.7, facing: "right" },
  { x: 50.1, y: 71.7, facing: "left" },
  { x: 63.9, y: 38.4, facing: "front" },
  { x: 45.6, y: 38.8, facing: "back" },
  { x: 54.9, y: 48.8, facing: "right" },
  { x: 40.4, y: 56.7, facing: "left" },
  { x: 59.5, y: 56.9, facing: "front" }
];

export const ROOM_DISPLAY_ORDER: SceneRoom[] = ["mahjong", "coffee", "nap", "cards", "work"];

export const formatOverlayRoomStatus = (
  room: SceneRoom,
  agentCount: number
): OverlayRoomStatus => {
  const statusMode = ROOM_OVERLAY_LAYOUT[room].statusMode;

  if (agentCount <= 0) {
    return {
      label: "OPEN",
      tone: "open"
    };
  }

  if (statusMode === "open") {
    return {
      label: "OPEN",
      tone: "open"
    };
  }

  if (statusMode === "occupied") {
    return {
      label: `${agentCount} ACTIVE`,
      tone: "occupied"
    };
  }

  return {
    label: `${agentCount} SEATED`,
    tone: "seated"
  };
};

export const getOverlayRoom = (scene: AgentSceneState): SceneRoom => scene.room ?? "work";

export const isWalkingOverlayAgent = (
  status: AgentRecord["status"],
  scene: AgentSceneState
) => status === "handoff" || scene.pose === "walk";

export const getOverlaySpriteFrame = ({
  status,
  scene,
  slotFacing
}: {
  status: AgentRecord["status"];
  scene: AgentSceneState;
  slotFacing?: OverlayFacing;
}): {
  row: number;
  column: number;
  flip: boolean;
  motion: OverlaySpriteMotion;
} => {
  const facing: OverlayFacing = slotFacing ?? scene.facing ?? "front";
  const resolvedFacing: "front" | "back" | "side" =
    facing === "left" || facing === "right" ? "side" : facing === "back" ? "back" : "front";
  const flip = facing === "left";
  const motion: OverlaySpriteMotion =
    isWalkingOverlayAgent(status, scene)
      ? "walk"
      : scene.pose === "desk" ||
          scene.pose === "working" ||
          scene.pose === "mahjong" ||
          scene.pose === "coffee" ||
          scene.pose === "game" ||
          scene.pose === "sleep"
        ? "sit"
        : "stand";
  const row = motion === "stand" ? 0 : motion === "walk" ? 1 : 2;
  const column = resolvedFacing === "front" ? 0 : resolvedFacing === "back" ? 1 : 2;

  return {
    row,
    column,
    flip,
    motion
  };
};
