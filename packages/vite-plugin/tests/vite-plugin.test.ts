import { describe, expect, it, vi } from 'vitest';
import { topoPlugin } from '../src/index';

type MiddlewareHandler = (req: unknown, res: { end: (data: string) => void }) => void;

function makeMockServer() {
  const routes: Array<{ path: string; handler: MiddlewareHandler }> = [];
  return {
    server: {
      middlewares: {
        use: (path: string, handler: MiddlewareHandler) => {
          routes.push({ path, handler });
        },
      },
    },
    routes,
  };
}

describe('topoPlugin', () => {
  it('returns a plugin with name topo-plugin', () => {
    const plugin = topoPlugin();
    expect(plugin.name).toBe('topo-plugin');
  });

  it('does not register middleware when visualize is omitted (default)', () => {
    const { server, routes } = makeMockServer();
    const plugin = topoPlugin();
    (plugin.configureServer as (s: typeof server) => void)?.(server);
    expect(routes).toHaveLength(0);
  });

  it('does not register middleware when visualize is explicitly false', () => {
    const { server, routes } = makeMockServer();
    const plugin = topoPlugin({ visualize: false });
    (plugin.configureServer as (s: typeof server) => void)?.(server);
    expect(routes).toHaveLength(0);
  });

  it('registers /topo middleware when visualize is true', () => {
    const { server, routes } = makeMockServer();
    const plugin = topoPlugin({ visualize: true });
    (plugin.configureServer as (s: typeof server) => void)?.(server);
    expect(routes).toHaveLength(1);
    expect(routes[0]?.path).toBe('/topo');
  });

  it('/topo responds with JSON including name and status', () => {
    const { server, routes } = makeMockServer();
    const plugin = topoPlugin({ visualize: true });
    (plugin.configureServer as (s: typeof server) => void)?.(server);

    const end = vi.fn();
    routes[0]?.handler(undefined, { end });
    const parsed = JSON.parse(end.mock.calls[0]?.[0] as string) as Record<string, unknown>;
    expect(parsed['name']).toBe('topo-visualizer');
    expect(parsed['status']).toBe('stable');
  });

  it('strictCycles defaults to true in the response', () => {
    const { server, routes } = makeMockServer();
    const plugin = topoPlugin({ visualize: true });
    (plugin.configureServer as (s: typeof server) => void)?.(server);

    const end = vi.fn();
    routes[0]?.handler(undefined, { end });
    const parsed = JSON.parse(end.mock.calls[0]?.[0] as string) as Record<string, unknown>;
    expect(parsed['strictCycles']).toBe(true);
  });

  it('strictCycles: false is reflected in the response', () => {
    const { server, routes } = makeMockServer();
    const plugin = topoPlugin({ visualize: true, strictCycles: false });
    (plugin.configureServer as (s: typeof server) => void)?.(server);

    const end = vi.fn();
    routes[0]?.handler(undefined, { end });
    const parsed = JSON.parse(end.mock.calls[0]?.[0] as string) as Record<string, unknown>;
    expect(parsed['strictCycles']).toBe(false);
  });

  it('strictCycles: true is reflected in the response', () => {
    const { server, routes } = makeMockServer();
    const plugin = topoPlugin({ visualize: true, strictCycles: true });
    (plugin.configureServer as (s: typeof server) => void)?.(server);

    const end = vi.fn();
    routes[0]?.handler(undefined, { end });
    const parsed = JSON.parse(end.mock.calls[0]?.[0] as string) as Record<string, unknown>;
    expect(parsed['strictCycles']).toBe(true);
  });
});
