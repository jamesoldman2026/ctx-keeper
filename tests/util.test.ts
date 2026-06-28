import { describe, it, expect } from 'vitest';
import { isSourceFile, isTestFile, isConfigFile } from '../src/util.js';

describe('isSourceFile', () => {
  const pass = [
    'foo.ts', 'foo.js', 'foo.tsx', 'foo.jsx',
    'foo.mjs', 'foo.cjs',
    'foo.py',
    'foo.rs',
    'foo.go',
    'foo.java',
    'foo.cpp', 'foo.c', 'foo.cc',
    'foo.hpp', 'foo.h', 'foo.hh',
    'path/to/bar.ts',
    'UPPERCASE.TS',
    'foo.CPP',
  ];
  for (const f of pass) {
    it(`"${f}" → true`, () => expect(isSourceFile(f)).toBe(true));
  }

  const fail = [
    'foo.json', 'foo.md', 'foo.txt', 'foo.yaml',
    'foo', '.env', 'Makefile', 'Dockerfile',
    'path/to/foo.json',
    'foo.css', 'foo.html',
  ];
  for (const f of fail) {
    it(`"${f}" → false`, () => expect(isSourceFile(f)).toBe(false));
  }
});

describe('isTestFile', () => {
  const pass = [
    'foo.test.ts', 'foo.spec.js', 'foo.e2e.tsx',
    'path/to/__tests__/foo.ts',
    'test_foo.py',
    'foo_test.py',
  ];
  for (const f of pass) {
    it(`"${f}" → true`, () => expect(isTestFile(f)).toBe(true));
  }
});

describe('isConfigFile', () => {
  const pass = [
    'package.json', 'tsconfig.json', '.env',
    'docker-compose.yml', 'Makefile', 'Cargo.toml',
    'pyproject.toml', 'setup.cfg', 'go.mod',
    '.prettierrc.json',
    'path/to/config.yaml',
    '.github/workflows/ci.yml',
  ];
  for (const f of pass) {
    it(`"${f}" → true`, () => expect(isConfigFile(f)).toBe(true));
  }
});
