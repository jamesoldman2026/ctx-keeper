# Changelog

## v0.2.0 (2026-06-29)

### Added
- `npm run validate` — one-command validation pipeline (test → build → dogfood scan)
- CI pipeline with dogfood scan (`.github/workflows/ci.yml`)
- 50 new tests: store roundtrip, generator output, init→scan→sync→status E2E, CLI parseArgs
- `parseArgs` exported from `cli.ts` for testability
- `main()` guard: only runs when `process.argv[1]` matches entry point

### Fixed
- Relative root path truncation in `resolveImport` / `parseArgs`
- Python dotted import walks parent directories correctly
- C++ `#include` resolution falls back to project root for `-I.` builds
- Symlink directories now traversed (`isSymbolicLink()` + `statSync()`)
- `export...from` regex now matches barrel files (was `import...from` only)
- Python bare directory match checks `__init__.py` before returning directory node

### Changed
- Test count: 91 → 141 across 6 test files
- `synced context` output verified by E2E test (first injection, replacement, preserve)
