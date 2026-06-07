import { describe, expect, it } from "vitest";
import { formatMatchTiming } from "@/lib/time";

describe("formatMatchTiming", () => {
  it("renders compact local match time and lock time", () => {
    const text = formatMatchTiming({
      kickoffAt: "2026-06-07T19:41:00.000Z",
      lockAt: "2026-06-07T19:26:00.000Z",
    });

    expect(text).toContain("· Locks ");
    expect(text).toMatch(/^[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2} · \d{2}:\d{2}/);
    expect(text).not.toContain("T");
  });
});
