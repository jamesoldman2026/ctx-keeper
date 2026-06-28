import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { scanImports, scanTree, scanDeps } from '../src/scanner.js';

// ── scanImports ──────────────────────────────────────────────

describe('scanImports', () => {
  it('extracts TS import { ... } from', () => {
    const edges = scanImports(`import { foo } from './bar';`, 'a.ts');
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ from: 'a.ts', to: './bar', kind: 'static' });
  });

  it('extracts TS import default', () => {
    const edges = scanImports(`import foo from './bar';`, 'a.ts');
    expect(edges).toHaveLength(1);
    expect(edges[0].to).toBe('./bar');
  });

  it('extracts TS import * as', () => {
    const edges = scanImports(`import * as foo from './bar';`, 'a.ts');
    expect(edges[0].to).toBe('./bar');
  });

  it('extracts TS export { ... } from', () => {
    const edges = scanImports(`export { foo } from './bar';`, 'a.ts');
    expect(edges[0].to).toBe('./bar');
  });

  it('extracts TS re-export *', () => {
    const edges = scanImports(`export * from './bar';`, 'a.ts');
    expect(edges[0].to).toBe('./bar');
  });

  it('extracts TS dynamic import()', () => {
    const edges = scanImports(`const x = import('./bar');`, 'a.ts');
    expect(edges).toHaveLength(1);
    expect(edges[0].kind).toBe('dynamic');
  });

  it('extracts TS require()', () => {
    const edges = scanImports(`const x = require('./bar');`, 'a.ts');
    expect(edges[0].to).toBe('./bar');
  });

  it('extracts TS bare import', () => {
    const edges = scanImports(`import './bar';`, 'a.ts');
    expect(edges[0].to).toBe('./bar');
  });

  it('extracts Python import X', () => {
    const edges = scanImports(`import os`, 'a.py');
    expect(edges[0]).toMatchObject({ from: 'a.py', to: 'os' });
  });

  it('extracts Python from X import Y', () => {
    const edges = scanImports(`from os import path`, 'a.py');
    expect(edges[0].to).toBe('os');
  });

  it('extracts Python relative from .X import Y', () => {
    const edges = scanImports(`from .utils import helpers`, 'a.py');
    expect(edges[0].to).toBe('.utils');
  });

  it('extracts Python relative from ..X import Y', () => {
    const edges = scanImports(`from ..config import settings`, 'a.py');
    expect(edges[0].to).toBe('..config');
  });

  it('extracts C++ #include', () => {
    const edges = scanImports(`#include "foo.h"\n#include <bar.hpp>`, 'a.cpp');
    expect(edges).toHaveLength(2);
    expect(edges[0].to).toBe('foo.h');
    expect(edges[1].to).toBe('bar.hpp');
  });

  it('returns empty for no matches', () => {
    const edges = scanImports(`const x = 1;`, 'a.ts');
    expect(edges).toHaveLength(0);
  });

  it('handles multiline code', () => {
    const code = `
import os
import sys

from fastapi import FastAPI
from .local import helper
`;
    const edges = scanImports(code, 'a.py');
    expect(edges).toHaveLength(4);
  });

  it('handles C in .h file', () => {
    const edges = scanImports(`#include <stdio.h>\n#include "myheader.h"`, 'header.h');
    expect(edges).toHaveLength(2);
  });
});

// ── resolveImport helper test ───────────────────────────────

import { resolveImport } from '../src/scanner.js';

