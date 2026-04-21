import { useState } from 'react';
import { version } from '../lib/version';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeTypes,
} from '@xyflow/react';

function CopyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

// ── React Flow: custom node ──
function TopoNode({ data }: { data: { label: string; sub?: string } }) {
  return (
    <div
      style={{
        background: '#0d0d0d',
        border: '1.5px solid rgba(77,155,255,0.5)',
        borderRadius: '8px',
        padding: '8px 18px',
        textAlign: 'center',
        minWidth: '90px',
        cursor: 'default',
        userSelect: 'none',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: 'none' }} />
      <div style={{ fontFamily: 'Fira Code, monospace', fontSize: '13px', color: '#E4E4E7' }}>
        {data.label}
      </div>
      {data.sub && (
        <div
          style={{
            fontFamily: 'Fira Code, monospace',
            fontSize: '9px',
            color: '#4d9bff',
            marginTop: '3px',
          }}
        >
          {data.sub}
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, pointerEvents: 'none' }}
      />
    </div>
  );
}

const nodeTypes: NodeTypes = { topo: TopoNode };

const rfNodes: Node[] = [
  { id: 'user', type: 'topo', position: { x: 145, y: 20 }, data: { label: 'user' } },
  {
    id: 'cart',
    type: 'topo',
    position: { x: 20, y: 155 },
    data: { label: 'cart', sub: '→ cart.discount' },
  },
  {
    id: 'checkout',
    type: 'topo',
    position: { x: 255, y: 155 },
    data: { label: 'checkout', sub: '→ canProceed' },
  },
];

const rfEdges: Edge[] = [
  {
    id: 'e-user-cart',
    source: 'user',
    target: 'cart',
    label: 'derives',
    animated: true,
    style: { stroke: '#4d9bff', strokeWidth: 1.5 },
    labelStyle: { fill: '#4d9bff', fontFamily: 'Fira Code, monospace', fontSize: 10 },
    labelBgStyle: { fill: '#0d0d0d', fillOpacity: 1 },
    labelBgPadding: [4, 3] as [number, number],
    labelBgBorderRadius: 3,
  },
  {
    id: 'e-user-checkout',
    source: 'user',
    target: 'checkout',
    label: 'requires',
    animated: true,
    style: { stroke: '#4d9bff', strokeWidth: 1.5 },
    labelStyle: { fill: '#4d9bff', fontFamily: 'Fira Code, monospace', fontSize: 10 },
    labelBgStyle: { fill: '#0d0d0d', fillOpacity: 1 },
    labelBgPadding: [4, 3] as [number, number],
    labelBgBorderRadius: 3,
  },
];

function GraphDiagram() {
  return (
    <div
      className="relative rounded-xl overflow-hidden select-none"
      style={{
        width: 420,
        height: 300,
        border: '1px solid rgba(77,155,255,0.15)',
        background: '#080808',
      }}
    >
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onInit={(rf) => rf.fitView({ padding: 0.25 })}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll={false}
        zoomOnScroll={false}
        panOnDrag={false}
        proOptions={{ hideAttribution: true }}
        colorMode="dark"
        style={{ background: 'transparent' }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          color="rgba(77,155,255,0.1)"
          gap={22}
          size={1}
        />
      </ReactFlow>

      {/* Badge */}
      <div
        className="absolute bottom-3 right-3 text-[10px] px-2 py-0.5 rounded pointer-events-none"
        style={{
          fontFamily: 'Fira Code, monospace',
          color: 'rgba(77,155,255,0.5)',
          background: 'rgba(77,155,255,0.06)',
          border: '1px solid rgba(77,155,255,0.15)',
          zIndex: 10,
        }}
      >
        live propagation
      </div>
    </div>
  );
}

// ── Hero section ──
export default function Hero() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText('pnpm add @topojs/core @topojs/react').catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="dot-grid min-h-screen flex items-center pt-14">
      <div className="max-w-5xl mx-auto px-6 py-24 w-full grid lg:grid-cols-2 gap-16 items-center">
        {/* ── Left: copy ── */}
        <div className="space-y-8">
          <div
            className="inline-flex items-center gap-2 text-xs rounded-full px-3 py-1"
            style={{
              fontFamily: 'Fira Code, monospace',
              color: '#4d9bff',
              border: '1px solid rgba(77,155,255,0.25)',
              background: 'rgba(77,155,255,0.07)',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: '#4d9bff',
                boxShadow: '0 0 6px rgba(77,155,255,0.6)',
                animation: 'node-pulse 2s ease-in-out infinite',
              }}
            />
            TypeScript · Framework-agnostic · {version}
          </div>

          <h1
            className="text-5xl lg:text-[3.5rem] font-bold leading-[1.1] tracking-tight"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            Your state is a graph.{' '}
            <span style={{ color: '#4d9bff' }}>Stop&nbsp;pretending it's a tree.</span>
          </h1>

          <p className="text-lg leading-relaxed max-w-lg" style={{ color: '#A1A1AA' }}>
            Topo models application state as what it actually is — a directed graph with{' '}
            <strong style={{ color: '#E4E4E7', fontWeight: 500 }}>explicit dependencies</strong>,
            cycle detection, and optimal update propagation.
          </p>

          {/* Install */}
          <div
            className="install-pill flex items-center gap-3 px-4 py-3"
            style={{ whiteSpace: 'nowrap' }}
          >
            <span
              style={{ color: '#4d9bff', fontFamily: 'Fira Code, monospace', fontSize: '0.875rem' }}
            >
              $
            </span>
            <span
              className="flex-1 text-sm"
              style={{ fontFamily: 'Fira Code, monospace', color: '#D4D4D8' }}
            >
              pnpm add @topojs/core @topojs/react
            </span>
            <button
              onClick={handleCopy}
              className="transition-colors ml-1"
              style={{ color: copied ? '#4d9bff' : '#52525B' }}
              title="Copy"
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </button>
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap gap-4">
            <a
              href="#quickstart"
              className="inline-flex items-center gap-2 font-medium px-6 py-3 rounded-lg transition-all text-sm"
              style={{ background: '#4d9bff', color: '#000' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#3a8bff')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#4d9bff')}
            >
              Get Started →
            </a>
            <a
              href="https://github.com/creativoma/topo"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-medium px-6 py-3 rounded-lg transition-all text-sm"
              style={{ color: '#A1A1AA', border: '1px solid rgba(255,255,255,0.08)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#fff';
                e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#A1A1AA';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
              }}
            >
              <GitHubIcon />
              View on GitHub
            </a>
          </div>
        </div>

        {/* ── Right: React Flow graph ── */}
        <div className="hidden lg:flex justify-center items-center">
          <GraphDiagram />
        </div>
      </div>
    </section>
  );
}
