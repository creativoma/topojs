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
