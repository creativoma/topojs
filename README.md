<p align="center">
  <img src="public/logo.svg" alt="Topo" width="100%" />
</p>

<p align="center">
  <strong>State management as graph topology, not tree hierarchy.</strong>
</p>

<p align="center">
  <a href="#installation">Installation</a> •
  <a href="#core-concepts">Concepts</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#api-reference">API</a>
</p>

<p align="center">
  <img src="https://img.shields.io/npm/v/@topojs/core?label=version&color=blue" alt="Version" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
  <img src="https://img.shields.io/badge/TypeScript-5.4+-blue" alt="TypeScript" />
  <img src="https://img.shields.io/badge/framework-agnostic-purple" alt="Framework" />
</p>

---

## The Problem

Every state management library assumes state forms a **tree**. But real application state is a **graph**: user data affects cart, cart affects checkout, checkout affects order history, order history affects recommendations which affect what's shown in cart.

When you force a graph into a tree, you get:

- Prop drilling or global state pollution
- Redundant subscriptions and unnecessary re-renders
- Hidden dependencies that cause bugs
- Circular update problems that crash your app

**Topo treats state as what it actually is: a graph with topology.**

```typescript
// ❌ Traditional: Force state into tree hierarchy
// Hidden dependencies, unknown update order, mystery re-renders
const store = create({
  user: { ... },
  cart: { ... },     // Depends on user.membership for discounts
  products: { ... }, // Depends on user.region for availability
  checkout: { ... }, // Depends on cart AND user AND products
});

// ✅ Topo: Explicit graph topology — dependencies are declared, not hidden
import { statespace, node, derives, requires, influencedBy } from '@topojs/core';

const ShoppingApp = statespace('ShoppingApp', {
  nodes: {
    user: node({ initial: { membership: 'free', region: 'US', authenticated: false } }),
    cart: node({ initial: { items: [], discount: 0 } }),
    products: node({ initial: { items: [] } }),
    checkout: node({ initial: { canProceed: false } }),
  },
  topology: {
    'cart.discount': derives(['user.membership'], (membership) =>
      membership === 'premium' ? 0.2 : membership === 'plus' ? 0.1 : 0,
    ),
    'products.available': derives(['user.region'], async (region) => fetchProducts(region)),
    'checkout.canProceed': requires(['cart.items.length > 0', 'user.authenticated']),
    'user.recommendations': influencedBy(['cart.items', 'products.available']),
  },
  constraints: { noCyclesThrough: ['checkout'] },
});
// Dependencies are explicit. Update order is computed. Cycles are detected at runtime.
```

---

## Core Concepts

### State as Topology

In Topo, you define:

1. **Nodes**: Units of state
2. **Edges**: Relationships between nodes
3. **Constraints**: Rules about the topology

```
         ┌──────────┐
         │   User   │
         └────┬─────┘
              │
    ┌─────────┼─────────┐
    │         │         │
    ▼         ▼         ▼
┌──────┐  ┌──────┐  ┌───────┐
│ Cart │  │Prods │  │ Prefs │
└──┬───┘  └──┬───┘  └───┬───┘
   │         │          │
   └────┬────┴──────────┘
        │
        ▼
   ┌──────────┐
   │ Checkout │
   └──────────┘

This is a topology. Topo understands it.
```

### Edge Types

| Edge           | Meaning                        | Update Behavior                   |
| -------------- | ------------------------------ | --------------------------------- |
| `derives`      | A is computed from B           | Sync or async                     |
| `requires`     | A is a boolean gate on B       | Evaluates on dependency change    |
| `influencedBy` | A may update when B changes    | Eventual consistency, emits event |
| `triggers`     | Change in A causes effect on B | One-way, event-based              |

---

## Key Features

| Feature                    | Description                                                     |
| -------------------------- | --------------------------------------------------------------- |
| **Explicit Relationships** | All state dependencies are declared, not hidden                 |
| **Cycle Detection**        | Circular dependencies are caught when the statespace is created |
| **Optimal Updates**        | Update order is computed from the dependency graph              |
| **Minimal Subscriptions**  | Components subscribe to exactly what they need                  |

