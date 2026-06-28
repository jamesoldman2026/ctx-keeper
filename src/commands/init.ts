import { hasCtx, saveConfig, defaultConfig } from '../store.js';
import { mkdirSafe, ctxDir, writeFileSafe, decisionsPath } from '../util.js';

export function init(root: string, name?: string): string {
  if (hasCtx(root)) return 'ctx already initialized in this directory';
  const dir = ctxDir(root);
  mkdirSafe(dir);

  const cfg = defaultConfig(root, name);
  saveConfig(root, cfg);

  writeFileSafe(decisionsPath(root), [
    '# Decisions',
    '',
    `ts: ${new Date().toISOString()}`,
    `msg: Project initialized`,
    `files: `,
    '---',
    ''
  ].join('\n'));

  const lines: string[] = [
    `✓ initialized .ctx/ for "${cfg.projectName}"`,
    `  type: ${cfg.projectType}`,
    `  ignore: ${cfg.ignore.join(', ')}`,
    '',
    'Next: run `ctx scan` to capture project structure',
  ];
  return lines.join('\n');
}
