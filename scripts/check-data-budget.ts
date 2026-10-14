import { join } from "node:path";
import { assertDataBudget, directoryBytes } from "../lib/data-budget";

async function main(): Promise<void> {
  const bytes = await directoryBytes(join(process.cwd(), "data"));
  assertDataBudget(bytes);
  process.stdout.write(`Historical JSON working tree: ${bytes} bytes, below 750 MiB review limit.\n`);
}

main().catch(() => {
  process.stderr.write("Data budget check failed; review history growth before publication.\n");
  process.exitCode = 1;
});
