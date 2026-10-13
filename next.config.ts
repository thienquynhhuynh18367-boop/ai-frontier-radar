import type { NextConfig } from "next";

const basePath = process.env.RADAR_BASE_PATH;
if (basePath && (!/^\/[a-zA-Z0-9-]+$/.test(basePath))) {
  throw new Error("RADAR_BASE_PATH must be a single path segment such as /ai-frontier-radar");
}

const nextConfig: NextConfig = {
  output: "export",
  agentRules: false,
  ...(basePath ? { basePath } : {}),
};

export default nextConfig;
