import { describe, expect, it } from "vitest";
import { safeRelativeRedirect } from "@/lib/auth/redirect";

describe("safeRelativeRedirect", () => {
  it("keeps relative app paths including search params and hashes", () => {
    expect(safeRelativeRedirect("/onboarding?invite=abc#rules")).toBe(
      "/onboarding?invite=abc#rules",
    );
  });

  it("rejects absolute and protocol-relative redirects", () => {
    expect(safeRelativeRedirect("https://example.com")).toBe("/");
    expect(safeRelativeRedirect("//example.com/path")).toBe("/");
  });
});
