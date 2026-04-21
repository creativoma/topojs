#!/usr/bin/env node

import { pathToFileURL } from 'url';
import { resolve } from 'path';

type EdgeDefinition =
  | {
      kind: 'derives';
      dependencies: string[];
      options?: { cache?: boolean };
      compute: (...args: unknown[]) => unknown;
    }
  | { kind: 'requires'; conditions: string[] }
  | { kind: 'influenced_by'; sources: string[] }
  | { kind: 'triggers'; target: string; effect: (v: unknown, s: unknown) => unknown };

interface NodeDefinition {
  initial: unknown;
  persist?: boolean | object;
  validate?: (v: unknown) => boolean;
  middleware?: unknown[];
}

interface Statespace {
  name: string;
  definition: {
    nodes: Record<string, NodeDefinition>;
    topology: Record<string, EdgeDefinition>;
    constraints?: {
      noCyclesThrough?: string[];
      strongConsistency?: string[];
      maxFanout?: Record<string, number>;
    };
  };
  get: (path: string) => unknown;
  set: (path: string, value: unknown) => void;
  affects: (path: string) => string[];
  dependsOn: (path: string) => string[];
  updateOrder: (path: string) => string[];
}

function isStatespace(obj: unknown): obj is Statespace {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'definition' in obj &&
    'name' in obj &&
    'get' in obj &&
    'affects' in obj
  );
}

export async function loadStatespaces(filePath: string): Promise<Statespace[]> {
  const absolutePath = resolve(process.cwd(), filePath);
  const mod = await import(pathToFileURL(absolutePath).href);
  return Object.values(mod as Record<string, unknown>).filter(isStatespace);
}

export function analyzeSpace(space: Statespace): void {
  const { nodes, topology } = space.definition;

  console.log(`\nStatespace: ${space.name}`);
  console.log('─'.repeat(40));

  console.log('\nNodes:');
  for (const [key, def] of Object.entries(nodes)) {
    const flags: string[] = [];
    if (def.persist) flags.push('persist');
    if (def.validate) flags.push('validate');
    if (def.middleware?.length) flags.push(`middleware(${def.middleware.length})`);
    console.log(`  ${key}${flags.length ? ` [${flags.join(', ')}]` : ''}`);
  }

  console.log('\nTopology:');
  for (const [path, edge] of Object.entries(topology)) {
    if (edge.kind === 'derives') {
      console.log(`  ${path} ← derives(${edge.dependencies.join(', ')})`);
    } else if (edge.kind === 'requires') {
      console.log(`  ${path} ← requires(${edge.conditions.join(' && ')})`);
    } else if (edge.kind === 'influenced_by') {
      console.log(`  ${path} ← influencedBy(${edge.sources.join(', ')})`);
    } else if (edge.kind === 'triggers') {
      console.log(`  ${path} → triggers(${edge.target})`);
    }
  }

  const nodeCount = Object.keys(nodes).length;
  const edgeCount = Object.keys(topology).length;
  console.log(`\n${nodeCount} nodes, ${edgeCount} edges`);
}

export function checkSpace(space: Statespace): number {
  const { constraints, topology, nodes } = space.definition;
  const issues: string[] = [];
  const warnings: string[] = [];

  console.log(`\nStatespace: ${space.name}`);
  console.log('─'.repeat(40));

  for (const [path, edge] of Object.entries(topology)) {
    const root = path.split('.')[0]!;
    if (!nodes[root]) issues.push(`Unknown node '${root}' in topology key '${path}'`);

    if (edge.kind === 'derives') {
      for (const dep of edge.dependencies) {
        const depRoot = dep.split('.')[0]!;
        if (!nodes[depRoot]) issues.push(`derives '${path}': unknown node '${depRoot}'`);
      }
    }
    if (edge.kind === 'influenced_by') {
      for (const src of edge.sources) {
        const srcRoot = src.split('.')[0]!;
        if (!nodes[srcRoot]) issues.push(`influencedBy '${path}': unknown node '${srcRoot}'`);
      }
    }
  }

  if (constraints?.maxFanout) {
    for (const [path, max] of Object.entries(constraints.maxFanout)) {
      const actual = space.affects(path).length;
      if (actual > max) issues.push(`'${path}' fanout ${actual} exceeds maxFanout ${max}`);
    }
  }

  for (const key of Object.keys(nodes)) {
    const fanout = space.affects(key).length;
    if (fanout > 5) warnings.push(`'${key}' has high fanout (${fanout})`);
  }

  if (warnings.length) {
    console.log('\nWarnings:');
    warnings.forEach((w) => console.log(`  ⚠  ${w}`));
  }

  if (issues.length) {
    console.log('\nIssues:');
    issues.forEach((i) => console.log(`  ✗  ${i}`));
    return 1;
  }

  console.log('\n✓  No issues found');
  return 0;
}

export function traceSpace(space: Statespace, path: string): void {
  console.log(`\nStatespace: ${space.name} — trace '${path}'`);
  console.log('─'.repeat(40));

  const dependsOn = space.dependsOn(path);
  const affects = space.affects(path);
  const order = space.updateOrder(path);

  if (dependsOn.length) {
    console.log('\nDepends on:');
    dependsOn.forEach((d) => console.log(`  ← ${d}`));
  } else {
    console.log('\nNo dependencies (root node)');
  }

  if (affects.length) {
    console.log('\nAffects:');
    affects.forEach((a) => console.log(`  → ${a}`));
  } else {
    console.log('\nNo downstream dependents');
  }

  if (order.length > 1) {
    console.log('\nUpdate order:');
    order.forEach((n, i) => console.log(`  ${i + 1}. ${n}`));
  }
}

