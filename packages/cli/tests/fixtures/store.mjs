// Standalone fixture — no external imports, implements the RuntimeStatespace interface directly

function buildAffects(topology) {
  return (path) => {
    const affected = [];
    for (const [key, edge] of Object.entries(topology)) {
      if (edge.kind === 'derives' && edge.dependencies.includes(path)) affected.push(key);
      if (edge.kind === 'requires' && edge.conditions.some((c) => c.includes(path)))
        affected.push(key);
      if (edge.kind === 'influenced_by' && edge.sources.includes(path)) affected.push(key);
    }
    return affected;
  };
}

function buildDependsOn(topology) {
  return (path) => {
    const edge = topology[path];
    if (!edge) return [];
    if (edge.kind === 'derives') return [...edge.dependencies];
    if (edge.kind === 'requires')
      return edge.conditions.flatMap((c) => c.match(/[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)*/g) ?? []);
    if (edge.kind === 'influenced_by') return [...edge.sources];
    return [];
  };
}

function buildUpdateOrder(affects) {
  return (path) => {
    const visited = new Set();
    const out = [];
    const walk = (p) => {
      if (visited.has(p)) return;
      visited.add(p);
      out.push(p);
      for (const next of affects(p)) walk(next);
    };
    walk(path);
    return out;
  };
}

function makeSpace(name, definition) {
  const affects = buildAffects(definition.topology);
  const dependsOn = buildDependsOn(definition.topology);
  const updateOrder = buildUpdateOrder(affects);
  /* v8 ignore next 8 */
  return {
    name,
    definition,
    get: () => undefined,
    set: () => {},
    update: () => {},
    subscribe: () => () => {},
    subscribeEvent: () => () => {},
    getState: () => ({}),
    affects,
    dependsOn,
    updateOrder,
  };
}

export const CartSpace = makeSpace('Cart', {
  nodes: {
    user: { initial: { authenticated: false, membership: 'free' } },
    cart: { initial: { items: [], discount: 0 } },
    checkout: { initial: { canProceed: false } },
  },
  topology: {
    'cart.discount': {
      kind: 'derives',
      dependencies: ['user.membership'],
      /* v8 ignore next */
      compute: (m) => (m === 'premium' ? 0.2 : m === 'plus' ? 0.1 : 0),
    },
    'checkout.canProceed': {
      kind: 'requires',
      conditions: ['cart.items.length > 0', 'user.authenticated'],
    },
    'user.recommendations': {
      kind: 'influenced_by',
      sources: ['cart.items'],
    },
    'checkout.summary': {
      kind: 'triggers',
      target: 'user.history',
      effect: (v) => v,
    },
  },
  constraints: {
    noCyclesThrough: ['checkout'],
    strongConsistency: ['cart.discount'],
  },
});
