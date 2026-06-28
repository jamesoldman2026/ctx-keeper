import { describe, it, expect } from 'vitest';
import { parseArgs } from '../src/cli.js';

describe('parseArgs', () => {
  it('extracts command from first arg', () => {
    const result = parseArgs(['scan', '--dir', '/tmp']);
    expect(result.cmd).toBe('scan');
  });

  it('defaults to help command', () => {
    const result = parseArgs([]);
    expect(result.cmd).toBe('help');
  });

  it('extracts --dir value', () => {
    const result = parseArgs(['scan', '--dir', '/some/path']);
    expect(result.dir).toBe('/some/path');
  });

  it('falls back to cwd when no --dir', () => {
    const result = parseArgs(['status']);
    expect(result.dir).toBe(process.cwd());
  });

  it('strips --dir flag from args', () => {
    const result = parseArgs(['log', 'my message', '--dir', '/tmp']);
    expect(result.args).toEqual(['my message']);
  });

  it('handles trailing --dir (no value)', () => {
    const result = parseArgs(['scan', '--dir']);
    expect(result.dir).toBe(process.cwd());
  });

  it('handles --dir as last arg with value', () => {
    const result = parseArgs(['scan', '--dir', '/path']);
    expect(result.dir).toBe('/path');
    expect(result.args).toEqual([]);
  });

  it('extracts args after command', () => {
    const result = parseArgs(['init', 'my-project', '--dir', '/tmp']);
    expect(result.cmd).toBe('init');
    expect(result.args).toEqual(['my-project']);
  });
});
