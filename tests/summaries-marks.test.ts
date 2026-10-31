import { describe, expect, it } from "vitest";
import { parseMarks, plainText, unbalancedMarks } from "@/lib/gazette/marks";

describe("inline marks", () => {
  it("splits bold, underline and italic into runs, nested or not", () => {
    expect(parseMarks("a **b** __c__ *d*")).toEqual([
      { text: "a ", bold: false, underline: false, italic: false },
      { text: "b", bold: true, underline: false, italic: false },
      { text: " ", bold: false, underline: false, italic: false },
      { text: "c", bold: false, underline: true, italic: false },
      { text: " ", bold: false, underline: false, italic: false },
      { text: "d", bold: false, underline: false, italic: true },
    ]);
    expect(parseMarks("**__both__ bold**")).toEqual([
      { text: "both", bold: true, underline: true, italic: false },
      { text: " bold", bold: true, underline: false, italic: false },
    ]);
  });

  it("keeps the Court's own characters: a single underscore, an ellipsis, brackets", () => {
    expect(plainText("x_y ... [Mülki Məcəllənin 140-cı maddəsi] \\*not italic\\*")).toBe(
      "x_y ... [Mülki Məcəllənin 140-cı maddəsi] *not italic*",
    );
  });

  it("names the mark that was left open", () => {
    expect(unbalancedMarks("__open **and closed**")).toBe("underline (__) not closed");
    expect(unbalancedMarks("**fine** __fine__ *fine*")).toBeNull();
    expect(unbalancedMarks("*a **b*")).toBe("bold (**) not closed");
  });
});
