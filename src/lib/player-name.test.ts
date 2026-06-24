import { describe, expect, it } from "vitest";
import { playerNamesMatch } from "@/lib/player-name";

describe("playerNamesMatch", () => {
  it("matches abbreviated provider names to full lineup names", () => {
    expect(playerNamesMatch("D. Munoz", "Daniel Muñoz")).toBe(true);
    expect(playerNamesMatch("N. Mukau", "Ngal'ayel Mukau")).toBe(true);
    expect(playerNamesMatch("L. Suarez", "Luis Javier Suárez")).toBe(true);
  });

  it("does not match same-last-name players when initials disagree", () => {
    expect(playerNamesMatch("J. Kayembe", "Joris Kayembe")).toBe(true);
    expect(playerNamesMatch("J. Kayembe", "Edo Kayembe")).toBe(false);
    expect(playerNamesMatch("E. Kayembe", "Edo Kayembe")).toBe(true);
    expect(playerNamesMatch("E. Kayembe", "Joris Kayembe")).toBe(false);
  });

  it("keeps same-last-name bench players from getting starter events", () => {
    expect(playerNamesMatch("J. Arias", "Jhon Arias")).toBe(true);
    expect(playerNamesMatch("J. Arias", "Santiago Arias")).toBe(false);
  });
});
