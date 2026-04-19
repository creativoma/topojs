import { describe, expect, it } from 'vitest';
import { run } from '../src/index';

describe('cli', () => {
  it('returns non-zero without command', () => {
    expect(run(['node', 'topo'])).toBe(1);
  });

  it('supports analyze', () => {
    expect(run(['node', 'topo', 'analyze'])).toBe(0);
  });
});
