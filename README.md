# ctx-keeper

CLI that keeps your project context fresh — designed for **opencode** agents.

Scan structure, trace dependencies, log decisions, and inject live context into
`AGENTS.md` so the agent always knows what you've been doing.

## Install

```sh
npm install -g ctx-keeper
```

Or run directly without install:

```sh
npx ctx-keeper init
```

## Commands

| Command | Description |
|---------|-------------|
| `init` | Initialize `.ctx/` directory in the current project |
| `scan` | Scan files, detect framework/routes/entry points, build dep graph |
| `status` | Show project snapshot: files, modules, edges, routes, decisions |
| `log <message>` | Record a decision with auto-detected changed files |
| `generate` | Write `.context.md` from the latest scan |
| `sync` | **Inject context into `AGENTS.md`** between `<!-- ctx -->` markers |
| `--dir <path>` | Target a different directory |

## Workflow

```sh
cd my-project

# 1. Initialize
ctx init

# 2. Scan project structure
ctx scan
# → ✓ scanned 210 entries, 149 modules
#   framework: Fastify
#   entry points: src/app.ts
#   routes: 70

# 3. Make changes, log key decisions
ctx log "switched from Redis to in-memory fallback"

# 4. Inject context into AGENTS.md — agent sees it every turn
ctx sync

# 5. Check current state
ctx status
# → Framework: Fastify
#   Files: 210, Modules: 149, Edges: 322
#   Routes: 70, Decisions: 3
```

## How it works with opencode

```
ctx scan  →  snapshot stored in .ctx/
  │
ctx sync  →  injects into AGENTS.md
  │           between <!-- ctx --> and <!-- /ctx -->
  ▼
opencode reads AGENTS.md on every turn
  → agent sees dependencies, routes, decisions, file tree
  → no more "let me re-scan the whole project" every session
```

Re-run `ctx sync` after any significant change — the `<!-- ctx -->` block
is replaced in-place, so `AGENTS.md` stays clean.

## Supported languages

- TypeScript / JavaScript (Fastify, Express, Next.js, NestJS, React, Vue)
- Python (FastAPI, Flask, Django)
- C / C++ (basic include detection)
- Rust, Go, Java

## License

MIT
