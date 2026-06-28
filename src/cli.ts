import path from 'node:path';
import fs from 'node:fs';
import { init } from './commands/init.js';
import { doScan } from './commands/scan.js';
import { doLog } from './commands/log.js';
import { showStatus } from './commands/status.js';
import { doGenerate } from './commands/generate.js';
import { doSync } from './commands/sync.js';

function help(): string {
  return [
    'ctx — Project context keeper',
    '',
    'Usage: ctx <command> [args] [--dir <path>]',
    '',
    'Options:',
    '  --dir <path>   Target project directory (default: current dir)',
    '',
    'Commands:',
    '  init [name]    Initialize .ctx/',
    '  scan           Scan project structure and dependencies',
    '  log <message>  Log a decision (includes changed files)',
    '  status         Show project context status',
  '  generate       Generate .context.md',
  '  sync           Inject context into AGENTS.md (opencode)',
  '  help           Show this help',
  ].join('\n');
}

function parseArgs(argv: string[]): { cmd: string; args: string[]; dir: string } {
  const dirIdx = argv.indexOf('--dir');
  let dir = process.cwd();
  const filtered: string[] = [];
  if (dirIdx !== -1 && dirIdx + 1 < argv.length) {
    dir = path.resolve(argv[dirIdx + 1]);
  }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dir') { i++; continue; }
    filtered.push(argv[i]);
  }
  return { cmd: filtered[0] || 'help', args: filtered.slice(1), dir };
}

async function main(): Promise<void> {
  const { cmd, args, dir } = parseArgs(process.argv.slice(2));

  if (cmd !== 'help' && !fs.existsSync(dir)) {
    console.error(`error: directory not found — ${dir}`);
    process.exit(1);
  }
  if (cmd !== 'help' && !fs.statSync(dir).isDirectory()) {
    console.error(`error: not a directory — ${dir}`);
    process.exit(1);
  }

  switch (cmd) {
    case 'init': {
      const name = args[0];
      console.log(init(dir, name));
      break;
    }
    case 'scan': {
      console.log(doScan(dir));
      break;
    }
    case 'log': {
      const msg = args.join(' ');
      const result = await doLog(dir, msg);
      console.log(result);
      break;
    }
    case 'status': {
      const result = await showStatus(dir);
      console.log(result);
      break;
    }
    case 'generate': {
      console.log(doGenerate(dir));
      break;
    }
    case 'sync': {
      console.log(doSync(dir));
      break;
    }
    default:
      console.log(help());
      break;
  }
}

main().catch(err => {
  console.error('Error:', err instanceof Error ? err.stack || err.message : String(err));
  process.exit(1);
});
