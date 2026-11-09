# claude-mapper

[![npm](https://img.shields.io/npm/v/claude-mapper)](https://www.npmjs.com/package/claude-mapper)
[![license](https://img.shields.io/npm/l/claude-mapper)](https://github.com/owlCoder/claude-mapper/blob/master/LICENSE)

Generates a navigable `MAP.md` for every repo in your codebase, plus a small
`ARCHITECTURE.md` index for multi-repo workspaces — so an AI coding agent
(Claude Code or similar) can read a short, structured map instead of blind
scanning your folders on every task.

Zero dependencies. Works standalone; nothing to configure for common
JS/TS/Python/Go layouts.

## The problem

Large or multi-repo codebases cost an AI agent real tokens (and time) just to
figure out *where things are* before it can start working. Two failure modes
in particular:

1. **Blind scanning.** Without a map, the agent globs/greps its way around
   the tree on every session, re-discovering structure it already saw last
   time.
2. **Stale docs.** A hand-written architecture doc drifts out of sync with
   the actual folders within a few commits, and nothing tells you it's wrong
   — the agent just trusts it and gets misled.

`claude-mapper` addresses both: the structural parts of `MAP.md` are
**generated from the actual folder tree** (so they can be regenerated and checked for drift), and
`claude-mapper check` compares the generated map with the current project
structure and reports when the map is out of date.

## What it generates

**Per repo**, a `MAP.md` with an auto-generated `<!-- AUTO:START -->` /
`<!-- AUTO:END --> ` block listing recognized structure (features, routes,
components, services, ...), plus a hand-editable "Where to look" section
that survives regeneration untouched.

**For a multi-repo workspace**, a root `ARCHITECTURE.md` that indexes every
sub-repo's `MAP.md` — so an agent starting cold reads one small file, then
opens exactly the per-repo map it needs.

## Install

```bash
npx claude-mapper generate     # no install needed
# or
npm install -g claude-mapper
```

## Usage

```bash
# Inside a single repo
claude-mapper generate         # create/update this repo's MAP.md
claude-mapper generate --dry-run  # preview the output, write nothing
claude-mapper check            # exit 1 if MAP.md differs from current generated structure
claude-mapper init             # scaffold a starter .claude-mapper.json

# At a multi-repo workspace root (folders containing package.json or .git)
claude-mapper generate --all   # regenerate every sub-repo's MAP.md + ARCHITECTURE.md
claude-mapper check --all      # flag every sub-repo whose MAP.md differs from the current structure

# Only include matching sub-repo folder names
claude-mapper generate --all --match "^my-org-"
```

### CI

Wire `claude-mapper check --all` into CI (non-zero exit on staleness) or a
pre-commit hook to keep maps honest without remembering to run it by hand. A
ready-to-copy GitHub Actions workflow is at
[`examples/github-actions/check-maps.yml`](examples/github-actions/check-maps.yml)
— copy it to `.github/workflows/check-maps.yml`.

## How structure detection works

No project-specific config is required — `claude-mapper` recognizes common
conventions out of the box:

**JS/TS**
- Feature-folder apps: `src/features/*`
- Next.js: `src/app/*` or `app/*` (App Router), `src/pages/*` or `pages/*`
- Backend route/controller layers: `src/routes`, `src/controllers`
- Clean-Architecture-ish layers, lowercase convention: `src/domain`,
  `src/application`, `src/services`, `src/repositories`, `src/models`,
  `src/schema`
- Clean-Architecture-ish layers, PascalCase convention (common in
  .NET-influenced TS backends): `src/Presentation/contracts`,
  `src/Presentation/routes`, `src/Application/services`,
  `src/Infrastructure/repositories`, `src/Domain/models`
- `src/components`, `src/lib`, `src/utils`, `src/shared`
- Monorepo layout: `packages/*`, `apps/*`
- Services monorepo with no `packages/`/`apps/` wrapper (each top-level
  folder has its own `src/`) — falls back to per-sibling `src/routes` or
  `src/services` scanning
- Config-only packages (codegen/CLI-wrapper packages with no `src/` at
  all) — falls back to scanning `scripts/` + `config/`

**Python** (Django/Flask/FastAPI-style): `app/routers`, `app/api`,
`app/models`, `app/services`

**Go** (standard project layout): `cmd/*`, `internal/*`, `pkg/*`

Each recognized folder becomes one labeled bullet line in the generated
section, e.g.:

```
- **Features** (10): `auth`, `board`, `dashboard`, `grade`, `landing`, ...
- **App routes** (4): `(app)`, `(auth)`, `(public)`, `api`
```

### Custom layout: `.claude-mapper.json`

If your repo doesn't match the built-in conventions (or you want extra
entries), run `claude-mapper init` to scaffold a starter file, or drop a
`.claude-mapper.json` in the repo root by hand:

```json
{
  "paths": [
    { "path": "src/my-weird-layer", "label": "My weird layer", "kind": "dirs" }
  ],
  "replaceConventions": false,
  "ignore": ["src/features/legacy", "src/routes/oldRoute.ts"]
}
```

- `kind: "dirs"` lists subdirectory names; `kind: "files"` lists source
  filenames (extension stripped).
- `replaceConventions: true` uses *only* your `paths`, skipping the built-in
  heuristics entirely — useful for unusual repo layouts where the defaults
  produce noise.

### Excluding entries from the generated map

Use `ignore` in `.claude-mapper.json` to omit **recognized** entries from
`MAP.md`, without deleting or changing any source files. Rules are project-root
relative paths with `/` separators (Windows-style `\` separators also work).
Exact file paths and whole directory trees are supported; glob syntax (`*`,
`**`) is deliberately **not** supported.

For example, `"src/features/legacy"` omits the `legacy` feature folder, while
`"src/routes/oldRoute.ts"` omits that route file. The displayed counts are
updated automatically. Omit `ignore` or set it to `[]` to preserve the previous
behavior. `claude-mapper init` creates a config with `"ignore": []` by default.
Invalid ignore entries are skipped with a warning.

### Checking whether a map is current

`claude-mapper check` now compares only the generated `AUTO:START` / `AUTO:END`
section against the content `generate --dry-run` would produce. It ignores
manual notes. It reports missing maps, invalid AUTO markers and changes in the
generated AUTO section, showing removed/added lines when they differ. It does
not modify `MAP.md`; a nonzero exit status indicates a stale or missing map.
`check --all` performs the same check for each recognized sub-repo.

## What it deliberately doesn't do

- **No AI/LLM analysis of your code.** This is a mechanical folder-structure
  scanner, not a codebase-understanding tool — it won't infer your
  architecture's *intent*, detect anti-patterns, or write prose about your
  domain model. If you want that, pair this with a tool that does deep
  content analysis; `claude-mapper` stays fast, deterministic, and free to
  run on every commit.
- **No CLAUDE.md generation.** This tool only maintains `MAP.md`/
  `ARCHITECTURE.md` navigation files. Your `CLAUDE.md` (rules, conventions,
  gotchas) stays entirely hand-written — link to the generated maps from it.

## License

MIT
