/**
 * Generic, convention-based repo scanner.
 *
 * No project-specific knowledge — recognizes widely-used folder conventions
 * across JS/TS ecosystems (Next.js/Express/Nest/generic feature-folder apps)
 * and reports what it finds as labeled groups. A repo can override or extend
 * this via .claude-mapper.json (see config.mjs).
 */
import { readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { isIgnored } from "./ignore.mjs";

/** List immediate subdirectories of a path (sorted, hidden dirs excluded). */
export function dirs(root, relPath, ignore = []) {
  const abs = join(root, relPath);
  if (!existsSync(abs)) return [];
  return readdirSync(abs)
    .filter((n) => !n.startsWith(".") && !n.startsWith("_") && statSync(join(abs, n)).isDirectory())
    .filter((n) => !isIgnored(join(relPath, n), ignore))
    .sort();
}

/**
 * List source files (by extension) in a path, sorted. Filenames have their
 * matched extension stripped (e.g. `usersRoute.ts` -> `usersRoute`) UNLESS
 * `stripExt` is false — config files (`.json`/`.yaml`) keep their extension
 * since the extension is part of what identifies them.
 */
export function files(root, relPath, ext = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"], stripExt = true, ignore = []) {
  const abs = join(root, relPath);
  if (!existsSync(abs)) return [];
  return readdirSync(abs)
    .filter((n) => ext.some((e) => n.endsWith(e)) && !n.endsWith(".d.ts") && !n.endsWith(".test.ts"))
    .filter((n) => !isIgnored(join(relPath, n), ignore))
    .map((n) => (stripExt ? n.slice(0, -ext.find((e) => n.endsWith(e)).length) : n))
    .sort();
}

/**
 * Known folder conventions, checked in order. Each entry: a relative path to
 * look for, a human label, and whether to list files (vs. subdirectories).
 * First-match-per-category — a repo can match several categories at once
 * (e.g. a Next.js app has both `src/app` and `src/features`).
 */
const CONVENTIONS = [
  // Feature-folder pattern (React/Vue/Svelte apps organized by domain)
  { path: "src/features", label: "Features", kind: "dirs" },
  { path: "features", label: "Features", kind: "dirs" },

  // Next.js App Router / Pages Router
  { path: "src/app", label: "App routes", kind: "dirs" },
  { path: "app", label: "App routes", kind: "dirs" },
  { path: "src/pages", label: "Pages", kind: "dirs" },
  { path: "pages", label: "Pages", kind: "dirs" },

  // Backend route/controller conventions
  { path: "src/routes", label: "Routes", kind: "files" },
  { path: "routes", label: "Routes", kind: "files" },
  { path: "src/controllers", label: "Controllers", kind: "files" },
  { path: "controllers", label: "Controllers", kind: "files" },

  // Service/domain layer (Clean Architecture-ish, lowercase convention)
  { path: "src/services", label: "Services", kind: "files" },
  { path: "src/domain", label: "Domain", kind: "dirs" },
  { path: "src/application", label: "Application services", kind: "dirs" },

  // Data layer
  { path: "src/repositories", label: "Repositories", kind: "files" },
  { path: "src/models", label: "Models", kind: "files" },
  { path: "src/schema", label: "Schema", kind: "files" },

  // Clean Architecture, PascalCase layer convention (Presentation/Domain/
  // Application/Infrastructure — common in .NET-influenced TS backends).
  // Checked deeper-first since these repos often also have a shallow
  // src/domain that would otherwise steal the "Domain" label.
  { path: "src/Presentation/contracts", label: "Domains (contract-first routes)", kind: "dirs" },
  { path: "src/Presentation/routes", label: "Domains (legacy routes)", kind: "dirs" },
  { path: "src/Application/services", label: "Domains (services)", kind: "dirs" },
  { path: "src/Infrastructure/repositories", label: "Domains (repositories)", kind: "dirs" },
  { path: "src/Domain/models", label: "Domain models", kind: "files" },

  // Components
  { path: "src/components", label: "Components", kind: "dirs" },
  { path: "components", label: "Components", kind: "dirs" },

  // Shared/lib
  { path: "src/lib", label: "Lib", kind: "files" },
  { path: "src/utils", label: "Utils", kind: "files" },
  { path: "src/shared", label: "Shared", kind: "dirs" },

  // API/SDK packages
  { path: "src/resources", label: "SDK resources", kind: "dirs" },

  // Packages in a JS/TS monorepo
  { path: "packages", label: "Packages", kind: "dirs" },
  { path: "apps", label: "Apps", kind: "dirs" },

  // Python: Django/Flask/FastAPI-style app layout
  { path: "app/routers", label: "Routers", kind: "files", ext: [".py"] },
  { path: "app/api", label: "API routes", kind: "dirs" },
  { path: "app/models", label: "Models", kind: "files", ext: [".py"] },
  { path: "app/services", label: "Services", kind: "files", ext: [".py"] },

  // Go: standard project layout (golang-standards/project-layout)
  { path: "cmd", label: "Commands", kind: "dirs" },
  { path: "internal", label: "Internal packages", kind: "dirs" },
  { path: "pkg", label: "Public packages", kind: "dirs" },
];

const list = (arr) => (arr.length ? "`" + arr.join("`, `") + "`" : "_(none)_");

/**
 * "Config-only" package fallback: a package with no `src/` at all, but real
 * `scripts/` (build/codegen tooling) and/or `config/` (JSON/YAML configs) —
 * common for codegen packages, CLI wrapper packages, or infra-only packages
 * that have no application source of their own.
 */
function scanConfigOnlyPackage(root, ignore) {
  if (existsSync(join(root, "src"))) return []; // only a fallback for src-less packages
  const lines = [];
  const scripts = files(root, "scripts", [".ts", ".mjs", ".js"], true, ignore);
  if (scripts.length) lines.push(`- **Scripts** (${scripts.length}): ${list(scripts)}`);
  const configs = files(root, "config", [".json", ".yaml", ".yml"], false, ignore);
  if (configs.length) lines.push(`- **Configs** (${configs.length}): ${list(configs)}`);
  return lines;
}

/**
 * Sibling-package monorepo fallback: top-level folders that each have their
 * own `src/` (e.g. `pdf/src`, `excel/src`, `mail/src` — a services monorepo
 * with no `packages/`/`apps/` wrapper folder). For each such sibling, list
 * its own `src/routes` (or `src/services` as a second choice) files under a
 * `<name>/ routes` label, matching how a human would describe "this repo has
 * N little services, here's what each one exposes."
 */
function scanSiblingPackages(root, ignore) {
  const siblings = dirs(root, ".", ignore).filter((name) => existsSync(join(root, name, "src")));
  const lines = [];
  for (const name of siblings) {
    const routeFiles = files(root, `${name}/src/routes`, undefined, true, ignore);
    const serviceFiles = routeFiles.length ? [] : files(root, `${name}/src/services`, undefined, true, ignore);
    const items = routeFiles.length ? routeFiles : serviceFiles;
    const label = routeFiles.length ? `${name}/ routes` : `${name}/ services`;
    if (items.length) lines.push(`- **${label}** (${items.length}): ${list(items)}`);
  }
  return lines;
}

/**
 * Scan a repo root and produce an array of markdown bullet lines describing
 * its structure. `overrides` (from .claude-mapper.json) can add extra
 * { path, label, kind } entries or replace the whole convention list.
 */
export function scanRepo(root, overrides = null) {
  const conventions = overrides?.replaceConventions
    ? overrides.paths
    : [...(overrides?.paths ?? []), ...CONVENTIONS];

  const lines = [];
  const seenLabels = new Set();
  const ignore = overrides?.ignore ?? [];

  for (const { path, label, kind, ext } of conventions) {
    if (seenLabels.has(label)) continue; // first match per label wins
    const items = kind === "files" ? files(root, path, ext, true, ignore) : dirs(root, path, ignore);
    if (items.length) {
      lines.push(`- **${label}** (${items.length}): ${list(items)}`);
      seenLabels.add(label);
    }
  }

  // Fallbacks only kick in if nothing else matched — a repo with a real
  // src/ at its root should never also get per-folder or config-only noise.
  if (!lines.length && !overrides?.replaceConventions) {
    lines.push(...scanConfigOnlyPackage(root, ignore));
  }
  if (!lines.length && !overrides?.replaceConventions) {
    lines.push(...scanSiblingPackages(root, ignore));
  }

  if (!lines.length) {
    lines.push(
      "_No recognized source layout. Add a `.claude-mapper.json` with custom `paths` — see README._",
    );
  }

  return lines;
}
