# @topojs/cli

CLI for [TopoJS](https://github.com/creativoma/topojs) — analyze, visualize, check, optimize, export, and trace statespaces from the terminal.

## Installation

```bash
npm install -g @topojs/cli
# or use without installing
npx @topojs/cli <command> <file>
```

## Requirements

- Node.js >= 20

## Usage

```
topo <command> <store.js> [options]
```

> **Note:** `<file>` must be a compiled JS/MJS file. Build your TypeScript source first (e.g. `tsc` or `tsup`).

## Commands

### `analyze`

Print all nodes and topology edges for every statespace found in the file.

```bash
topo analyze dist/store.js
```

```
Statespace: Cart
────────────────────────────────────────
Nodes:
  items
  discount [persist]
  total
  canCheckout

Topology:
  total ← derives(items, discount)
  canCheckout ← requires(total > 0)

4 nodes, 2 edges
```

### `check`

Validate the statespace — checks for unknown nodes in topology keys, constraint violations, and high-fanout warnings. Exits with code `1` if issues are found.

```bash
topo check dist/store.js
```

### `trace`

Show upstream dependencies, downstream effects, and propagation order for a specific node.

```bash
topo trace dist/store.js total
```

```
Statespace: Cart — trace 'total'
────────────────────────────────────────
Depends on:
  ← items
  ← discount

Affects:
  → canCheckout

Update order:
  1. total
  2. canCheckout
```

### `optimize`

Suggest optimization hints — missing `cache: true` on multi-dependency derivations, high-fanout nodes, and deep propagation chains.

```bash
topo optimize dist/store.js
```

### `export`

Export the graph in a machine-readable format. Supports `json` (default), `mermaid`, and `dot`.

```bash
topo export dist/store.js --format json
topo export dist/store.js --format mermaid
topo export dist/store.js --format dot
```

### `visualize`

Open an interactive force-directed graph visualizer in the browser. Supports zoom, pan, and node dragging. Each edge type is color-coded.

```bash
topo visualize dist/store.js
topo visualize dist/store.js --port 8080
```

Defaults to port `7331`. Press `Ctrl+C` to stop.

## Edge colors in the visualizer

| Color           | Edge type      |
| --------------- | -------------- |
| Blue            | `derives`      |
| Purple (dashed) | `requires`     |
| Green (dotted)  | `influencedBy` |
| Orange          | `triggers`     |

## License

MIT
