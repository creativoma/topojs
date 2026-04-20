import type { Plugin } from 'vite';

export interface TopoPluginOptions {
  visualize?: boolean;
  strictCycles?: boolean;
}

export function topoPlugin(options: TopoPluginOptions = {}): Plugin {
  return {
    name: 'topo-plugin',
    configureServer(server) {
      if (!options.visualize) return;
      server.middlewares.use('/topo', (_req, res) => {
        res.end(
          JSON.stringify({
            name: 'topo-visualizer',
            status: 'alpha',
            strictCycles: options.strictCycles ?? true,
          }),
        );
      });
    },
  };
}
