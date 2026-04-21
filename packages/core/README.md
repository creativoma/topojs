# @topojs/core

Runtime engine for [TopoJS](https://github.com/creativoma/topojs) — statespace, nodes, edges, cycle detection, and propagation.

## Installation

```bash
npm install @topojs/core
```

## Overview

`@topojs/core` is the foundation of the TopoJS state management library. It models state as a **directed graph** (nodes + edges) rather than a tree, enabling explicit dependency declarations and automatic propagation between nodes.

## API

### `statespace(name, definition)`

Creates a `RuntimeStatespace` — the main runtime object.

```ts
import { statespace, node, derives, requires, influencedBy, triggers } from '@topojs/core';

const CartSpace = statespace('Cart', {
  nodes: {
    items: node({ initial: [] }),
    discount: node({ initial: 0 }),
    total: node({ initial: 0 }),
    canCheckout: node({ initial: false }),
  },
  topology: {
    total: derives(['items', 'discount'], (items, discount) => {
      const sum = (items as number[]).reduce((a, b) => a + b, 0);
      return sum - (discount as number);
    }),
    canCheckout: requires(['total > 0']),
  },
  constraints: {
    noCyclesThrough: ['total'],
  },
});
```

### Edge constructors

| Constructor                                | Description                                     |
| ------------------------------------------ | ----------------------------------------------- |
| `derives(dependencies, compute, options?)` | Sync or async derivation from other nodes       |
| `requires(conditions)`                     | Boolean composition from condition strings      |
| `influencedBy(sources, options?)`          | Eventual-consistency event (emits `influenced`) |
| `triggers(target, effect)`                 | One-way side effect                             |

### `node(definition)`

Helper to define a node with full type inference.

```ts
node({
  initial: 0,
  validate: (v) => v >= 0,
  middleware: [(value, prev) => Math.max(0, value)],
  persist: true,
});
```

### `RuntimeStatespace`

The object returned by `statespace()`.

```ts
space.get<T>(path); // read a value
space.set<T>(path, value); // write and propagate
space.update<T>(path, updater); // functional update
space.subscribe(path, callback); // subscribe to changes (returns unsubscribe)
space.subscribeEvent(type, callback); // subscribe to topology events
space.dependsOn(path); // upstream dependencies
space.affects(path); // downstream dependents
space.updateOrder(path); // topological propagation order
space.getState(); // snapshot of the full state
```

### Topology events

```ts
space.subscribeEvent('influenced', ({ path, sources }) => { ... });
space.subscribeEvent('slow-propagation', ({ path, ms }) => { ... });
space.subscribeEvent('cycle-detected', ({ cycle }) => { ... });
```

### Constraints

```ts
constraints: {
  noCyclesThrough: ['nodeName'],        // throw if a cycle passes through these nodes
  strongConsistency: ['nodeName'],      // reserved for future use
  maxFanout: { nodeName: 5 },           // max downstream dependents
  maxDepth: 10,                         // max propagation depth
}
```

## Propagation rules

- `derives` — recomputes synchronously (or asynchronously via Promise) whenever any dependency changes.
- `requires` — evaluates condition strings like `'total > 0'` and writes a boolean.
- `influencedBy` — emits an `influenced` event without updating state directly.
- `triggers` — calls an effect function; if it returns a value, that value is written to the target node.

Propagation depth is capped at **100 levels** to prevent infinite loops.

## Requirements

- Node.js >= 20

## License

MIT
