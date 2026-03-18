import { describe, expect, test } from "vitest";

import { parseClawHubSearchOutput, parseManagedSkillList } from "./skillManager";

describe("skillManager", () => {
  test("parses clawhub search output", () => {
    const items = parseClawHubSearchOutput(`
- Searching
calendar  Calendar  (3.725)
gcalcli-calendar  Google Calendar (via gcalcli)  (3.661)
    `);

    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      slug: "calendar",
      displayName: "Calendar",
      score: 3.725
    });
  });

  test("parses managed skill list output", () => {
    const items = parseManagedSkillList(`
self-reflection  1.1.1
calendar  1.0.0
    `);

    expect(items).toEqual([
      { slug: "self-reflection", version: "1.1.1" },
      { slug: "calendar", version: "1.0.0" }
    ]);
  });
});
