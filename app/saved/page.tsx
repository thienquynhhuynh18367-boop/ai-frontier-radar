import { PageHeader } from "../../components/page-frame";
import { SavedPageClient } from "../../components/saved-page-client";
import { loadPreview } from "../../lib/preview-data";

export default async function SavedPage() {
  const preview = await loadPreview(process.cwd(), new Date().toISOString());
  return <>
    <PageHeader eyebrow="PERSONAL WORKSPACE / SAVED" title="我的收藏"
      description="保存值得回看的条目，管理已读与隐藏状态，并用 JSON 在浏览器之间手动备份。" />
    <SavedPageClient items={preview.latest?.items ?? []} />
  </>;
}
