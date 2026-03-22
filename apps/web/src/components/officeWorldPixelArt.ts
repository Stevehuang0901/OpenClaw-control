import * as THREE from "three";

export type PixelRoomKind = "work" | "coffee" | "cards" | "nap" | "mahjong";
export type AgentFacing = "left" | "right" | "up" | "down";
export type AgentPose = "idleA" | "idleB" | "walkA" | "walkB" | "seatA" | "seatB" | "sleep";

export const PIXEL_PALETTE = {
  ink: "#141822",
  shadow: "#243041",
  night: "#1A2332",
  slate: "#2D394B",
  steel: "#4B5A6C",
  mist: "#708096",
  cloud: "#9EADBB",
  frost: "#D9E0E5",
  wallTop: "#5F6D7E",
  wallMid: "#4A5868",
  wallDark: "#3A4556",
  platform: "#273241",
  paper: "#e3dacd",
  cream: "#f3ecdf",
  woodDark: "#694a37",
  woodMid: "#8d654b",
  woodLight: "#b78763",
  amber: "#dc9a57",
  moss: "#4c6350",
  leaf: "#73906a",
  mint: "#93c696",
  sea: "#527985",
  cyan: "#87c0ca",
  sky: "#A8DEF4",
  navy: "#495571",
  violet: "#766b8b",
  lavender: "#978db2",
  coral: "#cf7a69",
  coolGlow: "#7EC8E3",
  warmGlow: "#f6c985",
  greenGlow: "#a5ddaa",
  lemon: "#f5e7a4"
} as const;

type FurnitureKind =
  | "deskIdle"
  | "deskActive"
  | "workDecor"
  | "screeningRoom"
  | "napRoom"
  | "pantryRoom"
  | "mahjongRoom";

type Painter = {
  px: (x: number, y: number, color: string, alpha?: number) => void;
  fill: (x: number, y: number, width: number, height: number, color: string, alpha?: number) => void;
  line: (x1: number, y1: number, x2: number, y2: number, color: string, alpha?: number) => void;
  stroke: (x: number, y: number, width: number, height: number, color: string, alpha?: number) => void;
  dither: (
    x: number,
    y: number,
    width: number,
    height: number,
    primary: string,
    secondary: string,
    offset?: number
  ) => void;
  bevelRect: (
    x: number,
    y: number,
    width: number,
    height: number,
    base: string,
    highlight?: string,
    shadow?: string
  ) => void;
};

const textureCache = new Map<string, THREE.CanvasTexture>();
const paletteRgb = Object.values(PIXEL_PALETTE).map((color) => ({
  color,
  rgb: hexToRgb(color)
}));

export function quantizeToPixelPalette(color: string) {
  const rgb = hexToRgb(color);
  let closest = paletteRgb[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of paletteRgb) {
    const dr = rgb.r - candidate.rgb.r;
    const dg = rgb.g - candidate.rgb.g;
    const db = rgb.b - candidate.rgb.b;
    const distance = dr * dr + dg * dg + db * db;

    if (distance < bestDistance) {
      bestDistance = distance;
      closest = candidate;
    }
  }

  return closest.color;
}

export function shiftPaletteColor(color: string, amount: number) {
  const rgb = hexToRgb(color);
  const next = {
    r: clamp(Math.round(rgb.r + 255 * amount), 0, 255),
    g: clamp(Math.round(rgb.g + 255 * amount), 0, 255),
    b: clamp(Math.round(rgb.b + 255 * amount), 0, 255)
  };

  return quantizeToPixelPalette(`#${toHex(next.r)}${toHex(next.g)}${toHex(next.b)}`);
}

export function getBackdropTexture() {
  return createTexture("backdrop", 16, 16, ({ fill, dither, line }) => {
    fill(0, 0, 16, 16, PIXEL_PALETTE.night);
    dither(0, 0, 16, 16, PIXEL_PALETTE.night, PIXEL_PALETTE.platform, 0);
    for (let y = 0; y < 16; y += 4) {
      line(0, y, 15, y, PIXEL_PALETTE.shadow, 0.26);
    }
    for (let x = 0; x < 16; x += 4) {
      line(x, 0, x, 15, PIXEL_PALETTE.shadow, 0.2);
    }
    line(0, 0, 15, 0, PIXEL_PALETTE.steel, 0.18);
    line(0, 0, 0, 15, PIXEL_PALETTE.steel, 0.18);
  });
}

