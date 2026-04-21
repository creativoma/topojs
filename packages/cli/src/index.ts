#!/usr/bin/env node

import { pathToFileURL } from 'url';
import { resolve } from 'path';
import { createServer } from 'http';
import { exec } from 'child_process';

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

interface GraphNodeData {
  id: string;
}
interface GraphEdgeData {
  from: string;
  to: string;
  kind: string;
}
interface GraphData {
  name: string;
  nodes: GraphNodeData[];
  edges: GraphEdgeData[];
}

function buildGraphData(spaces: Statespace[]): GraphData[] {
  return spaces.map((space) => {
    const nodeSet = new Set<string>();
    const edges: GraphEdgeData[] = [];

    for (const key of Object.keys(space.definition.nodes)) {
      nodeSet.add(key);
    }

    for (const [path, edge] of Object.entries(space.definition.topology)) {
      nodeSet.add(path);
      if (edge.kind === 'derives') {
        for (const dep of edge.dependencies) {
          nodeSet.add(dep);
          edges.push({ from: dep, to: path, kind: 'derives' });
        }
      } else if (edge.kind === 'requires') {
        const deps = edge.conditions.flatMap(
          (c) => c.match(/[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)*/g) ?? [],
        );
        for (const dep of deps) {
          nodeSet.add(dep);
          edges.push({ from: dep, to: path, kind: 'requires' });
        }
      } else if (edge.kind === 'influenced_by') {
        for (const src of edge.sources) {
          nodeSet.add(src);
          edges.push({ from: src, to: path, kind: 'influencedBy' });
        }
      } else if (edge.kind === 'triggers') {
        nodeSet.add(edge.target);
        edges.push({ from: path, to: edge.target, kind: 'triggers' });
      }
    }

    return { name: space.name, nodes: Array.from(nodeSet).map((id) => ({ id })), edges };
  });
}

