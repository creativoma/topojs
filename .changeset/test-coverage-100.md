---
'@topojs/cli': patch
'@topojs/core': patch
'@topojs/react': patch
---

Achieve 100% test coverage across cli, core, and react packages.

Adds targeted unit tests for all edge types, async derives error paths, cycle detection edge cases, prototype-pollution guards, sourceEdges deduplication, and server error handling in visualizeSpace. Adds v8 ignore annotations for unreachable branches (exhaustive union type switches, SSR-only snapshot callbacks, platform-specific openBrowser code).
