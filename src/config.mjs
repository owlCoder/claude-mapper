/**
 * Loads optional .claude-mapper.json from a repo root.
 *
 * Shape:
 * {
 *   "paths": [
 *     { "path": "src/my-weird-layer", "label": "My weird layer", "kind": "dirs" }
 *   ],
 *   "replaceConventions": false,
 *   "ignore": ["src/features/legacy", "src/routes/oldRoute.ts"]
 * }
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeRelativePath } from "./ignore.mjs";

const CONFIG_FILE = ".claude-mapper.json";

export function loadConfig(root) {
  const configPath = join(root, CONFIG_FILE);
  if (!existsSync(configPath)) return null;

  try {
    const raw = readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw);
    const ignore = [];
    if (parsed.ignore !== undefined && !Array.isArray(parsed.ignore)) {
      console.warn(`[claude-mapper] warning: ignore must be an array of relative paths`);
    } else {
      for (const rule of parsed.ignore ?? []) {
        const normalized = normalizeRelativePath(rule);
        if (normalized === null) {
          console.warn(`[claude-mapper] warning: ignoring invalid ignore entry: ${JSON.stringify(rule)}`);
        } else {
          ignore.push(normalized);
        }
      }
    }
    return {
      paths: Array.isArray(parsed.paths) ? parsed.paths : [],
      replaceConventions: parsed.replaceConventions === true,
      ignore,
    };
  } catch (err) {
    console.warn(`[claude-mapper] warning: could not parse ${CONFIG_FILE}: ${err.message}`);
    return null;
  }
}
