import fs from 'node:fs';
import path from 'node:path';
import { FileEntry, DepGraph, DepEdge, PatternInfo, RouteInfo, Snapshot } from './types.js';
import { readFileSafe, isSourceFile, isTestFile, isConfigFile, parseGitignore, isoNow } from './util.js';

interface ScanOptions {
  ignore?: string[];
  concurrency?: number;
}

interface IgnoreMatcher {
  exact: Set<string>;
  prefix: Set<string>;
  suffix: Set<string>;
}

function buildIgnoreMatcher(patterns: string[]): IgnoreMatcher {
  const m: IgnoreMatcher = { exact: new Set(), prefix: new Set(), suffix: new Set() };
  for (const p of patterns) {
    const s = p.replace(/\/$/, '');
    if (s.startsWith('*')) m.suffix.add(s.slice(1));
    else if (s.endsWith('*')) m.prefix.add(s.slice(0, -1));
    else m.exact.add(s);
  }
  return m;
}

function isIgnored(rel: string, matcher: IgnoreMatcher): boolean {
  if (matcher.exact.has(rel) || matcher.exact.has(rel + '/')) return true;
  for (const p of matcher.prefix) if (rel.startsWith(p)) return true;
  for (const s of matcher.suffix) if (rel.endsWith(s)) return true;
  for (const p of matcher.prefix) if (rel.startsWith(p + '/')) return true;
  return false;
}

// ── Directory tree scanner (BFS) ──

export function scanTree(root: string, ignore?: string[]): FileEntry[] {
  const gitignore = parseGitignore(root);
  const matcher = buildIgnoreMatcher([...gitignore, ...(ignore || [])]);
  const entries: FileEntry[] = [];

  const queue: string[] = [''];
  while (queue.length > 0) {
    const rel = queue.shift()!;
    const abs = root + (rel ? '/' + rel : '');

    let children: fs.Dirent[];
    try {
      children = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const child of children) {
      const childRel = rel ? rel + '/' + child.name : child.name;
      if (isIgnored(childRel, matcher)) continue;

      if (child.isDirectory()) {
        queue.push(childRel);
      }
      entries.push({
        path: childRel,
        type: child.isDirectory() ? 'dir' : 'file',
        size: child.isFile() ? (fs.statSync(abs + '/' + child.name).size) : 0,
      });
    }
  }

  entries.sort((a, b) => a.path.localeCompare(b.path));
  return entries;
}

// ── Import scanner ──

const TS_IMPORT_RE: RegExp[] = [
  /import\s+(?:\{[^}]*\}\s*|\*\s*as\s+\w+\s*|\w+\s*,?\s*(?:\{[^}]*\})?\s*)from\s+['"]([^'"]+)['"]/g,
  /import\s+['"]([^'"]+)['"]/g,
  /const\s+\w+\s*[=:]\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

const PY_IMPORT_RE: RegExp[] = [
  /^\s*import\s+(\w[\w.]*)/gm,
  /^\s*from\s+(\w[\w.]*)\s+import/gm,
];

const C_IMPORT_RE: RegExp[] = [
  /#include\s+["<]([^">]+)[">]/g,
];

function scanImports(content: string, file: string): DepEdge[] {
  const edges: DepEdge[] = [];
  const ext = file.split('.').pop()?.toLowerCase() || '';
  const isC = /^(c|cpp|cc|cxx|h|hpp|hh)$/.test(ext);
  const reList = isC ? C_IMPORT_RE : file.endsWith('.py') ? PY_IMPORT_RE : TS_IMPORT_RE;

  for (const re of reList) {
    const clone = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m: RegExpExecArray | null;
    while ((m = clone.exec(content)) !== null) {
      const target = m[1];
      if (!target) continue;
      const isDynamic = re.source.includes('import\\s*\\(');
      edges.push({ from: file, to: target, kind: isDynamic ? 'dynamic' : 'static' });
    }
  }

  return edges;
}

