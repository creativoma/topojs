# @topojs/vite

Vite plugin for [TopoJS](https://github.com/creativoma/topojs) — topology visualizer middleware and cycle detection at dev time.

## Installation

```bash
npm install -D @topojs/vite
```

## Requirements

- Vite >= 5
- Node.js >= 20

## Usage

Add the plugin to your `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import { topoPlugin } from '@topojs/vite';

export default defineConfig({
  plugins: [
    topoPlugin({
      visualize: true,
      strictCycles: true,
    }),
  ],
});
```

## Options

| Option         | Type      | Default | Description                                         |
| -------------- | --------- | ------- | --------------------------------------------------- |
| `visualize`    | `boolean` | `false` | Mount the `/topo` status endpoint in the dev server |
| `strictCycles` | `boolean` | `true`  | Enable strict cycle enforcement                     |

## Dev server endpoint

When `visualize: true`, the plugin mounts a `/topo` route in the Vite dev server that returns a JSON status response:

```json
{
  "name": "topo-visualizer",
  "status": "stable",
  "strictCycles": true
}
```

For a full interactive graph visualizer, use the [`@topojs/cli`](../cli) `visualize` command.

## License

MIT
