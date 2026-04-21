# @topojs/react

React hooks for [TopoJS](https://github.com/creativoma/topojs) — subscribe to graph-topology state from React components.

## Installation

```bash
npm install @topojs/react @topojs/core
```

## Requirements

- React >= 18
- Node.js >= 20

## Overview

`@topojs/react` provides React hooks built on `useSyncExternalStore` for reading and mutating state managed by a `@topojs/core` statespace. Pass the `RuntimeStatespace` instance directly into any hook.

## Hooks

### `useNode(space, path)`

Subscribe to a single node. Re-renders only when that value changes.

```tsx
const total = useNode<number>(CartSpace, 'total');
```

### `useNodes(space, paths)`

Subscribe to multiple nodes at once. Returns a stable array reference when values are unchanged.

```tsx
const [items, discount, total] = useNodes<[Item[], number, number]>(CartSpace, [
  'items',
  'discount',
  'total',
]);
```

### `useMutation(space, path)`

Returns memoized write helpers for a node.

```tsx
const { set, update, append } = useMutation(CartSpace, 'items');

// set a new value
set([]);

// functional update
update((prev) => [...prev, newItem]);

// append to an array node
append(newItem);
```

### `useTopology(space, path)`

Returns memoized topology metadata for a node — useful for debugging or rendering dependency graphs.

```tsx
const { dependsOn, affects, updateOrder } = useTopology(CartSpace, 'total');
// dependsOn   → ['items', 'discount']
// affects     → ['canCheckout']
// updateOrder → ['total', 'canCheckout']
```

### `useTopologyEvent(space, event, handler)`

Subscribe to a topology event. Cleans up automatically on unmount.

```tsx
useTopologyEvent(CartSpace, 'influenced', ({ path, sources }) => {
  console.log(`${path} was influenced by`, sources);
});

useTopologyEvent(CartSpace, 'slow-propagation', ({ path, ms }) => {
  console.warn(`Slow propagation on ${path}: ${ms}ms`);
});
```

## Usage pattern

Define the statespace once at module level, then pass it into hooks:

```tsx
// store.ts
import { statespace, node, derives } from '@topojs/core';

export const CartSpace = statespace('Cart', {
  nodes: {
    items: node({ initial: [] as number[] }),
    total: node({ initial: 0 }),
  },
  topology: {
    total: derives(['items'], (items) => (items as number[]).reduce((a, b) => a + b, 0)),
  },
});

// Cart.tsx
import { useNode, useMutation } from '@topojs/react';
import { CartSpace } from './store';

export function Cart() {
  const total = useNode<number>(CartSpace, 'total');
  const { append } = useMutation(CartSpace, 'items');

  return (
    <div>
      <p>Total: {total}</p>
      <button onClick={() => append(10)}>Add item</button>
    </div>
  );
}
```

## License

MIT