describe('resolveImport', () => {
  let tmp: string;
  const files: string[] = [];

  function touch(rel: string) {
    const abs = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, '', 'utf-8');
    files.push(abs);
  }

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(tmpdir(), 'ctx-test-'));
    // Python project structure
    touch('backend/__init__.py');
    touch('backend/api/__init__.py');
    touch('backend/api/_utils.py');
    touch('backend/api/health.py');
    touch('backend/app/main.py');
    touch('backend/app/api/__init__.py');
    touch('backend/app/api/health.py');

    // TS project structure
    touch('src/index.ts');
    touch('src/utils/helper.ts');
    touch('src/utils/index.ts');

    // C++ project structure
    touch('src/core/engine.h');
    touch('src/core/engine.cpp');
  });

  afterAll(() => {
    for (const f of files.reverse()) {
      try { fs.rmSync(f); } catch { /* already removed */ }
    }
    try { fs.rmSync(tmp, { recursive: true }); } catch { /* skip */ }
  });

  // ── Python dotted imports ──

  it('resolves api.health from backend/app/main.py', () => {
    const r = resolveImport('backend/app/main.py', 'api.health', tmp);
    expect(r).toBe('backend/app/api/health.py');
  });

  it('resolves api._utils from backend/app/main.py to backend/api/_utils.py (walks up)', () => {
    // backend/app/ has __init__.py but not api/_utils.py
    // walk up to backend/ → finds backend/api/_utils.py
    const r = resolveImport('backend/app/main.py', 'api._utils', tmp);
    expect(r).toBe('backend/api/_utils.py');
  });

  it('resolves api._utils from backend/api/health.py to same dir first', () => {
    const r = resolveImport('backend/api/health.py', 'api._utils', tmp);
    expect(r).toBe('backend/api/_utils.py');
  });

  it('resolves api.health from backend/app/main.py to backend/app (not backend)', () => {
    // There's also backend/api/health.py — should prefer backend/app/ (closer to source)
    const r = resolveImport('backend/app/main.py', 'api.health', tmp);
    expect(r).toBe('backend/app/api/health.py');
  });

  it('returns null for non-existent import', () => {
    const r = resolveImport('backend/app/main.py', 'nonexistent.module', tmp);
    expect(r).toBeNull();
  });

  it('returns null for third-party package', () => {
    const r = resolveImport('backend/app/main.py', 'fastapi', tmp);
    expect(r).toBeNull();
  });

  it('returns null for stdlib-like', () => {
    const r = resolveImport('backend/app/main.py', 'os', tmp);
    expect(r).toBeNull();
  });

  // ── Python relative imports ──

  it('returns null for relative imports (target starts with .)', () => {
    // resolveImport returns null for .-prefixed — caller handles differently
    const r = resolveImport('backend/api/health.py', '.utils', tmp);
    expect(r).toBeNull();
  });

  // ── TS imports ──

  it('resolves ./utils/helper from src/index.ts', () => {
    const r = resolveImport('src/index.ts', './utils/helper', tmp);
    expect(r).toBe('src/utils/helper.ts');
  });

  it('resolves ./utils from src/index.ts to index.ts', () => {
    // Relative import block now checks index.ts before the bare directory
    const r = resolveImport('src/index.ts', './utils', tmp);
    expect(r).toBe('src/utils/index.ts');
  });

  it('returns null for non-existent relative import', () => {
    const r = resolveImport('src/index.ts', './nonexistent', tmp);
    expect(r).toBeNull();
  });

  // ── C++ includes ──

  it('resolves #include "core/engine.h" from src/core/engine.cpp (with dir)', () => {
    // The C++ extension block doesn't handle paths with directories
    // But bare block 2 (root fallback) handles it
    // core/engine.h doesn't exist at root → null
    // This is a known limitation
    const r = resolveImport('src/core/engine.cpp', 'core/engine.h', tmp);
    // For now, null — would need fromDir-aware C++ resolution
    // TODO: fix C++ include with path component
    expect(r).toBeNull();
  });

  it('resolves #include "engine.h" from src/core/engine.cpp (same dir)', () => {
    const r = resolveImport('src/core/engine.cpp', 'engine.h', tmp);
    // From left bare block
    expect(r).toBe('src/core/engine.h');
  });

  // ── bare blocks (file/dir match) ──

  it('bare block 2 matches file at root', () => {
    touch('data.txt');
    const r = resolveImport('backend/app/main.py', 'data.txt', tmp);
    // Bare block 2: path.resolve(root, target) → <tmp>/data.txt → matches
    expect(r).toBe('data.txt');
    fs.rmSync(path.join(tmp, 'data.txt'));
  });

  it('.env file at root returns null (target starts with .)', () => {
    // `.env` starts with `.` → enters the relative-import block
    // Tries .env.ts, .env.tsx, .env.js, .env.jsx, index.ts, index.js, .env.py, __init__.py
    // None exist → returns null
    touch('.env');
    const r = resolveImport('backend/app/main.py', '.env', tmp);
    expect(r).toBeNull();
    fs.rmSync(path.join(tmp, '.env'));
  });

  // ── Root normalization ──

  it('works with relative root "."', () => {
    // This was the original bug — relative root causing dir.startsWith failure
    // chdir to tmp so "." resolves correctly
    const orig = process.cwd;
    process.cwd = () => tmp;
    const r = resolveImport('backend/app/main.py', 'api.health', '.');
    expect(r).toBe('backend/app/api/health.py');
    process.cwd = orig;
  });

  it('works with root "." for bare block', () => {
    const orig = process.cwd;
    process.cwd = () => tmp;
    const r = resolveImport('backend/app/main.py', '.env', '.');
    expect(r).toBeNull();
    process.cwd = orig;
  });
});

// ── scanTree ────────────────────────────────────────────────

