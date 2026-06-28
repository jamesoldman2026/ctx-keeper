import { Snapshot, Decision, CtxConfig } from './types.js';
import { fmtTime } from './util.js';

interface GenOptions {
  title?: string;
  includeDeps?: boolean;
  includeRoutes?: boolean;
  includeTree?: boolean;
  maxTreeDepth?: number;
}

export function generate(
  config: CtxConfig | null,
  snapshot: Snapshot | null,
  decisions: Decision[],
  options?: GenOptions
): string {
  const opts = {
    title: config?.projectName || 'Project',
    includeDeps: options?.includeDeps ?? true,
    includeRoutes: options?.includeRoutes ?? true,
    includeTree: options?.includeTree ?? true,
    maxTreeDepth: options?.maxTreeDepth ?? 4,
  };

  const lines: string[] = [];
  const hr = () => lines.push('');

  lines.push(`# ${opts.title} — Context`);
  hr();

  // ── Project Info ──
  lines.push('## Project Info');
  if (config) {
    lines.push(`- **Framework**: ${config.framework || 'unknown'}`);
    lines.push(`- **Type**: ${config.projectType}`);
    const eps = config.entryPoints.length > 0 ? config.entryPoints : snapshot?.patterns.entryPoints || [];
    if (eps.length > 0) {
      lines.push(`- **Entry points**: ${eps.join(', ')}`);
    }
  }
  hr();

  // ── Architecture ──
  if (snapshot) {
    lines.push('## Architecture');

    if (opts.includeRoutes && snapshot.patterns.routes.length > 0) {
      lines.push('');
      lines.push('### Routes');
      // Group by file
      const byFile = new Map<string, { method: string; path: string }[]>();
      for (const r of snapshot.patterns.routes) {
        const file = r.file.split(':')[0];
        if (!byFile.has(file)) byFile.set(file, []);
        byFile.get(file)!.push({ method: r.method, path: r.path });
      }
      for (const [file, routes] of byFile) {
        lines.push(`**${file}**`);
        for (const r of routes) {
          lines.push(`  \`${r.method} ${r.path}\``);
        }
      }
      hr();
    }

    if (opts.includeDeps && snapshot.deps.nodes.length > 0) {
      lines.push('');
      lines.push('### Dependency Map');
      const byDir = groupByDir(snapshot.deps.nodes);
      for (const [dir, files] of byDir) {
        lines.push(`**${dir || '.'}** (${files.length} files)`);
        for (const f of files.slice(0, 10)) {
          const incoming = snapshot.deps.edges.filter(e => e.to === (dir ? dir + '/' + f : f)).length;
          const outgoing = snapshot.deps.edges.filter(e => e.from === (dir ? dir + '/' + f : f)).length;
          const label = f + (incoming > 0 || outgoing > 0 ? ` (←${incoming} →${outgoing})` : '');
          lines.push(`  \`${label}\``);
        }
        if (files.length > 10) lines.push(`  _... and ${files.length - 10} more_`);
      }
      hr();
    }
  }

  // ── Directory Tree ──
  if (opts.includeTree && snapshot) {
    lines.push('## Directory Structure');
    lines.push('```');
    lines.push(buildTree(snapshot.tree, opts.maxTreeDepth));
    lines.push('```');
    hr();
  }

  // ── Key Decisions ──
  if (decisions.length > 0) {
    lines.push('## Key Decisions');
    for (const d of decisions.slice().reverse()) {
      lines.push(`- **${fmtTime(d.timestamp)}**: ${d.message}`);
    }
    hr();
  }

  // ── Last Scan ──
  if (snapshot) {
    lines.push(`> Last scan: ${fmtTime(snapshot.timestamp)}`);
  }

  lines.push('');
  return lines.join('\n');
}

function groupByDir(nodes: string[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const n of nodes) {
    const idx = n.lastIndexOf('/');
    const dir = idx === -1 ? '' : n.slice(0, idx);
    const file = idx === -1 ? n : n.slice(idx + 1);
    if (!map.has(dir)) map.set(dir, []);
    map.get(dir)!.push(file);
  }
  for (const [, files] of map) files.sort();
  const sorted = new Map([...map].sort((a, b) => a[0].localeCompare(b[0])));
  return sorted;
}

interface TreeNode {
  name: string;
  type: 'dir' | 'file';
  children: Map<string, TreeNode>;
}

function buildTree(entries: { path: string; type: string }[], maxDepth: number): string {
  const root = new Map<string, TreeNode>();

  for (const e of entries) {
    const parts = e.path.split('/');
    if (parts.length > maxDepth) continue;
    let level = root;
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isDir = i < parts.length - 1 || e.type === 'dir';
      if (!level.has(name)) {
        level.set(name, { name, type: isDir ? 'dir' : 'file', children: new Map() });
      }
      const node = level.get(name)!;
      if (!isDir) node.type = 'file';
      level = node.children;
    }
  }

  const lines: string[] = [];
  function walk(level: Map<string, TreeNode>, prefix: string, isRoot: boolean) {
    const sorted = [...level].sort((a, b) => {
      const aDir = a[1].type === 'dir' ? 0 : 1;
      const bDir = b[1].type === 'dir' ? 0 : 1;
      return aDir - bDir || a[0].localeCompare(b[0]);
    });
    for (const [name, node] of sorted) {
      const label = node.type === 'dir' ? `📁 ${name}/` : `📄 ${name}`;
      lines.push(prefix + label);
      if (node.children.size > 0) {
        walk(node.children, prefix + '  ', false);
      }
    }
  }
  walk(root, '', true);
  return lines.join('\n');
}


