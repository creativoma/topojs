import { useMutation, useNode, useTopology } from '@topojs/react';
import { CartSpace, PRODUCTS, type CartItem, type Membership } from './store';

// ─── primitives ──────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
        paddingBottom: 12,
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}
      >
        {children}
      </span>
    </div>
  );
}

function CodeChip({
  children,
  variant = 'default',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'blue' | 'dim';
}) {
  const styles = {
    default: { bg: 'var(--surface-2)', color: 'var(--text-muted)', border: 'var(--border)' },
    blue: { bg: 'var(--blue-dim)', color: 'var(--blue)', border: 'var(--blue-border)' },
    dim: { bg: 'transparent', color: 'var(--text-faint)', border: 'var(--border-subtle)' },
  }[variant];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: styles.bg,
        color: styles.color,
        border: `1px solid ${styles.border}`,
        borderRadius: 4,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: '0.03em',
        padding: '2px 7px',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

function TechLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: 'var(--blue)',
        fontWeight: 500,
        letterSpacing: '0.04em',
        opacity: 0.8,
      }}
    >
      {children}
    </span>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}
    >
      <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 400 }}>{label}</span>
      {children}
    </div>
  );
}

// ─── live state block ─────────────────────────────────────────────────────────

function StateBlock({ entries }: { entries: [string, unknown][] }) {
  return (
    <div
      style={{
        marginTop: 16,
        padding: '10px 12px',
        background: 'rgba(77,155,255,0.04)',
        border: '1px solid rgba(77,155,255,0.12)',
        borderRadius: 6,
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
      }}
    >
      {entries.map(([key, val]) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--blue)',
              minWidth: 120,
            }}
          >
            {key}
          </span>
          <span
            style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}
          >
            {JSON.stringify(val)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── panels ──────────────────────────────────────────────────────────────────

function UserPanel() {
  const user = useNode<{ membership: Membership; authenticated: boolean }>(CartSpace, 'user');
  const userMutation = useMutation(CartSpace, 'user');
  const topo = useTopology(CartSpace, 'user.membership');

  return (
    <section style={card}>
      <SectionLabel>Identity</SectionLabel>

      <FieldRow label="Authenticated">
        <input
          type="checkbox"
          checked={user.authenticated}
          onChange={(e) => userMutation.set({ ...user, authenticated: e.target.checked })}
        />
      </FieldRow>

      <FieldRow label="Membership tier">
        <select
          value={user.membership}
          onChange={(e) => userMutation.set({ ...user, membership: e.target.value as Membership })}
        >
          <option value="free">Free</option>
          <option value="plus">Plus (+10%)</option>
          <option value="premium">Premium (+20%)</option>
        </select>
      </FieldRow>

      {topo.affects.length > 0 && (
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}
        >
          <TechLabel>affects</TechLabel>
          {topo.affects.map((p) => (
            <CodeChip key={p} variant="blue">
              {p}
            </CodeChip>
          ))}
        </div>
      )}

      <StateBlock
        entries={[
          ['user.authenticated', user.authenticated],
          ['user.membership', user.membership],
        ]}
      />
    </section>
  );
}

function ProductList() {
  const cart = useNode<{ items: CartItem[] }>(CartSpace, 'cart');
  const itemsMutation = useMutation(CartSpace, 'cart.items');

  const addItem = (product: (typeof PRODUCTS)[0]) => {
    const existing = cart.items.find((i) => i.id === product.id);
    if (existing) {
      itemsMutation.set(
        cart.items.map((i) => (i.id === product.id ? { ...i, qty: i.qty + 1 } : i)),
      );
    } else {
      itemsMutation.append({ ...product, qty: 1 });
    }
  };

  return (
    <section style={card}>
      <SectionLabel>Products</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {PRODUCTS.map((p) => {
          const inCart = cart.items.find((i) => i.id === p.id);
          return (
            <div
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '9px 0',
                borderBottom: '1px solid var(--border-subtle)',
                gap: 12,
              }}
            >
              <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', fontWeight: 400 }}>
                {p.name}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: 'var(--text-faint)',
                  minWidth: 40,
                  textAlign: 'right',
                }}
              >
                ${p.price}
              </span>
              <button
                onClick={() => addItem(p)}
                style={{
                  ...btnBase,
                  minWidth: inCart ? 68 : 52,
                  background: inCart ? 'var(--blue-dim)' : 'var(--surface-2)',
                  color: inCart ? 'var(--blue)' : 'var(--text-muted)',
                  borderColor: inCart ? 'var(--blue-border)' : 'var(--border)',
                }}
              >
                {inCart ? `+1 (${inCart.qty})` : 'Add'}
              </button>
            </div>
          );
        })}
      </div>

      <StateBlock
        entries={[
          ['cart.items.length', cart.items.length],
          ['cart.items', cart.items.map((i) => `${i.id}×${i.qty}`)],
        ]}
      />
    </section>
  );
}

