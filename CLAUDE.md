# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
pnpm install

# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests for a single package
pnpm --filter @topojs/core test
pnpm --filter @topojs/react test
pnpm --filter @topojs/cli test
pnpm --filter @topojs/vite test

# Run a single test file directly
pnpm --filter @topojs/core exec vitest run tests/core.test.ts

# Build all packages
pnpm build

# Type-check all packages
pnpm typecheck

# Lint
pnpm lint

# Format
pnpm format
pnpm format:check

# Run the cart example app
pnpm example
```

## Architecture

Topo is a pnpm monorepo that implements graph-topology state management for TypeScript/React. State is modeled as a directed graph (nodes + edges) rather than a tree, with explicit dependency declarations and automatic propagation.

### Packages

| Package                | npm name               | Purpose                                                                 |
| ---------------------- | ---------------------- | ----------------------------------------------------------------------- |
| `packages/core`        | `@topojs/core`         | Runtime engine — statespace, nodes, edges, cycle detection, propagation |
| `packages/react`       | `@topojs/react`        | React hooks built on `useSyncExternalStore`                             |
| `packages/cli`         | `@topojs/cli`          | `topo` CLI binary (analyze, visualize, check, optimize, export, trace)  |
| `packages/vite-plugin` | `@topojs/vite`         | Vite plugin with optional `/topo` visualizer middleware                 |
| `examples/cart`        | `@topojs/example-cart` | Working Vite+React demo showing the cart statespace                     |

### Core runtime (`packages/core/src/index.ts`)

The entire runtime is a single file. Key internals:

- **`statespace(name, definition)`** — creates a `RuntimeStatespace`. Initializes state from `nodes`, builds a dependency graph, runs cycle detection, then returns a runtime object with `get/set/update/subscribe/subscribeEvent`.
- **`set(path, value)`** — the central propagation engine. After writing the value it iterates `topology` and recursively updates downstream edges (`derives` → sync or async recompute, `requires` → boolean eval, `influenced_by` → emits `influenced` event, `triggers` → calls effect function). Propagation depth is capped at 100.
- **`buildGraph`** — converts the `topology` record into a `Map<string, Set<string>>` adjacency list used for cycle detection and `affects`/`updateOrder` introspection.
- **`detectCycle`** — DFS that returns the cycle path or `null`. If a cycle is found, it only throws when `noCyclesThrough` constraint names a node in that cycle.
- **`setByPath`** / **`getByPath`** — dot-path accessors with prototype-pollution guards.
- **`evalCondition`** — evaluates `requires` condition strings (supports `>`, `<`, `>=`, `<=`, `==`, `===`, `!=`, `!==`).

### Edge types

All four edge constructors live in `@topojs/core`:

```ts
derives(dependencies, compute, options?)   // sync or async derivation
requires(conditions)                        // boolean composition
influencedBy(sources, options?)             // eventual-consistency event (camelCase, not influenced_by)
triggers(target, effect)                    // one-way effect
```

> **Note:** The export is `influencedBy` (camelCase). The README DSL shows `influenced_by` as aspirational syntax — use `influencedBy` in actual TypeScript code.

### React hooks (`packages/react/src/index.ts`)

All hooks accept a `RuntimeStatespace` as the first argument.

| Hook                                      | Description                                                |
| ----------------------------------------- | ---------------------------------------------------------- |
| `useNode(space, path)`                    | Single node subscription via `useSyncExternalStore`        |
| `useNodes(space, paths)`                  | Multi-node subscription with stable reference via `useRef` |
| `useTopology(space, path)`                | Memoized `{ dependsOn, affects, updateOrder }`             |
| `useMutation(space, path)`                | Memoized `{ set, update, append }` — no options parameter  |
| `useTopologyEvent(space, event, handler)` | Subscribes to topology events, cleans up on unmount        |

### TypeScript / build

- `tsconfig.base.json` maps `@topojs/*` paths to source files — used by tests and the root typecheck.
- Each package builds with `tsup`; core and react emit both ESM (`index.js`) and CJS (`index.cjs`); cli and vite-plugin emit ESM only.
- Vitest workspace at `vitest.workspace.ts` includes core, react, cli, and vite-plugin configs. React tests run under `jsdom`.
- `verbatimModuleSyntax: true` — always use `import type` for type-only imports.

### Statespace pattern

The standard usage pattern seen in `examples/cart/src/store.ts`:

```ts
import { derives, node, requires, statespace } from '@topojs/core';

export const MySpace = statespace('Name', {
  nodes: { /* NodeDefinition<T> per key */ },
  topology: { /* 'node.path': EdgeDefinition */ },
  constraints: { noCyclesThrough: [...], strongConsistency: [...] },
});
```

The `RuntimeStatespace` object is typically created once (module-level singleton) and passed directly into hooks.
