import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { LatestSchema, SourceStatusSchema, type Latest, type SourceStatus } from "../types/publication";
import { isDataStale } from "./freshness";

export type Preview = {
  latest: Latest | null;
  health: SourceStatus | null;
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
  const latestResult = LatestSchema.safeParse(latestInput.data);
  const healthResult = SourceStatusSchema.safeParse(healthInput.data);
  const latest = latestResult.success ? latestResult.data : null;
  const health = healthResult.success ? healthResult.data : null;
  if (!latest) {
    return {
      latest: null, health, stale: false,
      message: latestInput.found ? "发布数据校验失败；页面没有展示未经验证的内容。"
        : health && !["success", "empty"].includes(health.status)
          ? "最近一次采集失败，尚无可展示的有效数据。"
          : "暂无采集数据。请先运行 npm run radar:run，再重新构建网站。",
    };
  }
  const stale = isDataStale(latest.asOf, now);
  const failed = health && !["success", "empty"].includes(health.status);
  return {
    latest, health, stale,
    message: failed ? "最近一次采集未达到发布门槛，下面保留上一次有效结果。"
      : stale ? "数据已超过 48 小时未更新，下面是上一次有效结果。"
        : "最近一次有效采集结果",
  };
}
