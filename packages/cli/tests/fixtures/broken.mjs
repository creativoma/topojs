// Fixture with an unknown node reference — checkSpace should return 1
function makeSpace(name, definition) {
  const affects = () => [];
  const dependsOn = () => [];
  const updateOrder = (path) => [path];
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

export const BrokenSpace = makeSpace('Broken', {
  nodes: {
    valid: { initial: 0 },
  },
  topology: {
    'ghost.value': {
      kind: 'derives',
      dependencies: ['nonexistent.dep'],
      /* v8 ignore next */
      compute: (v) => v,
    },
  },
  constraints: {},
});