function generateHtml(data: GraphData[]): string {
  const safeJson = JSON.stringify(data).replace(/<\/script>/gi, '<\\/script>');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><title>TopoJS Visualizer</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0f1117;color:#e2e8f0;font-family:'SF Mono','Fira Code',monospace;overflow:hidden;height:100vh}
#c{display:block;cursor:grab}
#c:active{cursor:grabbing}
#panel{position:fixed;top:16px;left:16px;display:flex;flex-direction:column;gap:8px;pointer-events:none}
.card{background:rgba(15,23,42,0.92);border:1px solid #1e293b;border-radius:8px;padding:10px 14px;backdrop-filter:blur(6px);pointer-events:all}
h2{font-size:12px;font-weight:600;color:#94a3b8;letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px}
.tabs{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px}
.tab{padding:3px 10px;border-radius:4px;font-size:11px;cursor:pointer;color:#64748b;border:1px solid #1e293b;background:transparent}
.tab.on{background:#1e293b;border-color:#334155;color:#e2e8f0}
.stat{font-size:11px;color:#475569}
.stat b{color:#94a3b8}
.leg{display:flex;align-items:center;gap:6px;margin:3px 0;font-size:10px;color:#64748b}
.lc{width:24px;height:2px;border-radius:1px}
.hint{font-size:10px;color:#334155;margin-top:4px}
#tip{position:fixed;background:rgba(15,23,42,0.95);border:1px solid #334155;border-radius:6px;padding:5px 9px;font-size:11px;color:#e2e8f0;pointer-events:none;display:none;max-width:220px;word-break:break-all}
</style>
</head>
<body>
<canvas id="c"></canvas>
<div id="panel">
  <div class="card">
    <h2>TopoJS Visualizer</h2>
    <div class="tabs" id="tabs"></div>
    <div class="stat"><b id="nn">0</b> nodes &nbsp; <b id="ne">0</b> edges</div>
  </div>
  <div class="card">
    <div class="leg"><div class="lc" style="background:#60a5fa"></div>derives</div>
    <div class="leg"><div class="lc" style="background:repeating-linear-gradient(90deg,#a78bfa 0,#a78bfa 5px,transparent 5px,transparent 9px)"></div>requires</div>
    <div class="leg"><div class="lc" style="background:repeating-linear-gradient(90deg,#34d399 0,#34d399 2px,transparent 2px,transparent 6px)"></div>influencedBy</div>
    <div class="leg"><div class="lc" style="background:#fb923c"></div>triggers</div>
    <div class="hint">scroll zoom · drag pan · drag node</div>
  </div>
</div>
<div id="tip"></div>
<script>
const GRAPHS = ${safeJson};
const EC = {derives:'#60a5fa',requires:'#a78bfa',influencedBy:'#34d399',triggers:'#fb923c'};
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const tip = document.getElementById('tip');
let W, H;
function resize() { W = canvas.width = innerWidth; H = canvas.height = innerHeight; }
resize();
addEventListener('resize', resize);

const tabsEl = document.getElementById('tabs');
GRAPHS.forEach(function(g, i) {
  const t = document.createElement('button');
  t.className = 'tab' + (i === 0 ? ' on' : '');
  t.textContent = g.name;
  t.onclick = function() {
    document.querySelectorAll('.tab').forEach(function(e, j) { e.classList.toggle('on', j === i); });
    initSim(g);
  };
  tabsEl.appendChild(t);
});

let nodes = [], edges = [], alpha = 0, running = false;

function nodeR(n) { return n.id.indexOf('.') === -1 ? 20 : 16; }

function initSim(g) {
  document.getElementById('nn').textContent = g.nodes.length;
  document.getElementById('ne').textContent = g.edges.length;
  const r = Math.min(W, H) * 0.28;
  nodes = g.nodes.map(function(n, i) {
    const a = (i / g.nodes.length) * Math.PI * 2;
    return { id: n.id, x: W/2 + r * Math.cos(a), y: H/2 + r * Math.sin(a), vx: 0, vy: 0, pinned: false };
  });
  const byId = new Map(nodes.map(function(n) { return [n.id, n]; }));
  edges = g.edges.map(function(e) {
    return Object.assign({}, e, { src: byId.get(e.from), dst: byId.get(e.to) });
  }).filter(function(e) { return e.src && e.dst; });
  alpha = 1; running = true;
}

function tick() {
  if (!running) return;
  alpha *= 0.992;
  if (alpha < 0.003) { running = false; return; }
  const REP = 4000, K = 0.07, REST = 130, CG = 0.012;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) + 0.01;
      const f = REP / (d * d), nx = dx / d, ny = dy / d;
      a.vx -= nx * f; a.vy -= ny * f; b.vx += nx * f; b.vy += ny * f;
    }
  }
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    const dx = e.dst.x - e.src.x, dy = e.dst.y - e.src.y;
    const d = Math.sqrt(dx * dx + dy * dy) + 0.01;
    const f = (d - REST) * K, nx = dx / d, ny = dy / d;
    e.src.vx += nx * f; e.src.vy += ny * f; e.dst.vx -= nx * f; e.dst.vy -= ny * f;
  }
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    n.vx += (W / 2 - n.x) * CG; n.vy += (H / 2 - n.y) * CG;
  }
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.pinned) continue;
    n.vx *= 0.82; n.vy *= 0.82;
    n.x += n.vx * alpha; n.y += n.vy * alpha;
  }
}

let pan = { x: 0, y: 0 }, zoom = 1, drag = null, panning = false, pm = null;

canvas.addEventListener('wheel', function(e) {
  e.preventDefault();
  zoom = Math.max(0.15, Math.min(5, zoom * (e.deltaY < 0 ? 1.12 : 0.89)));
}, { passive: false });

canvas.addEventListener('mousedown', function(e) {
  const p = s2w(e.clientX, e.clientY);
  const hit = nodes.find(function(n) { return Math.hypot(n.x - p.x, n.y - p.y) < nodeR(n) + 4; });
  if (hit) { drag = hit; hit.pinned = true; hit.vx = hit.vy = 0; }
  else { panning = true; pm = { x: e.clientX, y: e.clientY }; }
});

addEventListener('mousemove', function(e) {
  if (drag) {
    const p = s2w(e.clientX, e.clientY);
    drag.x = p.x; drag.y = p.y; drag.vx = drag.vy = 0;
    running = true; alpha = Math.max(alpha, 0.4);
  } else if (panning && pm) {
    pan.x += e.clientX - pm.x; pan.y += e.clientY - pm.y;
    pm = { x: e.clientX, y: e.clientY };
  }
  const p = s2w(e.clientX, e.clientY);
  const hit = nodes.find(function(n) { return Math.hypot(n.x - p.x, n.y - p.y) < nodeR(n) + 4; });
  if (hit) {
    tip.textContent = hit.id;
    tip.style.display = 'block';
    tip.style.left = (e.clientX + 14) + 'px';
    tip.style.top = (e.clientY - 6) + 'px';
  } else {
    tip.style.display = 'none';
  }
});

addEventListener('mouseup', function() {
  if (drag) drag.pinned = false;
  drag = null; panning = false; pm = null;
});

function s2w(sx, sy) {
  return { x: (sx - W/2 - pan.x) / zoom + W/2, y: (sy - H/2 - pan.y) / zoom + H/2 };
}

function drawArrow(x1, y1, x2, y2, col, kind, r1, r2) {
  const dx = x2 - x1, dy = y2 - y1, d = Math.sqrt(dx * dx + dy * dy);
  if (d < 2) return;
  const nx = dx / d, ny = dy / d;
  const sx = x1 + nx * r1, sy = y1 + ny * r1, ex = x2 - nx * r2, ey = y2 - ny * r2;
  ctx.save();
  ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.globalAlpha = 0.65;
  if (kind === 'requires') ctx.setLineDash([6, 4]);
  else if (kind === 'influencedBy') ctx.setLineDash([2, 4]);
  else ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex - 10 * nx + 6 * (-ny), ey - 10 * ny + 6 * nx);
  ctx.lineTo(ex - 10 * nx - 6 * (-ny), ey - 10 * ny - 6 * nx);
  ctx.closePath(); ctx.fillStyle = col; ctx.fill();
  ctx.restore();
}

function render() {
  tick();
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W/2 + pan.x, H/2 + pan.y);
  ctx.scale(zoom, zoom);
  ctx.translate(-W/2, -H/2);
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    if (!e.src || !e.dst) continue;
    drawArrow(e.src.x, e.src.y, e.dst.x, e.dst.y, EC[e.kind] || '#64748b', e.kind, nodeR(e.src), nodeR(e.dst));
  }
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const root = n.id.indexOf('.') === -1;
    const r = nodeR(n);
    ctx.save();
    ctx.shadowColor = root ? 'rgba(226,232,240,0.15)' : 'rgba(100,116,139,0.08)';
    ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fillStyle = root ? '#1e293b' : '#0f172a'; ctx.fill();
    ctx.strokeStyle = root ? '#cbd5e1' : '#334155';
    ctx.lineWidth = root ? 1.5 : 1; ctx.stroke();
    ctx.restore();
    ctx.font = (root ? '600 10px' : '400 9px') + " 'SF Mono','Fira Code',monospace";
    ctx.fillStyle = root ? '#f1f5f9' : '#94a3b8';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lbl = n.id.length > 16 ? n.id.slice(0, 15) + '…' : n.id;
    ctx.fillText(lbl, n.x, n.y);
  }
  ctx.restore();
  requestAnimationFrame(render);
}

