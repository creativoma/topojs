import { describe, expect, it, vi } from 'vitest';
import type { EdgeDefinition, NodeDefinition } from '../src/index';
import {
  defineConfig,
  derives,
  influencedBy,
  node,
  requires,
  statespace,
  triggers,
} from '../src/index';

describe('derives + requires edges', () => {
  it('computes derived value when dependency changes', () => {
    const app = statespace('App', {
      nodes: {
        user: node({ initial: { membership: 'free', authenticated: false } }),
        cart: node({ initial: { discount: 0, items: [] as string[] } }),
        checkout: node({ initial: { canProceed: false } }),
      },
      topology: {
        'cart.discount': derives(['user.membership'], (membership) =>
          membership === 'premium' ? 0.2 : 0,
        ),
        'checkout.canProceed': requires(['cart.items.length > 0', 'user.authenticated']),
      },
    });

    app.set('user.membership', 'premium');
    expect(app.get('cart.discount')).toBe(0.2);

    app.set('cart.items', ['sku-1']);
    app.set('user.authenticated', true);
    expect(app.get('checkout.canProceed')).toBe(true);
  });

  it('requires evaluates to false when conditions unmet', () => {
    const app = statespace('Req', {
      nodes: {
        form: node({ initial: { valid: false, dirty: false } }),
        submit: node({ initial: { enabled: false } }),
      },
      topology: {
        'submit.enabled': requires(['form.valid', 'form.dirty']),
      },
    });

    app.set('form.valid', true);
    expect(app.get('submit.enabled')).toBe(false);

    app.set('form.dirty', true);
    expect(app.get('submit.enabled')).toBe(true);
  });
});