---

## How Topo Compares

Most state libraries manage **values**. Topo manages **relationships**.

| | Redux | Zustand | Jotai | Recoil | MobX | XState | **Topo** |
|---|---|---|---|---|---|---|---|
| **State model** | Tree | Tree | Atoms | Atoms + selectors | Object graph | FSM | **Directed graph** |
| **Dependencies** | Implicit | Implicit | Atom links | Atom links | Computed props | Transitions | **Explicit edge types** |
| **Cycle detection** | None | None | None | Runtime | None | Built-in (FSM) | **Creation-time DFS** |
| **Update ordering** | Manual reducers | Manual | Atom order | Atom order | Implicit reactivity | Transition-based | **Automatic topo sort** |
| **Async state** | Middleware/thunks | Custom hooks | Suspense/loadables | Loadables | async/await | Built-in | **First-class in `derives`** |
| **Graph introspection** | No | No | No | No | No | States/transitions | **`dependsOn`, `affects`, `updateOrder`** |
| **Constraint system** | No | No | No | No | No | FSM guards | **`noCyclesThrough`, consistency levels** |
| **Dev tooling** | Time-travel debugger | DevTools ext | DevTools ext | Chrome ext | MobX DevTools | XState Viz | **CLI + interactive Vite visualizer** |

### What only Topo does

**Four explicit edge types** — instead of a single "subscribe and compute" pattern, Topo names the _kind_ of relationship:

```
derives       → A is recomputed from B (sync or async)
requires      → A is a boolean gate; guards other operations
influencedBy  → A may update eventually when B changes (fires event, no auto-set)
triggers      → change in A executes a side effect on B
```

**Cycle detection at creation time** — the statespace constructor runs a DFS over the declared topology. A cycle throws immediately, before any user interaction, not when a user action happens to trigger the loop.

**`noCyclesThrough` constraint** — cycles can be allowed in low-risk parts of the graph while strictly forbidding them through critical nodes like `checkout` or `orders`.

**Topology as queryable metadata** — every `RuntimeStatespace` exposes `dependsOn(path)`, `affects(path)`, and `updateOrder(path)`. Components can read the graph structure at runtime, and the CLI can analyze or export it.

---

## Installation

```bash
# npm
npm install @topojs/core @topojs/react

# yarn
yarn add @topojs/core @topojs/react

# pnpm
pnpm add @topojs/core @topojs/react
```

### Vite Plugin (Optional)

```typescript
// vite.config.ts
import { topoPlugin } from '@topojs/vite';

export default {
  plugins: [
    topoPlugin({
      visualize: true, // Exposes a /topo endpoint in dev mode
      strictCycles: true,
    }),
  ],
};
```

---

## Quick Start

### 1. Define a Statespace

```typescript
// state/app.topo.ts
import { statespace, node, derives, requires, influencedBy } from '@topojs/core';

export const AppStatespace = statespace('ShoppingApp', {
  // Define state nodes
  nodes: {
    user: node<UserState>({
      initial: { authenticated: false, membership: 'free', region: 'US' },
    }),

    cart: node<CartState>({
      initial: { items: [], discount: 0 },
    }),

    products: node<ProductsState>({
      initial: { items: [], filters: {} },
    }),

    checkout: node<CheckoutState>({
      initial: { step: 'cart', canProceed: false },
    }),
  },

  // Define topology (relationships between nodes)
  topology: {
    // Cart discount is derived from user membership
    'cart.discount': derives(['user.membership'], (membership) => {
      if (membership === 'premium') return 0.2;
      if (membership === 'plus') return 0.1;
      return 0;
    }),

    // Product availability depends on user region
    'products.available': derives(['user.region'], async (region) => {
      return await fetchAvailableProducts(region);
    }),

    // Checkout can only proceed if cart is valid AND user is authenticated
    'checkout.canProceed': requires(['cart.items.length > 0', 'user.authenticated']),

    // Recommendations are influenced by history
    'user.recommendations': influencedBy(['cart.history', 'products.viewed']),
  },

  // Define constraints
  constraints: {
    // Checkout must not be in any cycles
    noCyclesThrough: ['checkout'],
  },
});
```

