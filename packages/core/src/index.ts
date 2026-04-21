export type Primitive = string | number | boolean | null | undefined;

export interface PersistConfig {
  adapter?: 'localStorage' | 'indexedDB' | 'custom';
  key?: string;
}

export type Middleware<T> = (value: T, previous: T) => T;

export interface NodeDefinition<T> {
  initial: T;
  persist?: boolean | PersistConfig;
  validate?: (value: T) => boolean;
  middleware?: Middleware<T>[];
}

export interface DerivesEdge<T = unknown> {
  kind: 'derives';
  dependencies: string[];
  compute: (...deps: unknown[]) => T | Promise<T>;
  options?: { cache?: boolean; loading?: T; error?: (e: unknown) => T };
}

export interface RequiresEdge {
  kind: 'requires';
  conditions: string[];
}

export interface InfluencedByEdge {
  kind: 'influenced_by';
  sources: string[];
  options?: { debounce?: string; throttle?: string };
}

export interface TriggersEdge {
  kind: 'triggers';
  target: string;
  effect: (value: unknown, state: Record<string, unknown>) => unknown;
}

export type EdgeDefinition = DerivesEdge | RequiresEdge | InfluencedByEdge | TriggersEdge;

export interface Constraints {
  noCyclesThrough?: string[];
  strongConsistency?: string[];
  eventualConsistency?: string[];
  maxFanout?: Record<string, number>;
  maxDepth?: number;
}

export interface StatespaceDefinition {
  nodes: Record<string, NodeDefinition<unknown>>;
  topology: Record<string, EdgeDefinition>;
  constraints?: Constraints;
}

export interface TopologyEventMap {
  'cycle-detected': { cycle: string[] };
  'slow-propagation': { path: string; ms: number };
  influenced: { path: string; sources: string[] };
}

export interface RuntimeStatespace {
  name: string;
  definition: StatespaceDefinition;
  get<T>(path: string): T;
  set<T>(path: string, value: T): void;
  update<T>(path: string, updater: (prev: T) => T): void;
  subscribe(path: string, callback: () => void): () => void;
  subscribeEvent<K extends keyof TopologyEventMap>(
    type: K,
    callback: (payload: TopologyEventMap[K]) => void,
  ): () => void;
  dependsOn(path: string): string[];
  affects(path: string): string[];
  updateOrder(path: string): string[];
  getState(): Record<string, unknown>;
}

const RESERVED = new Set(['true', 'false', 'null', 'undefined']);
const MAX_PROPAGATION_DEPTH = 100;

export function node<T>(definition: NodeDefinition<T>): NodeDefinition<T> {
  return definition;
}

export function derives<T>(
  dependencies: string[],
  compute: (...deps: unknown[]) => T | Promise<T>,
  options?: DerivesEdge<T>['options'],
): DerivesEdge<T> {
  return { kind: 'derives', dependencies, compute, options };
}

export function requires(conditions: string[]): RequiresEdge {
  return { kind: 'requires', conditions };
}

export function influencedBy(
  sources: string[],
  options?: InfluencedByEdge['options'],
): InfluencedByEdge {
  return { kind: 'influenced_by', sources, options };
}

export function triggers(target: string, effect: TriggersEdge['effect']): TriggersEdge {
  return { kind: 'triggers', target, effect };
}

export function defineConfig<T>(config: T): T {
  return config;
}

function cloneDeep<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => cloneDeep(item)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = cloneDeep(v);
    }
    return out as T;
  }
  return value;
}

function getByPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null) return undefined;
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

function setByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const isUnsafeKey = (key: string): boolean =>
    key === '__proto__' || key === 'prototype' || key === 'constructor';
  const parts = path.split('.');
  if (parts.some(isUnsafeKey)) {
    throw new Error(`Unsafe path segment in '${path}'.`);
  }
  const last = parts.pop();
  /* v8 ignore next */
  if (!last) return;
  let curr: Record<string, unknown> = obj;
  for (const part of parts) {
    const next = curr[part];
    const newNext: Record<string, unknown> =
      next && typeof next === 'object' && !Array.isArray(next)
        ? { ...(next as Record<string, unknown>) }
        : Object.create(null);
    Object.defineProperty(curr, part, {
      value: newNext,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    curr = newNext;
  }
  Object.defineProperty(curr, last, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

function extractPaths(input: string): string[] {
  const tokens = input.match(/[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)*/g) ?? [];
  return tokens.filter((token) => !RESERVED.has(token));
}

function parseValue(raw: string, state: Record<string, unknown>): unknown {
  const trimmed = raw.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }
  return getByPath(state, trimmed);
}

function evalCondition(condition: string, state: Record<string, unknown>): boolean {
  const ops = ['>=', '<=', '===', '!==', '==', '!=', '>', '<'];
  const op = ops.find((candidate) => condition.includes(candidate));
  if (!op) return Boolean(getByPath(state, condition.trim()));
  const [leftRaw, rightRaw] = condition.split(op);
  const left = parseValue(leftRaw, state);
  const right = parseValue(rightRaw, state);
  switch (op) {
    case '>=':
      return Number(left) >= Number(right);
    case '<=':
      return Number(left) <= Number(right);
    case '===':
      return left === right;
    case '!==':
      return left !== right;
    case '==':
      return left == right;
    case '!=':
      return left != right;
    case '>':
      return Number(left) > Number(right);
    case '<':
      return Number(left) < Number(right);
    /* v8 ignore next 2 */
    default:
      return false;
  }
}

function pathAffects(source: string, changed: string): boolean {
  return source === changed || source.startsWith(`${changed}.`) || changed.startsWith(`${source}.`);
}

function buildGraph(topology: Record<string, EdgeDefinition>): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();

  const add = (from: string, to: string) => {
    if (!graph.has(from)) graph.set(from, new Set<string>());
    graph.get(from)?.add(to);
  };

  for (const [target, edge] of Object.entries(topology)) {
    if (edge.kind === 'derives') edge.dependencies.forEach((dep) => add(dep, target));
    if (edge.kind === 'requires')
      edge.conditions.flatMap(extractPaths).forEach((dep) => add(dep, target));
    if (edge.kind === 'influenced_by') edge.sources.forEach((source) => add(source, target));
    if (edge.kind === 'triggers') add(target, edge.target);
  }

  return graph;
}

function detectCycle(graph: Map<string, Set<string>>): string[] | null {
  const visited = new Set<string>();
  const stackSet = new Set<string>();
  const stackPath: string[] = [];

  const dfs = (nodeName: string): string[] | null => {
    visited.add(nodeName);
    stackSet.add(nodeName);
    stackPath.push(nodeName);

    for (const next of graph.get(nodeName) ?? []) {
      if (!visited.has(next)) {
        const found = dfs(next);
        if (found) return found;
      } else if (stackSet.has(next)) {
        const idx = stackPath.indexOf(next);
        return [...stackPath.slice(idx), next];
      }
    }

    stackSet.delete(nodeName);
    stackPath.pop();
    return null;
  };

  for (const nodeName of graph.keys()) {
    if (!visited.has(nodeName)) {
      const found = dfs(nodeName);
      if (found) return found;
    }
  }

  return null;
}

export function statespace(name: string, definition: StatespaceDefinition): RuntimeStatespace {
  const state: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(definition.nodes)) {
    state[key] = cloneDeep(def.initial);
  }

  const topology = definition.topology;
  const subscribers = new Map<string, Set<() => void>>();
  const eventSubscribers = new Map<string, Set<(payload: unknown) => void>>();

  const graph = buildGraph(topology);

  const sourceEdges = new Map<string, Array<[string, EdgeDefinition]>>();
  for (const [target, edge] of Object.entries(topology)) {
    let sources: string[];
    if (edge.kind === 'derives') sources = edge.dependencies;
    else if (edge.kind === 'requires') sources = edge.conditions.flatMap(extractPaths);
    else if (edge.kind === 'influenced_by') sources = edge.sources;
    else sources = [target]; // triggers: the watched path is the source
    for (const source of sources) {
      if (!sourceEdges.has(source)) sourceEdges.set(source, []);
      sourceEdges.get(source)!.push([target, edge]);
    }
  }

  const cycle = detectCycle(graph);
  if (cycle) {
    const guarded = definition.constraints?.noCyclesThrough;
    if (!guarded || guarded.some((prefix) => cycle.some((path) => path.startsWith(prefix)))) {
      throw new Error(`Cycle detected in statespace ${name}: ${cycle.join(' -> ')}`);
    }
  }

  const notify = (path: string) => {
    const parts = path.split('.');
    for (let i = parts.length; i > 0; i--) {
      const prefix = parts.slice(0, i).join('.');
      subscribers.get(prefix)?.forEach((cb) => cb());
    }
  };

  const emit = <K extends keyof TopologyEventMap>(type: K, payload: TopologyEventMap[K]) => {
    eventSubscribers.get(type)?.forEach((listener) => listener(payload));
  };

  let depth = 0;

  const runtime: RuntimeStatespace = {
    name,
    definition,
    get<T>(path: string): T {
      return getByPath(state, path) as T;
    },
    getState(): Record<string, unknown> {
      return cloneDeep(state);
    },
    set<T>(path: string, value: T): void {
      if (depth > MAX_PROPAGATION_DEPTH) {
        throw new Error(
          `Max propagation depth (${MAX_PROPAGATION_DEPTH}) exceeded in statespace '${name}'. Check for unintended cycles.`,
        );
      }

      const root = path.split('.')[0] ?? path;
      const nodeDef = definition.nodes[root] as NodeDefinition<T> | undefined;

      let next = value;
      const prev = runtime.get<T>(path);
      if (nodeDef?.middleware) {
        next = nodeDef.middleware.reduce((acc, mw) => mw(acc, prev), next);
      }
      if (nodeDef?.validate && !nodeDef.validate(next)) {
        throw new Error(`Validation failed for node '${path}'.`);
      }

      setByPath(state, path, next);
      notify(path);

      depth++;
      try {
        const seen = new Set<string>();
        const affected: Array<[string, EdgeDefinition]> = [];
        for (const [source, entries] of sourceEdges) {
          if (pathAffects(source, path)) {
            for (const [tgt, edge] of entries) {
              if (!seen.has(tgt)) {
                seen.add(tgt);
                affected.push([tgt, edge]);
              }
            }
          }
        }

        for (const [target, edge] of affected) {
          const started = Date.now();

          if (edge.kind === 'derives') {
            const deps = edge.dependencies.map((dep) => runtime.get(dep));
            const valueOrPromise = edge.compute(...deps);
            if (valueOrPromise instanceof Promise) {
              valueOrPromise
                .then((resolved) => runtime.set(target, resolved))
                .catch((error: unknown) => {
                  if (edge.options?.error) runtime.set(target, edge.options.error(error));
                });
              continue;
            } else {
              runtime.set(target, valueOrPromise);
            }
          } else if (edge.kind === 'requires') {
            runtime.set(
              target,
              edge.conditions.every((condition) => evalCondition(condition, state)),
            );
          } else if (edge.kind === 'influenced_by') {
            emit('influenced', { path: target, sources: edge.sources });
            /* v8 ignore next 4 */
          } else if (edge.kind === 'triggers') {
            const result = edge.effect(runtime.get(target), runtime.getState());
            if (result !== undefined) runtime.set(edge.target, result);
          }

          const elapsed = Date.now() - started;
          if (elapsed > 16) emit('slow-propagation', { path: target, ms: elapsed });
        }
      } finally {
        depth--;
      }
    },
    update<T>(path: string, updater: (prev: T) => T): void {
      runtime.set(path, updater(runtime.get<T>(path)));
    },
    subscribe(path: string, callback: () => void): () => void {
      if (!subscribers.has(path)) subscribers.set(path, new Set());
      subscribers.get(path)?.add(callback);
      return () => subscribers.get(path)?.delete(callback);
    },
    subscribeEvent<K extends keyof TopologyEventMap>(
      type: K,
      callback: (payload: TopologyEventMap[K]) => void,
    ): () => void {
      if (!eventSubscribers.has(type)) eventSubscribers.set(type, new Set());
      const set = eventSubscribers.get(type) as Set<(payload: TopologyEventMap[K]) => void>;
      set.add(callback);
      return () => set.delete(callback);
    },
    dependsOn(path: string): string[] {
      const edge = topology[path];
      if (!edge) return [];
      if (edge.kind === 'derives') return [...edge.dependencies];
      if (edge.kind === 'requires') return edge.conditions.flatMap(extractPaths);
      if (edge.kind === 'influenced_by') return [...edge.sources];
      if (edge.kind === 'triggers') return [path];
      /* v8 ignore next */
      return [];
    },
    affects(path: string): string[] {
      return [...(graph.get(path) ?? new Set<string>())];
    },
    updateOrder(path: string): string[] {
      const visited = new Set<string>();
      const out: string[] = [];
      const walk = (nodeName: string) => {
        if (visited.has(nodeName)) return;
        visited.add(nodeName);
        out.push(nodeName);
        for (const next of graph.get(nodeName) ?? []) walk(next);
      };
      walk(path);
      return out;
    },
  };

  return runtime;
}
