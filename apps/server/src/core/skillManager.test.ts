import { describe, expect, test } from "vitest";

import { parseClawHubSearchOutput } from "./skillManager";

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
});