### 2. Use in React Components

```tsx
// components/Cart.tsx
import { useNode, useTopology } from '@topojs/react';
import { AppStatespace } from '../state/app.topo';

function Cart() {
  // Subscribe to specific node
  const cart = useNode(AppStatespace, 'cart');

  // Access derived values (automatically subscribed to dependencies)
  const discount = useNode(AppStatespace, 'cart.discount');

  // Access topology metadata
  const { dependsOn, affects } = useTopology(AppStatespace, 'cart');

  return (
    <div>
      <h2>Your Cart</h2>
      {cart.items.map((item) => (
        <CartItem key={item.id} item={item} />
      ))}

      {discount > 0 && <DiscountBadge amount={discount} />}

      <CartTotal items={cart.items} discount={discount} />
    </div>
  );
}
```

### 3. Mutate State

```tsx
// components/AddToCart.tsx
import { useMutation } from '@topojs/react';
import { AppStatespace } from '../state/app.topo';

function AddToCart({ product }) {
  const addItem = useMutation(AppStatespace, 'cart.items');
  // Topo automatically propagates to derived values (cart.discount),
  // dependent nodes (checkout.canProceed), and influenced nodes (user.recommendations).

  return <button onClick={() => addItem.append(product)}>Add to Cart</button>;
}
```

---

## API Reference

### Statespace Definition

```typescript
statespace(name: string, {
  nodes: {
    [name: string]: NodeDefinition<T>;
  };

  topology: {
    [path: string]: EdgeDefinition;
  };

  constraints?: {
    noCyclesThrough?: string[];
  };
});
```

### Node Definition

```typescript
node<T>({
  initial: T;                           // Initial value
  validate?: (value: T) => boolean;     // Validation function — throws on failure
  middleware?: Middleware<T>[];         // Transform value before it is stored
});
```

### Edge Definitions

```typescript
// Synchronous derivation
derives(
  dependencies: string[],
  compute: (...deps) => T,
  options?: { cache?: boolean }
)

// Async derivation
derives(
  dependencies: string[],
  compute: async (...deps) => T,
  options?: { loading?: T, error?: (e) => T }
)

// Requirement (boolean composition)
requires(
  conditions: string[],  // Can include expressions: 'cart.items.length > 0'
)

// Eventual consistency — emits 'influenced' event, does not set value
influencedBy(
  sources: string[],
)

// Event trigger
triggers(
  target: string,
  effect: (value: unknown, state: unknown) => unknown,
)
```

### React Hooks

```typescript
// Subscribe to a node
const value = useNode(statespace, 'path.to.node');

// Subscribe to multiple nodes
const [user, cart] = useNodes(statespace, ['user', 'cart']);

// Get topology info
const { dependsOn, affects, updateOrder } = useTopology(statespace, 'node');

// Mutate state
const mutation = useMutation(statespace, 'path');
mutation.set(value);
mutation.update((prev) => next);
mutation.append(item); // For arrays

// Subscribe to topology events
useTopologyEvent(statespace, 'influenced', handler); // influencedBy edge fired
useTopologyEvent(statespace, 'slow-propagation', handler); // propagation > 16ms
```

### CLI Commands

```bash
topo analyze              # Analyze statespace topology
topo visualize            # Open interactive visualizer
topo check                # Validate constraints
topo optimize             # Suggest optimizations
topo export               # Export topology graph
topo trace <path>         # Trace updates through topology
```

---

## Examples

### E-commerce State Topology

