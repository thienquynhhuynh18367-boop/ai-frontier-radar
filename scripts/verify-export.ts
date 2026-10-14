import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { LatestSchema, ManifestSchema, SourceStatusSchema } from "../types/publication";
import { directoryBytes } from "../lib/data-budget";

const root = process.cwd();
const out = join(root, "out");
const basePath = process.env.RADAR_BASE_PATH ?? "";
const routes = ["", "explore", "topics", "github", "products", "startups", "funding",
  "research", "career", "trends", "saved", "health", "detail"];

async function exists(path: string): Promise<boolean> {
  try { await stat(path); return true; } catch { return false; }
}

async function main(): Promise<void> {
  if (await directoryBytes(out) > 200 * 1024 * 1024) throw new Error("Static export exceeds 200 MiB review limit");
  for (const route of routes) {
    if (!await exists(join(out, route, "index.html"))) throw new Error(`Missing static route: ${route || "home"}`);
  }
  const files = (await readdir(join(out, "data")).catch(() => [])).sort();
  const allowed = ["latest.json", "manifest.json", "sources-status.json"];
  if (files.some((file) => !allowed.includes(file))) throw new Error("Unexpected public data file");
  if (await exists(join(out, "raw")) || await exists(join(out, "data", "raw"))) {
    throw new Error("Raw Data entered static export");
  }
  if (files.includes("latest.json")) {
    if ((await stat(join(out, "data", "latest.json"))).size > 10 * 1024 * 1024) {
      throw new Error("Public latest exceeds 10 MiB review limit");
    }
    if (files.join(",") !== allowed.sort().join(",")) throw new Error("Incomplete public data set");
    const latest = LatestSchema.parse(JSON.parse(await readFile(join(out, "data", "latest.json"), "utf8")) as unknown);
    const manifest = ManifestSchema.parse(JSON.parse(await readFile(join(out, "data", "manifest.json"), "utf8")) as unknown);
    SourceStatusSchema.parse(JSON.parse(await readFile(join(out, "data", "sources-status.json"), "utf8")) as unknown);
    if (manifest.latestDate !== latest.date || manifest.latestAsOf !== latest.asOf || manifest.itemCount !== latest.itemCount) {
      throw new Error("Exported JSON versions do not match");
    }
  }
  const html = await readFile(join(out, "index.html"), "utf8");
  if (basePath && !html.includes(`${basePath}/_next/`)) throw new Error("Base path missing from assets");
  if (basePath && !html.includes(`${basePath}/explore/`)) throw new Error("Base path missing from navigation");
  for (const asset of html.matchAll(/(?:src|href)="([^"]*\/_next\/[^"?]+)[^"]*"/g)) {
    const path = asset[1].replace(basePath, "").replace(/^\//, "");
    if (!await exists(join(out, path))) throw new Error(`Missing exported asset: ${path}`);
  }
  process.stdout.write(`Static export verified: ${routes.length} routes, ${files.length} public JSON files.\n`);
}

main().catch(() => {
  process.stderr.write("Static export verification failed.\n");
  process.exitCode = 1;
});
