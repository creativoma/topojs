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

// Capture handlers so tests can trigger request/error paths
const mockCapture = vi.hoisted(() => ({
  requestHandler: null as
    | null
    | ((req: unknown, res: { writeHead: () => void; end: () => void }) => void),
  errorHandler: null as null | ((err: NodeJS.ErrnoException) => void),
  listenMode: 'success' as 'success' | 'eaddrinuse' | 'error',
}));

vi.mock('http', () => {
  const mockServer = {
    listen: vi.fn((_port: number, cb: () => void) => {
      if (mockCapture.requestHandler) {
        mockCapture.requestHandler({}, { writeHead: vi.fn(), end: vi.fn() });
      }
      if (mockCapture.listenMode === 'success') {
        cb();
      } else {
        // Fire error on next tick, after server.on('error', ...) is registered
        queueMicrotask(() => {
          const err =
            mockCapture.listenMode === 'eaddrinuse'
              ? Object.assign(new Error('address in use'), { code: 'EADDRINUSE' })
              : new Error('generic server error');
          mockCapture.errorHandler?.(err as NodeJS.ErrnoException);
        });
      }
      return mockServer;
    }),
    on: vi.fn((event: string, handler: unknown) => {
      if (event === 'error')
        mockCapture.errorHandler = handler as (err: NodeJS.ErrnoException) => void;
      return mockServer;
    }),
  };
  return {
    createServer: vi.fn(
      (handler: (req: unknown, res: { writeHead: () => void; end: () => void }) => void) => {
        mockCapture.requestHandler = handler;
        return mockServer;
      },
    ),
  };
});

vi.mock('child_process', () => ({ exec: vi.fn() }));