export function getCorridorTexture() {
  return createTexture("corridor-floor", 16, 12, ({ fill, bevelRect, line, dither }) => {
    fill(0, 0, 16, 12, PIXEL_PALETTE.wallDark);
    for (let y = 0; y < 12; y += 4) {
      for (let x = 0; x < 16; x += 4) {
        bevelRect(
          x,
          y,
          4,
          4,
          (x + y) % 8 === 0 ? PIXEL_PALETTE.wallMid : PIXEL_PALETTE.slate,
          PIXEL_PALETTE.cloud,
          PIXEL_PALETTE.shadow
        );
      }
    }
    dither(0, 0, 16, 12, "rgba(255,255,255,0.03)", "rgba(255,255,255,0.01)", 1);
    line(0, 5, 15, 5, PIXEL_PALETTE.frost, 0.14);
  });
}

export function getThresholdTexture() {
  return createTexture("threshold-floor", 8, 8, ({ fill, bevelRect }) => {
    fill(0, 0, 8, 8, PIXEL_PALETTE.steel);
    bevelRect(1, 1, 6, 6, PIXEL_PALETTE.cloud, PIXEL_PALETTE.frost, PIXEL_PALETTE.shadow);
  });
}

export function getRoomFloorTexture(room: PixelRoomKind, active: boolean) {
  const key = `room-floor:${room}:${active ? "active" : "idle"}`;

  switch (room) {
    case "work":
      return createTexture(key, 20, 16, ({ fill, bevelRect, dither }) => {
        const lightTile = active ? "#D9DFE5" : "#CBD3DB";
        const midTile = active ? "#B9C2CC" : "#AEB8C4";
        const darkTile = active ? "#99A3AF" : "#8D98A6";
        fill(0, 0, 20, 16, lightTile);
        for (let y = 0; y < 16; y += 4) {
          for (let x = 0; x < 20; x += 4) {
            bevelRect(
              x,
              y,
              4,
              4,
              (x + y) % 8 === 0 ? lightTile : midTile,
              PIXEL_PALETTE.frost,
              darkTile
            );
          }
        }
        dither(0, 0, 20, 16, "rgba(126,200,227,0.07)", "rgba(126,200,227,0.03)", 1);
      });
    case "coffee":
      return createTexture(key, 24, 16, ({ fill, px }) => {
        const darkWood = "#8B6914";
        const lightWood = "#A07828";
        fill(0, 0, 24, 16, darkWood);
        for (let y = 0; y < 16; y += 2) {
          fill(0, y, 24, 2, (y / 2) % 2 === 0 ? darkWood : lightWood);
        }
        for (let y = 1; y < 16; y += 4) {
          for (let x = (y % 3) + 2; x < 24; x += 6) {
            px(x, y, PIXEL_PALETTE.lemon, 0.16);
          }
        }
      });
    case "cards":
      return createTexture(key, 20, 16, ({ fill, bevelRect, dither, px }) => {
        const base = "#58606A";
        const mid = "#6A737E";
        const warm = "#7A6D58";
        fill(0, 0, 20, 16, base);
        for (let y = 0; y < 16; y += 4) {
          for (let x = 0; x < 20; x += 4) {
            bevelRect(
              x,
              y,
              4,
              4,
              (x + y) % 8 === 0 ? mid : base,
              PIXEL_PALETTE.cloud,
              PIXEL_PALETTE.shadow
            );
          }
        }
        dither(0, 0, 20, 16, "rgba(246,201,133,0.06)", "rgba(246,201,133,0.02)", 1);
        for (let x = 2; x < 20; x += 6) {
          px(x, 3, warm, 0.22);
          px(x + 1, 11, warm, 0.22);
        }
      });
    case "nap":
      return createTexture(key, 20, 16, ({ fill, dither, px }) => {
        fill(0, 0, 20, 16, PIXEL_PALETTE.navy);
        dither(
          0,
          0,
          20,
          16,
          PIXEL_PALETTE.navy,
          active ? PIXEL_PALETTE.violet : PIXEL_PALETTE.shadow,
          1
        );
        for (let y = 1; y < 16; y += 3) {
          for (let x = (y % 2) + 1; x < 20; x += 4) {
            px(x, y, PIXEL_PALETTE.lavender, 0.18);
          }
        }
      });
    case "mahjong":
      return createTexture(key, 20, 16, ({ fill, bevelRect, dither }) => {
        const darkGreen = "#31593A";
        const lightGreen = "#4F8658";
        const highlight = "#78AF71";
        fill(0, 0, 20, 16, darkGreen);
        for (let y = 0; y < 16; y += 4) {
          for (let x = 0; x < 20; x += 4) {
            bevelRect(
              x,
              y,
              4,
              4,
              (x + y) % 8 === 0 ? lightGreen : darkGreen,
              highlight,
              PIXEL_PALETTE.shadow
            );
          }
        }
        dither(0, 0, 20, 16, "rgba(165,221,170,0.07)", "rgba(165,221,170,0.03)", 1);
      });
  }
}

