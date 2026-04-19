import type { RuntimeStatespace, TopologyEventMap } from '@topo/core';
import { useMemo, useSyncExternalStore } from 'react';

export function useNode<T>(space: RuntimeStatespace, path: string): T {
  return useSyncExternalStore(
    (onStoreChange) => space.subscribe(path, onStoreChange),
    () => space.get<T>(path),
    () => space.get<T>(path)
  );
}

export function useNodes<T extends unknown[]>(space: RuntimeStatespace, paths: string[]): T {
  return paths.map((path) => useNode(space, path)) as T;
}

export function useTopology(space: RuntimeStatespace, path: string): {
  dependsOn: string[];
  affects: string[];
  updateOrder: string[];
} {
  return useMemo(
    () => ({
      dependsOn: space.dependsOn(path),
      affects: space.affects(path),
      updateOrder: space.updateOrder(path)
    }),
    [path, space]
  );
}

export function useMutation(space: RuntimeStatespace, path: string): {
  set: <T>(value: T) => void;
  update: <T>(updater: (prev: T) => T) => void;
  append: <T>(item: T) => void;
} {
  return useMemo(
    () => ({
      set: <T>(value: T) => space.set(path, value),
      update: <T>(updater: (prev: T) => T) => space.update(path, updater),
      append: <T>(item: T) => {
        space.update<T[]>(path, (prev: T[]) => [...(prev ?? []), item]);
      }
    }),
    [path, space]
  );
}

export function useTopologyEvent<K extends keyof TopologyEventMap>(
  space: RuntimeStatespace,
  event: K,
  handler: (payload: TopologyEventMap[K]) => void
): void {
  useSyncExternalStore(
    (onStoreChange) => {
      const unsub = space.subscribeEvent(event, (payload) => {
        handler(payload as TopologyEventMap[K]);
        onStoreChange();
      });
      return unsub;
    },
    () => null,
    () => null
  );
}