// Minimal fixture statespace with all 4 edge types + flagged node
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
    'user.recommendations': {
      kind: 'influenced_by' as const,
      sources: ['cart.items'],
    },
    'checkout.summary': {
      kind: 'triggers' as const,
      target: 'user.history',
      effect: () => undefined,
    },
  };

  const nodes = {
    user: {
      initial: { authenticated: false, membership: 'free' },
      persist: true,
      validate: () => true,
      middleware: [() => {}],
    },
    cart: { initial: { items: [], discount: 0 } },
    checkout: { initial: { canProceed: false } },
  };

  const affects = (path: string): string[] => {
    const result: string[] = [];
    for (const [key, edge] of Object.entries(topology)) {
      if (edge.kind === 'derives' && edge.dependencies.includes(path)) result.push(key);
      if (edge.kind === 'requires' && edge.conditions.some((c) => c.includes(path)))
        result.push(key);
      if (edge.kind === 'influenced_by' && edge.sources.includes(path)) result.push(key);
    }
    return result;
  };

  const dependsOn = (path: string): string[] => {
    const edge = topology[path as keyof typeof topology];
    if (!edge) return [];
    if (edge.kind === 'derives') return [...edge.dependencies];
    if (edge.kind === 'requires')
      return edge.conditions.flatMap((c) => c.match(/[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)*/g) ?? []);
    if (edge.kind === 'influenced_by') return [...edge.sources];
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

// Fixture that triggers all optimizeSpace suggestions
function makeOptimizeFixture(): RuntimeStatespace {
  const topology: Record<
    string,
    { kind: 'derives'; dependencies: string[]; compute: () => number }
  > = {
    result: { kind: 'derives', dependencies: ['source1', 'source2'], compute: () => 0 },
    b: { kind: 'derives', dependencies: ['root'], compute: () => 0 },
    c: { kind: 'derives', dependencies: ['root'], compute: () => 0 },
    d: { kind: 'derives', dependencies: ['root'], compute: () => 0 },
    e: { kind: 'derives', dependencies: ['b'], compute: () => 0 },
    f: { kind: 'derives', dependencies: ['e'], compute: () => 0 },
    g: { kind: 'derives', dependencies: ['f'], compute: () => 0 },
  };
  const nodes = Object.fromEntries(
    ['root', 'source1', 'source2', 'result', 'b', 'c', 'd', 'e', 'f', 'g'].map((k) => [
      k,
      { initial: 0 },
    ]),
  );
  const affects = (path: string): string[] =>
    Object.entries(topology)
      .filter(([, e]) => e.dependencies.includes(path))
      .map(([k]) => k);
  const dependsOn = (path: string): string[] => topology[path]?.dependencies ?? [];
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
    name: 'Optimize',
    definition: { nodes, topology: topology as never },
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
const EMPTY_FIXTURE_PATH = resolve(__dirname, 'fixtures/empty.mjs');
const BROKEN_FIXTURE_PATH = resolve(__dirname, 'fixtures/broken.mjs');

describe('analyzeSpace', () => {
  it('prints nodes and topology including all edge types', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    analyzeSpace(makeFixture());
    const output = log.mock.calls.flat().join('\n');
    expect(output).toContain('Cart');
    expect(output).toContain('user');
    expect(output).toContain('derives');
    expect(output).toContain('requires');
    expect(output).toContain('influencedBy');
    expect(output).toContain('triggers');
    expect(output).toContain('persist');
    expect(output).toContain('validate');
    expect(output).toContain('middleware');
    log.mockRestore();
  });
});

describe('checkSpace', () => {
  it('returns 0 for a valid statespace', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(checkSpace(makeFixture())).toBe(0);
    log.mockRestore();
  });

  it('returns 1 for a statespace with unknown node in derives', () => {
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

  it('returns 1 for statespace with unknown node in influencedBy', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const space = makeFixture();
    (space.definition.topology as Record<string, unknown>)['ghost.recs'] = {
      kind: 'influenced_by',
      sources: ['nonexistent_source'],
    };
    expect(checkSpace(space)).toBe(1);
    log.mockRestore();
  });

  it('returns 1 when maxFanout is exceeded', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const space = makeFixture();
    space.definition.constraints = { maxFanout: { 'user.membership': 0 } };
    expect(checkSpace(space)).toBe(1);
    log.mockRestore();
  });

  it('returns 0 when maxFanout is set but not exceeded', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const space = makeFixture();
    space.definition.constraints = { maxFanout: { 'user.membership': 10 } };
    expect(checkSpace(space)).toBe(0);
    log.mockRestore();
  });

  it('logs warnings for nodes with high fanout', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const space = makeFixture();
    const origAffects = space.affects;
    space.affects = (path: string) => {
      if (path === 'user') return ['a', 'b', 'c', 'd', 'e', 'f'];
      return origAffects(path);
    };
    checkSpace(space);
    const output = log.mock.calls.flat().join('\n');
    expect(output).toContain('high fanout');
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

  it('shows downstream for a node that affects others', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    traceSpace(makeFixture(), 'user.membership');
    const output = log.mock.calls.flat().join('\n');
    expect(output).toContain('cart.discount');
    log.mockRestore();
  });

  it('shows no downstream for a leaf node', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    traceSpace(makeFixture(), 'cart.discount');
    const output = log.mock.calls.flat().join('\n');
    expect(output).toContain('No downstream');
    log.mockRestore();
  });
});

