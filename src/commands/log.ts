import { hasCtx, appendDecision } from '../store.js';

export async function doLog(root: string, msg: string): Promise<string> {
  if (!hasCtx(root)) return 'not initialized. Run `ctx init` first.';
  if (!msg) return 'usage: ctx log <decision message>';

  let files: string[] = [];
  try {
    const { execSync } = await import('node:child_process');
    const gitRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8', stdio: 'pipe' }).toString().trim();
    const out = execSync('git diff --name-only', { encoding: 'utf-8', stdio: 'pipe' });
    const relRoot = root.replace(gitRoot + '/', '');
    files = out.toString().split('\n').filter(Boolean).filter(f => f.startsWith(relRoot));
  } catch {}

  appendDecision(root, msg, files);
  return `✓ decision logged: ${msg}`;
}
