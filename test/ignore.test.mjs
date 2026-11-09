import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateMap } from "../src/generateMap.mjs";
import { scanRepo } from "../src/scan.mjs";
import { initConfig } from "../src/init.mjs";
import { checkStaleness } from "../src/checkStale.mjs";
import { loadConfig } from "../src/config.mjs";
import { isIgnored } from "../src/ignore.mjs";

function withTempDir(fn) {
  const tmp = mkdtempSync(join(tmpdir(), "claude-mapper-ignore-test-"));
  try { fn(tmp); } finally { rmSync(tmp, { recursive: true, force: true }); }
}
function create(root, pathname) {
  const filePath = join(root, pathname);
  mkdirSync(join(filePath, ".."), { recursive: true });
  writeFileSync(filePath, "// test file");
}
function config(root, ignore) {
  writeFileSync(join(root, ".claude-mapper.json"), JSON.stringify({ ignore }));
}

test("no ignore preserves original structure and counts", () => withTempDir((root) => {
  mkdirSync(join(root, "src", "features", "auth"), { recursive: true });
  mkdirSync(join(root, "src", "features", "billing"));
  assert.match(scanRepo(root).join("\n"), /Features.*\(2\)/);
  config(root, []);
  assert.match(generateMap(root, { dryRun: true }).content, /Features.*\(2\)/);
}));

test("ignore excludes an exact feature directory and a source file", () => withTempDir((root) => {
  mkdirSync(join(root, "src", "features", "auth"), { recursive: true });
  mkdirSync(join(root, "src", "features", "legacy"));
  create(root, "src/routes/usersRoute.ts");
  create(root, "src/routes/oldRoute.ts");
  config(root, ["src/features/legacy", "src/routes/oldRoute.ts"]);
  const content = generateMap(root, { dryRun: true }).content;
  assert.match(content, /Features.*\(1\).*auth/);
  assert.match(content, /Routes.*\(1\).*usersRoute/);
  assert.doesNotMatch(content, /`legacy`|`oldRoute`/);
}));

test("ignore can exclude a whole directory and removes empty categories", () => withTempDir((root) => {
  mkdirSync(join(root, "src", "features", "auth"), { recursive: true });
  create(root, "src/routes/usersRoute.ts");
  config(root, ["src/features"]);
  const content = generateMap(root, { dryRun: true }).content;
  assert.doesNotMatch(content, /- \*\*Features\*\*/);
  assert.match(content, /Routes.*\(1\)/);
}));

test("ignore normalizes Windows separators, and exact names do not match prefixes", () => withTempDir((root) => {
  mkdirSync(join(root, "src", "features", "auth"), { recursive: true });
  mkdirSync(join(root, "src", "features", "authentication"));
  config(root, ["src\\features\\auth"]);
  const content = generateMap(root, { dryRun: true }).content;
  assert.match(content, /Features.*\(1\).*authentication/);
  assert.doesNotMatch(content, /`auth`/);
  assert.equal(isIgnored("src/features/authentication", ["src/features/auth"]), false);
}));

test("ignore also applies to config-only fallback", () => withTempDir((root) => {
  create(root, "scripts/build.mjs");
  create(root, "scripts/generate.mjs");
  config(root, ["scripts/build.mjs"]);
  const content = generateMap(root, { dryRun: true }).content;
  assert.match(content, /Scripts.*\(1\).*generate/);
  assert.doesNotMatch(content, /`build`/);
}));

test("ignore also applies to sibling-packages fallback", () => withTempDir((root) => {
  create(root, "mail/src/routes/send.ts");
  create(root, "mail/src/routes/receive.ts");
  config(root, ["mail/src/routes/send.ts"]);
  const content = generateMap(root, { dryRun: true }).content;
  assert.match(content, /mail\/ routes.*\(1\).*receive/);
  assert.doesNotMatch(content, /`send`/);
}));

test("invalid ignore entries do not crash generation", () => withTempDir((root) => {
  create(root, "src/routes/usersRoute.ts");
  config(root, ["../outside", "C:\\private\\x", 123, "src/routes/missing.ts"]);
  const content = generateMap(root, { dryRun: true }).content;
  assert.match(content, /Routes.*\(1\)/);
}));

test("changing ignore makes check report that the old map is stale", () => withTempDir((root) => {
  mkdirSync(join(root, "src", "features", "auth"), { recursive: true });
  mkdirSync(join(root, "src", "features", "billing"));
  generateMap(root);
  config(root, ["src/features/billing"]);
  assert.equal(checkStaleness(root).staleCount, 1);
  assert.match(checkStaleness(root).results[0].changes.join("\n"), /Features.*\(1\)/);
  generateMap(root);
  assert.equal(checkStaleness(root).staleCount, 0);
}));

test("init adds an empty ignore array without overwriting user config", () => withTempDir((root) => {
  initConfig(root);
  assert.deepEqual(loadConfig(root).ignore, []);
  const path = join(root, ".claude-mapper.json");
  const before = readFileSync(path, "utf8");
  assert.equal(initConfig(root).created, false);
  assert.equal(readFileSync(path, "utf8"), before);
}));

test("ignore excludes all recognized entries", () => withTempDir((root) => {
  mkdirSync(join(root, "src", "features", "auth"), { recursive: true });
  create(root, "src/routes/usersRoute.ts");

  config(root, ["src/features", "src/routes"]);

  const content = generateMap(root, { dryRun: true }).content;

  assert.doesNotMatch(content, /\*\*Features\*\*/);
  assert.doesNotMatch(content, /\*\*Routes\*\*/);

  assert.match(content, /No recognized source layout/);
}));