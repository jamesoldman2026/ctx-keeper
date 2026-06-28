import { loadConfig, saveConfig, saveSnapshot } from '../store.js';
import { hasCtx } from '../store.js';
import { scan } from '../scanner.js';

export function doScan(root: string): string {
  if (!hasCtx(root)) {
    return 'not initialized. Run `ctx init` first.';
  }
  const cfg = loadConfig(root);
  const snapshot = scan(root, { ignore: cfg?.ignore });
  saveSnapshot(root, snapshot);

  if (cfg && snapshot.patterns.framework) {
    cfg.framework = snapshot.patterns.framework;
    cfg.entryPoints = snapshot.patterns.entryPoints;
    saveConfig(root, cfg);
  }

  const files = snapshot.tree.filter(e => e.type === 'file').length;
  const dirs = snapshot.tree.filter(e => e.type === 'dir').length;
  return [
    `✓ scanned ${files} files, ${dirs} dirs, ${snapshot.deps.nodes.length} modules`,
    `  framework: ${snapshot.patterns.framework || 'unknown'}`,
    `  entry points: ${snapshot.patterns.entryPoints.join(', ') || 'none detected'}`,
    `  routes: ${snapshot.patterns.routes.length}`,
    `  test dirs: ${snapshot.patterns.testDirs.join(', ') || 'none'}`,
  ].join('\n');
}