export function getRoomLightTexture(room: PixelRoomKind) {
  const key = `room-light:${room}`;

  switch (room) {
    case "coffee":
      return createLightPoolTexture(key, PIXEL_PALETTE.lemon, PIXEL_PALETTE.warmGlow, 0.54, 0.44, 1.28);
    case "work":
      return createLightPoolTexture(key, PIXEL_PALETTE.coolGlow, PIXEL_PALETTE.sky, 0.52, 0.48, 1.14);
    case "mahjong":
      return createLightPoolTexture(key, PIXEL_PALETTE.greenGlow, PIXEL_PALETTE.mint, 0.5, 0.46, 1.12);
    case "cards":
      return createLightPoolTexture(key, PIXEL_PALETTE.lemon, PIXEL_PALETTE.warmGlow, 0.36, 0.44, 0.92);
    case "nap":
      return createLightPoolTexture(key, PIXEL_PALETTE.paper, PIXEL_PALETTE.warmGlow, 0.56, 0.36, 0.88);
  }
}

export function getLampTexture(room: PixelRoomKind) {
  return createTexture(`lamp:${room}`, 16, 18, ({ fill, bevelRect, px }) => {
    const aura =
      room === "coffee"
        ? PIXEL_PALETTE.warmGlow
        : room === "work"
          ? PIXEL_PALETTE.coolGlow
        : room === "mahjong"
            ? PIXEL_PALETTE.greenGlow
            : room === "cards"
              ? PIXEL_PALETTE.warmGlow
              : PIXEL_PALETTE.warmGlow;

    fill(7, 0, 2, 4, PIXEL_PALETTE.paper);
    fill(5, 4, 6, 2, PIXEL_PALETTE.paper);
    bevelRect(5, 6, 6, 3, PIXEL_PALETTE.lemon, PIXEL_PALETTE.cream, PIXEL_PALETTE.warmGlow);
    px(4, 6, aura, 0.72);
    px(11, 6, aura, 0.72);
    px(3, 7, aura, 0.48);
    px(12, 7, aura, 0.48);
    px(5, 9, aura, 0.36);
    px(10, 9, aura, 0.36);
  });
}

export function getFurnitureTexture(kind: FurnitureKind) {
  switch (kind) {
    case "deskIdle":
      return createDeskTexture(false);
    case "deskActive":
      return createDeskTexture(true);
    case "workDecor":
      return createWorkDecorTexture();
    case "screeningRoom":
      return createScreeningRoomTexture();
    case "napRoom":
      return createNapRoomTexture();
    case "pantryRoom":
      return createPantryRoomTexture();
    case "mahjongRoom":
      return createMahjongRoomTexture();
    default:
      return createDeskTexture(false);
  }
}

export function getShadowStampTexture() {
  return createTexture("shadow-stamp", 20, 10, ({ px }) => {
    const core = "rgba(22,24,31,0.34)";
    const edge = "rgba(22,24,31,0.14)";
    const mask = [
      "....................",
      ".....eeeeeeeeee.....",
      "...eeccccccccccccee.",
      "..eeccccccccccccccce",
      "..eeccccccccccccccce",
      "...eeccccccccccccee.",
      ".....eeeeeeeeee.....",
      "....................",
      "....................",
      "...................."
    ];

    mask.forEach((row, y) => {
      row.split("").forEach((token, x) => {
        if (token === "c") px(x, y, core);
        if (token === "e") px(x, y, edge);
      });
    });
  });
}

