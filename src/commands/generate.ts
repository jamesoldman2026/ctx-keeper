import { hasCtx, loadConfig, loadSnapshot, loadDecisions } from '../store.js';
import { generate } from '../generator.js';
import { writeFileSafe } from '../util.js';
import path from 'node:path';

export function doGenerate(root: string): string {
  if (!hasCtx(root)) return 'not initialized. Run `ctx init` first.';
  const cfg = loadConfig(root);
  const snap = loadSnapshot(root);
  if (!snap) return 'no snapshot found. Run `ctx scan` first.';

  const decisions = loadDecisions(root);
  const md = generate(cfg, snap, decisions, { title: cfg?.projectName });

  const outPath = path.join(root, '.context.md');
  writeFileSafe(outPath, md);
  return `✓ generated .context.md (${md.split('\n').length} lines)`;
}
