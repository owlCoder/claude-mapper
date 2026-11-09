/**
 * Scaffolds a starter .claude-mapper.json in the given repo root, with
 * commented-out example entries so a user can see the shape without
 * having to read the README first.
 */
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const TEMPLATE = `{
  "$schema_note": "claude-mapper config — see https://github.com/owlCoder/claude-mapper#custom-layout-claude-mapperjson",
  "paths": [
    { "path": "src/my-weird-layer", "label": "My weird layer", "kind": "dirs" }
  ],
  "replaceConventions": false,
  "ignore": []
}
`;

/**
 * @param {string} root
 * @returns {{ created: boolean, path: string }}
 */
export function initConfig(root) {
  const configPath = join(root, ".claude-mapper.json");
  if (existsSync(configPath)) {
    return { created: false, path: configPath };
  }
  writeFileSync(configPath, TEMPLATE);
  return { created: true, path: configPath };
}