function resolveImport(fromFile: string, target: string, root: string): string | null {
  if (target.startsWith('.')) {
    const base = path.dirname(fromFile);
    const resolved = path.resolve(root, base, target);
    const candidates = [
      resolved,
      resolved + '.ts',
      resolved + '.tsx',
      resolved + '.js',
      resolved + '.jsx',
      resolved + '/index.ts',
      resolved + '/index.js',
      resolved + '/index.tsx',
      resolved + '.py',
      resolved + '/__init__.py',
    ];
    if (resolved.endsWith('.js')) {
      const stem = resolved.slice(0, -3);
      candidates.push(stem + '.ts', stem + '.tsx');
    }
    if (resolved.endsWith('.ts')) {
      const stem = resolved.slice(0, -3);
      candidates.push(stem + '.js', stem + '.jsx');
    }
    for (const c of candidates) {
      const rel = path.relative(root, c);
      if (fs.existsSync(c)) return rel;
    }
    return null;
  }

  if (target.includes('.') && !target.startsWith('.')) {
    const asPath = target.replace(/\./g, '/');
    const fromDir = path.resolve(root, path.dirname(fromFile));
    let dir = fromDir;
    while (dir.startsWith(root)) {
      for (const suffix of ['.py', '/__init__.py']) {
        const c = path.join(dir, asPath + suffix);
        if (fs.existsSync(c)) {
          return path.relative(root, c);
        }
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }

  return null;
}

export function scanDeps(root: string, files: FileEntry[]): DepGraph {
  const nodes = new Set<string>();
  const rawEdges: DepEdge[] = [];

  const sourceFiles = files.filter(f => f.type === 'file' && isSourceFile(f.path));

  for (const f of sourceFiles) {
    nodes.add(f.path);
    const content = readFileSafe(root + '/' + f.path);
    if (!content) continue;

    const edges = scanImports(content, f.path);
    for (const e of edges) {
      const resolved = resolveImport(f.path, e.to, root);
      if (resolved) {
        nodes.add(resolved);
        rawEdges.push({ from: e.from, to: resolved, kind: e.kind });
      }
    }
  }

  const edges = rawEdges.filter(e => nodes.has(e.from) && nodes.has(e.to));

  return {
    nodes: [...nodes].sort(),
    edges,
  };
}

// ── Pattern detector ──

const FRAMEWORK_PATTERNS: [RegExp, string][] = [
  [/from\s+['"]fastify['"]/, 'Fastify'],
  [/from\s+['"]express['"]/, 'Express'],
  [/from\s+['"]next['"]/, 'Next.js'],
  [/from\s+['"](?:@nestjs|nest\.js)['"]/, 'NestJS'],
  [/from\s+['"]flask['"]/, 'Flask'],
  [/from\s+['"]fastapi['"]/, 'FastAPI'],
  [/from\s+['"]django['"]/, 'Django'],
  [/from\s+['"]react['"]/, 'React'],
  [/from\s+['"]vue['"]/, 'Vue'],
  [/^(?:from\s+flask\s+import|import\s+flask)\b/m, 'Flask'],
  [/^(?:from\s+fastapi\s+import|import\s+fastapi)\b/m, 'FastAPI'],
  [/^(?:from\s+django\s+import|import\s+django)\b/m, 'Django'],
];

const ROUTE_PATTERNS: [RegExp, string][] = [
  [/fastify\.(get|post|put|delete|patch)\s*\(/g, 'Fastify'],
  [/app\.(get|post|put|delete|patch)\s*\(/g, 'Fastify'],
  [/router\.(get|post|put|delete|patch)\s*\(/g, 'Express'],
  [/@(?:app|router|api)\.(?:get|post|put|delete|patch)\(/g, 'FastAPI'],
  [/@app\.route\(/g, 'Flask'],
];

function detectFramework(sourceFiles: FileEntry[], root: string): string | null {
  const counts = new Map<string, number>();
  for (const f of sourceFiles.slice(0, 30)) {
    const content = readFileSafe(root + '/' + f.path);
    if (!content) continue;
    for (const [re, name] of FRAMEWORK_PATTERNS) {
      if (re.test(content)) {
        counts.set(name, (counts.get(name) || 0) + 1);
      }
    }
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [name, count] of counts) {
    if (count > bestCount) { best = name; bestCount = count; }
  }
  return best;
}

function detectRoutes(sourceFiles: FileEntry[], root: string): RouteInfo[] {
  const routes: RouteInfo[] = [];
  for (const f of sourceFiles) {
    const content = readFileSafe(root + '/' + f.path);
    if (!content) continue;
    for (const [re, _] of ROUTE_PATTERNS) {
      const clone = new RegExp(re.source, 'g');
      let m: RegExpExecArray | null;
      while ((m = clone.exec(content)) !== null) {
        let method = m[1] || 'GET';
        method = method.toUpperCase();
        const line = content.slice(0, m.index).split('\n').length;
        routes.push({ method, path: extractRoutePath(content, m.index), file: f.path + ':' + line });
      }
    }
  }
  return routes;
}

function extractRoutePath(content: string, idx: number): string {
  const after = content.slice(idx);
  const m = after.match(/['"]([^'"]+)['"]/);
  return m ? m[1] : '?';
}

function findEntryPoints(files: FileEntry[], root: string): string[] {
  const candidates = ['src/app.ts', 'src/main.ts', 'src/index.ts', 'app.ts', 'main.ts', 'index.ts', 'server.ts', 'app.py', 'main.py', 'main.cpp', 'main.c', 'manage.py', 'wsgi.py', 'asgi.py', 'run.py'];
  const found: string[] = [];
  for (const c of candidates) {
    if (files.some(f => f.path === c)) found.push(c);
  }

  const pkg = readFileSafe(root + '/package.json');
  if (pkg) {
    try {
      const json = JSON.parse(pkg);
      if (json.main) {
        const norm = json.main.replace(/^\.\//, '');
        if (files.some(f => f.path === norm)) found.push(norm);
      }
      if (json.bin) {
        const binEntries = typeof json.bin === 'string' ? [json.bin] : Object.values(json.bin);
        for (const v of binEntries) {
          if (typeof v === 'string') {
            const norm = v.replace(/^\.\//, '');
            if (files.some(f => f.path === norm)) found.push(norm);
          }
        }
      }
    } catch {}
  }

  const epPatterns: [RegExp, string][] = [
    [/uvicorn\.run\(/, '__main__ via uvicorn'],
    [/if\s+__name__\s*==\s*['"]__main__['"]\s*:/, '__main__'],
  ];
  for (const f of files) {
    if (f.type !== 'file' || !isSourceFile(f.path)) continue;
    const content = readFileSafe(root + '/' + f.path);
    if (!content) continue;
    for (const [re, _] of epPatterns) {
      if (re.test(content)) {
        if (!found.includes(f.path)) found.push(f.path);
        break;
      }
    }
  }

  return [...new Set(found)];
}

function findTestDirs(files: FileEntry[]): string[] {
  const dirs = new Set<string>();
  for (const f of files) {
    if (f.path.includes('/__tests__/') || f.path.includes('/test/') || f.path.includes('/tests/')) {
      const parts = f.path.split('/');
      for (let i = 0; i < parts.length; i++) {
        if (parts[i] === '__tests__' || parts[i] === 'test' || parts[i] === 'tests') {
          dirs.add(parts.slice(0, i + 1).join('/'));
        }
      }
    }
  }
  return [...dirs].sort();
}

// ── Main scan orchestrator ──

export function scan(root: string, options?: ScanOptions): Snapshot {
  const ignore = options?.ignore || [];
  const tree = scanTree(root, ignore);
  const deps = scanDeps(root, tree);

  const sourceFiles = tree.filter(f => f.type === 'file' && isSourceFile(f.path));
  const framework = detectFramework(sourceFiles, root);
  const routes = detectRoutes(sourceFiles, root);
  const entryPoints = findEntryPoints(tree, root);

  const testFiles = tree.filter(f => isTestFile(f.path));
  const testDirs = findTestDirs(tree);
  const configFiles = tree.filter(f => isConfigFile(f.path)).map(f => f.path);

  return {
    timestamp: isoNow(),
    tree,
    deps,
    patterns: {
      entryPoints,
      framework,
      routes,
      testDirs,
      configFiles,
    },
  };
}