export function getAgentTexture({
  accent,
  facing,
  pose,
  hairColor,
  skinColor
}: {
  accent: string;
  facing: AgentFacing;
  pose: AgentPose;
  hairColor?: string;
  skinColor?: string;
}) {
  const shirt = quantizeToPixelPalette(accent);
  const shirtLight = shiftPaletteColor(shirt, 0.12);
  const shirtShadow = shiftPaletteColor(shirt, -0.14);
  const hair = quantizeToPixelPalette(hairColor ?? (facing === "up" ? PIXEL_PALETTE.shadow : PIXEL_PALETTE.woodDark));
  const skin = quantizeToPixelPalette(skinColor ?? PIXEL_PALETTE.paper);
  const outline = PIXEL_PALETTE.ink;
  const trouser = PIXEL_PALETTE.shadow;
  const key = `agent:${shirt}:${hair}:${skin}:${facing}:${pose}`;

  return createTexture(key, 10, 14, ({ fill, px, bevelRect, dither }) => {
    if (pose === "sleep") {
      dither(1, 11, 8, 2, PIXEL_PALETTE.shadow, PIXEL_PALETTE.night, 0);
      bevelRect(2, 6, 4, 3, shirtShadow, shirtLight, outline);
      fill(6, 6, 2, 2, skin);
      fill(6, 5, 2, 1, hair);
      fill(1, 8, 2, 2, trouser);
      px(8, 3, PIXEL_PALETTE.cream, 0.72);
      px(9, 2, PIXEL_PALETTE.cream, 0.42);
      return;
    }

    const headX = facing === "right" ? 4 : 3;
    const torsoX = 2;
    const seated = pose === "seatA" || pose === "seatB";
    const torsoY = 5;
    const headTurn = pose === "idleB" || pose === "seatB" ? 1 : 0;

    dither(2, 12, 6, 2, PIXEL_PALETTE.shadow, PIXEL_PALETTE.night, pose === "walkB" ? 1 : 0);
    fill(headX, 1, 4, 2, hair);
    bevelRect(headX - 1, 2, 4, 3, skin, PIXEL_PALETTE.cream, outline);
    fill(headX + headTurn, 3, 1, 1, outline);
    if (facing === "down") {
      fill(headX + 2, 3, 1, 1, outline);
    }

    bevelRect(torsoX, torsoY, 6, 4, shirt, shirtLight, shirtShadow);
    fill(torsoX + 1, torsoY + 3, 4, 1, shirtShadow);

    if (seated) {
      fill(1, 6, 1, pose === "seatB" ? 2 : 3, skin);
      fill(8, 6, 1, pose === "seatB" ? 3 : 2, skin);
      fill(3, 9, 1, 2, trouser);
      fill(6, 9, 1, 2, trouser);
      if (pose === "seatA") {
        px(1, 8, PIXEL_PALETTE.paper);
        px(8, 8, PIXEL_PALETTE.paper);
      }
      return;
    }

    fill(1, torsoY + 1, 1, 3, skin);
    fill(8, torsoY + 1, 1, 3, skin);

    const leftLegX = pose === "walkA" ? 3 : 4;
    const rightLegX = pose === "walkB" ? 5 : 6;
    const leftHeight = pose === "walkA" ? 4 : 3;
    const rightHeight = pose === "walkB" ? 4 : 3;

    fill(leftLegX, 9, 1, leftHeight, trouser);
    fill(rightLegX, 9, 1, rightHeight, trouser);
    px(torsoX + 1, torsoY + 1, PIXEL_PALETTE.paper, 0.55);
  });
}

