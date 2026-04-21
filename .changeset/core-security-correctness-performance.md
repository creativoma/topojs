---
'@topojs/core': patch
---

fix: add prototype pollution guard to getByPath, fix notify to propagate intermediate path segments, pre-compute source-to-edges map for O(affected) propagation, tighten TriggersEdge effect state type
