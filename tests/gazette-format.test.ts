import { describe, expect, it } from "vitest";
import { formatBytes, formatDate, issueFilename, weekOf } from "@/lib/gazette-format";

describe("gazette-format", () => {
  it("formats dates with Azerbaijani month names regardless of locale data", () => {
    expect(formatDate("2026-09-05")).toBe("5 sentyabr 2026");
    expect(formatDate("2026-01-01T12:00:00Z")).toBe("1 yanvar 2026");
  });

  it("weekOf returns the Monday of that week", () => {
    expect(weekOf("2026-09-05")).toBe("31 avqust 2026"); // Saturday → Monday
    expect(weekOf("2026-08-31")).toBe("31 avqust 2026"); // Monday stays
  });

  it("formats byte sizes and filenames", () => {
    expect(formatBytes(null)).toBe("—");
    expect(formatBytes(306215)).toBe("299 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(issueFilename(11)).toBe("omni-law-gazette-issue-011.pdf");
  });
});
