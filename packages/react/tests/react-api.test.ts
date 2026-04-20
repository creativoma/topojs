// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { node, statespace, influencedBy } from '@topojs/core';
import { useNode, useNodes, useMutation, useTopologyEvent, useTopology } from '../src/index';

function makeCountSpace() {
  return statespace('count-test', {
    nodes: {
      count: node({ initial: 0 }),
      items: node({ initial: [] as string[] }),
    },
    topology: {},
  });
}

describe('useNode', () => {
  it('returns the current value', () => {
    const space = makeCountSpace();
    const { result } = renderHook(() => useNode<number>(space, 'count'));
    expect(result.current).toBe(0);
  });

  it('re-renders when value changes', () => {
    const space = makeCountSpace();
    const { result } = renderHook(() => useNode<number>(space, 'count'));

    act(() => {
      space.set('count', 42);
    });
    expect(result.current).toBe(42);
  });
});

describe('useNodes', () => {
  it('returns values for multiple paths', () => {
    const space = makeCountSpace();
    const { result } = renderHook(() => useNodes<[number, string[]]>(space, ['count', 'items']));
    expect(result.current).toEqual([0, []]);
  });

  it('updates when any path changes', () => {
    const space = makeCountSpace();
    const { result } = renderHook(() => useNodes<[number, string[]]>(space, ['count', 'items']));

    act(() => {
      space.set('count', 5);
    });
    expect(result.current[0]).toBe(5);
  });

  it('returns stable reference when values unchanged', () => {
    const space = makeCountSpace();
    const { result, rerender } = renderHook(() =>
      useNodes<[number, string[]]>(space, ['count', 'items']),
    );

    const firstRef = result.current;
    rerender();
    expect(result.current).toBe(firstRef);
  });

  it('returns new reference when values change', () => {
    const space = makeCountSpace();
    const { result } = renderHook(() => useNodes<[number, string[]]>(space, ['count', 'items']));

    const firstRef = result.current;
    act(() => {
      space.set('count', 5);
    });
    expect(result.current).not.toBe(firstRef);
  });
});

describe('useMutation', () => {
  it('set updates the node', () => {
    const space = makeCountSpace();
    const { result } = renderHook(() => useMutation(space, 'count'));

    act(() => {
      result.current.set(99);
    });
    expect(space.get('count')).toBe(99);
  });

  it('update applies the updater function', () => {
    const space = makeCountSpace();
    const { result } = renderHook(() => useMutation(space, 'count'));

    act(() => {
      result.current.update<number>((n) => n + 10);
    });
    expect(space.get('count')).toBe(10);
  });

  it('append adds items to array', () => {
    const space = makeCountSpace();
    const { result } = renderHook(() => useMutation(space, 'items'));

    act(() => {
      result.current.append('a');
    });
    act(() => {
      result.current.append('b');
    });
    expect(space.get('items')).toEqual(['a', 'b']);
  });
});

describe('useTopology', () => {
  it('returns topology metadata for the path', () => {
    const space = statespace('topo-test', {
      nodes: {
        a: node({ initial: 0 }),
        b: node({ initial: 0 }),
      },
      topology: {},
    });

    const { result } = renderHook(() => useTopology(space, 'a'));
    expect(result.current).toEqual({ dependsOn: [], affects: [], updateOrder: ['a'] });
  });
});

describe('useTopologyEvent', () => {
  it('calls the handler when the event fires', () => {
    const space = statespace('event-test', {
      nodes: {
        cart: node({ initial: { items: [] as string[] } }),
        recs: node({ initial: [] as string[] }),
      },
      topology: {
        recs: influencedBy(['cart.items']),
      },
    });

    const handler = vi.fn();
    renderHook(() => useTopologyEvent(space, 'influenced', handler));

    act(() => {
      space.set('cart.items', ['x']);
    });
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'recs', sources: ['cart.items'] }),
    );
  });

  it('does not call handler after unmount', () => {
    const space = statespace('event-unmount', {
      nodes: {
        a: node({ initial: [] as string[] }),
        b: node({ initial: [] as string[] }),
      },
      topology: { b: influencedBy(['a']) },
    });

    const handler = vi.fn();
    const { unmount } = renderHook(() => useTopologyEvent(space, 'influenced', handler));

    unmount();
    act(() => {
      space.set('a', ['x']);
    });
    expect(handler).not.toHaveBeenCalled();
  });
});
