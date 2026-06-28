import { hasCtx, loadConfig, loadSnapshot, loadDecisions } from '../store.js';
import { generate } from '../generator.js';
import { readFileSafe, writeFileSafe } from '../util.js';
import path from 'node:path';

const CTX_BEGIN = '<!-- ctx -->';
const CTX_END = '<!-- /ctx -->';

export function doSync(root: string): string {
  if (!hasCtx(root)) return 'not initialized. Run `ctx init` first.';
  const cfg = loadConfig(root);
  const snap = loadSnapshot(root);
  if (!snap) return 'no snapshot found. Run `ctx scan` first.';

  const decisions = loadDecisions(root);
  const md = generate(cfg, snap, decisions, { title: cfg?.projectName });

  const agentsPath = path.join(root, 'AGENTS.md');
  const existing = readFileSafe(agentsPath) || '';

  const preamble = existing
    ? ''
    : '# AGENTS.md\n\nThis file is auto-maintained by ctx-keeper.\nAdd your own instructions above or below the `ctx` block.\n\n';

  const ctxBlock = `${CTX_BEGIN}\n${md}\n${CTX_END}`;

  const startIdx = existing.indexOf(CTX_BEGIN);
  const endIdx = existing.indexOf(CTX_END);

  let updated: string;
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    updated = existing.slice(0, startIdx) + ctxBlock + existing.slice(endIdx + CTX_END.length);
  } else {
    const sep = existing.endsWith('\n') || existing.length === 0 ? '' : '\n';
    updated = preamble + existing + `${sep}\n${ctxBlock}\n`;
  }

  writeFileSafe(agentsPath, updated);
  return `✓ synced context to AGENTS.md (${md.split('\n').length} lines)`;
}
