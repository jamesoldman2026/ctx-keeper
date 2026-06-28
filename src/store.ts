import { CtxConfig, Snapshot, Decision, StatusReport } from './types.js';
import {
  ctxDir, configPath, decisionsPath, snapshotPath,
  isDir, isFile, readFileSafe, writeFileSafe, mkdirSafe, isoNow,
} from './util.js';

export function hasCtx(root: string): boolean {
  return isDir(ctxDir(root));
}

export function loadConfig(root: string): CtxConfig | null {
  const raw = readFileSafe(configPath(root));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CtxConfig;
  } catch (e) {
    console.error(`warning: corrupt config at ${configPath(root)} — ${(e as Error).message}`);
    return null;
  }
}

export function saveConfig(root: string, cfg: CtxConfig): boolean {
  const dir = ctxDir(root);
  if (!mkdirSafe(dir)) return false;
  return writeFileSafe(configPath(root), JSON.stringify(cfg, null, 2));
}

export function defaultConfig(root: string, name?: string): CtxConfig {
  return {
    projectName: name || guessProjectName(root),
    projectType: guessProjectType(root),
    entryPoints: [],
    ignore: ['node_modules', '.git', 'dist', 'build', '.ctx', '.next', 'target', '__pycache__', '.venv'],
    framework: null,
  };
}

function guessProjectName(root: string): string {
  const pkg = readFileSafe(root + '/package.json');
  if (pkg) {
    try {
      const json = JSON.parse(pkg);
      if (json.name) return json.name;
    } catch {}
  }
  const pyproject = readFileSafe(root + '/pyproject.toml');
  if (pyproject) {
    const m = pyproject.match(/name\s*=\s*"([^"]+)"/);
    if (m) return m[1];
  }
  return root.split('/').pop() || 'unknown';
}

function guessProjectType(root: string): 'node' | 'python' | 'unknown' {
  if (isFile(root + '/package.json')) return 'node';
  if (isFile(root + '/pyproject.toml') || isFile(root + '/requirements.txt') || isFile(root + '/setup.py')) return 'python';
  return 'unknown';
}

export function loadSnapshot(root: string): Snapshot | null {
  const raw = readFileSafe(snapshotPath(root));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Snapshot;
  } catch (e) {
    console.error(`warning: corrupt snapshot at ${snapshotPath(root)} — ${(e as Error).message}`);
    return null;
  }
}

export function saveSnapshot(root: string, snap: Snapshot): boolean {
  const dir = ctxDir(root);
  if (!mkdirSafe(dir)) return false;
  return writeFileSafe(snapshotPath(root), JSON.stringify(snap, null, 2));
}

export function loadDecisions(root: string): Decision[] {
  const raw = readFileSafe(decisionsPath(root));
  if (!raw) return [];
  return raw.trim().split('\n---\n').filter(Boolean).map(block => {
    const lines = block.trim().split('\n');
    const decision: Decision = { timestamp: '', message: '', files: [] };
    for (const line of lines) {
      if (line.startsWith('ts: ')) decision.timestamp = line.slice(4);
      else if (line.startsWith('msg: ')) decision.message = line.slice(5);
      else if (line.startsWith('files: ')) decision.files = line.slice(7).split(',').map(s => s.trim()).filter(Boolean);
    }
    return decision;
  });
}

export function appendDecision(root: string, msg: string, files: string[]): boolean {
  const dir = ctxDir(root);
  if (!mkdirSafe(dir)) return false;
  const entry = [
    `ts: ${isoNow()}`,
    `msg: ${msg}`,
    `files: ${files.join(', ')}`,
  ].join('\n') + '\n---\n';
  const existing = readFileSafe(decisionsPath(root)) || '';
  return writeFileSafe(decisionsPath(root), existing + entry);
}

export async function buildStatus(root: string): Promise<StatusReport> {
  const cfg = loadConfig(root);
  const snap = loadSnapshot(root);
  const decisions = loadDecisions(root);

  let uncommittedFiles: string[] = [];
  try {
    const { execSync } = await import('node:child_process');
    const out = execSync('git status --porcelain', { cwd: root, encoding: 'utf-8', stdio: 'pipe' });
    uncommittedFiles = out.split('\n').filter(Boolean).map(l => l.slice(3).trim());
  } catch {}

  return {
    snapshot: snap,
    uncommittedFiles,
    pendingChanges: snap ? uncommittedFiles.length : 0,
    decisionCount: decisions.length,
    lastScan: snap?.timestamp ?? null,
    projectName: cfg?.projectName ?? null,
    framework: cfg?.framework ?? null,
  } as StatusReport & { projectName: string | null; framework: string | null };
}
