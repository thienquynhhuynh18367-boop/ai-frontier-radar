import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { LatestSchema, ManifestSchema, SourceStatusSchema,
  type Latest, type Manifest, type SourceStatus } from "../types/publication";
import { isDataStale } from "./freshness";
import { overallHealth } from "./source-health";
import { sourceRuns } from "./source-health";

export type Preview = {
  latest: Latest | null;
  health: SourceStatus | null;
  manifest: Manifest | null;
  message: string;
  stale: boolean;
};

async function optionalJson(path: string): Promise<{ found: boolean; data: unknown; validJson: boolean }> {
  try {
    return { found: true, data: JSON.parse(await readFile(path, "utf8")) as unknown, validJson: true };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { found: false, data: null, validJson: true };
    }
    return { found: true, data: null, validJson: false };
  }
}

export async function loadPreview(root: string, now: string): Promise<Preview> {
  const data = join(root, "public", "data");
  const latestInput = await optionalJson(join(data, "latest.json"));
  const healthInput = await optionalJson(join(data, "sources-status.json"));
  const manifestInput = await optionalJson(join(data, "manifest.json"));
  const latestResult = LatestSchema.safeParse(latestInput.data);
  const healthResult = SourceStatusSchema.safeParse(healthInput.data);
  const manifestResult = ManifestSchema.safeParse(manifestInput.data);
  const manifest = manifestResult.success ? manifestResult.data : null;
  const snapshot = latestResult.success ? latestResult.data : null;
  const consistent = snapshot && manifest && manifest.latestDate === snapshot.date &&
    manifest.latestAsOf === snapshot.asOf && manifest.itemCount === snapshot.itemCount &&
    manifest.dates.includes(snapshot.date);
  const latest = consistent ? snapshot : null;
  const health = healthResult.success ? healthResult.data : null;
  if (!latest) {
    return {
      latest: null, health, manifest, stale: false,
      message: latestInput.found ? "发布数据或清单校验失败；页面没有展示未经验证的内容。"
        : health && !["success", "empty"].includes(overallHealth(health))
          ? "最近一次采集失败，尚无可展示的有效数据。"
          : "暂无采集数据。请先运行 npm run radar:run，再重新构建网站。",
    };
  }
  const stale = isDataStale(latest.asOf, now);
  const failed = health && !["success", "empty"].includes(overallHealth(health));
  const newerFailure = sourceRuns(health).some((source) => source.lastAttemptAt > latest.asOf);
  const futureTimeNote = latest.schemaVersion === 2 && latest.qualityFlags?.includes("as_of_was_future_at_collection")
    ? " 此历史批次使用了当时超前于真实采集时刻的 asOf；时间相关评分与健康时间仅供参考。" : "";
  const message = failed && (newerFailure || latest.schemaVersion === 1) ? `最近一次采集未达到发布门槛，下面保留上一次有效结果。${stale ? "该结果也已超过 48 小时。" : ""}`
    : failed ? `部分来源本次失败或沿用旧条目；成功来源已发布。详情见来源状态。${stale ? "该批次已超过 48 小时。" : ""}`
    : overallHealth(health) === "empty" ? `最近一次采集成功但无入选条目，下面保留上一次有效结果。${stale ? "该结果也已超过 48 小时。" : ""}`
    : !health ? `来源状态文件缺失或无效；下面是已验证的最近有效结果。${stale ? "该结果已超过 48 小时。" : ""}`
    : stale ? "数据已超过 48 小时未更新，下面是上一次有效结果。"
      : "最近一次有效采集结果";
  return {
    latest, health, manifest, stale,
    message: message + futureTimeNote,
  };
}
