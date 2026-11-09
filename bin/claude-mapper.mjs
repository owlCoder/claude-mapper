#!/usr/bin/env node
import { generateMap } from "../src/generateMap.mjs";
import { generateIndex } from "../src/generateIndex.mjs";
import { checkStaleness } from "../src/checkStale.mjs";
import { initConfig } from "../src/init.mjs";

const HELP = `claude-mapper — generate navigable MAP.md files for AI coding agents

Usage:
  claude-mapper generate            Generate/update MAP.md for the current repo
  claude-mapper generate --all      Generate MAP.md for every sub-repo in this
                                     workspace + a root ARCHITECTURE.md index
  claude-mapper generate --dry-run  Preview output without writing any file
  claude-mapper check                Check whether MAP.md matches the current structure
  claude-mapper check --all          Check whether each sub-repo MAP.md matches its structure
  claude-mapper init                 Scaffold a starter .claude-mapper.json

Options:
  --all              Treat cwd as a multi-repo workspace root, not a single repo
  --match <regex>    Only include child dirs matching this regex (with --all)
  --dry-run          Compute output but don't write MAP.md/ARCHITECTURE.md
  -h, --help         Show this help
`;

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--all") args.all = true;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--match") args.match = argv[++i];
    else if (a === "-h" || a === "--help") args.help = true;
    else args._.push(a);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];

  if (args.help) {
    console.log(HELP);
    process.exit(0);
  }

  if (!command) {
    console.log(HELP);
    process.exit(1);
  }

  const cwd = process.cwd();
  const match = args.match ? new RegExp(args.match) : undefined;

  if (command === "generate") {
    if (args.all) {
      const { repoCount } = generateIndex(cwd, { match, dryRun: args.dryRun });
      const suffix = args.dryRun ? " (dry-run, nothing written)" : "; ARCHITECTURE.md updated";
      console.log(`[claude-mapper] processed ${repoCount} repo(s)${suffix}.`);
    } else {
      const { repo, action, content } = generateMap(cwd, { dryRun: args.dryRun });
      if (args.dryRun) {
        console.log(`[claude-mapper] ${repo}: MAP.md would be ${action} (dry-run, nothing written):\n`);
        console.log(content);
      } else {
        console.log(`[claude-mapper] ${repo}: MAP.md ${action}.`);
      }
    }
    return;
  }

  if (command === "check") {
    const { staleCount, results } = checkStaleness(cwd, { multiRepo: !!args.all, match });
    for (const r of results) {
      const reason = r.reason === "missing"
        ? "MAP.md is missing"
        : r.reason === "invalid-markers"
          ? "MAP.md has missing or invalid AUTO markers"
          : "MAP.md does not match the current project structure";
      console.log(`[stale] ${r.repo}: ${reason} — run \`claude-mapper generate\`.`);
      for (const change of r.changes) console.log(`  ${change}`);
    }
    if (staleCount === 0) {
      console.log("[claude-mapper] all maps up to date.");
    } else {
      console.log(`\n[claude-mapper] ${staleCount} map(s) stale.`);
      process.exitCode = 1;
    }
    return;
  }

  if (command === "init") {
    const { created, path } = initConfig(cwd);
    console.log(
      created
        ? `[claude-mapper] created ${path}`
        : `[claude-mapper] ${path} already exists — not overwriting.`,
    );
    return;
  }

  console.error(`Unknown command: ${command}\n`);
  console.log(HELP);
  process.exitCode = 1;
}

main();
