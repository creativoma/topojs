import { resolve } from 'path';
import { describe, expect, it, vi } from 'vitest';
import {
  analyzeSpace,
  checkSpace,
  exportSpace,
  optimizeSpace,
  run,
  traceSpace,
  visualizeSpace,
} from '../src/index';
import type { RuntimeStatespace } from '@topojs/core';

vi.mock('http', () => {
  const mockServer = {
    listen: vi.fn((_port: number, cb: () => void) => {
      cb();
      return mockServer;
    }),
    on: vi.fn(() => mockServer),
  };
  return { createServer: vi.fn(() => mockServer) };
});

vi.mock('child_process', () => ({ exec: vi.fn() }));

// Minimal fixture statespace — matches the shape of RuntimeStatespace without importing core
function makeFixture(): RuntimeStatespace {
  const topology = {
    'cart.discount': {
      kind: 'derives' as const,
      dependencies: ['user.membership'],
      compute: (m: unknown) => (m === 'premium' ? 0.2 : 0),
    },
    'checkout.canProceed': {
      kind: 'requires' as const,
      conditions: ['cart.items.length > 0', 'user.authenticated'],
    },
  };

  const nodes = {
    user: { initial: { authenticated: false, membership: 'free' } },
    cart: { initial: { items: [], discount: 0 } },
    checkout: { initial: { canProceed: false } },
  };

  const affects = (path: string): string[] => {
    const result: string[] = [];
    for (const [key, edge] of Object.entries(topology)) {
      if (edge.kind === 'derives' && edge.dependencies.includes(path)) result.push(key);
      if (edge.kind === 'requires' && edge.conditions.some((c) => c.includes(path)))
        result.push(key);
    }
    return result;
  };

  const dependsOn = (path: string): string[] => {
    const edge = topology[path as keyof typeof topology];
    if (!edge) return [];
    if (edge.kind === 'derives') return [...edge.dependencies];
    if (edge.kind === 'requires')
      return edge.conditions.flatMap((c) => c.match(/[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)*/g) ?? []);
    return [];
  };

  const updateOrder = (path: string): string[] => {
    const visited = new Set<string>();
    const out: string[] = [];
    const walk = (p: string) => {
      if (visited.has(p)) return;
      visited.add(p);
      out.push(p);
      for (const next of affects(p)) walk(next);
    };
    walk(path);
    return out;
  };

  return {
    name: 'Cart',
    definition: { nodes, topology, constraints: { noCyclesThrough: ['checkout'] } },
    get: () => undefined as never,
    set: () => {},
    update: () => {},
    subscribe: () => () => {},
    subscribeEvent: () => () => {},
    getState: () => ({}),
    affects,
    dependsOn,
    updateOrder,
  };
}

const FIXTURE_PATH = resolve(__dirname, 'fixtures/store.mjs');

describe('analyzeSpace', () => {
  it('prints nodes and topology', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    analyzeSpace(makeFixture());
    const output = log.mock.calls.flat().join('\n');
    expect(output).toContain('Cart');
    expect(output).toContain('user');
    expect(output).toContain('cart');
    expect(output).toContain('checkout');
    expect(output).toContain('derives');
    expect(output).toContain('requires');
    log.mockRestore();
  });
});

describe('checkSpace', () => {
  it('returns 0 for a valid statespace', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(checkSpace(makeFixture())).toBe(0);
    log.mockRestore();
  });

  it('returns 1 for a statespace with unknown node references', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const space = makeFixture();
    (space.definition.topology as Record<string, unknown>)['ghost.field'] = {
      kind: 'derives',
      dependencies: ['nonexistent.node'],
      compute: () => 0,
    };
    expect(checkSpace(space)).toBe(1);
    log.mockRestore();
  });
});

