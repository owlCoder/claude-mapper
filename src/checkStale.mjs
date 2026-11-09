/**
 * Checks whether the AUTO section of MAP.md matches the current project
 * structure. Read-only.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { generateMap } from "./generateMap.mjs";

const START = "<!-- AUTO:START -->";
const END = "<!-- AUTO:END -->";

function extractAuto(content) {
  const start = content.indexOf(START);
  const end = content.indexOf(END);
  if (start < 0 || end < 0 || end < start + START.length) return null;
  if (content.indexOf(START, start + START.length) !== -1) return null;
  if (content.indexOf(END, end + END.length) !== -1) return null;
  return content.slice(start + START.length, end).replace(/\r\n/g, "\n").trim();
}


function changedRows(previous, current) {
  const mapRows = (value) => value.split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const oldLines = mapRows(previous);
  const newLines = mapRows(current);

  const dp = Array.from(
    { length: oldLines.length + 1 },
    () => Array(newLines.length + 1).fill(0)
  );

  for (let i = oldLines.length - 1; i >= 0; i--) {
    for (let j = newLines.length - 1; j >= 0; j--) {
      dp[i][j] = oldLines[i] === newLines[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const changes = [];
  let i = 0;
  let j = 0;

  while (i < oldLines.length && j < newLines.length) {
    if (oldLines[i] === newLines[j]) {
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      changes.push(`- ${oldLines[i].replace(/^- /, "")}`);
      i++;
    } else {
      changes.push(`+ ${newLines[j].replace(/^- /, "")}`);
      j++;
    }
  }

  while (i < oldLines.length) {
    changes.push(`- ${oldLines[i].replace(/^- /, "")}`);
    i++;
  }

  while (j < newLines.length) {
    changes.push(`+ ${newLines[j].replace(/^- /, "")}`);
    j++;
  }

  return changes;
}

function checkOne(repoPath, repoLabel) {
  const mapPath = join(repoPath, "MAP.md");
  if (!existsSync(mapPath)) {
    return { repo: repoLabel, stale: true, reason: "missing", changes: [] };
  }

  const actual = extractAuto(readFileSync(mapPath, "utf8"));
  if (actual === null) {
    return { repo: repoLabel, stale: true, reason: "invalid-markers", changes: [] };
  }

  const expected = extractAuto(generateMap(repoPath, { dryRun: true }).content);
  if (actual === expected) return null;

  return {
    repo: repoLabel,
    stale: true,
    reason: "content-changed",
    changes: changedRows(actual, expected),
  };
}

/**
 * @param {string} root workspace root (multi-repo) or a single repo root
 * @param {{ multiRepo?: boolean, match?: RegExp }} [opts]
 * @returns {{ staleCount: number, results: {repo: string, stale: boolean, reason: string, changes: string[]}[] }}
 */
export function checkStaleness(root, opts = {}) {
  const results = [];
  if (opts.multiRepo) {
    const entries = readdirSync(root)
      .filter((name) => !name.startsWith(".") && statSync(join(root, name)).isDirectory())
      .filter((name) => opts.match ? opts.match.test(name) : true)
      .filter((name) => existsSync(join(root, name, "package.json")) || existsSync(join(root, name, ".git")))
      .sort();
    for (const name of entries) {
      const result = checkOne(join(root, name), name);
      if (result) results.push(result);
    }
  } else {
    const result = checkOne(root, ".");
    if (result) results.push(result);
  }
  return { staleCount: results.length, results };
}
