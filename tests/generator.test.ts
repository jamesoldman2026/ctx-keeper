import { describe, it, expect } from 'vitest';
import { generate } from '../src/generator.js';
import { CtxConfig, Snapshot, Decision } from '../src/types.js';

const cfg: CtxConfig = {
  projectName: 'test-project',
  projectType: 'node',
  entryPoints: ['src/index.ts'],
  ignore: ['node_modules'],
  framework: 'Express',
};

const snap: Snapshot = {
  timestamp: '2026-06-01T00:00:00.000Z',
  tree: [
    { path: 'src/index.ts', type: 'file', size: 50 },
    { path: 'src/utils/helper.ts', type: 'file', size: 100 },
    { path: 'src', type: 'dir', size: 0 },
  ],
  deps: {
    nodes: ['src/index.ts', 'src/utils/helper.ts'],
    edges: [{ from: 'src/index.ts', to: 'src/utils/helper.ts', kind: 'static' }],
  },
  patterns: {
    entryPoints: ['src/index.ts'],
    framework: 'Express',
    routes: [{ method: 'GET', path: '/api/health', file: 'src/index.ts:10' }],
    testDirs: ['tests'],
    configFiles: ['package.json'],
  },
};

const decisions: Decision[] = [
  { timestamp: '2026-06-01T00:00:00.000Z', message: 'Initial setup', files: [] },
];

describe('generate', () => {
  it('includes project title', () => {
    const md = generate(cfg, snap, decisions);
    expect(md).toContain('# test-project — Context');
  });

  it('includes framework info', () => {
    const md = generate(cfg, snap, decisions);
    expect(md).toContain('Express');
    expect(md).toContain('node');
  });

  it('includes entry points', () => {
    const md = generate(cfg, snap, decisions);
    expect(md).toContain('src/index.ts');
  });

  it('includes routes', () => {
    const md = generate(cfg, snap, decisions);
    expect(md).toContain('GET');
    expect(md).toContain('/api/health');
  });

  it('includes dependency map', () => {
    const md = generate(cfg, snap, decisions);
    expect(md).toContain('Dependency Map');
    expect(md).toContain('helper.ts (←1 →0)');
  });

  it('includes directory tree', () => {
    const md = generate(cfg, snap, decisions);
    expect(md).toContain('Directory Structure');
    expect(md).toContain('src/index.ts');
  });

  it('includes decisions', () => {
    const md = generate(cfg, snap, decisions);
    expect(md).toContain('Key Decisions');
    expect(md).toContain('Initial setup');
  });

  it('includes last scan timestamp', () => {
    const md = generate(cfg, snap, decisions);
    expect(md).toContain('Last scan');
  });

  it('handles null config', () => {
    const md = generate(null, snap, []);
    expect(md).toContain('Project — Context');
  });

  it('handles null snapshot', () => {
    const md = generate(cfg, null, []);
    expect(md).not.toContain('Dependency Map');
    expect(md).not.toContain('Directory Structure');
  });

  it('handles empty decisions', () => {
    const md = generate(cfg, snap, []);
    expect(md).not.toContain('Key Decisions');
  });

  it('can exclude routes', () => {
    const md = generate(cfg, snap, decisions, { includeRoutes: false });
    expect(md).not.toContain('/api/health');
  });

  it('can exclude deps', () => {
    const md = generate(cfg, snap, decisions, { includeDeps: false });
    expect(md).not.toContain('Dependency Map');
  });

  it('can exclude tree', () => {
    const md = generate(cfg, snap, decisions, { includeTree: false });
    expect(md).not.toContain('Directory Structure');
  });

  it('handles multiple decisions in reverse order', () => {
    const d: Decision[] = [
      { timestamp: '2026-01-01T00:00:00.000Z', message: 'First', files: [] },
      { timestamp: '2026-06-01T00:00:00.000Z', message: 'Second', files: [] },
    ];
    const md = generate(cfg, snap, d);
    const firstIdx = md.indexOf('First');
    const secondIdx = md.indexOf('Second');
    expect(firstIdx).toBeGreaterThan(secondIdx);
  });
});
