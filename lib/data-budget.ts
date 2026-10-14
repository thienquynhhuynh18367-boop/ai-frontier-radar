import { lstat, readdir } from "node:fs/promises";
import { join } from "node:path";

export const MAX_DATA_BYTES = 750 * 1024 * 1024;

export function assertDataBudget(bytes: number): void {
  if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > MAX_DATA_BYTES) {
    throw new Error("Historical JSON working tree exceeds the 750 MiB review limit");
  }
}

export async function directoryBytes(path: string): Promise<number> {
  let total = 0;
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isSymbolicLink()) throw new Error("Unexpected symlink in data tree");
    if (entry.isDirectory()) total += await directoryBytes(child);
    else if (entry.isFile()) total += (await lstat(child)).size;
  }
  return total;
}
