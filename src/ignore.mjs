/**
 * Small, dependency-free ignore matcher for paths in generated MAP.md entries.
 * Supports exact relative paths and excluding everything below a directory.
 * Does not implement glob/.gitignore syntax.
 */
export function normalizeRelativePath(value) {
  if (typeof value !== "string") return null;
  const path = value.trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/g, "");
  if (!path || path.startsWith("/") || /^[A-Za-z]:\//.test(path) || /[*?]/.test(path)) return null;
  if (path.split("/").some((segment) => !segment || segment === "." || segment === "..")) return null;
  return path;
}

export function isIgnored(relativePath, rules = []) {
  const target = normalizeRelativePath(relativePath);
  if (target === null) return false;
  return rules.some((rule) => {
    const ignored = normalizeRelativePath(rule);
    return ignored !== null && (target === ignored || target.startsWith(`${ignored}/`));
  });
}
