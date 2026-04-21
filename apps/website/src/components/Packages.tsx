import { useState } from 'react';

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

function ExternalLinkIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

const packages = [
  {
    name: '@topojs/core',
    description:
      'Runtime engine with statespace, nodes, edges, cycle detection, and optimal propagation. Zero dependencies, framework-agnostic.',
    tags: ['Zero dependencies', 'Cycle detection', 'Framework agnostic'],
    install: 'pnpm add @topojs/core',
    npmUrl: 'https://www.npmjs.com/package/@topojs/core',
  },
  {
    name: '@topojs/react',
    description:
      'React hooks built on useSyncExternalStore. Includes useNode, useNodes, useMutation, useTopology, and useTopologyEvent.',
    tags: ['useSyncExternalStore', 'useNode hook', 'Mutation helpers'],
    install: 'pnpm add @topojs/react',
    npmUrl: 'https://www.npmjs.com/package/@topojs/react',
  },
  {
    name: '@topojs/vite',
    description:
      'Vite plugin with optional /topo visualizer middleware. Inspect your statespace graph during development.',
    tags: ['Vite plugin', 'Graph visualizer', 'Dev middleware'],
    install: 'pnpm add -D @topojs/vite',
    npmUrl: 'https://www.npmjs.com/package/@topojs/vite',
  },
  {
    name: '@topojs/cli',
    description:
      'CLI binary for analyzing, visualizing, checking, optimizing, exporting, and tracing your topology at the terminal.',
    tags: ['analyze', 'visualize', 'trace'],
    install: 'pnpm add -D @topojs/cli',
    npmUrl: 'https://www.npmjs.com/package/@topojs/cli',
  },
];

function PackageCard({ pkg }: { pkg: (typeof packages)[0] }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(pkg.install).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card-glow rounded-xl p-6 flex flex-col gap-5" style={{ background: '#0d0d0d' }}>
      {/* Header */}
      <span
        className="text-sm font-semibold text-white"
        style={{ fontFamily: 'Fira Code, monospace' }}
      >
        {pkg.name}
      </span>

      {/* Description */}
      <p className="text-sm leading-relaxed flex-1" style={{ color: '#71717A' }}>
        {pkg.description}
      </p>

      {/* Tags */}
      <div className="flex flex-wrap gap-2">
        {pkg.tags.map((tag) => (
          <span
            key={tag}
            className="text-xs px-2.5 py-1 rounded"
            style={{
              fontFamily: 'Fira Code, monospace',
              color: '#A1A1AA',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Install command */}
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-lg"
        style={{
          background: '#0a0a0a',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <span
          className="flex-1 text-sm truncate"
          style={{ fontFamily: 'Fira Code, monospace', color: '#D4D4D8' }}
        >
          {pkg.install}
        </span>
        <button
          onClick={handleCopy}
          className="shrink-0 transition-colors"
          style={{ color: copied ? '#4d9bff' : '#52525B' }}
          title="Copy"
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
      </div>

      {/* View on npm */}
      <a
        href={pkg.npmUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 text-xs font-medium py-2 rounded-lg transition-all"
        style={{
          color: '#52525B',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#CB3837';
          e.currentTarget.style.borderColor = 'rgba(203,56,55,0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#52525B';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
        }}
      >
        View on npm
        <ExternalLinkIcon />
      </a>
    </div>
  );
}

export default function Packages() {
  return (
    <section className="py-28" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="max-w-5xl mx-auto px-6">
        {/* Header */}
        <div className="mb-14 text-center">
          <p
            className="text-xs font-medium tracking-widest uppercase mb-4"
            style={{ fontFamily: 'Fira Code, monospace', color: '#4d9bff' }}
          >
            Packages
          </p>
          <h2
            className="text-4xl font-bold leading-tight mb-4"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            Install only what you need
          </h2>
          <p className="text-base max-w-xl mx-auto" style={{ color: '#71717A' }}>
            A focused toolkit for graph-topology state. From the core runtime to React hooks, Vite
            integration, and CLI tooling.
          </p>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 gap-4">
          {packages.map((pkg) => (
            <PackageCard key={pkg.name} pkg={pkg} />
          ))}
        </div>
      </div>
    </section>
  );
}
