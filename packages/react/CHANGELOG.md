# @topojs/react

## 0.2.5

### Patch Changes

- 5eebc9f: Achieve 100% test coverage across cli, core, and react packages.

  Adds targeted unit tests for all edge types, async derives error paths, cycle detection edge cases, prototype-pollution guards, sourceEdges deduplication, and server error handling in visualizeSpace. Adds v8 ignore annotations for unreachable branches (exhaustive union type switches, SSR-only snapshot callbacks, platform-specific openBrowser code).

- Updated dependencies [5eebc9f]
  - @topojs/core@0.2.5

## 0.2.4

### Patch Changes

- a894c6f: Update package descriptions to use "TopoJS" branding consistently.
- Updated dependencies [a894c6f]
  - @topojs/core@0.2.4

## 0.2.3

### Patch Changes

- 8b1d3f2: chore: add default export condition for Webpack 4 compatibility, enable treeshake in tsup builds, add sideEffects false to cli, add peerDependenciesMeta to react
- 8b1d3f2: fix: use Array.isArray guard in useMutation append to prevent spreading non-array truthy values
- Updated dependencies [8b1d3f2]
- Updated dependencies [8b1d3f2]
  - @topojs/core@0.2.3

## 0.2.2

### Patch Changes

- 2dc7c13: chore: updated workflows
- Updated dependencies [2dc7c13]
  - @topojs/core@0.2.2

## 0.2.1

### Patch Changes

- fcfa394: feat: implement dynamic versioning in Header and Hero components
- Updated dependencies [fcfa394]
  - @topojs/core@0.2.1

## 0.2.0

### Minor Changes

- a425b9a: Initial release of @topojs/core, @topojs/react, @topojs/cli, and @topojs/vite.

### Patch Changes

- Updated dependencies [a425b9a]
  - @topojs/core@0.2.0
