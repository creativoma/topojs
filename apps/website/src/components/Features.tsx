import type { LucideProps } from 'lucide-react';
import { ArrowLeftRight, Layers, Network, RefreshCcw, Target, Zap } from 'lucide-react';
import type { FC } from 'react';

const features: { icon: FC<LucideProps>; title: string; description: string }[] = [
  {
    icon: ArrowLeftRight,
    title: 'Declared Dependencies',
    description:
      'Every relationship between state nodes is explicit. No hidden coupling, no surprise updates. The topology is your documentation.',
  },
  {
    icon: RefreshCcw,
    title: 'Cycle Detection',
    description:
      'Circular dependencies are caught at startup — before they crash your app at 3am. Define guarded nodes and TopoJS enforces the constraint.',
  },
  {
    icon: Zap,
    title: 'Optimal Updates',
    description:
      'TopoJS computes the minimal propagation set using topological sort. Only what actually changed gets recomputed. Nothing more.',
  },
  {
    icon: Target,
    title: 'Minimal Subscriptions',
    description:
      'Components subscribe to exactly what they need. useNode gives you a single value; useSyncExternalStore ensures no stale renders.',
  },
  {
    icon: Network,
    title: 'Graph Introspection',
    description:
      'Query what any node depends on, what it affects downstream, and the full propagation order — at runtime, from any component.',
  },
  {
    icon: Layers,
    title: 'Consistency Modes',
    description:
      "Strong consistency for cart totals, eventual consistency for recommendations. Choose per-edge semantics that match your domain's requirements.",
  },
];

export default function Features() {
  return (
    <section className="py-28" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="max-w-5xl mx-auto px-6">
        {/* Section label */}
        <div className="mb-14">
          <p
            className="text-xs font-medium tracking-widest uppercase mb-4"
            style={{ fontFamily: 'Fira Code, monospace', color: '#4d9bff' }}
          >
            Features
          </p>
          <h2
            className="text-4xl font-bold leading-tight"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            Built for real graph state
          </h2>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div key={f.title} className="card-glow rounded-xl p-6 space-y-3">
              <div
                className="w-10 h-10 flex items-center justify-center rounded-lg"
                style={{ background: 'rgba(77,155,255,0.1)', color: '#4d9bff' }}
              >
                <f.icon size={20} />
              </div>
              <h3
                className="font-semibold text-base text-white"
                style={{ fontFamily: 'Syne, sans-serif' }}
              >
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: '#71717A' }}>
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
