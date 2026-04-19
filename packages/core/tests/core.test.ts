import { describe, expect, it, vi } from 'vitest';
import { derives, influenced_by, node, requires, statespace, triggers } from '../src/index';

describe('core runtime', () => {
  it('computes derives and requires edges', () => {
    const app = statespace('App', {
      nodes: {
        user: node({ initial: { membership: 'free', authenticated: false } }),
        cart: node({ initial: { discount: 0, items: [] as string[] } }),
        checkout: node({ initial: { canProceed: false } })
      },
      topology: {
        'cart.discount': derives(['user.membership'], (membership) => (membership === 'premium' ? 0.2 : 0)),
        'checkout.canProceed': requires(['cart.items.length > 0', 'user.authenticated'])
      }
    });

    app.set('user.membership', 'premium');
    expect(app.get('cart.discount')).toBe(0.2);

    app.set('cart.items', ['sku-1']);
    app.set('user.authenticated', true);
    expect(app.get('checkout.canProceed')).toBe(true);
  });

  it('supports triggers and influenced events', () => {
    const influencedHandler = vi.fn();
    const app = statespace('App2', {
      nodes: {
        checkout: node({ initial: { complete: null as null | { id: string } } }),
        orders: node({ initial: { history: [] as Array<{ id: string }> } }),
        user: node({ initial: { recommendations: [] as string[] } }),
        cart: node({ initial: { items: [] as string[] } })
      },
      topology: {
        'checkout.complete': triggers('orders.history', (order, state) => [
          ...((state as { orders: { history: Array<{ id: string }> } }).orders.history as Array<{
            id: string;
          }>),
          order as { id: string }
        ]),
        'user.recommendations': influenced_by(['cart.items'])
      }
    });

    const unsub = app.subscribeEvent('influenced', influencedHandler);
    app.set('checkout.complete', { id: 'o-1' });
    app.set('cart.items', ['a']);

    expect(app.get<Array<{ id: string }>>('orders.history')).toEqual([{ id: 'o-1' }]);
    expect(influencedHandler).toHaveBeenCalled();
    unsub();
  });

  it('throws on restricted cycles', () => {
    expect(() =>
      statespace('Cycle', {
        nodes: {
          checkout: node({ initial: {} }),
          cart: node({ initial: {} })
        },
        topology: {
          'checkout.value': derives(['cart.value'], (v) => v),
          'cart.value': derives(['checkout.value'], (v) => v)
        },
        constraints: { noCyclesThrough: ['checkout'] }
      })
    ).toThrow(/Cycle detected/);
  });
});