initSim(GRAPHS[0]);
render();
</script>
</body>
</html>`;
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === 'win32'
      ? `start ${url}`
      : process.platform === 'darwin'
        ? `open ${url}`
        : `xdg-open ${url}`;
  exec(cmd, () => {});
}

export async function visualizeSpace(spaces: Statespace[], port = 7331): Promise<void> {
  return new Promise((resolve, reject) => {
    const html = generateHtml(buildGraphData(spaces));

    const server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    });

    server.listen(port, () => {
      const url = `http://localhost:${port}`;
      console.log(`\nTopo Visualizer → ${url}`);
      console.log('Press Ctrl+C to stop\n');
      openBrowser(url);
      resolve();
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Try: topo visualize <file> --port <n>`);
      } else {
        console.error(`Server error: ${err.message}`);
      }
      reject(err);
    });
  });
}

export async function run(argv: string[]): Promise<number> {
  const [, , cmd, fileArg, ...rest] = argv;

  if (!cmd) {
    console.log('Usage: topo <command> <store.js> [options]');
    console.log('\nCommands:');
    console.log('  analyze   <file>                              Show nodes and topology');
    console.log('  check     <file>                              Validate constraints');
    console.log('  trace     <file> <path>                       Trace propagation for a node');
    console.log('  optimize  <file>                              Suggest optimization hints');
    console.log('  export    <file> [--format json|dot|mermaid]  Export graph');
    console.log('  visualize <file> [--port <n>]                 Open interactive visualizer');
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

    case 'visualize': {
      const portIdx = rest.indexOf('--port');
      const port = portIdx !== -1 ? parseInt(rest[portIdx + 1] ?? '7331', 10) : 7331;
      try {
        await visualizeSpace(spaces, port);
      } catch {
        return 1;
      }
      return 0;
    }

    default:
      console.error(`Unknown command: ${cmd}`);
      return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run(process.argv).then((code) => {
    // Non-zero: exit explicitly so the error code propagates.
    // Zero: let the event loop drain naturally — the HTTP server (visualize command)
    // keeps it alive until Ctrl+C; other commands exit on their own.
    if (code !== 0) process.exit(code);
  });
}