export function optimizeSpace(space: Statespace): void {
  const { topology, nodes } = space.definition;
  const suggestions: string[] = [];

  console.log(`\nStatespace: ${space.name}`);
  console.log('─'.repeat(40));

  for (const [path, edge] of Object.entries(topology)) {
    if (edge.kind === 'derives' && !edge.options?.cache && edge.dependencies.length >= 2) {
      suggestions.push(
        `'${path}': consider { cache: true } — derived from ${edge.dependencies.length} sources`,
      );
    }
  }

  for (const key of Object.keys(nodes)) {
    const fanout = space.affects(key).length;
    if (fanout >= 3) {
      suggestions.push(
        `'${key}': high fanout (${fanout} downstream) — batch updates where possible`,
      );
    }
  }

  for (const key of Object.keys(nodes)) {
    const order = space.updateOrder(key);
    if (order.length >= 4) {
      suggestions.push(`'${key}': deep chain (depth ${order.length}) — ${order.join(' → ')}`);
    }
  }

  if (!suggestions.length) {
    console.log('\n✓  No optimization suggestions');
  } else {
    console.log('\nSuggestions:');
    suggestions.forEach((s) => console.log(`  •  ${s}`));
  }
}

export function exportSpace(space: Statespace, format = 'json'): void {
  const { nodes, topology } = space.definition;

  if (format === 'json') {
    const graph = {
      name: space.name,
      nodes: Object.keys(nodes),
      edges: Object.entries(topology).map(([path, edge]) => ({
        path,
        kind: edge.kind,
        ...(edge.kind === 'derives' && { dependencies: edge.dependencies }),
        ...(edge.kind === 'requires' && { conditions: edge.conditions }),
        ...(edge.kind === 'influenced_by' && { sources: edge.sources }),
        ...(edge.kind === 'triggers' && { target: edge.target }),
      })),
    };
    console.log(JSON.stringify(graph, null, 2));
    return;
  }

  if (format === 'mermaid') {
    console.log('graph TD');
    for (const [path, edge] of Object.entries(topology)) {
      const t = path.replace(/\./g, '_');
      if (edge.kind === 'derives') {
        edge.dependencies.forEach((dep) => console.log(`  ${dep.replace(/\./g, '_')} --> ${t}`));
      } else if (edge.kind === 'requires') {
        const paths = edge.conditions.flatMap(
          (c) => c.match(/[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)*/g) ?? [],
        );
        paths.forEach((dep) => console.log(`  ${dep.replace(/\./g, '_')} -.-> ${t}`));
      }
    }
    return;
  }

  if (format === 'dot') {
    console.log('digraph {');
    for (const [path, edge] of Object.entries(topology)) {
      if (edge.kind === 'derives') {
        edge.dependencies.forEach((dep) => console.log(`  "${dep}" -> "${path}";`));
      } else if (edge.kind === 'requires') {
        const paths = edge.conditions.flatMap(
          (c) => c.match(/[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)*/g) ?? [],
        );
        paths.forEach((dep) => console.log(`  "${dep}" -> "${path}" [style=dashed];`));
      }
    }
    console.log('}');
    return;
  }

  console.error(`Unknown format '${format}'. Use: json, mermaid, dot`);
}

export async function run(argv: string[]): Promise<number> {
  const [, , cmd, fileArg, ...rest] = argv;

  if (!cmd) {
    console.log('Usage: topo <command> <store.js> [options]');
    console.log('\nCommands:');
    console.log('  analyze  <file>                              Show nodes and topology');
    console.log('  check    <file>                              Validate constraints');
    console.log('  trace    <file> <path>                       Trace propagation for a node');
    console.log('  optimize <file>                              Suggest improvements');
    console.log('  export   <file> [--format json|dot|mermaid]  Export graph');
    console.log('\nNote: <file> must be a compiled JS/MJS file');
    return 1;
  }

  const validCommands = ['analyze', 'visualize', 'check', 'optimize', 'export', 'trace'];
  if (!validCommands.includes(cmd)) {
    console.error(`Unknown command: ${cmd}`);
    return 1;
  }

  if (!fileArg) {
    console.error(`Error: missing <file> argument for '${cmd}'`);
    return 1;
  }

  let spaces: Statespace[];
  try {
    spaces = await loadStatespaces(fileArg);
  } catch (e) {
    console.error(`Error loading '${fileArg}': ${(e as Error).message}`);
    return 1;
  }

  if (!spaces.length) {
    console.error(`No statespace found in '${fileArg}'`);
    return 1;
  }

  switch (cmd) {
    case 'analyze':
      spaces.forEach(analyzeSpace);
      return 0;

    case 'check': {
      const codes = spaces.map(checkSpace);
      return codes.some((c) => c !== 0) ? 1 : 0;
    }

    case 'trace': {
      const tracePath = rest[0];
      if (!tracePath) {
        console.error('Error: trace requires a <path> argument');
        return 1;
      }
      spaces.forEach((s) => traceSpace(s, tracePath));
      return 0;
    }

    case 'optimize':
      spaces.forEach(optimizeSpace);
      return 0;

    case 'export': {
      const fmtIdx = rest.indexOf('--format');
      const format = fmtIdx !== -1 ? rest[fmtIdx + 1] : 'json';
      spaces.forEach((s) => exportSpace(s, format));
      return 0;
    }

    case 'visualize':
      console.log('Visualizer coming soon — use `topo export <file> --format mermaid` for now');
      return 0;

    default:
      console.error(`Unknown command: ${cmd}`);
      return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run(process.argv).then((code) => process.exit(code));
}