```typescript
export const EcommerceStatespace = statespace('Ecommerce', {
  nodes: {
    user: node<UserState>({ initial: defaultUser }),
    catalog: node<CatalogState>({ initial: { products: [], loading: true } }),
    cart: node<CartState>({ initial: { items: [], coupon: null } }),
    wishlist: node<WishlistState>({ initial: { items: [] } }),
    checkout: node<CheckoutState>({ initial: { step: 'cart', shipping: null, payment: null } }),
    orders: node<OrdersState>({ initial: { history: [], current: null } }),
  },

  topology: {
    // Catalog availability based on user location
    'catalog.available': derives(['user.location'], async (location) => {
      return await fetchCatalog({ region: location.region });
    }),

    // Cart total with taxes based on location
    'cart.total': derives(['cart.items', 'user.location'], (items, location) => {
      const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
      const tax = calculateTax(subtotal, location);
      return { subtotal, tax, total: subtotal + tax };
    }),

    // Apply coupon discount
    'cart.finalTotal': derives(['cart.total', 'cart.coupon'], (total, coupon) => {
      if (!coupon) return total.total;
      return total.total * (1 - coupon.discount);
    }),

    // Checkout availability
    'checkout.canProceed': requires([
      'cart.items.length > 0',
      'user.authenticated',
      'cart.finalTotal > 0',
    ]),

    // Shipping options based on cart and location
    'checkout.shippingOptions': derives(
      ['cart.items', 'user.location'],
      async (items, location) => {
        return await fetchShippingOptions(items, location);
      },
    ),

    // Recommendations influenced by behavior
    'user.recommendations': influencedBy([
      'cart.items',
      'wishlist.items',
      'orders.history',
      'catalog.viewed',
    ]),

    // Order completion triggers history update
    'checkout.complete': triggers('orders.history', (order, currentState) => {
      const { orders } = currentState as { orders: OrdersState };
      return [...orders.history, order];
    }),
  },

  constraints: {
    noCyclesThrough: ['checkout', 'orders'],
  },
});
```

### Real-Time Collaboration State

```typescript
export const CollabStatespace = statespace('Collaboration', {
  nodes: {
    document: node<DocumentState>({ initial: { content: '', version: 0 } }),
    presence: node<PresenceState>({ initial: { users: [] } }),
    cursors: node<CursorsState>({ initial: {} }),
    selections: node<SelectionsState>({ initial: {} }),
    comments: node<CommentsState>({ initial: [] }),
    history: node<HistoryState>({ initial: { undo: [], redo: [] } }),
  },

  topology: {
    // Selections depend on document content
    'selections.valid': derives(['document.content', 'selections.ranges'], (content, ranges) => {
      return ranges.filter((r) => r.end <= content.length);
    }),

    // Comments anchored to document positions
    'comments.positioned': derives(['document.content', 'comments.raw'], (content, comments) => {
      return comments.map((c) => resolvePosition(c, content));
    }),

    // Presence broadcasts on any user action
    'presence.update': influencedBy(['cursors.*', 'selections.*']),

    // History tracking
    'document.change': triggers('history.undo', (change, currentState) => {
      const { history } = currentState as { history: HistoryState };
      return [...history.undo, change];
    }),
  },

  constraints: {
    noCyclesThrough: ['document'],
  },
});
```

---

## FAQ

**Q: How is this different from Redux / Zustand / Jotai?**

Those libraries manage state values. Topo manages state _topology_—the relationships between state nodes. You can even use Topo to describe the topology and use another library for the actual state storage.

**Q: What about performance?**

Topo's topology analysis happens at runtime when the statespace is created. Runtime is a lightweight subscription system with optimal update ordering. Often faster than manual solutions because it eliminates redundant updates.

**Q: Can I migrate incrementally?**

Yes. Start by wrapping your existing state in Topo nodes without topology. Add edges incrementally as you understand your dependencies.

**Q: What if my state doesn't have clear nodes?**

If your state is truly a blob, you have a design problem, not a library problem. Topo encourages thinking about state boundaries—which leads to better architecture.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

```bash
git clone https://github.com/creativoma/topojs
cd topojs
pnpm install
pnpm test
```

---

## License

MIT © 2026 Topo Contributors

---

<p align="center">
  <strong>State is a graph. Treat it like one.</strong>
</p>
