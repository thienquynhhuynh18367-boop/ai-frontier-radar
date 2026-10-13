export function sitePath(path: string, basePath = process.env.NEXT_PUBLIC_RADAR_BASE_PATH ?? ""): string {
  if (!path.startsWith("/")) throw new Error("Site path must be absolute");
  const [pathname, query] = path.split("?", 2);
  const route = pathname === "/" ? "/" : pathname.replace(/\/$/, "") + "/";
  return `${basePath}${route}${query === undefined ? "" : `?${query}`}`;
}

export function detailHref(id: string, basePath?: string): string {
  return sitePath(`/detail?id=${encodeURIComponent(id)}`, basePath);
}
