import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const faqs: { q: string; a: string | React.ReactNode }[] = [
  {
    q: "Isn't this just Zustand/Redux with extra steps?",
    a: (
      <>
        Zustand and Redux give you a flat store or a tree. You're still responsible for manually
        keeping derived values in sync — usually via{' '}
        <code
          className="text-xs px-1 py-0.5 rounded"
          style={{
            fontFamily: 'Fira Code, monospace',
            background: 'rgba(255,255,255,0.06)',
            color: '#FDE68A',
          }}
        >
          useEffect
        </code>{' '}
        or selectors that don't compose. TopoJS makes the dependency graph a first-class citizen:
        you declare what derives from what, and the runtime guarantees propagation order. The
        difference isn't syntax — it's that hidden coupling becomes impossible to express.
      </>
    ),
  },
  {
    q: 'Jotai and Recoil also have derived atoms. Same thing?',
    a: "Atoms describe individual pieces of state. Derived atoms let you compute one value from others — but there's no shared graph you can introspect, no cycle detection, no per-edge consistency semantics, and no propagation order guarantees across the whole space. TopoJS models the entire statespace as a named, queryable topology. You can ask any node what it affects, what order things update, and whether a cycle exists — at runtime, from any component.",
  },
  {
    q: 'MobX is already reactive and tracks dependencies automatically. Why bother?',
    a: "MobX uses implicit observation: dependencies are discovered at runtime by tracking which observables a computation accesses. That's powerful but opaque — the dependency graph lives in the runtime, not in your code. TopoJS is explicit by design. Every edge is declared, named, and visible in the topology object. You trade the magic for clarity: the graph is your documentation, and the compiler can verify it.",
  },
  {
    q: 'XState handles complex state too. How are they different?',
    a: "XState is excellent for modeling control flow — finite states, transitions, guards, actors. TopoJS is for data state with structured relationships: nodes that derive values from other nodes, conditions that gate behaviour, effects that propagate downstream. They solve different problems and can coexist. Use XState for 'what mode is the app in', use TopoJS for 'what is the computed value of this node given the current graph state'.",
  },
  {
    q: 'Can I use it without React?',
    a: (
      <>
        Yes.{' '}
        <code
          className="text-xs px-1 py-0.5 rounded"
          style={{
            fontFamily: 'Fira Code, monospace',
            background: 'rgba(255,255,255,0.06)',
            color: '#FDE68A',
          }}
        >
          @topojs/core
        </code>{' '}
        has zero dependencies and no framework coupling. The React hooks in{' '}
        <code
          className="text-xs px-1 py-0.5 rounded"
          style={{
            fontFamily: 'Fira Code, monospace',
            background: 'rgba(255,255,255,0.06)',
            color: '#FDE68A',
          }}
        >
          @topojs/react
        </code>{' '}
        are a thin layer on top — you can use the core runtime directly in Node.js, vanilla TS, or
        any other framework.
      </>
    ),
  },
  {
    q: 'What about TanStack Query / SWR for async derived state?',
    a: "TanStack Query is the right tool for server state — caching, background refetches, stale-while-revalidate. TopoJS is for client state where nodes relate to each other. They're complementary: use TanStack Query to fetch data, feed it into a TopoJS node, and let the graph propagate downstream effects automatically.",
  },
  {
    q: "Isn't a global graph just global state with a worse API?",
    a: "Global state without structure is exactly the problem TopoJS solves. The graph isn't just a bucket — it has declared edges, typed nodes, cycle constraints, and introspectable topology. You can scope statespaces per-feature and compose them. The structure is what makes the state legible and safe at scale.",
  },
];

function Item({ q, a }: { q: string; a: string | React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
    >
      <button
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left cursor-pointer"
        style={{ background: 'transparent' }}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span
          className="font-semibold text-sm"
          style={{ fontFamily: 'Syne, sans-serif', color: '#E4E4E7' }}
        >
          {q}
        </span>
        <ChevronDown
          size={16}
          style={{
            color: '#4d9bff',
            flexShrink: 0,
            transition: 'transform 0.2s ease',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {open && (
        <div
          className="px-6 pb-5 text-sm leading-relaxed"
          style={{ color: '#A1A1AA', borderTop: '1px solid rgba(255,255,255,0.04)' }}
        >
          <p className="pt-4">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function FAQ() {
  return (
    <section className="py-28" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="max-w-3xl mx-auto px-6">
        <div className="mb-14">
          <p
            className="text-xs font-medium tracking-widest uppercase mb-4"
            style={{ fontFamily: 'Fira Code, monospace', color: '#4d9bff' }}
          >
            FAQ
          </p>
          <h2
            className="text-4xl font-bold leading-tight"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            Common questions
          </h2>
          <p className="mt-4 text-base max-w-lg" style={{ color: '#71717A' }}>
            Yes, we know what you're thinking. Here's how TopoJS compares.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq) => (
            <Item key={faq.q} q={faq.q} a={faq.a} />
          ))}
        </div>
      </div>
    </section>
  );
}