function createDeskTexture(active: boolean) {
  return createTexture(`desk:${active ? "active" : "idle"}`, 40, 26, ({ fill, bevelRect, px, line }) => {
    const deskTop = PIXEL_PALETTE.woodMid;
    const deskLeg = PIXEL_PALETTE.woodDark;
    const screen = active ? PIXEL_PALETTE.coolGlow : PIXEL_PALETTE.sky;
    const glow = active ? PIXEL_PALETTE.sky : PIXEL_PALETTE.cloud;

    bevelRect(4, 8, 32, 8, deskTop, PIXEL_PALETTE.woodLight, deskLeg);
    fill(7, 16, 4, 7, deskLeg);
    fill(28, 16, 4, 7, deskLeg);
    bevelRect(9, 2, 8, 6, PIXEL_PALETTE.ink, PIXEL_PALETTE.mist, PIXEL_PALETTE.shadow);
    bevelRect(21, 1, 10, 7, PIXEL_PALETTE.ink, PIXEL_PALETTE.mist, PIXEL_PALETTE.shadow);
    fill(10, 3, 6, 4, screen);
    fill(22, 2, 8, 5, screen);
    fill(8, 7, 10, 4, glow, active ? 0.22 : 0.09);
    fill(20, 7, 12, 4, glow, active ? 0.24 : 0.1);
    fill(10, 9, 7, 2, glow, active ? 0.18 : 0.06);
    fill(22, 9, 8, 2, glow, active ? 0.2 : 0.07);
    if (active) {
      line(9, 4, 16, 4, PIXEL_PALETTE.frost, 0.45);
      line(21, 4, 30, 4, PIXEL_PALETTE.frost, 0.45);
      fill(8, 6, 10, 3, glow, 0.18);
      fill(20, 6, 12, 3, glow, 0.2);
      fill(10, 11, 4, 1, glow, 0.18);
      fill(23, 11, 4, 1, glow, 0.2);
      px(8, 4, glow, 0.45);
      px(31, 4, glow, 0.45);
    }
    bevelRect(15, 12, 5, 2, PIXEL_PALETTE.paper, PIXEL_PALETTE.cream, PIXEL_PALETTE.mist);
    bevelRect(22, 12, 2, 2, PIXEL_PALETTE.paper, PIXEL_PALETTE.cream, PIXEL_PALETTE.mist);
    bevelRect(5, 19, 8, 5, PIXEL_PALETTE.steel, PIXEL_PALETTE.cloud, PIXEL_PALETTE.shadow);
    bevelRect(12, 17, 4, 2, PIXEL_PALETTE.cloud, PIXEL_PALETTE.frost, PIXEL_PALETTE.mist);
    bevelRect(31, 10, 2, 2, PIXEL_PALETTE.coral, PIXEL_PALETTE.paper, PIXEL_PALETTE.shadow);
    px(32, 9, PIXEL_PALETTE.paper);
  });
}

function createWorkDecorTexture() {
  return createTexture("work-decor", 58, 40, ({ fill, bevelRect, px, line }) => {
    bevelRect(2, 20, 16, 13, PIXEL_PALETTE.woodDark, PIXEL_PALETTE.woodLight, PIXEL_PALETTE.ink);
    bevelRect(4, 12, 12, 8, PIXEL_PALETTE.moss, PIXEL_PALETTE.mint, PIXEL_PALETTE.shadow);
    fill(7, 9, 6, 4, PIXEL_PALETTE.leaf);
    bevelRect(23, 10, 14, 18, PIXEL_PALETTE.wallDark, PIXEL_PALETTE.cloud, PIXEL_PALETTE.shadow);
    bevelRect(25, 12, 10, 4, PIXEL_PALETTE.sky, PIXEL_PALETTE.frost, PIXEL_PALETTE.steel);
    line(26, 14, 33, 14, PIXEL_PALETTE.coolGlow, 0.35);
    bevelRect(40, 18, 14, 10, PIXEL_PALETTE.woodMid, PIXEL_PALETTE.woodLight, PIXEL_PALETTE.woodDark);
    bevelRect(41, 8, 12, 9, PIXEL_PALETTE.steel, PIXEL_PALETTE.cloud, PIXEL_PALETTE.shadow);
    bevelRect(43, 10, 3, 5, PIXEL_PALETTE.coral);
    bevelRect(47, 10, 2, 5, PIXEL_PALETTE.mint);
    bevelRect(50, 10, 2, 5, PIXEL_PALETTE.sky);
    px(10, 8, PIXEL_PALETTE.cream);
    px(29, 9, PIXEL_PALETTE.frost);
    px(47, 17, PIXEL_PALETTE.paper);
  });
}

