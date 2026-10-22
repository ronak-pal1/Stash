import { describe, expect, it } from "vitest";
import { highlight, initials, readingLabel } from "./format";

describe("format", () => {
  it("builds initials and reading labels", () => {
    expect(initials("Ada Lovelace")).toBe("AL");
    expect(readingLabel(0)).toBe("Empty");
    expect(readingLabel(3)).toBe("3 min read");
  });

  it("marks a search hit without changing the surrounding words", () => {
    expect(highlight("Ship the launch notes", "launch")).toBe("Ship the «launch» notes");
  });
});
