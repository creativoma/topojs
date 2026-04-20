import { Check, Lightbulb, X } from 'lucide-react';

function CodeBefore() {
  return (
    <div className="code-surface h-full">
      {/* Header bar */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 border-b text-xs"
        style={{
          borderColor: 'rgba(255,255,255,0.05)',
          background: 'rgba(239,68,68,0.05)',
          fontFamily: 'Fira Code, monospace',
          color: '#EF4444',
        }}
      >
        <X size={12} />
        <span style={{ color: '#6B7280' }}>Traditional — hidden dependencies</span>
      </div>
      <pre>
        <code>
          <span className="tok-cm">{'// Zustand / Redux approach'}</span>
          {'\n'}
          <span className="tok-kw">const</span>
          {' store = '}
          <span className="tok-fn">create</span>
          {'({\n'}
          {'  user:     { membership: '}
          <span className="tok-str">{"'free'"}</span>
          {' },\n'}
          {'  cart:     { items: [], discount: '}
          <span className="tok-num">{'0'}</span>
          {' },\n'}
          {'  checkout: { step: '}
          <span className="tok-str">{"'cart'"}</span>
          {' },\n'}
          {'})\n\n'}
          <span className="tok-cm">{'// Somewhere, somehow:'}</span>
          {'\n'}
          <span className="tok-fn">useEffect</span>
          {'(() => {\n'}
          {'  '}
          <span className="tok-kw">if</span>
          {' (user.membership === '}
          <span className="tok-str">{"'premium'"}</span>
          {')\n'}
          {'    '}
          <span className="tok-fn">setCart</span>
          {'({ ...cart, discount: '}
          <span className="tok-num">{'0.2'}</span>
          {' })\n'}
          {'}, [user.membership])\n\n'}
          <span className="tok-cm">{'// Hidden dependency — no declaration'}</span>
          {'\n'}
          <span className="tok-cm">{'// Mystery re-renders. Update order: ¯\\_(ツ)_/¯'}</span>
        </code>
      </pre>
    </div>
  );
}

function CodeAfter() {
  return (
    <div className="code-surface h-full">
      {/* Header bar */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 border-b text-xs"
        style={{
          borderColor: 'rgba(255,255,255,0.05)',
          background: 'rgba(77,155,255,0.06)',
          fontFamily: 'Fira Code, monospace',
          color: '#4d9bff',
        }}
      >
        <Check size={12} />
        <span style={{ color: '#6B7280' }}>Topo — explicit topology</span>
      </div>
      <pre>
        <code>
          <span className="tok-kw">const</span>
          {' CartSpace = '}
          <span className="tok-fn">statespace</span>
          {'('}
          <span className="tok-str">{"'Cart'"}</span>
          {', {\n'}
          {'  nodes: {\n'}
          {'    user: '}
          <span className="tok-fn">node</span>
          {'({ initial: { membership: '}
          <span className="tok-str">{"'free'"}</span>
          {' } }),\n'}
          {'    cart: '}
          <span className="tok-fn">node</span>
          {'({ initial: { items: [], discount: '}
          <span className="tok-num">{'0'}</span>
          {' } }),\n'}
          {'  },\n'}
          {'  topology: {\n'}
          {'    '}
          <span className="tok-cm">{'// Declared. Explicit. Compiler-verified.'}</span>
          {'\n'}
          {'    '}
          <span className="tok-str">{"'cart.discount'"}</span>
          {': '}
          <span className="tok-fn">derives</span>
          {'(\n'}
          {'      ['}
          <span className="tok-str">{"'user.membership'"}</span>
          {'],\n'}
          {'      m => m === '}
          <span className="tok-str">{"'premium'"}</span>
          {' ? '}
          <span className="tok-num">{'0.2'}</span>
          {' : '}
          <span className="tok-num">{'0'}</span>
          {'\n'}
          {'    ),\n'}
          {'  },\n'}
          {'  '}
          <span className="tok-cm">{'// Topo propagates it. Always. Optimally.'}</span>
          {'\n'}
          {'})\n'}
        </code>
      </pre>
    </div>
  );
}

export default function Problem() {
  return (
    <section className="py-28" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="max-w-5xl mx-auto px-6">
        {/* Section label */}
        <div className="mb-14">
          <p
            className="text-xs font-medium tracking-widest uppercase mb-4"
            style={{ fontFamily: 'Fira Code, monospace', color: '#4d9bff' }}
          >
            The Problem
          </p>
          <h2
            className="text-4xl font-bold leading-tight max-w-xl"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            The tree lie everyone just&nbsp;accepts
          </h2>
          <p className="mt-4 text-base max-w-lg" style={{ color: '#71717A' }}>
            Every state management library assumes your state is a tree. It's not. Real applications
            are graphs — and hiding that creates silent bugs.
          </p>
        </div>

        {/* Side-by-side code */}
        <div className="grid lg:grid-cols-2 gap-4">
          <CodeBefore />
          <CodeAfter />
        </div>

        {/* Bottom callout */}
        <div
          className="mt-8 rounded-lg px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3"
          style={{
            background: 'rgba(77,155,255,0.05)',
            border: '1px solid rgba(77,155,255,0.15)',
          }}
        >
          <Lightbulb size={18} style={{ color: '#4d9bff', flexShrink: 0 }} />
          <p className="text-sm" style={{ color: '#A1A1AA' }}>
            <strong style={{ color: '#E4E4E7' }}>With Topo</strong>, every dependency is declared in
            the topology. The runtime computes the correct update order automatically — no more{' '}
            <code
              className="text-xs px-1.5 py-0.5 rounded"
              style={{
                fontFamily: 'Fira Code, monospace',
                background: 'rgba(255,255,255,0.06)',
                color: '#FDE68A',
              }}
            >
              useEffect
            </code>{' '}
            chains chasing state.
          </p>
        </div>
      </div>
    </section>
  );
}