function createScreeningRoomTexture() {
  return createTexture("screening-room", 72, 46, ({ fill, bevelRect, px, line }) => {
    bevelRect(6, 12, 30, 18, PIXEL_PALETTE.ink, PIXEL_PALETTE.cloud, PIXEL_PALETTE.shadow);
    fill(8, 14, 26, 14, "#20344B");
    fill(9, 15, 24, 12, "#16273A");
    px(14, 18, PIXEL_PALETTE.paper);
    px(20, 20, PIXEL_PALETTE.sky);
    px(27, 17, PIXEL_PALETTE.paper);
    fill(18, 22, 7, 2, PIXEL_PALETTE.coolGlow, 0.55);
    fill(23, 21, 5, 3, PIXEL_PALETTE.frost, 0.3);
    bevelRect(42, 10, 9, 22, "#8A3030", PIXEL_PALETTE.coral, PIXEL_PALETTE.shadow);
    bevelRect(44, 13, 5, 7, PIXEL_PALETTE.warmGlow, PIXEL_PALETTE.lemon, PIXEL_PALETTE.amber);
    bevelRect(10, 31, 22, 8, PIXEL_PALETTE.steel, PIXEL_PALETTE.cloud, PIXEL_PALETTE.wallDark);
    bevelRect(13, 28, 16, 4, PIXEL_PALETTE.wallMid, PIXEL_PALETTE.cloud, PIXEL_PALETTE.shadow);
    bevelRect(38, 34, 8, 5, PIXEL_PALETTE.navy, PIXEL_PALETTE.cloud, PIXEL_PALETTE.shadow);
    bevelRect(50, 34, 8, 5, PIXEL_PALETTE.sea, PIXEL_PALETTE.sky, PIXEL_PALETTE.shadow);
    bevelRect(58, 16, 6, 11, PIXEL_PALETTE.woodMid, PIXEL_PALETTE.woodLight, PIXEL_PALETTE.woodDark);
    fill(60, 12, 2, 4, PIXEL_PALETTE.warmGlow, 0.72);
    fill(4, 18, 2, 6, PIXEL_PALETTE.warmGlow, 0.55);
    line(8, 14, 33, 14, PIXEL_PALETTE.sky, 0.2);
  });
}

function createNapRoomTexture() {
  return createTexture("nap-room", 60, 44, ({ fill, bevelRect, px, line }) => {
    bevelRect(6, 18, 18, 12, PIXEL_PALETTE.woodMid, PIXEL_PALETTE.woodLight, PIXEL_PALETTE.woodDark);
    bevelRect(9, 8, 12, 8, PIXEL_PALETTE.ink, PIXEL_PALETTE.cloud, PIXEL_PALETTE.shadow);
    fill(10, 9, 10, 6, PIXEL_PALETTE.coolGlow);
    fill(8, 16, 14, 3, PIXEL_PALETTE.sky, 0.2);
    bevelRect(28, 18, 18, 12, PIXEL_PALETTE.woodMid, PIXEL_PALETTE.woodLight, PIXEL_PALETTE.woodDark);
    bevelRect(31, 8, 12, 8, PIXEL_PALETTE.ink, PIXEL_PALETTE.cloud, PIXEL_PALETTE.shadow);
    fill(32, 9, 10, 6, PIXEL_PALETTE.coolGlow);
    fill(30, 16, 14, 3, PIXEL_PALETTE.sky, 0.2);
    bevelRect(47, 10, 9, 20, PIXEL_PALETTE.wallDark, PIXEL_PALETTE.cloud, PIXEL_PALETTE.shadow);
    bevelRect(49, 13, 5, 5, PIXEL_PALETTE.woodMid, PIXEL_PALETTE.woodLight, PIXEL_PALETTE.woodDark);
    bevelRect(49, 20, 5, 5, PIXEL_PALETTE.woodMid, PIXEL_PALETTE.woodLight, PIXEL_PALETTE.woodDark);
    fill(3, 12, 2, 10, PIXEL_PALETTE.warmGlow, 0.5);
    fill(57, 14, 2, 8, PIXEL_PALETTE.warmGlow, 0.42);
    bevelRect(5, 31, 10, 8, PIXEL_PALETTE.moss, PIXEL_PALETTE.mint, PIXEL_PALETTE.shadow);
    line(10, 12, 18, 12, PIXEL_PALETTE.frost, 0.24);
    line(32, 12, 40, 12, PIXEL_PALETTE.frost, 0.24);
    px(12, 6, PIXEL_PALETTE.lemon);
  });
}

