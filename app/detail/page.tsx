import { DetailClient } from "../../components/detail-client";
import { loadPreview } from "../../lib/preview-data";

export default async function DetailPage() {
  const preview = await loadPreview(process.cwd(), new Date().toISOString());
  return <DetailClient items={preview.latest?.items ?? []} />;
}
