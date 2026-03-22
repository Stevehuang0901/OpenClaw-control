import { describe, expect, it } from "vitest";

import { formatOverlayRoomStatus } from "./officeWorldOverlay";

describe("office world overlay room status", () => {
  it("reports seated counts for leisure rooms when people are inside", () => {
    expect(formatOverlayRoomStatus("cards", 2)).toEqual({
      label: "2 SEATED",
      tone: "seated"
    });
    expect(formatOverlayRoomStatus("mahjong", 4)).toEqual({
      label: "4 SEATED",
      tone: "seated"
    });
  });

  it("shows exact active counts for work and pantry areas", () => {
    expect(formatOverlayRoomStatus("work", 1)).toEqual({
      label: "1 ACTIVE",
      tone: "occupied"
    });
    expect(formatOverlayRoomStatus("coffee", 2)).toEqual({
      label: "2 ACTIVE",
      tone: "occupied"
    });
  });

  it("reports seated counts for the quiet pod", () => {
    expect(formatOverlayRoomStatus("nap", 0)).toEqual({
      label: "OPEN",
      tone: "open"
    });
    expect(formatOverlayRoomStatus("nap", 2)).toEqual({
      label: "2 SEATED",
      tone: "seated"
    });
  });
});
