import type { Metadata } from "next";
import { AppShell } from "../components/app-shell";
import { SavedProvider } from "../components/saved-provider";
import { loadPreview } from "../lib/preview-data";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Frontier Radar",
  description: "AI 行业前沿信息雷达",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const preview = await loadPreview(process.cwd(), new Date().toISOString());
  return (
    <html lang="zh-CN">
      <body><SavedProvider><AppShell health={preview.health} asOf={preview.latest?.asOf ?? null} staleAtBuild={preview.stale}>
        {children}
      </AppShell></SavedProvider></body>
    </html>
  );
}
