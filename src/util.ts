import fs from 'node:fs';
import path from 'node:path';

export const CTX_DIR = '.ctx';
export const CONFIG_FILE = 'config.json';
export const DECISIONS_FILE = 'decisions.md';
export const SNAPSHOT_FILE = 'snapshot.json';

export function ctxDir(root?: string): string {
  return path.join(root || process.cwd(), CTX_DIR);
}

export function configPath(root?: string): string {
  return path.join(ctxDir(root), CONFIG_FILE);
}

export function decisionsPath(root?: string): string {
  return path.join(ctxDir(root), DECISIONS_FILE);
}

export function snapshotPath(root?: string): string {
  return path.join(ctxDir(root), SNAPSHOT_FILE);
}

export function isDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

export function isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

export function readFileSafe(p: string): string | null {
  try {
    return fs.readFileSync(p, 'utf-8');
  } catch {
    return null;
  }
}

export function writeFileSafe(p: string, content: string): boolean {
  try {
    fs.writeFileSync(p, content, 'utf-8');
    return true;
  } catch {
    return false;
  }
}

export function mkdirSafe(p: string): boolean {
  try {
    fs.mkdirSync(p, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

export function isoNow(): string {
  return new Date().toISOString();
}

export function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
}

export function isSourceFile(name: string): boolean {
  return /\.(ts|js|mjs|cjs|tsx|jsx|py|rs|go|java|cpp|c|cc|hpp|h|hh)$/i.test(name);
}

export function isTestFile(name: string): boolean {
  return /\.(test|spec|e2e)\.(ts|js|tsx|jsx)$/i.test(name) ||
         /\/__tests__\//.test(name) ||
         name.includes('test_') ||
         name.includes('_test.');
}

export function isConfigFile(name: string): boolean {
  return /^(package\.json|tsconfig\.json|\.env|docker-compose\.|Makefile|Cargo\.toml|pyproject\.toml|setup\.cfg|go\.mod)$/i.test(name) ||
         /\.(json|yaml|yml|toml|ini|cfg|conf)$/i.test(name);
}

export function parseGitignore(root: string): string[] {
  const content = readFileSafe(path.join(root, '.gitignore'));
  if (!content) return [];
  return content
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));
}
