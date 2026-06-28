import { hasCtx, loadConfig, loadSnapshot, loadDecisions } from '../store.js';
import { fmtTime } from '../util.js';

export async function showStatus(root: string): Promise<string> {
  if (!hasCtx(root)) return 'not initialized. Run `ctx init` first.';

  const cfg = loadConfig(root);
  const snap = loadSnapshot(root);
  const decisions = loadDecisions(root);

  let uncommitted = 0;
  let branch = '?';
  try {
    const { execSync } = await import('node:child_process');
    branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: root, encoding: 'utf-8', stdio: 'pipe' }).toString().trim();
    const out = execSync('git status --porcelain', { cwd: root, encoding: 'utf-8', stdio: 'pipe' });
    uncommitted = out.toString().split('\n').filter(Boolean).length;
  } catch {}

  const snapFiles = snap ? snap.tree.filter(e => e.type === 'file').length : 0;
  const snapDirs = snap ? snap.tree.filter(e => e.type === 'dir').length : 0;
  const fw = cfg?.framework || snap?.patterns.framework;
  return [
    `Project: ${cfg?.projectName || '?'}`,
    `Branch : ${branch}`,
    `Type   : ${cfg?.projectType || '?'}`,
    `Framework: ${fw || 'unknown'}`,
    ``,
    `Last scan : ${snap ? fmtTime(snap.timestamp) : 'never'}`,
    `Files     : ${snapFiles}`,
    `Dirs      : ${snapDirs}`,
    `Modules   : ${snap?.deps.nodes.length ?? 0}`,
    `Edges     : ${snap?.deps.edges.length ?? 0}`,
    `Routes    : ${snap?.patterns.routes.length ?? 0}`,
    `Decisions : ${decisions.length}`,
    `Uncommitted: ${uncommitted}`,
  ].join('\n');
}