describe('triggers + influencedBy edges', () => {
  it('triggers appends to target on change', () => {
    const app = statespace('App2', {
      nodes: {
        checkout: node({ initial: { complete: null as null | { id: string } } }),
        orders: node({ initial: { history: [] as Array<{ id: string }> } }),
        user: node({ initial: { recommendations: [] as string[] } }),
        cart: node({ initial: { items: [] as string[] } }),
      },
      topology: {
        'checkout.complete': triggers('orders.history', (order, state) => [
          ...(state as { orders: { history: Array<{ id: string }> } }).orders.history,
          order as { id: string },
        ]),
        'user.recommendations': influencedBy(['cart.items']),
      },
    });

    const influencedHandler = vi.fn();
    const unsub = app.subscribeEvent('influenced', influencedHandler);

    app.set('checkout.complete', { id: 'o-1' });
    app.set('cart.items', ['a']);

    expect(app.get<Array<{ id: string }>>('orders.history')).toEqual([{ id: 'o-1' }]);
    expect(influencedHandler).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'user.recommendations' }),
    );
    unsub();
  });

  it('unsubscribing event stops callbacks', () => {
    const app = statespace('Unsub', {
      nodes: {
        a: node({ initial: [] as string[] }),
        b: node({ initial: [] as string[] }),
      },
      topology: { b: influencedBy(['a']) },
    });

    const handler = vi.fn();
    const unsub = app.subscribeEvent('influenced', handler);
    app.set('a', ['x']);
    expect(handler).toHaveBeenCalledTimes(1);

    unsub();
    app.set('a', ['y']);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('middleware + validation', () => {
  it('middleware transforms the incoming value', () => {
    const app = statespace('MW', {
      nodes: {
        score: node({
          initial: 0,
          middleware: [(v) => Math.max(0, Math.min(100, v as number))],
        }),
      },
      topology: {},
    });

    app.set('score', 150);
    expect(app.get('score')).toBe(100);

    app.set('score', -10);
    expect(app.get('score')).toBe(0);
  });

  it('validate throws on invalid value', () => {
    const app = statespace('Val', {
      nodes: {
        age: node({
          initial: 0,
          validate: (v) => typeof v === 'number' && v >= 0,
        }),
      },
      topology: {},
    });

    expect(() => app.set('age', -1)).toThrow(/Validation failed/);
    expect(app.get('age')).toBe(0);
  });
});

describe('subscribe', () => {
  it('calls subscriber on change and cleans up', () => {
    const app = statespace('Sub', {
      nodes: { x: node({ initial: 0 }) },
      topology: {},
    });

    const cb = vi.fn();
    const unsub = app.subscribe('x', cb);

    app.set('x', 1);
    expect(cb).toHaveBeenCalledTimes(1);

    unsub();
    app.set('x', 2);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('notifies root subscribers on nested path change', () => {
    const app = statespace('NestedSub', {
      nodes: { user: node({ initial: { name: 'alice' } }) },
      topology: {},
    });

    const cb = vi.fn();
    app.subscribe('user', cb);
    app.set('user.name', 'bob');
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe('topology introspection', () => {
  it('dependsOn returns declared dependencies', () => {
    const app = statespace('Deps', {
      nodes: {
        a: node({ initial: 1 }),
        b: node({ initial: 2 }),
        c: node({ initial: 0 }),
      },
      topology: {
        c: derives(['a', 'b'], (a, b) => (a as number) + (b as number)),
      },
    });

    expect(app.dependsOn('c')).toEqual(['a', 'b']);
    expect(app.dependsOn('a')).toEqual([]);
  });

  it('affects returns downstream nodes', () => {
    const app = statespace('Affects', {
      nodes: {
        a: node({ initial: 1 }),
        b: node({ initial: 0 }),
        c: node({ initial: 0 }),
      },
      topology: {
        b: derives(['a'], (v) => v),
        c: derives(['a'], (v) => v),
      },
    });

    expect(app.affects('a').sort()).toEqual(['b', 'c']);
  });

  it('updateOrder returns topological traversal', () => {
    const app = statespace('Order', {
      nodes: {
        a: node({ initial: 0 }),
        b: node({ initial: 0 }),
        c: node({ initial: 0 }),
      },
      topology: {
        b: derives(['a'], (v) => v),
        c: derives(['b'], (v) => v),
      },
    });

    expect(app.updateOrder('a')).toEqual(['a', 'b', 'c']);
  });
});

describe('getState', () => {
  it('returns a deep clone of current state', () => {
    const app = statespace('GS', {
      nodes: { list: node({ initial: [1, 2] }) },
      topology: {},
    });

    const snap = app.getState();
    expect(snap).toEqual({ list: [1, 2] });

    (snap['list'] as number[]).push(3);
    expect(app.get<number[]>('list')).toHaveLength(2);
  });
});

describe('async derives', () => {
  it('sets value after promise resolves', async () => {
    const app = statespace('Async', {
      nodes: {
        query: node({ initial: '' }),
        result: node({ initial: '' }),
      },
      topology: {
        result: derives(['query'], async (q) => `result:${q}`),
      },
    });

    app.set('query', 'hello');
    await new Promise((r) => setTimeout(r, 0));
    expect(app.get('result')).toBe('result:hello');
  });
});

describe('cycle detection', () => {
  it('throws on restricted cycles', () => {
    expect(() =>
      statespace('Cycle', {
        nodes: {
          checkout: node({ initial: {} }),
          cart: node({ initial: {} }),
        },
        topology: {
          'checkout.value': derives(['cart.value'], (v) => v),
          'cart.value': derives(['checkout.value'], (v) => v),
        },
        constraints: { noCyclesThrough: ['checkout'] },
      }),
    ).toThrow(/Cycle detected/);
  });

  it('does not throw when cycle is not in guarded nodes', () => {
    expect(() =>
      statespace('NoCycle', {
        nodes: {
          a: node({ initial: {} }),
          b: node({ initial: {} }),
        },
        topology: {
          'a.value': derives(['b.value'], (v) => v),
          'b.value': derives(['a.value'], (v) => v),
        },
        constraints: { noCyclesThrough: ['unrelated'] },
      }),
    ).not.toThrow();
  });
});

describe('defineConfig', () => {
  it('returns the config as-is', () => {
    const config = { foo: 'bar', nested: { a: 1 } };
    expect(defineConfig(config)).toBe(config);
  });
});

describe('cloneDeep', () => {
  it('clones primitives as-is', () => {
    const app = statespace('Prim', {
      nodes: {
        num: node({ initial: 42 }),
        str: node({ initial: 'hello' }),
        bool: node({ initial: true }),
        nil: node({ initial: null }),
      },
      topology: {},
    });
    expect(app.get('num')).toBe(42);
    expect(app.get('str')).toBe('hello');
    expect(app.get('bool')).toBe(true);
    expect(app.get('nil')).toBe(null);
  });

  it('deep clones nested objects via getState', () => {
    const app = statespace('Deep', {
      nodes: {
        user: node({ initial: { profile: { name: 'alice', tags: ['a', 'b'] } } }),
      },
      topology: {},
    });

    const snap = app.getState() as { user: { profile: { name: string; tags: string[] } } };
    snap.user.profile.name = 'bob';
    snap.user.profile.tags.push('c');

    expect(app.get('user').profile.name).toBe('alice');
    expect(app.get('user').profile.tags).toEqual(['a', 'b']);
  });
});

describe('getByPath edge cases', () => {
  it('returns undefined for missing nested path', () => {
    const app = statespace('Missing', {
      nodes: { user: node({ initial: { name: 'alice' } }) },
      topology: {},
    });
    expect(app.get('user.age')).toBeUndefined();
    expect(app.get('nonexistent')).toBeUndefined();
  });
});

describe('setByPath security', () => {
  it('throws on unsafe path segments', () => {
    const app = statespace('Sec', {
      nodes: { data: node({ initial: {} }) },
      topology: {},
    });

    expect(() => app.set('data.__proto__.polluted', true)).toThrow(/Unsafe path segment/);
    expect(() => app.set('data.constructor.prototype.polluted', true)).toThrow(
      /Unsafe path segment/,
    );
  });
});

describe('evalCondition - all operators', () => {
  it('evaluates > operator', () => {
    const app = statespace('Gt', {
      nodes: { a: node({ initial: 5 }), b: node({ initial: 3 }), result: node({ initial: false }) },
      topology: { result: requires(['a > b']) },
    });
    app.set('a', 10);
    expect(app.get('result')).toBe(true);
  });

  it('evaluates < operator', () => {
    const app = statespace('Lt', {
      nodes: { a: node({ initial: 2 }), b: node({ initial: 5 }), result: node({ initial: false }) },
      topology: { result: requires(['a < b']) },
    });
    app.set('b', 10);
    expect(app.get('result')).toBe(true);
  });

  it('evaluates >= operator', () => {
    const app = statespace('Gte', {
      nodes: { a: node({ initial: 5 }), b: node({ initial: 5 }), result: node({ initial: false }) },
      topology: { result: requires(['a >= b']) },
    });
    app.set('a', 6);
    expect(app.get('result')).toBe(true);
  });

  it('evaluates <= operator', () => {
    const app = statespace('Lte', {
      nodes: { a: node({ initial: 3 }), b: node({ initial: 5 }), result: node({ initial: false }) },
      topology: { result: requires(['a <= b']) },
    });
    app.set('a', 4);
    expect(app.get('result')).toBe(true);
  });

  it('evaluates === operator', () => {
    const app = statespace('Seq', {
      nodes: { a: node({ initial: 5 }), b: node({ initial: 3 }), result: node({ initial: false }) },
      topology: { result: requires(['a === b']) },
    });
    app.set('b', 5);
    expect(app.get('result')).toBe(true);
  });

  it('evaluates !== operator', () => {
    const app = statespace('Neq', {
      nodes: { a: node({ initial: 5 }), b: node({ initial: 3 }), result: node({ initial: false }) },
      topology: { result: requires(['a !== b']) },
    });
    app.set('a', 8);
    expect(app.get('result')).toBe(true);
  });

  it('evaluates == operator with coercion', () => {
    const app = statespace('Eq', {
      nodes: {
        a: node({ initial: 5 }),
        b: node({ initial: '5' }),
        result: node({ initial: false }),
      },
      topology: { result: requires(['a == b']) },
    });
    app.set('a', 5); // 5 == '5' is true with coercion
    expect(app.get('result')).toBe(true);
  });

  it('evaluates != operator with coercion', () => {
    const app = statespace('Ne', {
      nodes: { a: node({ initial: 5 }), b: node({ initial: 3 }), result: node({ initial: false }) },
      topology: { result: requires(['a != b']) },
    });
    app.set('a', 8);
    expect(app.get('result')).toBe(true);
  });

  it('evaluates truthy/falsy without operator', () => {
    const app = statespace('Truthy', {
      nodes: { flag: node({ initial: true }), result: node({ initial: false }) },
      topology: { result: requires(['flag']) },
    });
    app.set('flag', false);
    app.set('flag', true);
    expect(app.get('result')).toBe(true);
  });
});

describe('async derives - error handling', () => {
  it('calls error handler when promise rejects', async () => {
    const app = statespace('AsyncErr', {
      nodes: {
        query: node({ initial: '' }),
        result: node({ initial: 'idle' }),
      },
      topology: {
        result: derives(
          ['query'],
          async () => {
            throw new Error('fetch failed');
          },
          { error: () => 'error-state' },
        ),
      },
    });

    app.set('query', 'hello');
    await new Promise((r) => setTimeout(r, 10));
    expect(app.get('result')).toBe('error-state');
  });
});

describe('slow-propagation event', () => {
  it('emits slow-propagation when elapsed > 16ms', () => {
    const app = statespace('Slow', {
      nodes: {
        a: node({ initial: 0 }),
        b: node({ initial: 0 }),
      },
      topology: {
        b: derives(['a'], (v) => {
          const start = Date.now();
          while (Date.now() - start < 20) {
            /* block for 20ms */
          }
          return v;
        }),
      },
    });

    const handler = vi.fn();
    const unsub = app.subscribeEvent('slow-propagation', handler);
    app.set('a', 1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'b', ms: expect.any(Number) }),
    );
    expect(handler.mock.calls[0][0].ms).toBeGreaterThanOrEqual(16);
    unsub();
  });
});

describe('max propagation depth', () => {
  it('throws when propagation exceeds 100 depth', () => {
    const topology: Record<string, EdgeDefinition> = {};
    const nodes: Record<string, NodeDefinition<unknown>> = {};

    for (let i = 0; i <= 101; i++) {
      nodes[`n${i}`] = node({ initial: 0 });
      if (i > 0) {
        topology[`n${i}`] = derives([`n${i - 1}`], (v) => (v as number) + 1);
      }
    }

    const app = statespace('DeepProp', { nodes, topology });

    expect(() => app.set('n0', 1)).toThrow(/Max propagation depth/);
  });
});

describe('update', () => {
  it('applies updater function and sets the result', () => {
    const app = statespace('Upd', {
      nodes: { count: node({ initial: 0 }) },
      topology: {},
    });
    app.update<number>('count', (n) => n + 5);
    expect(app.get('count')).toBe(5);
  });

  it('triggers subscriber on update', () => {
    const app = statespace('UpdSub', {
      nodes: { count: node({ initial: 0 }) },
      topology: {},
    });
    const cb = vi.fn();
    app.subscribe('count', cb);
    app.update<number>('count', (n) => n + 1);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('propagates derived edges after update', () => {
    const app = statespace('UpdDerives', {
      nodes: {
        base: node({ initial: 0 }),
        doubled: node({ initial: 0 }),
      },
      topology: {
        doubled: derives(['base'], (v) => (v as number) * 2),
      },
    });
    app.update<number>('base', (n) => n + 3);
    expect(app.get('doubled')).toBe(6);
  });
});

describe('set same value', () => {
  it('still notifies subscribers when value is unchanged', () => {
    const app = statespace('SameVal', {
      nodes: { x: node({ initial: 42 }) },
      topology: {},
    });
    const cb = vi.fn();
    app.subscribe('x', cb);
    app.set('x', 42);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe('node helper', () => {
  it('returns the definition object as-is', () => {
    const def = { initial: 10, validate: (v: unknown) => typeof v === 'number' };
    expect(node(def)).toBe(def);
  });
});

describe('strongConsistency constraint', () => {
  it('is accepted without throwing', () => {
    expect(() =>
      statespace('SC', {
        nodes: {
          price: node({ initial: 0 }),
          total: node({ initial: 0 }),
        },
        topology: {
          total: derives(['price'], (v) => v),
        },
        constraints: { strongConsistency: ['price', 'total'] },
      }),
    ).not.toThrow();
  });
});

describe('dependsOn - all edge types', () => {
  it('returns extracted paths for requires edge', () => {
    const app = statespace('DepsReq', {
      nodes: {
        total: node({ initial: 0 }),
        authenticated: node({ initial: false }),
        canCheckout: node({ initial: false }),
      },
      topology: {
        canCheckout: requires(['total > 0', 'authenticated']),
      },
    });
    const deps = app.dependsOn('canCheckout');
    expect(deps).toContain('total');
    expect(deps).toContain('authenticated');
  });

  it('returns sources for influenced_by edge', () => {
    const app = statespace('DepsIB', {
      nodes: {
        items: node({ initial: [] as string[] }),
        recs: node({ initial: [] as string[] }),
      },
      topology: { recs: influencedBy(['items']) },
    });
    expect(app.dependsOn('recs')).toEqual(['items']);
  });

  it('returns [path] for triggers edge', () => {
    const app = statespace('DepsTrig', {
      nodes: {
        order: node({ initial: null as null | { id: string } }),
        history: node({ initial: [] as Array<{ id: string }> }),
      },
      topology: {
        order: triggers('history', (v, s) => [
          ...(s as { history: Array<{ id: string }> }).history,
          v as { id: string },
        ]),
      },
    });
    expect(app.dependsOn('order')).toEqual(['order']);
  });
});

describe('parseValue - quoted string literals', () => {
  it('evaluates requires with single-quoted string literal', () => {
    const app = statespace('QuotedSingle', {
      nodes: {
        role: node({ initial: 'user' }),
        isAdmin: node({ initial: false }),
      },
      topology: { isAdmin: requires(["role === 'admin'"]) },
    });
    app.set('role', 'admin');
    expect(app.get('isAdmin')).toBe(true);
    app.set('role', 'user');
    expect(app.get('isAdmin')).toBe(false);
  });

  it('evaluates requires with double-quoted string literal', () => {
    const app = statespace('QuotedDouble', {
      nodes: {
        status: node({ initial: 'inactive' }),
        isActive: node({ initial: false }),
      },
      topology: { isActive: requires(['status === "active"']) },
    });
    app.set('status', 'active');
    expect(app.get('isActive')).toBe(true);
  });
});

describe('cycle detection - edge cases', () => {
  it('throws when cycle exists with no constraints', () => {
    expect(() =>
      statespace('CycleNoConstraint', {
        nodes: {
          a: node({ initial: {} }),
          b: node({ initial: {} }),
        },
        topology: {
          'a.x': derives(['b.x'], (v) => v),
          'b.x': derives(['a.x'], (v) => v),
        },
      }),
    ).toThrow(/Cycle detected/);
  });

  it('does not throw for diamond-shaped dependency graph', () => {
    expect(() =>
      statespace('Diamond', {
        nodes: {
          a: node({ initial: 0 }),
          b: node({ initial: 0 }),
          c: node({ initial: 0 }),
          d: node({ initial: 0 }),
        },
        topology: {
          b: derives(['a'], (v) => v),
          c: derives(['a'], (v) => v),
          d: derives(['b', 'c'], (bv, cv) => (bv as number) + (cv as number)),
        },
      }),
    ).not.toThrow();
  });
});

describe('triggers - effect returns undefined', () => {
  it('does not call set when effect returns undefined', () => {
    const app = statespace('TrigUndef', {
      nodes: {
        source: node({ initial: 0 }),
        target: node({ initial: 99 }),
      },
      topology: {
        source: triggers('target', () => undefined),
      },
    });
    app.set('source', 1);
    // target stays 99 because effect returned undefined
    expect(app.get('target')).toBe(99);
  });
});

describe('async derives - rejects with no error handler', () => {
  it('silently ignores rejection when no error option set', async () => {
    const app = statespace('AsyncNoErr', {
      nodes: {
        query: node({ initial: '' }),
        result: node({ initial: 'idle' }),
      },
      topology: {
        result: derives(['query'], async () => {
          throw new Error('oops');
        }),
      },
    });
    app.set('query', 'test');
    await new Promise((r) => setTimeout(r, 20));
    // result stays 'idle' — no crash, no update
    expect(app.get('result')).toBe('idle');
  });
});

describe('maxFanout constraint (via CLI checkSpace)', () => {
  it('maxFanout type is accepted in statespace constraints', () => {
    expect(() =>
      statespace('FanoutSpace', {
        nodes: {
          source: node({ initial: 0 }),
          a: node({ initial: 0 }),
          b: node({ initial: 0 }),
        },
        topology: {
          a: derives(['source'], (v) => v),
          b: derives(['source'], (v) => v),
        },
        constraints: { maxFanout: { source: 5 } },
      }),
    ).not.toThrow();
  });
});

describe('loading option in async derives', () => {
  it('option is accepted without error', async () => {
    const app = statespace('AsyncLoading', {
      nodes: {
        query: node({ initial: '' }),
        result: node({ initial: 'idle' }),
      },
      topology: {
        result: derives(['query'], async (q) => `result:${q}`, {
          loading: 'loading...',
          error: () => 'error',
        }),
      },
    });
    app.set('query', 'hello');
    await new Promise((r) => setTimeout(r, 10));
    expect(app.get('result')).toBe('result:hello');
  });
});

describe('getByPath - edge cases', () => {
  it('returns the whole state when path is empty', () => {
    const app = statespace('EmptyPath', {
      nodes: { x: node({ initial: 42 }) },
      topology: {},
    });
    expect(app.get('')).toEqual({ x: 42 });
  });

  it('returns undefined when an intermediate segment is null', () => {
    const app = statespace('NullMid', {
      nodes: { data: node({ initial: null as null | { name: string } }) },
      topology: {},
    });
    expect(app.get('data.name')).toBeUndefined();
  });

  it('returns undefined for constructor key (prototype-pollution guard)', () => {
    const app = statespace('CtorGuard', {
      nodes: { obj: node({ initial: { a: 1 } }) },
      topology: {},
    });
    expect(app.get('obj.constructor')).toBeUndefined();
  });
});

describe('setByPath - edge cases', () => {
  it('throws on prototype path segment', () => {
    const app = statespace('ProtoSeg', {
      nodes: { data: node({ initial: {} }) },
      topology: {},
    });
    expect(() => app.set('data.prototype.x', true)).toThrow(/Unsafe path segment/);
  });

  it('throws on constructor path segment', () => {
    const app = statespace('CtorSeg', {
      nodes: { data: node({ initial: {} }) },
      topology: {},
    });
    expect(() => app.set('data.constructor.x', true)).toThrow(/Unsafe path segment/);
  });

  it('creates nested path when intermediate value is a primitive', () => {
    const app = statespace('OverwritePrim', {
      nodes: { data: node({ initial: { count: 5 } as Record<string, unknown> }) },
      topology: {},
    });
    app.set('data.count.value', 99);
    expect((app.get('data') as Record<string, unknown>)['count']).toBeDefined();
  });
});

describe('parseValue - boolean literals', () => {
  it('evaluates requires with literal true', () => {
    const app = statespace('LitTrue', {
      nodes: { flag: node({ initial: false }), result: node({ initial: false }) },
      topology: { result: requires(['flag === true']) },
    });
    app.set('flag', true);
    expect(app.get('result')).toBe(true);
  });

  it('evaluates requires with literal false', () => {
    const app = statespace('LitFalse', {
      nodes: { flag: node({ initial: true }), result: node({ initial: false }) },
      topology: { result: requires(['flag === false']) },
    });
    app.set('flag', false);
    expect(app.get('result')).toBe(true);
  });
});

describe('sourceEdges deduplication', () => {
  it('does not double-process a target reachable via overlapping source paths', () => {
    const computeSpy = vi.fn((u: unknown) => String(u));
    const app = statespace('SeenDedup', {
      nodes: {
        user: node({ initial: { name: 'alice' } }),
        display: node({ initial: '' }),
      },
      topology: {
        // Both 'user' and 'user.name' appear as dependencies.
        // When 'user' is set, pathAffects matches both, but 'display'
        // should only be computed once thanks to the seen-set dedup.
        display: derives(['user', 'user.name'], computeSpy),
      },
    });
    computeSpy.mockClear();
    app.set('user', { name: 'bob' });
    expect(computeSpy).toHaveBeenCalledTimes(1);
  });
});

describe('updateOrder - diamond graph revisit', () => {
  it('returns correct order and does not revisit nodes in diamond topology', () => {
    const app = statespace('DiamondOrder', {
      nodes: {
        a: node({ initial: 0 }),
        b: node({ initial: 0 }),
        c: node({ initial: 0 }),
        d: node({ initial: 0 }),
      },
      topology: {
        b: derives(['a'], (v) => v),
        c: derives(['a'], (v) => v),
        d: derives(['b', 'c'], (bv, cv) => (bv as number) + (cv as number)),
      },
    });
    const order = app.updateOrder('a');
    expect(order).toContain('a');
    expect(order).toContain('b');
    expect(order).toContain('c');
    expect(order).toContain('d');
    // d should appear only once despite two paths to it
    expect(order.filter((n) => n === 'd')).toHaveLength(1);
  });
});

describe('subscribeEvent - second subscription for same type', () => {
  it('accepts multiple subscribers for the same event type', () => {
    const app = statespace('MultiSub', {
      nodes: {
        a: node({ initial: [] as string[] }),
        b: node({ initial: [] as string[] }),
      },
      topology: { b: influencedBy(['a']) },
    });
    const h1 = vi.fn();
    const h2 = vi.fn();
    app.subscribeEvent('influenced', h1);
    app.subscribeEvent('influenced', h2);
    app.set('a', ['x']);
    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
  });
});

describe('influencedBy with options', () => {
  it('accepts debounce option without throwing', () => {
    expect(() =>
      statespace('IBDebounce', {
        nodes: {
          search: node({ initial: '' }),
          results: node({ initial: [] as string[] }),
        },
        topology: {
          results: influencedBy(['search'], { debounce: '300ms' }),
        },
      }),
    ).not.toThrow();
  });

  it('accepts throttle option without throwing', () => {
    expect(() =>
      statespace('IBThrottle', {
        nodes: {
          scroll: node({ initial: 0 }),
          visible: node({ initial: [] as string[] }),
        },
        topology: {
          visible: influencedBy(['scroll'], { throttle: '100ms' }),
        },
      }),
    ).not.toThrow();
  });
});