describe('optimizeSpace', () => {
  it('prints "no suggestions" for simple statespace', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    optimizeSpace(makeFixture());
    const output = log.mock.calls.flat().join('\n');
    expect(output).toContain('No optimization');
    log.mockRestore();
  });

  it('suggests cache, flags high fanout and deep chain', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    optimizeSpace(makeOptimizeFixture());
    const output = log.mock.calls.flat().join('\n');
    expect(output).toContain('cache: true');
    expect(output).toContain('high fanout');
    expect(output).toContain('deep chain');
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

  it('handles requires condition with no path identifiers in mermaid and dot', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const space = makeFixture();
    (space.definition.topology as Record<string, unknown>)['numericCheck'] = {
      kind: 'requires',
      conditions: ['1 > 0'],
    };
    exportSpace(space, 'mermaid');
    exportSpace(space, 'dot');
    log.mockRestore();
  });

  it('logs error for unknown format', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    exportSpace(makeFixture(), 'unknown');
    expect(err.mock.calls.flat().join('')).toContain('Unknown format');
    err.mockRestore();
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

  it('returns 1 when file cannot be loaded', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await run(['node', 'topo', 'analyze', '/nonexistent/path/store.mjs'])).toBe(1);
    expect(err.mock.calls.flat().join('')).toContain('Error loading');
    err.mockRestore();
  });

  it('returns 1 when no statespace found in file', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await run(['node', 'topo', 'analyze', EMPTY_FIXTURE_PATH])).toBe(1);
    expect(err.mock.calls.flat().join('')).toContain('No statespace found');
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

  it('trace returns 0 for derives path', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await run(['node', 'topo', 'trace', FIXTURE_PATH, 'cart.discount'])).toBe(0);
    log.mockRestore();
  });

  it('trace returns 0 for requires path', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await run(['node', 'topo', 'trace', FIXTURE_PATH, 'checkout.canProceed'])).toBe(0);
    log.mockRestore();
  });

  it('trace returns 0 for influencedBy source path', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await run(['node', 'topo', 'trace', FIXTURE_PATH, 'cart.items'])).toBe(0);
    log.mockRestore();
  });

  it('trace returns 0 for influencedBy target path', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await run(['node', 'topo', 'trace', FIXTURE_PATH, 'user.recommendations'])).toBe(0);
    log.mockRestore();
  });

  it('trace returns 0 for triggers path', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await run(['node', 'topo', 'trace', FIXTURE_PATH, 'checkout.summary'])).toBe(0);
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

  it('check returns 1 with broken fixture file', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await run(['node', 'topo', 'check', BROKEN_FIXTURE_PATH])).toBe(1);
    log.mockRestore();
  });

  it('visualize returns 0 with --port but no port number (uses default)', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await run(['node', 'topo', 'visualize', FIXTURE_PATH, '--port'])).toBe(0);
    log.mockRestore();
  });

  it('visualize returns 1 when server throws', async () => {
    mockCapture.listenMode = 'error';
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await run(['node', 'topo', 'visualize', FIXTURE_PATH])).toBe(1);
    err.mockRestore();
    log.mockRestore();
    mockCapture.listenMode = 'success';
  });
});

describe('visualizeSpace', () => {
  it('starts server and logs the URL', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await visualizeSpace([makeFixture()] as never[], 7331);
    const output = log.mock.calls.flat().join('\n');
    expect(output).toContain('localhost:7331');
    log.mockRestore();
  });

  it('uses the provided port', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await visualizeSpace([makeFixture()] as never[], 9000);
    const output = log.mock.calls.flat().join('\n');
    expect(output).toContain('9000');
    log.mockRestore();
  });

  it('handles requires condition with no identifiers in buildGraphData', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const space = makeFixture();
    (space.definition.topology as Record<string, unknown>)['numericGate'] = {
      kind: 'requires',
      conditions: ['1 > 0'],
    };
    await visualizeSpace([space] as never[], 7332);
    log.mockRestore();
  });

  it('rejects and logs error on EADDRINUSE', async () => {
    mockCapture.listenMode = 'eaddrinuse';
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await expect(visualizeSpace([makeFixture()] as never[], 9999)).rejects.toThrow(
      'address in use',
    );
    expect(err.mock.calls.flat().join('')).toContain('already in use');
    err.mockRestore();
    log.mockRestore();
    mockCapture.listenMode = 'success';
  });

  it('rejects and logs error on generic server error', async () => {
    mockCapture.listenMode = 'error';
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await expect(visualizeSpace([makeFixture()] as never[], 9999)).rejects.toThrow(
      'generic server error',
    );
    expect(err.mock.calls.flat().join('')).toContain('Server error');
    err.mockRestore();
    log.mockRestore();
    mockCapture.listenMode = 'success';
  });
});

describe('store.mjs fixture internals', () => {
  it('stub functions return expected defaults', async () => {
    const { CartSpace } = (await import(FIXTURE_PATH)) as { CartSpace: RuntimeStatespace };
    expect(CartSpace.get('anything')).toBeUndefined();
    CartSpace.set('anything', 'value');
    CartSpace.update('anything', (v: unknown) => v);
    const unsub = CartSpace.subscribe('anything', () => {});
    unsub();
    const unsubevent = CartSpace.subscribeEvent('influenced' as never, () => {});
    unsubevent();
    expect(CartSpace.getState()).toEqual({});
  });

  it('compute function in fixture handles all membership tiers', async () => {
    const { CartSpace } = (await import(FIXTURE_PATH)) as { CartSpace: RuntimeStatespace };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const compute = (CartSpace.definition.topology['cart.discount'] as any).compute;
    expect(compute('premium')).toBe(0.2);
    expect(compute('plus')).toBe(0.1);
    expect(compute('free')).toBe(0);
  });
});
