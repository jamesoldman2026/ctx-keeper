
<!-- ctx -->
# ctx-keeper — Context

## Project Info
- **Framework**: unknown
- **Type**: node
- **Entry points**: bin/ctx.js

## Architecture

### Dependency Map
**bin** (1 files)
  `ctx.js (←0 →1)`
**dist** (1 files)
  `cli.js (←1 →0)`
**src** (6 files)
  `cli.ts (←0 →5)`
  `generator.ts (←1 →2)`
  `scanner.ts (←1 →2)`
  `store.ts (←6 →2)`
  `types.ts (←3 →0)`
  `util.ts (←6 →0)`
**src/commands** (5 files)
  `generate.ts (←1 →3)`
  `init.ts (←1 →2)`
  `log.ts (←1 →1)`
  `scan.ts (←1 →3)`
  `status.ts (←1 →2)`

## Directory Structure
```
📁 bin/
  📄 ctx.js
📁 src/
  📁 commands/
    📄 generate.ts
    📄 init.ts
    📄 log.ts
    📄 scan.ts
    📄 status.ts
  📄 cli.ts
  📄 generator.ts
  📄 scanner.ts
  📄 store.ts
  📄 types.ts
  📄 util.ts
📄 .gitignore
📄 LICENSE
📄 package-lock.json
📄 package.json
📄 README.md
📄 tsconfig.json
```

## Key Decisions
- **2026/6/28 23:38:25**: C/C++ source file + include support added
- **2026/6/28 23:38:25**: Python dotted-path dep resolution added
- **2026/6/28 23:38:25**: v0.1.0 prep: cross-project validation on 3 projects (Python/FastAPI, C++, TS)
- **2026/6/28 23:28:47**: fix: resolveImport now handles .js→.ts extension mapping for TS ESM imports
- **2026/6/28 23:26:12**: Project initialized

> Last scan: 2026/6/28 23:38:31

<!-- /ctx -->
