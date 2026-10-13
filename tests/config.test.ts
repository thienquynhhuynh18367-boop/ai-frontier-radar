import { describe, expect, it } from "vitest";
import { profile } from "../config/profile";
import { rankingWeights } from "../config/ranking";

describe("central configuration", () => {
  it("keeps Ranking weights normalized despite floating-point precision", () => {
    const total = Object.values(rankingWeights).reduce((sum, weight) => sum + weight, 0);
    expect(total).toBeCloseTo(1, 12);
  });

  it("uses unique lowercase-kebab-case Topic IDs", () => {
    const ids = profile.topics.map((topic) => topic.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))).toBe(true);
  });

  it("uses unique lowercase-kebab-case Company IDs", () => {
    const ids = profile.companies.map((company) => company.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))).toBe(true);
  });
});
