import { useState } from 'react';

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="text-xs px-4 py-2 rounded-md transition-all"
      style={{
        fontFamily: 'Fira Code, monospace',
        background: active ? 'rgba(77,155,255,0.15)' : 'transparent',
        color: active ? '#4d9bff' : '#52525B',
        border: active ? '1px solid rgba(77,155,255,0.25)' : '1px solid transparent',
      }}
    >
      {children}
    </button>
  );
}

function DefineCode() {
  return (
    <div className="code-surface">
      <pre>
        <code>
          <span className="tok-kw">import</span>
          {' { statespace, node, derives, requires, influencedBy }\n'}
          <span className="tok-kw">{'  from'}</span>{' '}
          <span className="tok-str">{"'@topojs/core'"}</span>
          {'\n\n'}
          <span className="tok-kw">const</span>
          {' CartSpace = '}
          <span className="tok-fn">statespace</span>
          {'('}
          <span className="tok-str">{"'Cart'"}</span>
          {', {\n'}
          {'  nodes: {\n'}
          {'    user: '}
          <span className="tok-fn">node</span>
          {'({\n'}
          {'      initial: { membership: '}
          <span className="tok-str">{"'free'"}</span>
          {' as '}
          <span className="tok-fn">Membership</span>
          {', authenticated: '}
          <span className="tok-num">false</span>
          {' },\n'}
          {'    }),\n'}
          {'    cart: '}
          <span className="tok-fn">node</span>({'({\n'}
          {'      initial: { items: [] as CartItem[], discount: '}
          <span className="tok-num">0</span>
          {' },\n'}
          {'    }),\n'}
          {'    checkout: '}
          <span className="tok-fn">node</span>({'({\n'}
          {'      initial: { canProceed: '}
          <span className="tok-num">false</span>
          {' },\n'}
          {'    }),\n'}
          {'  },\n\n'}
          {'  topology: {\n'}
          {'    '}
          <span className="tok-cm">{'// Derived synchronously from user.membership'}</span>
          {'\n'}
          {'    '}
          <span className="tok-str">{"'cart.discount'"}</span>
          {': '}
          <span className="tok-fn">derives</span>
          {'(['}
          <span className="tok-str">{"'user.membership'"}</span>
          {'], (m) =>\n'}
          {'      m === '}
          <span className="tok-str">{"'premium'"}</span>
          {' ? '}
          <span className="tok-num">0.2</span>
          {' : m === '}
          <span className="tok-str">{"'plus'"}</span>
          {' ? '}
          <span className="tok-num">0.1</span>
          {' : '}
          <span className="tok-num">0</span>
          {'\n'}
          {'    ),\n\n'}
          {'    '}
          <span className="tok-cm">
            {'// Boolean gate — blocks until both conditions are true'}
          </span>
          {'\n'}
          {'    '}
          <span className="tok-str">{"'checkout.canProceed'"}</span>
          {': '}
          <span className="tok-fn">requires</span>
          {'([\n'}
          {'      '}
          <span className="tok-str">{"'cart.items.length > 0'"}</span>
          {',\n'}
          {'      '}
          <span className="tok-str">{"'user.authenticated'"}</span>
          {',\n'}
          {'    ]),\n\n'}
          {'    '}
          <span className="tok-cm">{'// Eventual consistency — debounced influence'}</span>
          {'\n'}
          {'    '}
          <span className="tok-str">{"'user.recommendations'"}</span>
          {': '}
          <span className="tok-fn">influencedBy</span>
          {'(\n'}
          {'      ['}
          <span className="tok-str">{"'cart.items'"}</span>
          {'],\n'}
          {'      { debounce: '}
          <span className="tok-str">{"'500ms'"}</span>
          {' },\n'}
          {'    ),\n'}
          {'  },\n\n'}
          {'  constraints: {\n'}
          {'    noCyclesThrough:  ['}
          <span className="tok-str">{"'checkout'"}</span>
          {'],\n'}
          {'    strongConsistency: ['}
          <span className="tok-str">{"'cart.discount'"}</span>
          {'],\n'}
          {'  },\n'}
          {'})\n'}
        </code>
      </pre>
    </div>
  );
}

function UseCode() {
  return (
    <div className="code-surface">
      <pre>
        <code>
          <span className="tok-kw">import</span>
          {' { useNode, useMutation } '}
          <span className="tok-kw">from</span> <span className="tok-str">{"'@topojs/react'"}</span>
          {'\n'}
          <span className="tok-kw">import</span>
          {' { CartSpace } '}
          <span className="tok-kw">from</span> <span className="tok-str">{"'./store'"}</span>
          {'\n\n'}
          <span className="tok-kw">function</span> <span className="tok-fn">CartSummary</span>
          {'() {\n'}
          {'  '}
          <span className="tok-cm">
            {'// Subscribe to a node — re-renders only when it changes'}
          </span>
          {'\n'}
          {'  '}
          <span className="tok-kw">const</span>
          {' discount = '}
          <span className="tok-fn">useNode</span>
          {'<'}
          <span className="tok-fn">number</span>
          {'>(CartSpace, '}
          <span className="tok-str">{"'cart.discount'"}</span>
          {')\n'}
          {'  '}
          <span className="tok-kw">const</span>
          {' canProceed = '}
          <span className="tok-fn">useNode</span>
          {'<'}
          <span className="tok-fn">boolean</span>
          {'>(CartSpace, '}
          <span className="tok-str">{"'checkout.canProceed'"}</span>
          {')\n\n'}
          {'  '}
          <span className="tok-cm">{'// Topology-aware mutations — propagates automatically'}</span>
          {'\n'}
          {'  '}
          <span className="tok-kw">const</span>
          {' { append } = '}
          <span className="tok-fn">useMutation</span>
          {'(CartSpace, '}
          <span className="tok-str">{"'cart.items'"}</span>
          {')\n\n'}
          {'  '}
          <span className="tok-kw">return</span>
          {' (\n'}
          {'    <div>\n'}
          {'      {discount > '}
          <span className="tok-num">0</span>
          {'  && <DiscountBadge amount={discount} />}\n'}
          {'      <AddToCart '}
          <span className="tok-prop">onAdd</span>
          {'={append} />\n'}
          {'      <CheckoutButton '}
          <span className="tok-prop">disabled</span>
          {'={!canProceed} />\n'}
          {'    </div>\n'}
          {'  )\n'}
          {'}\n'}
        </code>
      </pre>
    </div>
  );
}

export default function QuickStart() {
  const [tab, setTab] = useState<'define' | 'use'>('define');

  return (
    <section
      id="quickstart"
      className="py-28"
      style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
    >
      <div className="max-w-5xl mx-auto px-6">
        {/* Section label */}
        <div className="mb-14">
          <p
            className="text-xs font-medium tracking-widest uppercase mb-4"
            style={{ fontFamily: 'Fira Code, monospace', color: '#4d9bff' }}
          >
            Quick Start
          </p>
          <h2
            className="text-4xl font-bold leading-tight"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            Zero to topology in minutes
          </h2>
          <p className="mt-4 text-base max-w-xl" style={{ color: '#71717A' }}>
            Define your statespace once. Every derived value, every constraint, every subscription
            is handled automatically.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <TabButton active={tab === 'define'} onClick={() => setTab('define')}>
            1. Define statespace
          </TabButton>
          <TabButton active={tab === 'use'} onClick={() => setTab('use')}>
            2. Use in React
          </TabButton>
        </div>

        {/* Code panel */}
        {tab === 'define' ? <DefineCode /> : <UseCode />}

        {/* Package pills */}
        <div className="mt-8 flex flex-wrap gap-3">
          {['@topojs/core', '@topojs/react', '@topojs/vite', '@topojs/cli'].map((pkg) => (
            <span
              key={pkg}
              className="text-xs px-3 py-1.5 rounded-full"
              style={{
                fontFamily: 'Fira Code, monospace',
                color: '#4d9bff',
                background: 'rgba(77,155,255,0.07)',
                border: '1px solid rgba(77,155,255,0.15)',
              }}
            >
              {pkg}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