function CartPanel() {
  const cart = useNode<{ items: CartItem[]; discount: number }>(CartSpace, 'cart');
  const checkout = useNode<{ canProceed: boolean }>(CartSpace, 'checkout');
  const itemsMutation = useMutation(CartSpace, 'cart.items');
  const topo = useTopology(CartSpace, 'cart.discount');

  const subtotal = cart.items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const discountAmount = subtotal * cart.discount;
  const total = subtotal - discountAmount;

  const remove = (id: string) => itemsMutation.set(cart.items.filter((i) => i.id !== id));

  return (
    <section style={{ ...card, gridColumn: '1 / -1' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* left: items */}
        <div>
          <SectionLabel>Cart</SectionLabel>

          {cart.items.length === 0 ? (
            <p
              style={{
                fontSize: 13,
                color: 'var(--text-faint)',
                padding: '16px 0',
                textAlign: 'center',
              }}
            >
              No items added
            </p>
          ) : (
            <>
              {cart.items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 0',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>
                    {item.name}
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        color: 'var(--text-faint)',
                        marginLeft: 6,
                      }}
                    >
                      ×{item.qty}
                    </span>
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      color: 'var(--text-muted)',
                      minWidth: 40,
                      textAlign: 'right',
                    }}
                  >
                    ${item.price * item.qty}
                  </span>
                  <button
                    onClick={() => remove(item.id)}
                    title="Remove"
                    style={{ ...btnBase, padding: '4px 8px', fontSize: 13, lineHeight: 1 }}
                  >
                    ×
                  </button>
                </div>
              ))}

              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    color: 'var(--text-muted)',
                  }}
                >
                  <span>Subtotal</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>${subtotal}</span>
                </div>
                {cart.discount > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 12,
                    }}
                  >
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        color: 'var(--text-muted)',
                      }}
                    >
                      Discount ({cart.discount * 100}%)
                      {topo.dependsOn[0] && <CodeChip variant="blue">{topo.dependsOn[0]}</CodeChip>}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      −${discountAmount.toFixed(2)}
                    </span>
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    paddingTop: 8,
                    marginTop: 2,
                    borderTop: '1px solid var(--border)',
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  <span>Total</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>${total.toFixed(2)}</span>
                </div>
              </div>
            </>
          )}

          <button
            disabled={!checkout.canProceed}
            style={{
              width: '100%',
              marginTop: 16,
              padding: '10px 0',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              border: checkout.canProceed
                ? '1px solid rgba(255,255,255,0.2)'
                : '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              background: checkout.canProceed ? 'rgba(255,255,255,0.07)' : 'transparent',
              color: checkout.canProceed ? 'var(--text)' : 'var(--text-faint)',
              cursor: checkout.canProceed ? 'pointer' : 'not-allowed',
              letterSpacing: '0.02em',
              transition: 'background 0.15s, border-color 0.15s',
            }}
          >
            {checkout.canProceed ? 'Proceed to checkout' : 'Requires items + authentication'}
          </button>
        </div>

        {/* right: runtime values */}
        <div>
          <SectionLabel>Runtime state</SectionLabel>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <StateEntry
              path="cart.discount"
              value={cart.discount}
              note={`derives(['user.membership'])`}
            />
            <StateEntry path="cart.items.length" value={cart.items.length} />
            <StateEntry
              path="checkout.canProceed"
              value={checkout.canProceed}
              note={`requires(['cart.items.length > 0', 'user.authenticated'])`}
            />
          </div>

          <div style={{ marginTop: 20 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                color: 'var(--text-faint)',
                marginBottom: 10,
              }}
            >
              Topology edges
            </div>
            <EdgeBlock
              target="cart.discount"
              kind="derives"
              code={`derives(\n  ['user.membership'],\n  m => m==='premium' ? 0.2\n     : m==='plus'    ? 0.1 : 0\n)`}
            />
            <EdgeBlock
              target="checkout.canProceed"
              kind="requires"
              code={`requires([\n  'cart.items.length > 0',\n  'user.authenticated'\n])`}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function StateEntry({ path, value, note }: { path: string; value: unknown; note?: string }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        background: 'rgba(77,155,255,0.04)',
        border: '1px solid rgba(77,155,255,0.1)',
        borderRadius: 6,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: note ? 5 : 0,
        }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--blue)' }}>
          {path}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--text)',
            fontWeight: 500,
          }}
        >
          {JSON.stringify(value)}
        </span>
      </div>
      {note && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faint)' }}>
          {note}
        </span>
      )}
    </div>
  );
}

