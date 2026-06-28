import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
  hasCtx, loadConfig, saveConfig, defaultConfig,
  loadSnapshot, saveSnapshot, loadDecisions, appendDecision,
} from '../src/store.js';
import { Snapshot } from '../src/types.js';

let tmp: string;

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(tmpdir(), 'ctx-store-'));
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('hasCtx', () => {
  it('returns false without .ctx dir', () => {
    expect(hasCtx(tmp)).toBe(false);
  });

  it('returns true with .ctx dir', () => {
    fs.mkdirSync(path.join(tmp, '.ctx'));
    expect(hasCtx(tmp)).toBe(true);
  });
});

describe('defaultConfig', () => {
  it('returns node type when package.json exists', () => {
    fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"test"}');
    const cfg = defaultConfig(tmp);
    expect(cfg.projectType).toBe('node');
    expect(cfg.ignore).toContain('node_modules');
    expect(cfg.framework).toBeNull();
    expect(cfg.entryPoints).toEqual([]);
  });

  it('returns python type when requirements.txt exists', () => {
    const clean = fs.mkdtempSync(path.join(tmpdir(), 'ctx-py-'));
    fs.writeFileSync(path.join(clean, 'requirements.txt'), '');
    const cfg = defaultConfig(clean);
    expect(cfg.projectType).toBe('python');
    fs.rmSync(clean, { recursive: true });
  });

  it('returns unknown type for empty directory', () => {
    const clean = fs.mkdtempSync(path.join(tmpdir(), 'ctx-unk-'));
    const cfg = defaultConfig(clean);
    expect(cfg.projectType).toBe('unknown');
    fs.rmSync(clean, { recursive: true });
  });
});

describe('saveConfig / loadConfig', () => {
  it('roundtrips config', () => {
    const cfg = { projectName: 'test', projectType: 'node' as const, entryPoints: ['src/index.ts'], ignore: ['node_modules'], framework: 'Express' };
    const ok = saveConfig(tmp, cfg);
    expect(ok).toBe(true);
    const loaded = loadConfig(tmp);
    expect(loaded).toEqual(cfg);
  });

  it('returns null for missing config', () => {
    const clean = fs.mkdtempSync(path.join(tmpdir(), 'ctx-nocfg-'));
    expect(loadConfig(clean)).toBeNull();
    fs.rmSync(clean, { recursive: true });
  });
});

describe('saveSnapshot / loadSnapshot', () => {
  it('roundtrips snapshot', () => {
    const snap: Snapshot = {
      timestamp: '2026-01-01T00:00:00.000Z',
      tree: [{ path: 'src/index.ts', type: 'file', size: 100 }],
      deps: { nodes: ['src/index.ts'], edges: [] },
      patterns: { entryPoints: ['src/index.ts'], framework: 'Express', routes: [], testDirs: [], configFiles: ['package.json'] },
    };
    const ok = saveSnapshot(tmp, snap);
    expect(ok).toBe(true);
    const loaded = loadSnapshot(tmp);
    expect(loaded).toEqual(snap);
  });

  it('returns null for missing snapshot', () => {
    const clean = fs.mkdtempSync(path.join(tmpdir(), 'ctx-nosnap-'));
    expect(loadSnapshot(clean)).toBeNull();
    fs.rmSync(clean, { recursive: true });
  });
});

describe('loadDecisions / appendDecision', () => {
  it('loadDecisions returns empty for no file', () => {
    const clean = fs.mkdtempSync(path.join(tmpdir(), 'ctx-nodec-'));
    expect(loadDecisions(clean)).toEqual([]);
    fs.rmSync(clean, { recursive: true });
  });

  it('appendDecision adds entry', () => {
    const ok = appendDecision(tmp, 'test decision', ['file1.ts', 'file2.ts']);
    expect(ok).toBe(true);
    const decisions = loadDecisions(tmp);
    expect(decisions.length).toBeGreaterThanOrEqual(1);
    const last = decisions[decisions.length - 1];
    expect(last.message).toBe('test decision');
    expect(last.files).toContain('file1.ts');
    expect(last.files).toContain('file2.ts');
  });
});