function createPantryRoomTexture() {
  return createTexture("pantry-room", 62, 48, ({ fill, bevelRect, px, line }) => {
    for (let x = 8; x < 56; x += 8) {
      bevelRect(x, 2, 6, 10, PIXEL_PALETTE.warmGlow, PIXEL_PALETTE.lemon, PIXEL_PALETTE.amber);
    }
    bevelRect(8, 14, 42, 10, PIXEL_PALETTE.woodDark, PIXEL_PALETTE.woodLight, PIXEL_PALETTE.shadow);
    for (let x = 10; x < 48; x += 6) {
      bevelRect(x, 16, 2, 5, x % 12 === 0 ? PIXEL_PALETTE.sky : PIXEL_PALETTE.paper, PIXEL_PALETTE.cream, PIXEL_PALETTE.shadow);
      bevelRect(x + 3, 17, 2, 4, x % 12 === 0 ? PIXEL_PALETTE.coral : PIXEL_PALETTE.leaf, PIXEL_PALETTE.paper, PIXEL_PALETTE.shadow);
    }
    bevelRect(10, 27, 38, 11, PIXEL_PALETTE.woodMid, PIXEL_PALETTE.woodLight, PIXEL_PALETTE.woodDark);
    bevelRect(13, 23, 10, 4, PIXEL_PALETTE.woodLight, PIXEL_PALETTE.paper, PIXEL_PALETTE.woodDark);
    bevelRect(25, 23, 8, 4, PIXEL_PALETTE.woodLight, PIXEL_PALETTE.paper, PIXEL_PALETTE.woodDark);
    bevelRect(35, 23, 5, 4, PIXEL_PALETTE.steel, PIXEL_PALETTE.cloud, PIXEL_PALETTE.shadow);
    fill(37, 20, 1, 3, PIXEL_PALETTE.paper);
    bevelRect(50, 16, 8, 18, PIXEL_PALETTE.frost, PIXEL_PALETTE.cream, PIXEL_PALETTE.mist);
    line(52, 24, 56, 24, PIXEL_PALETTE.mist, 0.7);
    bevelRect(4, 28, 4, 12, PIXEL_PALETTE.moss, PIXEL_PALETTE.mint, PIXEL_PALETTE.shadow);
    fill(3, 24, 6, 4, PIXEL_PALETTE.leaf);
    px(15, 22, PIXEL_PALETTE.lemon);
    px(31, 22, PIXEL_PALETTE.lemon);
  });
}

function createMahjongRoomTexture() {
  return createTexture("mahjong-room", 66, 48, ({ fill, bevelRect, px, line }) => {
    bevelRect(14, 8, 36, 8, PIXEL_PALETTE.paper, PIXEL_PALETTE.cream, PIXEL_PALETTE.woodDark);
    fill(16, 10, 32, 4, "#7A8B6D");
    line(18, 12, 44, 12, PIXEL_PALETTE.leaf, 0.45);
    fill(8, 18, 2, 8, PIXEL_PALETTE.warmGlow, 0.55);
    fill(56, 18, 2, 8, PIXEL_PALETTE.warmGlow, 0.55);
    bevelRect(19, 21, 20, 13, PIXEL_PALETTE.woodDark, PIXEL_PALETTE.woodLight, PIXEL_PALETTE.shadow);
    bevelRect(22, 24, 14, 7, PIXEL_PALETTE.moss, PIXEL_PALETTE.greenGlow, PIXEL_PALETTE.shadow);
    bevelRect(22, 19, 14, 3, PIXEL_PALETTE.woodMid, PIXEL_PALETTE.woodLight, PIXEL_PALETTE.shadow);
    bevelRect(22, 34, 14, 3, PIXEL_PALETTE.woodMid, PIXEL_PALETTE.woodLight, PIXEL_PALETTE.shadow);
    bevelRect(14, 24, 4, 9, PIXEL_PALETTE.woodMid, PIXEL_PALETTE.woodLight, PIXEL_PALETTE.shadow);
    bevelRect(40, 24, 4, 9, PIXEL_PALETTE.woodMid, PIXEL_PALETTE.woodLight, PIXEL_PALETTE.shadow);
    bevelRect(4, 24, 8, 13, PIXEL_PALETTE.moss, PIXEL_PALETTE.mint, PIXEL_PALETTE.shadow);
    fill(3, 20, 10, 5, PIXEL_PALETTE.leaf);
    bevelRect(54, 24, 8, 13, PIXEL_PALETTE.moss, PIXEL_PALETTE.mint, PIXEL_PALETTE.shadow);
    fill(53, 20, 10, 5, PIXEL_PALETTE.leaf);
    px(28, 27, PIXEL_PALETTE.paper);
    px(30, 28, PIXEL_PALETTE.paper);
    px(32, 27, PIXEL_PALETTE.paper);
  });
}

