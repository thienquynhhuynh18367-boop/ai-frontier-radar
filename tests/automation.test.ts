import { readFile } from "node:fs/promises";
import { join } from "node:path";
import YAML from "yaml";
import { describe, expect, it } from "vitest";
import { assertPublishableRun, resolveRunWindow } from "../lib/run-window";
import { assertDataBudget, MAX_DATA_BYTES } from "../lib/data-budget";
import { LatestSchema } from "../types/publication";

const root = process.cwd();

describe("UTC run time and Shanghai business day", () => {
  const now = new Date("2026-10-15T00:17:00.000Z");

  it("defaults to actual run time and the preceding completed Shanghai day", () => {
    expect(resolveRunWindow({ now })).toEqual({ day: "2026-10-14", asOf: now.toISOString(),
      windowStart: "2026-10-13T16:00:00.000Z", windowEnd: "2026-10-14T16:00:00.000Z" });
  });

  it("rejects future asOf with zero clock tolerance", () => {
    expect(() => resolveRunWindow({ now, asOf: "2026-10-15T00:17:00.001Z" })).toThrow("later than current UTC");
  });

  it("accepts a completed historical window at a real past asOf", () => {
    expect(resolveRunWindow({ now, day: "2026-10-12", asOf: "2026-10-13T09:00:00.000Z" }).day).toBe("2026-10-12");
  });

  it("refuses to publish a stale asOf or overwrite a newer latest", () => {
    const historic = resolveRunWindow({ now, day: "2026-10-12", asOf: "2026-10-13T09:00:00.000Z" });
    expect(() => assertPublishableRun(historic, now, "2026-10-14")).toThrow("newer latest");
    expect(() => assertPublishableRun(historic, now, null)).toThrow("match actual run time");
    expect(() => assertPublishableRun(resolveRunWindow({ now }), now, "2026-10-14")).not.toThrow();
  });

  it("rejects a window that had not ended at asOf", () => {
    expect(() => resolveRunWindow({ now, day: "2026-10-15", asOf: now.toISOString() })).toThrow("Window must be completed");
  });
});

describe("publication provenance and automation", () => {
  it("stops unbounded historical working-tree growth before data commit", () => {
    expect(() => assertDataBudget(MAX_DATA_BYTES)).not.toThrow();
    expect(() => assertDataBudget(MAX_DATA_BYTES + 1)).toThrow("750 MiB");
  });
  it("parses the current historical batch and optional future-time provenance flag", async () => {
    const historical = JSON.parse(await readFile(join(root, "data", "2026-10-14", "items.json"), "utf8")) as unknown;
    const parsed = LatestSchema.parse(historical);
    expect(parsed.schemaVersion).toBe(2);
    if (parsed.schemaVersion === 2) {
      expect(LatestSchema.safeParse({ ...parsed, qualityFlags: ["as_of_was_future_at_collection"] }).success).toBe(true);
      expect(LatestSchema.safeParse({ ...parsed, qualityFlags: ["unknown_flag"] }).success).toBe(false);
    }
  });

  it("uses bounded daily collection, job-scoped permissions, same-run deployment, and serial deployment", async () => {
    const daily = YAML.parse(await readFile(join(root, ".github", "workflows", "daily-radar.yml"), "utf8"));
    const site = YAML.parse(await readFile(join(root, ".github", "workflows", "deploy-site.yml"), "utf8"));
    expect(daily.on.schedule).toEqual([{ cron: "17 0 * * *" }]);
    expect(daily.on.workflow_dispatch.inputs.business_date.required).toBe(false);
    expect(daily.jobs.collect.permissions).toEqual({ contents: "write" });
    expect(daily.jobs.build.permissions).toEqual({ contents: "read" });
    expect(daily.jobs.deploy.permissions).toEqual({ contents: "read", pages: "write", "id-token": "write" });
    expect(daily.jobs.build.needs).toBe("collect");
    expect(daily.jobs.deploy.needs).toEqual(["collect", "build"]);
    expect(daily.jobs.collect.steps.some((step: { run?: string }) => step.run?.includes("git push origin HEAD:main"))).toBe(true);
    expect(daily.jobs.collect.steps.some((step: { run?: string }) => step.run?.includes("git add -A -- data public/data"))).toBe(true);
    expect(daily.jobs.collect.steps.some((step: { run?: string }) => step.run?.includes("npm run verify:data-budget"))).toBe(true);
    expect(daily.jobs.deploy.concurrency.group).toBe(site.jobs.deploy.concurrency.group);
    expect(daily.jobs.deploy.steps.at(-1).if).toBe("steps.current.outputs.deploy == 'true'");
    expect(site.on.push.branches).toEqual(["main"]);
    expect(site.jobs.deploy.needs).toBe("build");
    for (const workflow of [daily, site]) {
      const build = workflow.jobs.build.steps.map((step: { run?: string }) => step.run ?? "").join("\n");
      expect(build).toContain("npm run verify:export");
      expect(workflow.jobs.build.steps.some((step: { env?: Record<string, string> }) =>
        step.env?.RADAR_BASE_PATH === "/ai-frontier-radar")).toBe(true);
    }
  });
});
