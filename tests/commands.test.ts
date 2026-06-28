import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { init } from '../src/commands/init.js';
import { doScan } from '../src/commands/scan.js';
import { doGenerate } from '../src/commands/generate.js';
import { doSync } from '../src/commands/sync.js';
import { hasCtx, loadConfig, loadSnapshot } from '../src/store.js';
import { showStatus } from '../src/commands/status.js';

let tmp: string;

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(tmpdir(), 'ctx-cmd-'));
  fs.mkdirSync(path.join(tmp, 'src', 'utils'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'src', 'index.ts'), `import { greet } from './utils/helper';\n`, { encoding: 'utf-8' });
  fs.writeFileSync(path.join(tmp, 'src', 'utils', 'helper.ts'), `export const greet = () => 'hello';\n`, { encoding: 'utf-8' });
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('init', () => {
  it('creates .ctx directory and config', () => {
    const out = init(tmp, 'test-project');
    expect(out).toContain('initialized');
    expect(out).toContain('test-project');
    expect(hasCtx(tmp)).toBe(true);
    const cfg = loadConfig(tmp);
    expect(cfg).not.toBeNull();
    expect(cfg!.projectName).toBe('test-project');
  });

  it('returns already-initialized on second call', () => {
    const out = init(tmp);
    expect(out).toContain('already initialized');
  });

  it('creates decisions.md with header', () => {
    const d = fs.readFileSync(path.join(tmp, '.ctx', 'decisions.md'), 'utf-8');
    expect(d).toContain('# Decisions');
  });
});

describe('doScan', () => {
  it('scans project and saves snapshot', () => {
    const out = doScan(tmp);
    expect(out).toContain('scanned');
    const snap = loadSnapshot(tmp);
    expect(snap).not.toBeNull();
    expect(snap!.deps.nodes).toContain('src/index.ts');
    expect(snap!.deps.nodes).toContain('src/utils/helper.ts');
  });

  it('returns human-readable output', () => {
    const out = doScan(tmp);
    expect(out).toContain('files');
    expect(out).toContain('modules');
    expect(out).toContain('entry points');
  });

  it('config exists after scan', () => {
    const cfg = loadConfig(tmp);
    expect(cfg).not.toBeNull();
  });
});

describe('doGenerate', () => {
  it('creates .context.md', () => {
    const out = doGenerate(tmp);
    expect(out).toContain('generated');
    const p = path.join(tmp, '.context.md');
    expect(fs.existsSync(p)).toBe(true);
    const content = fs.readFileSync(p, 'utf-8');
    expect(content).toContain('test-project');
  });
});

describe('doSync — AGENTS.md injection', () => {
  it('injects context into AGENTS.md (first time)', () => {
    const out = doSync(tmp);
    expect(out).toContain('synced');
    const agentsPath = path.join(tmp, 'AGENTS.md');
    expect(fs.existsSync(agentsPath)).toBe(true);
    const content = fs.readFileSync(agentsPath, 'utf-8');
    expect(content).toContain('<!-- ctx -->');
    expect(content).toContain('<!-- /ctx -->');
    expect(content).toContain('test-project');
  });

  it('replaces existing ctx block on second sync', () => {
    const agentsPath = path.join(tmp, 'AGENTS.md');
    const before = fs.readFileSync(agentsPath, 'utf-8');
    const out = doSync(tmp);
    expect(out).toContain('synced');
    const after = fs.readFileSync(agentsPath, 'utf-8');
    // Should still contain ctx markers
    expect(after).toContain('<!-- ctx -->');
    expect(after).toContain('<!-- /ctx -->');
    // Should have only 1 ctx block
    const firstOpen = after.indexOf('<!-- ctx -->');
    const lastOpen = after.lastIndexOf('<!-- ctx -->');
    expect(firstOpen).toBe(lastOpen);
  });

  it('preserves content outside ctx block', () => {
    const agentsPath = path.join(tmp, 'AGENTS.md');
    fs.writeFileSync(agentsPath, '# User Instructions\n\nDo stuff.\n');
    doSync(tmp);
    const content = fs.readFileSync(agentsPath, 'utf-8');
    expect(content).toContain('# User Instructions');
    expect(content).toContain('Do stuff.');
    expect(content).toContain('<!-- ctx -->');
  });
});

describe('showStatus', () => {
  it('returns formatted status with project info', async () => {
    const out = await showStatus(tmp);
    expect(out).toContain('test-project');
    expect(out).toContain('Files');
    expect(out).toContain('Modules');
    expect(out).toContain('Edges');
    expect(out).toContain('Decisions');
  });
});

describe('not-initialized guard', () => {
  it('doScan returns not-initialized', () => {
    const clean = fs.mkdtempSync(path.join(tmpdir(), 'ctx-noinit-'));
    expect(doScan(clean)).toContain('not initialized');
    fs.rmSync(clean, { recursive: true });
  });

  it('doGenerate returns not-initialized', () => {
    const clean = fs.mkdtempSync(path.join(tmpdir(), 'ctx-noinit2-'));
    expect(doGenerate(clean)).toContain('not initialized');
    fs.rmSync(clean, { recursive: true });
  });

  it('doSync returns not-initialized', () => {
    const clean = fs.mkdtempSync(path.join(tmpdir(), 'ctx-noinit3-'));
    expect(doSync(clean)).toContain('not initialized');
    fs.rmSync(clean, { recursive: true });
  });
});

describe('generate without scan', () => {
  it('doGenerate returns no-snapshot', () => {
    const empty = fs.mkdtempSync(path.join(tmpdir(), 'ctx-noscan-'));
    init(empty, 'empty');
    expect(doGenerate(empty)).toContain('no snapshot');
    fs.rmSync(empty, { recursive: true });
  });

  it('doSync returns no-snapshot', () => {
    const empty = fs.mkdtempSync(path.join(tmpdir(), 'ctx-noscan2-'));
    init(empty, 'empty');
    expect(doSync(empty)).toContain('no snapshot');
    fs.rmSync(empty, { recursive: true });
  });
});