function createLightPoolTexture(
  key: string,
  highlight: string,
  middle: string,
  hotspotX: number,
  hotspotY: number,
  intensity = 1
) {
  return createTexture(key, 64, 48, ({ px }) => {
    const edge = shiftPaletteColor(middle, -0.1);

    for (let y = 0; y < 48; y++) {
      for (let x = 0; x < 64; x++) {
        const dx = (x / 63 - hotspotX) / 0.48;
        const dy = (y / 47 - hotspotY) / 0.38;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const strength = clamp(1 - distance, 0, 1);

        if (strength < 0.04) {
          continue;
        }

        const checker = (x + y) % 2 === 0;
        const color =
          strength > 0.72
            ? highlight
            : strength > 0.42
              ? checker ? highlight : middle
              : checker ? middle : edge;
        const alpha =
          strength > 0.72
            ? 0.52 * intensity
            : strength > 0.42
              ? 0.34 * intensity
              : strength > 0.18
                ? 0.2 * intensity
                : 0.1 * intensity;

        px(x, y, color, alpha);
      }
    }
  });
}

function createTexture(key: string, width: number, height: number, painter: (tools: Painter) => void) {
  const cached = textureCache.get(key);
  if (cached) {
    return cached;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to create pixel-art texture canvas.");
  }

  context.clearRect(0, 0, width, height);
  context.imageSmoothingEnabled = false;

  const tools: Painter = {
    px: (x, y, color, alpha = 1) => {
      if (x < 0 || y < 0 || x >= width || y >= height) {
        return;
      }

      context.globalAlpha = alpha;
      context.fillStyle = color;
      context.fillRect(x, y, 1, 1);
      context.globalAlpha = 1;
    },
    fill: (x, y, rectWidth, rectHeight, color, alpha = 1) => {
      context.globalAlpha = alpha;
      context.fillStyle = color;
      context.fillRect(x, y, rectWidth, rectHeight);
      context.globalAlpha = 1;
    },
    line: (x1, y1, x2, y2, color, alpha = 1) => {
      context.globalAlpha = alpha;
      context.fillStyle = color;

      if (x1 === x2) {
        const minY = Math.min(y1, y2);
        context.fillRect(x1, minY, 1, Math.abs(y2 - y1) + 1);
      } else if (y1 === y2) {
        const minX = Math.min(x1, x2);
        context.fillRect(minX, y1, Math.abs(x2 - x1) + 1, 1);
      }

      context.globalAlpha = 1;
    },
    stroke: (x, y, rectWidth, rectHeight, color, alpha = 1) => {
      context.globalAlpha = alpha;
      context.fillStyle = color;
      context.fillRect(x, y, rectWidth, 1);
      context.fillRect(x, y + rectHeight - 1, rectWidth, 1);
      context.fillRect(x, y, 1, rectHeight);
      context.fillRect(x + rectWidth - 1, y, 1, rectHeight);
      context.globalAlpha = 1;
    },
    dither: (x, y, rectWidth, rectHeight, primary, secondary, offset = 0) => {
      for (let row = 0; row < rectHeight; row++) {
        for (let column = 0; column < rectWidth; column++) {
          context.fillStyle = (row + column + offset) % 2 === 0 ? secondary : primary;
          context.fillRect(x + column, y + row, 1, 1);
        }
      }
    },
    bevelRect: (x, y, rectWidth, rectHeight, base, highlight, shadow) => {
      const hi = highlight ?? shiftPaletteColor(base, 0.12);
      const lo = shadow ?? shiftPaletteColor(base, -0.14);
      context.fillStyle = base;
      context.fillRect(x, y, rectWidth, rectHeight);
      context.fillStyle = hi;
      context.fillRect(x, y, rectWidth, 1);
      context.fillRect(x, y, 1, rectHeight);
      context.fillStyle = lo;
      context.fillRect(x + rectWidth - 1, y + 1, 1, Math.max(1, rectHeight - 1));
      context.fillRect(x + 1, y + rectHeight - 1, Math.max(1, rectWidth - 1), 1);
    }
  };

  painter(tools);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  textureCache.set(key, texture);

  return texture;
}

function hexToRgb(color: string) {
  const normalized = color.startsWith("#") ? color.slice(1) : color;
  const value = normalized.length === 3
    ? normalized
        .split("")
        .map((part) => `${part}${part}`)
        .join("")
    : normalized;

  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16)
  };
}

function toHex(value: number) {
  return value.toString(16).padStart(2, "0");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
