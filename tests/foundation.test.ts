import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

describe("project foundation", () => {
  it("builds as a static export", () => {
    expect(nextConfig.output).toBe("export");
  });
});
