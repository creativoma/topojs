import { describe, expect, it, vi } from 'vitest';
import { run } from '../src/index';

describe('cli', () => {
  it('returns 1 and shows usage when no command given', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(run(['node', 'topo'])).toBe(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
    log.mockRestore();
  });

  it('returns 1 for unknown command', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(run(['node', 'topo', 'unknown'])).toBe(1);
    expect(err).toHaveBeenCalledWith(expect.stringContaining('Unknown command'));
    err.mockRestore();
  });

  const commands = ['analyze', 'visualize', 'check', 'optimize', 'export'] as const;

  for (const cmd of commands) {
    it(`returns 0 for "${cmd}"`, () => {
      expect(run(['node', 'topo', cmd])).toBe(0);
    });
  }

  it('trace returns 0 and includes the target path', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(run(['node', 'topo', 'trace', 'user.cart'])).toBe(0);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('user.cart'));
    log.mockRestore();
  });

  it('trace without arg uses placeholder', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(run(['node', 'topo', 'trace'])).toBe(0);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('<path>'));
    log.mockRestore();
  });
});
