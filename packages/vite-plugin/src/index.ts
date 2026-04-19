export interface TopoPluginOptions {
  visualize?: boolean;
  strictCycles?: boolean;
}

export function topoPlugin(options: TopoPluginOptions = {}) {
  return {
    name: 'topo-plugin',
    configureServer(server: {
      middlewares: { use: (path: string, handler: (req: unknown, res: { end: (body: string) => void }) => void) => void };
    }) {
      if (!options.visualize) return;
      server.middlewares.use('/topo', (_req, res) => {
        res.end(
          JSON.stringify({
            name: 'topo-visualizer',
            status: 'alpha',
            strictCycles: options.strictCycles ?? true
          })
        );
      });
    }
  };
}