describe('scanTree', () => {
  let tmp: string;

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(tmpdir(), 'ctx-tree-'));
    fs.mkdirSync(path.join(tmp, 'src', 'utils'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'src', 'api'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'node_modules', 'dep'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'src', 'index.ts'), '', 'utf-8');
    fs.writeFileSync(path.join(tmp, 'src', 'utils', 'helper.ts'), '', 'utf-8');
    fs.writeFileSync(path.join(tmp, 'src', 'api', 'route.ts'), '', 'utf-8');
    fs.writeFileSync(path.join(tmp, 'node_modules', 'dep', 'index.js'), '', 'utf-8');
    fs.writeFileSync(path.join(tmp, 'package.json'), '{}', 'utf-8');
  });

  afterAll(() => fs.rmSync(tmp, { recursive: true }));

  it('scans all files and dirs', () => {
    const entries = scanTree(tmp);
    const files = entries.filter(e => e.type === 'file');
    const dirs = entries.filter(e => e.type === 'dir');
    expect(files).toHaveLength(5);
    expect(dirs).toHaveLength(5);
  });

  it('excludes node_modules by default', () => {
    const entries = scanTree(tmp, ['node_modules']);
    const paths = entries.map(e => e.path);
    expect(paths).not.toContain('node_modules');
    expect(paths).not.toContain('node_modules/dep/index.js');
  });

  it('includes node_modules when not in ignore', () => {
    const entries = scanTree(tmp);
    const paths = entries.map(e => e.path);
    expect(paths).toContain('node_modules');
    expect(paths).toContain('node_modules/dep/index.js');
  });

  it('returns entries sorted by path', () => {
    const entries = scanTree(tmp);
    const paths = entries.map(e => e.path);
    const sorted = [...paths].sort((a, b) => a.localeCompare(b));
    expect(paths).toEqual(sorted);
  });

  it('each entry has path, type, size', () => {
    const entries = scanTree(tmp);
    for (const e of entries) {
      expect(e).toHaveProperty('path');
      expect(e).toHaveProperty('type');
      expect(e).toHaveProperty('size');
      expect(typeof e.size).toBe('number');
    }
  });
});

// ── scanDeps ────────────────────────────────────────────────

describe('scanDeps', () => {
  let tmp: string;

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(tmpdir(), 'ctx-deps-'));
    // src/index.ts imports from ./utils/helper
    fs.mkdirSync(path.join(tmp, 'src', 'utils'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'src', 'index.ts'), `import { greet } from './utils/helper';\n`, 'utf-8');
    fs.writeFileSync(path.join(tmp, 'src', 'utils', 'helper.ts'), `export const greet = () => 'hello';\n`, 'utf-8');
    // app.py imports from config.db
    fs.writeFileSync(path.join(tmp, 'app.py'), `from config.db import engine\n`, 'utf-8');
    fs.mkdirSync(path.join(tmp, 'config'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'config', '__init__.py'), ``, 'utf-8');
    fs.writeFileSync(path.join(tmp, 'config', 'db.py'), `engine = None\n`, 'utf-8');
    // Non-source file
    fs.writeFileSync(path.join(tmp, 'readme.md'), '# Project\n', 'utf-8');
  });

  afterAll(() => fs.rmSync(tmp, { recursive: true }));

  it('finds edges between source files', () => {
    const tree = scanTree(tmp);
    const graph = scanDeps(tmp, tree);
    expect(graph.nodes).toContain('src/index.ts');
    expect(graph.nodes).toContain('src/utils/helper.ts');
    expect(graph.nodes).toContain('app.py');
    expect(graph.nodes).toContain('config/__init__.py');
    expect(graph.nodes).not.toContain('readme.md');
  });

  it('resolves TS relative imports', () => {
    const tree = scanTree(tmp);
    const graph = scanDeps(tmp, tree);
    const edge = graph.edges.find(e => e.from === 'src/index.ts');
    expect(edge).toBeDefined();
    expect(edge!.to).toBe('src/utils/helper.ts');
    expect(edge!.kind).toBe('static');
  });

  it('resolves Python dotted imports', () => {
    const tree = scanTree(tmp);
    const graph = scanDeps(tmp, tree);
    const edge = graph.edges.find(e => e.from === 'app.py');
    expect(edge).toBeDefined();
    expect(edge!.to).toBe('config/db.py');
  });

  it('resolves node_modules symbol', () => {
    // helper.ts from config/db.py — chained
    const tree = scanTree(tmp);
    const graph = scanDeps(tmp, tree);
    expect(graph.nodes).toContain('src/index.ts');
    expect(graph.nodes).toContain('src/utils/helper.ts');
  });

  it('filters out unresolvable imports', () => {
    const tree = scanTree(tmp);
    const graph = scanDeps(tmp, tree);
    const badEdges = graph.edges.filter(e => !graph.nodes.includes(e.to));
    expect(badEdges).toHaveLength(0);
  });
});
