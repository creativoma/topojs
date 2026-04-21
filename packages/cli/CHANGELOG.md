# @topojs/cli

## 0.4.0

### Minor Changes

- a894c6f: Add `visualize` command with interactive canvas-based graph visualizer served over HTTP. Supports `--port` option (default 7331). Renders nodes and edges with force-directed layout, pan/zoom, and per-edge-kind color coding.

## 0.3.0

### Minor Changes

- 944fc1f: Implement real CLI commands — analyze, check, trace, optimize, and export now load actual statespace files (compiled JS/MJS) and introspect the graph. The `run` function is now async. Adds `--format json|dot|mermaid` support for `export`.

## 0.2.3

### Patch Changes

- 8b1d3f2: chore: add default export condition for Webpack 4 compatibility, enable treeshake in tsup builds, add sideEffects false to cli, add peerDependenciesMeta to react

## 0.2.2

### Patch Changes

- 2dc7c13: chore: updated workflows

## 0.2.1

### Patch Changes

- fcfa394: feat: implement dynamic versioning in Header and Hero components

## 0.2.0

### Minor Changes

- a425b9a: Initial release of @topojs/core, @topojs/react, @topojs/cli, and @topojs/vite.
