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
  <a href="#api-reference">API</a> •
  <a href="#roadmap">Roadmap</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.0--alpha-blue" alt="Version" />
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

// ✅ Topo: Explicit graph topology
statespace ShoppingApp {
  nodes {
    user: UserState
    cart: CartState
    products: ProductsState
    checkout: CheckoutState
  }

  topology {
    cart.discount <- derives(user.membership)
    products.available <- derives(user.region)
    checkout.canProceed <- requires(cart.valid, user.authenticated)
    user.recommendations <- influencedBy(cart.history, products.viewed)
  }
}
// Compiler analyzes the graph: no cycles, optimal update order, minimal subscriptions
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

### Topology Constraints

```typescript
constraints {
  // Prevent circular dependencies
  no_cycles_through(checkout)

  // Define consistency requirements
  strong_consistency(cart.total)       // Always up-to-date
  eventual_consistency(recommendations) // Can lag

  // Performance boundaries
  max_fanout(user, 5)  // User can affect max 5 other nodes
  max_depth(3)         // Max 3 hops from any source
}
```

---

## Key Features

| Feature                    | Description                                          |
| -------------------------- | ---------------------------------------------------- |
| **Explicit Relationships** | All state dependencies are declared, not hidden      |
| **Cycle Detection**        | Compiler catches circular dependencies at build time |
| **Optimal Updates**        | System computes ideal update order                   |
| **Minimal Subscriptions**  | Components subscribe to exactly what they need       |
| **Topology Visualization** | See your state graph in real-time                    |
| **Consistency Modes**      | Choose strong or eventual consistency per edge       |

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
      visualize: true, // Enable topology visualizer at /topo
      strictCycles: true, // Fail on any cycles
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
    // Each node has a type and initial state
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

    // Recommendations are influenced by history (eventual consistency OK)
    'user.recommendations': influencedBy(['cart.history', 'products.viewed'], {
      debounce: '500ms',
    }),
  },

  // Define constraints
  constraints: {
    // Checkout must not be in any cycles
    noCyclesThrough: ['checkout'],

    // Cart total must always be correct (strong consistency)
    strongConsistency: ['cart.total'],

    // Recommendations can lag (eventual consistency)
    eventualConsistency: ['user.recommendations'],
  },
});
```

### 2. Compile and Analyze

```bash
$ npx topo analyze

Analyzing ShoppingApp statespace...

Topology:
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│    user ─────────────┬────────────────┬──────────────────┐      │
│     │                │                │                  │      │
│     │ membership     │ region         │ authenticated    │      │
│     ▼                ▼                │                  │      │
│  cart.discount    products.available │                  │      │
│     │                │                │                  │      │
│     └────────────────┴────────────────┘                  │      │
│                      │                                   │      │
│                      ▼                                   │      │
│             checkout.canProceed ◄────────────────────────┘      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

Analysis:
  ✓ No cycles detected
  ✓ All constraints satisfied
  ✓ Strong consistency paths validated

Optimizations applied:
  • cart.discount: cached (changes only when user.membership changes)
  • products.available: async with loading state
  • checkout.canProceed: batched evaluation

Subscription graph generated: 4 nodes, 6 edges
```

### 3. Use in React Components

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

### 4. Mutate State

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

## Topology Visualization

Topo includes a real-time visualizer for development:

```bash
# Start dev server with visualizer
npx topo dev --visualize

# Open http://localhost:3001/topo
```

The visualizer shows:

- **Node graph** with current values
- **Edge highlighting** when updates propagate
- **Update order** animation
- **Bottleneck detection** (nodes with high fanout)
- **Cycle warnings** in real-time

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
    strongConsistency?: string[];
    eventualConsistency?: string[];
    maxFanout?: { [node: string]: number };
    maxDepth?: number;
  };
});
```

### Node Definition

```typescript
node<T>({
  initial: T;                           // Initial value
  persist?: boolean | PersistConfig;    // Persistence configuration
  validate?: (value: T) => boolean;     // Validation function
  middleware?: Middleware<T>[];         // Update middleware
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

// Eventual consistency
influencedBy(
  sources: string[],
  options?: { debounce?: string; throttle?: string }
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
useTopologyEvent(statespace, 'cycle-detected', handler);
useTopologyEvent(statespace, 'slow-propagation', handler);
```

### CLI Commands

```bash
topo analyze              # Analyze statespace topology
topo visualize            # Open interactive visualizer
topo check                # Validate constraints
topo optimize             # Suggest optimizations
topo export               # Export topology graph (DOT, JSON, Mermaid)
topo trace <path>         # Trace updates through topology
```

---

## Configuration

`defineConfig` is a typed helper for future config files — it returns its argument as-is:

```typescript
// topo.config.ts
import { defineConfig } from '@topojs/core';

export default defineConfig({
  // Config options are planned for Beta — see Roadmap
});
```

> Full configuration support (analysis rules, persistence, devtools, visualization options) is planned for the Beta release.

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
    'user.recommendations': influencedBy(
      ['cart.items', 'wishlist.items', 'orders.history', 'catalog.viewed'],
      { debounce: '1s' },
    ),

    // Order completion triggers history update
    'checkout.complete': triggers('orders.history', (order) => {
      return [...state.orders.history, order];
    }),
  },

  constraints: {
    noCyclesThrough: ['checkout', 'orders'],
    strongConsistency: ['cart.total', 'cart.finalTotal'],
    eventualConsistency: ['user.recommendations'],
    maxFanout: { user: 6 },
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
    'presence.update': influencedBy(['cursors.*', 'selections.*'], { throttle: '50ms' }),

    // History tracking
    'document.change': triggers('history.undo', (change) => {
      return [...state.history.undo, change.previous];
    }),
  },

  constraints: {
    strongConsistency: ['document.content', 'document.version'],
    eventualConsistency: ['presence', 'cursors', 'comments.positioned'],
    maxDepth: 2, // Keep update chains short for real-time
  },
});
```

---

## Roadmap

| Phase      | Status     | Features                                            |
| ---------- | ---------- | --------------------------------------------------- |
| **Alpha**  | 🟢 Current | Core topology, React bindings, basic visualizer     |
| **Beta**   | 🟡 Q2 2026 | DevTools extension, persistence, Vue/Svelte support |
| **1.0**    | ⚪ Q4 2026 | Production optimizations, multi-tab sync, SSR       |
| **Future** | ⚪ 2027+   | Distributed state, topology migrations, AI analysis |

---

## FAQ

**Q: How is this different from Redux / Zustand / Jotai?**

Those libraries manage state values. Topo manages state _topology_—the relationships between state nodes. You can even use Topo to describe the topology and use another library for the actual state storage.

**Q: What about performance?**

Topo's topology analysis happens at build time. Runtime is a lightweight subscription system with optimal update ordering. Often faster than manual solutions because it eliminates redundant updates.

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