describe('traceSpace', () => {
  it('shows dependencies and downstream for a derived node', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    traceSpace(makeFixture(), 'cart.discount');
    const output = log.mock.calls.flat().join('\n');
    expect(output).toContain('user.membership');
    log.mockRestore();
  });

  it('shows "root node" for a node with no dependencies', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    traceSpace(makeFixture(), 'user.membership');
    const output = log.mock.calls.flat().join('\n');
    expect(output).toContain('root node');
    log.mockRestore();
  });
});

describe('optimizeSpace', () => {
  it('prints suggestions or confirms no issues', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    optimizeSpace(makeFixture());
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});

describe('exportSpace', () => {
  it('outputs valid JSON by default', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    exportSpace(makeFixture());
    const raw = log.mock.calls.map((c) => c[0]).join('');
    expect(() => JSON.parse(raw)).not.toThrow();
    const parsed = JSON.parse(raw);
    expect(parsed.name).toBe('Cart');
    expect(parsed.nodes).toContain('user');
    log.mockRestore();
  });

  it('outputs mermaid graph', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    exportSpace(makeFixture(), 'mermaid');
    const output = log.mock.calls.flat().join('\n');
    expect(output).toContain('graph TD');
    log.mockRestore();
  });

  it('outputs dot graph', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    exportSpace(makeFixture(), 'dot');
    const output = log.mock.calls.flat().join('\n');
    expect(output).toContain('digraph');
    log.mockRestore();
  });
});

describe('run', () => {
  it('returns 1 and shows usage when no command given', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await run(['node', 'topo'])).toBe(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
    log.mockRestore();
  });

  it('returns 1 for unknown command', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await run(['node', 'topo', 'unknown', FIXTURE_PATH])).toBe(1);
    err.mockRestore();
  });

  it('returns 1 when file argument is missing', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await run(['node', 'topo', 'analyze'])).toBe(1);
    err.mockRestore();
  });

  it('analyze returns 0 with fixture file', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await run(['node', 'topo', 'analyze', FIXTURE_PATH])).toBe(0);
    log.mockRestore();
  });

  it('check returns 0 with fixture file', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await run(['node', 'topo', 'check', FIXTURE_PATH])).toBe(0);
    log.mockRestore();
  });

  it('trace returns 0 with fixture file and path', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await run(['node', 'topo', 'trace', FIXTURE_PATH, 'user.membership'])).toBe(0);
    const output = log.mock.calls.flat().join('\n');
    expect(output).toContain('user.membership');
    log.mockRestore();
  });

  it('trace returns 1 when path is missing', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await run(['node', 'topo', 'trace', FIXTURE_PATH])).toBe(1);
    err.mockRestore();
  });

  it('optimize returns 0 with fixture file', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await run(['node', 'topo', 'optimize', FIXTURE_PATH])).toBe(0);
    log.mockRestore();
  });

  it('export returns 0 with fixture file', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await run(['node', 'topo', 'export', FIXTURE_PATH])).toBe(0);
    log.mockRestore();
  });

  it('export returns 0 with --format mermaid', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await run(['node', 'topo', 'export', FIXTURE_PATH, '--format', 'mermaid'])).toBe(0);
    log.mockRestore();
  });

  it('visualize returns 0 with fixture file', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await run(['node', 'topo', 'visualize', FIXTURE_PATH])).toBe(0);
    log.mockRestore();
  });

  it('visualize returns 0 with --port option', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await run(['node', 'topo', 'visualize', FIXTURE_PATH, '--port', '8080'])).toBe(0);
    log.mockRestore();
  });
});

describe('visualizeSpace', () => {
  it('starts server and logs the URL', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await visualizeSpace([makeFixture()] as any[], 7331);
    const output = log.mock.calls.flat().join('\n');
    expect(output).toContain('localhost:7331');
    log.mockRestore();
  });

  it('uses the provided port', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await visualizeSpace([makeFixture()] as any[], 9000);
    const output = log.mock.calls.flat().join('\n');
    expect(output).toContain('9000');
    log.mockRestore();
  });
});
