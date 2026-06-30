import { describe, expect, it } from "vitest";
import { statusPillLabel } from "@/components/ui/status-pill";

describe("statusPillLabel", () => {
  it("shows penalty shootout status while penalties are in progress", () => {
    expect(statusPillLabel("live", "P")).toBe("PEN");
  });

  it("shows penalty shootout status after a penalty decision", () => {
    expect(statusPillLabel("finished", "PEN")).toBe("PEN");
  });

  it("keeps regular labels for non-penalty status codes", () => {
    expect(statusPillLabel("live", "2H")).toBe("Live");
    expect(statusPillLabel("finished", "FT")).toBe("FT");
  });
});