function EdgeBlock({
  target,
  kind,
  code,
}: {
  target: string;
  kind: 'derives' | 'requires';
  code: string;
}) {
  return (
    <div
      style={{
        marginBottom: 10,
        borderRadius: 6,
        overflow: 'hidden',
        border: '1px solid rgba(77,155,255,0.12)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          background: 'rgba(77,155,255,0.07)',
          borderBottom: '1px solid rgba(77,155,255,0.1)',
        }}
      >
        <span
          style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--blue)', flex: 1 }}
        >
          {target}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: kind === 'derives' ? 'rgba(77,155,255,0.7)' : 'rgba(180,140,255,0.7)',
            background: kind === 'derives' ? 'rgba(77,155,255,0.1)' : 'rgba(180,140,255,0.1)',
            padding: '2px 6px',
            borderRadius: 3,
          }}
        >
          {kind}
        </span>
      </div>
      <pre
        style={{
          padding: '10px 12px',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          lineHeight: 1.7,
          color: 'var(--text-muted)',
          background: 'var(--surface)',
          margin: 0,
          overflowX: 'auto',
          whiteSpace: 'pre',
        }}
      >
        {code}
      </pre>
    </div>
  );
}

function TopologyPanel() {
  const cartTopo = useTopology(CartSpace, 'cart');
  const checkoutTopo = useTopology(CartSpace, 'checkout.canProceed');

  return (
    <section style={{ ...card, gridColumn: '1 / -1' }}>
      <SectionLabel>Topology graph</SectionLabel>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '180px 1fr 1fr 1fr',
          gap: 12,
          paddingBottom: 8,
          borderBottom: '1px solid var(--border)',
        }}
      >
        {['Node', 'Depends on', 'Affects', 'Update order'].map((col) => (
          <span
            key={col}
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-faint)',
            }}
          >
            {col}
          </span>
        ))}
      </div>
      <TopoRow label="cart" topo={cartTopo} />
      <TopoRow label="checkout.canProceed" topo={checkoutTopo} />
    </section>
  );
}

function TopoRow({
  label,
  topo,
}: {
  label: string;
  topo: { dependsOn: string[]; affects: string[]; updateOrder: string[] };
}) {
  return (
    <div
      style={{
        padding: '12px 0',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'grid',
        gridTemplateColumns: '180px 1fr 1fr 1fr',
        gap: 12,
        alignItems: 'start',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--blue)',
          fontWeight: 500,
        }}
      >
        {label}
      </span>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {topo.dependsOn.length > 0 ? (
          topo.dependsOn.map((p) => (
            <CodeChip key={p} variant="blue">
              {p}
            </CodeChip>
          ))
        ) : (
          <span
            style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}
          >
            —
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {topo.affects.length > 0 ? (
          topo.affects.map((p) => (
            <CodeChip key={p} variant="dim">
              {p}
            </CodeChip>
          ))
        ) : (
          <span
            style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}
          >
            —
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        {topo.updateOrder.map((p, i) => (
          <span key={p} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <CodeChip>{p}</CodeChip>
            {i < topo.updateOrder.length - 1 && (
              <span style={{ color: 'var(--text-faint)', fontSize: 10 }}>›</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── app root ────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '48px 20px' }}>
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--blue)',
              background: 'var(--blue-dim)',
              border: '1px solid var(--blue-border)',
              borderRadius: 4,
              padding: '3px 8px',
            }}
          >
            @topojs/react
          </span>
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: '-0.025em',
            color: 'var(--text)',
            lineHeight: 1.2,
            marginBottom: 8,
          }}
        >
          Cart Demo
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 400, maxWidth: 480 }}>
          State as graph topology. Derived values, reactive dependencies, and constraint validation
          — all declared in one statespace.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <UserPanel />
        <ProductList />
        <CartPanel />
        <TopologyPanel />
      </div>
    </div>
  );
}

// ─── shared styles ───────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '20px 22px',
};

const btnBase: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 500,
  fontFamily: 'var(--font-mono)',
  padding: '5px 12px',
  transition: 'background 0.12s, color 0.12s, border-color 0.12s',
  letterSpacing: '0.01em',
};
