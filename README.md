<p align="center">
  <img src="public/logo.svg" alt="TopoJS" width="100%" />
</p>

<p align="center">
  <strong>State management as graph topology, not tree hierarchy.</strong>
</p>

<p align="center">
  <a href="#installation">Installation</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#how-topojs-compares">Comparison</a> •
  <a href="#packages">Packages</a>
</p>

<p align="center">
  <img src="https://img.shields.io/npm/v/@topojs/core?label=version&color=blue" alt="Version" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
  <img src="https://img.shields.io/badge/TypeScript-5.4+-blue" alt="TypeScript" />
  <img src="https://img.shields.io/badge/framework-agnostic-purple" alt="Framework" />
</p>

---

Real application state is a **graph**: user data affects cart, cart affects checkout, checkout affects orders. Most libraries force that graph into a tree — so you end up with implicit dependencies, mystery re-renders, and cycles you only discover at runtime.

**TopoJS models state as what it actually is.** You declare nodes, the edges between them, and the _kind_ of relationship each edge represents. The runtime computes update order, detects cycles at creation time, and propagates changes automatically.

```ts
import { statespace, node, derives, requires, influencedBy } from '@topojs/core';

const Cart = statespace('Cart', {
  nodes: {
    user: node({ initial: { membership: 'free', authenticated: false } }),
    items: node({ initial: [] }),
    discount: node({ initial: 0 }),
    total: node({ initial: 0 }),
    canCheckout: node({ initial: false }),
  },
  topology: {
    discount: derives(['user.membership'], (m) => (m === 'premium' ? 0.2 : 0)),
    total: derives(['items', 'discount'], (items, d) => sum(items) * (1 - d)),
    canCheckout: requires(['total > 0', 'user.authenticated']),
    'user.recommendations': influencedBy(['items']),
  },
  constraints: { noCyclesThrough: ['total'] },
});
```

---

## How TopoJS Compares

### vs. Jotai / Recoil (atom-based)

**What they share:** reactive primitives, derived values, React integration via `useSyncExternalStore`.

**What TopoJS adds:**

- **Named edge types** — instead of "atom depends on atom", you say _how_: `derives` (computed value), `requires` (boolean gate), `influencedBy` (eventual consistency), `triggers` (side effect). The relationship is first-class, not implicit.
- **Cycle detection at creation time** — Jotai and Recoil have no cycle detection; infinite loops surface at runtime. TopoJS runs a DFS when the statespace is created and throws before any user interaction.
- **`noCyclesThrough` constraint** — you can allow cycles in low-risk parts of the graph while strictly guarding critical nodes like `checkout` or `orders`.
- **Graph introspection** — `space.dependsOn(path)`, `space.affects(path)`, `space.updateOrder(path)` are queryable at runtime. Atoms have no structural API.

### vs. Zustand / Redux (store-based)

**What they share:** a single source of truth, subscription model, TypeScript support.

**What TopoJS adds:**

- **Automatic propagation** — you don't write reducers or selectors manually. Declare the topology once; the runtime handles update order and derived values.
- **Async derivations as first-class edges** — `derives` accepts a `Promise`-returning function with `loading` and `error` options. No middleware, no thunks.
- **Structural tooling** — the `topo` CLI can analyze, validate, trace, and visualize any statespace without touching the app.

### vs. MobX (reactive OOP)

**What they share:** automatic reactivity, computed values, subscriptions without manual wiring.

**What TopoJS adds:**

- **Explicit, typed edges** — MobX reactivity is implicit and scattered across class decorators. In TopoJS, all relationships live in one `topology` record that you can read, export, and analyze.
- **Constraint system** — MobX has no concept of `noCyclesThrough` or `maxFanout`. TopoJS constraints are part of the statespace definition and enforced at runtime.

---

## Quick Start

```bash
npm install @topojs/core @topojs/react
```

```tsx
// store.ts
import { statespace, node, derives, requires } from '@topojs/core';

export const CartSpace = statespace('Cart', {
  nodes: {
    items: node({ initial: [] as number[] }),
    discount: node({ initial: 0 }),
    total: node({ initial: 0 }),
    canCheckout: node({ initial: false }),
  },
  topology: {
    total: derives(
      ['items', 'discount'],
      (items, d) => (items as number[]).reduce((a, b) => a + b, 0) * (1 - (d as number)),
    ),
    canCheckout: requires(['total > 0']),
  },
});

// Cart.tsx
import { useNode, useMutation } from '@topojs/react';
import { CartSpace } from './store';

export function Cart() {
  const total = useNode<number>(CartSpace, 'total');
  const canCheckout = useNode<boolean>(CartSpace, 'canCheckout');
  const { append } = useMutation(CartSpace, 'items');

  return (
    <div>
      <p>Total: {total}</p>
      <button disabled={!canCheckout}>Checkout</button>
      <button onClick={() => append(10)}>Add item ($10)</button>
    </div>
  );
}
```

---

## Packages

| Package                                        | npm             | Description                                                             |
| ---------------------------------------------- | --------------- | ----------------------------------------------------------------------- |
| [`packages/core`](packages/core)               | `@topojs/core`  | Runtime engine — statespace, nodes, edges, cycle detection, propagation |
| [`packages/react`](packages/react)             | `@topojs/react` | React hooks — `useNode`, `useNodes`, `useMutation`, `useTopology`       |
| [`packages/cli`](packages/cli)                 | `@topojs/cli`   | CLI — analyze, visualize, check, optimize, export, trace                |
| [`packages/vite-plugin`](packages/vite-plugin) | `@topojs/vite`  | Vite plugin with `/topo` visualizer middleware                          |

Each package has its own README with full API documentation.

---

## CLI

```bash
npx @topojs/cli analyze   dist/store.js   # print nodes and topology
npx @topojs/cli check     dist/store.js   # validate constraints
npx @topojs/cli trace     dist/store.js total  # trace propagation for a node
npx @topojs/cli visualize dist/store.js   # open interactive graph in browser
npx @topojs/cli export    dist/store.js --format mermaid
```

---

## Contributing

```bash
git clone https://github.com/creativoma/topojs
cd topojs
pnpm install
pnpm test
```

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

MIT © 2026 TopoJS Contributors

---

<p align="center">
  <strong>State is a graph. Treat it like one.</strong>
</p>
