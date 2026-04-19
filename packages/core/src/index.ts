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
  effect: (value: unknown, state: unknown) => unknown;
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

type Subscriber = () => void;
type EventSubscriber<T> = (payload: T) => void;

interface RuntimeStatespace {
  name: string;
  definition: StatespaceDefinition;
  get<T>(path: string): T;
  set<T>(path: string, value: T): void;
  update<T>(path: string, updater: (prev: T) => T): void;
  subscribe(path: string, callback: Subscriber): () => void;
  subscribeEvent<K extends keyof TopologyEventMap>(type: K, callback: EventSubscriber<TopologyEventMap[K]>): () => void;
  dependsOn(path: string): string[];
  affects(path: string): string[];
  updateOrder(path: string): string[];
  getState(): Record<string, unknown>;
}

const RESERVED = new Set(['true', 'false', 'null', 'undefined']);

function node<T>(definition: NodeDefinition<T>): NodeDefinition<T> {
  return definition;
}

function derives<T>(
  dependencies: string[],
  compute: (...deps: unknown[]) => T | Promise<T>,
  options?: DerivesEdge<T>['options']
): DerivesEdge<T> {
  return { kind: 'derives', dependencies, compute, options };
}

function requires(conditions: string[]): RequiresEdge {
  return { kind: 'requires', conditions };
}

function influenced_by(sources: string[], options?: InfluencedByEdge['options']): InfluencedByEdge {
  return { kind: 'influenced_by', sources, options };
}

function triggers(target: string, effect: TriggersEdge['effect']): TriggersEdge {
  return { kind: 'triggers', target, effect };
}

function defineConfig<T>(config: T): T {
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
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

function setByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const isUnsafeKey = (key: string): boolean =>
    key === '__proto__' || key === 'prototype' || key === 'constructor';
  const parts = path.split('.');
  if (parts.some((part) => isUnsafeKey(part))) {
    throw new Error(`Unsafe path segment in '${path}'.`);
  }
  const last = parts.pop();
  if (!last) return;
  let curr: Record<string, unknown> = obj;
  for (const part of parts) {
    if (isUnsafeKey(part)) throw new Error(`Unsafe path segment in '${path}'.`);
    const next = curr[part];
    if (!next || typeof next !== 'object') {
      Object.defineProperty(curr, part, {
        value: Object.create(null),
        writable: true,
        enumerable: true,
        configurable: true
      });
    }
    curr = curr[part] as Record<string, unknown>;
  }
  if (isUnsafeKey(last)) throw new Error(`Unsafe path segment in '${path}'.`);
  Object.defineProperty(curr, last, {
    value,
    writable: true,
    enumerable: true,
    configurable: true
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
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
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
    if (edge.kind === 'requires') edge.conditions.flatMap(extractPaths).forEach((dep) => add(dep, target));
    if (edge.kind === 'influenced_by') edge.sources.forEach((source) => add(source, target));
    if (edge.kind === 'triggers') add(target, edge.target);
  }

  return graph;
}

function detectCycle(graph: Map<string, Set<string>>): string[] | null {
  const visited = new Set<string>();
  const stack = new Set<string>();
  const parent = new Map<string, string>();

  const dfs = (nodeName: string): string[] | null => {
    visited.add(nodeName);
    stack.add(nodeName);

    for (const next of graph.get(nodeName) ?? []) {
      if (!visited.has(next)) {
        parent.set(next, nodeName);
        const found = dfs(next);
        if (found) return found;
      } else if (stack.has(next)) {
        const cycle = [next];
        let current = nodeName;
        while (current !== next) {
          cycle.push(current);
          current = parent.get(current) ?? next;
        }
        cycle.push(next);
        cycle.reverse();
        return cycle;
      }
    }

    stack.delete(nodeName);
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

function statespace(name: string, definition: StatespaceDefinition): RuntimeStatespace {
  const state: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(definition.nodes)) {
    state[key] = cloneDeep(def.initial);
  }

  const topology = definition.topology;
  const subscribers = new Map<string, Set<Subscriber>>();
  const eventSubscribers = new Map<string, Set<EventSubscriber<unknown>>>();

  const graph = buildGraph(topology);
  const cycle = detectCycle(graph);
  if (cycle) {
    const guarded = definition.constraints?.noCyclesThrough;
    if (!guarded || guarded.some((prefix) => cycle.some((path) => path.startsWith(prefix)))) {
      throw new Error(`Cycle detected in statespace ${name}: ${cycle.join(' -> ')}`);
    }
  }

  const notify = (path: string) => {
    const cbs = subscribers.get(path);
    cbs?.forEach((cb) => cb());

    const root = path.split('.')[0] ?? path;
    subscribers.get(root)?.forEach((cb) => cb());
  };

  const emit = <K extends keyof TopologyEventMap>(type: K, payload: TopologyEventMap[K]) => {
    const listeners = eventSubscribers.get(type);
    listeners?.forEach((listener) => listener(payload));
  };

  const runtime = {
    name,
    definition,
    get<T>(path: string): T {
      return getByPath(state, path) as T;
    },
    getState(): Record<string, unknown> {
      return cloneDeep(state);
    },
    set<T>(path: string, value: T): void {
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

      for (const [target, edge] of Object.entries(topology)) {
        const started = Date.now();
        if (edge.kind === 'derives') {
          if (!edge.dependencies.some((dep) => pathAffects(dep, path))) continue;
          const deps = edge.dependencies.map((dep) => runtime.get(dep));
          const valueOrPromise = edge.compute(...deps);
          if (valueOrPromise instanceof Promise) {
            valueOrPromise
              .then((resolved) => runtime.set(target, resolved))
              .catch((error: unknown) => {
                if (edge.options?.error) runtime.set(target, edge.options.error(error));
              });
          } else {
            runtime.set(target, valueOrPromise);
          }
        }

        if (edge.kind === 'requires') {
          const deps = edge.conditions.flatMap(extractPaths);
          if (!deps.some((dep) => pathAffects(dep, path))) continue;
          runtime.set(target, edge.conditions.every((condition) => evalCondition(condition, state)));
        }

        if (edge.kind === 'influenced_by') {
          if (!edge.sources.some((source) => pathAffects(source, path))) continue;
          emit('influenced', { path: target, sources: edge.sources });
        }

        if (edge.kind === 'triggers') {
          if (!pathAffects(target, path)) continue;
          const result = edge.effect(runtime.get(target), runtime.getState());
          if (result !== undefined) runtime.set(edge.target, result);
        }

        const elapsed = Date.now() - started;
        if (elapsed > 16) emit('slow-propagation', { path: target, ms: elapsed });
      }
    },
    update<T>(path: string, updater: (prev: T) => T): void {
      runtime.set(path, updater(runtime.get<T>(path)));
    },
    subscribe(path: string, callback: Subscriber): () => void {
      if (!subscribers.has(path)) subscribers.set(path, new Set());
      subscribers.get(path)?.add(callback);
      return () => subscribers.get(path)?.delete(callback);
    },
    subscribeEvent<K extends keyof TopologyEventMap>(type: K, callback: EventSubscriber<TopologyEventMap[K]>): () => void {
      if (!eventSubscribers.has(type)) eventSubscribers.set(type, new Set());
      const set = eventSubscribers.get(type) as Set<EventSubscriber<TopologyEventMap[K]>>;
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
    }
  };

  return runtime;
}

export {
  defineConfig,
  derives,
  influenced_by,
  node,
  requires,
  statespace,
  triggers,
  type RuntimeStatespace
};
