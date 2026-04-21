import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { RuntimeStatespace, TopologyEventMap } from '@topojs/core';

export type { RuntimeStatespace, TopologyEventMap };

export function useNode<T>(space: RuntimeStatespace, path: string): T {
  return useSyncExternalStore(
    (onStoreChange) => space.subscribe(path, onStoreChange),
    () => space.get<T>(path),
    () => space.get<T>(path),
  );
}

export function useNodes<T extends unknown[]>(space: RuntimeStatespace, paths: string[]): T {
  const pathsKey = paths.join('\0');
  const snapshotRef = useRef<T | undefined>(undefined);

  const getSnapshot = useCallback((): T => {
    const next = paths.map((path) => space.get(path)) as T;
    const prev = snapshotRef.current;
    if (prev !== undefined && next.length === prev.length && next.every((v, i) => v === prev[i])) {
      return prev;
    }
    snapshotRef.current = next;
    return next;
  }, [space, pathsKey]);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const unsubs = paths.map((path) => space.subscribe(path, onStoreChange));
      return () => unsubs.forEach((unsub) => unsub());
    },

    [space, pathsKey],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useTopology(
  space: RuntimeStatespace,
  path: string,
): { dependsOn: string[]; affects: string[]; updateOrder: string[] } {
  return useMemo(
    () => ({
      dependsOn: space.dependsOn(path),
      affects: space.affects(path),
      updateOrder: space.updateOrder(path),
    }),
    [path, space],
  );
}

export function useMutation(
  space: RuntimeStatespace,
  path: string,
): {
  set: <T>(value: T) => void;
  update: <T>(updater: (prev: T) => T) => void;
  append: <T>(item: T) => void;
} {
  return useMemo(
    () => ({
      set: <T>(value: T) => space.set(path, value),
      update: <T>(updater: (prev: T) => T) => space.update(path, updater),
      append: <T>(item: T) =>
        space.update<T[]>(path, (prev) => [...(Array.isArray(prev) ? prev : []), item]),
    }),
    [path, space],
  );
}

export function useTopologyEvent<K extends keyof TopologyEventMap>(
  space: RuntimeStatespace,
  event: K,
  handler: (payload: TopologyEventMap[K]) => void,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    return space.subscribeEvent(event, (payload) => handlerRef.current(payload));
  }, [space, event]);
}
