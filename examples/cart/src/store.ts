import { derives, node, requires, statespace } from '@topojs/core';

export type Membership = 'free' | 'plus' | 'premium';

export interface Product {
  id: string;
  name: string;
  price: number;
}

export interface CartItem extends Product {
  qty: number;
}

export const PRODUCTS: Product[] = [
  { id: 'p1', name: 'Mechanical Keyboard', price: 149 },
  { id: 'p2', name: 'Ergonomic Mouse', price: 89 },
  { id: 'p3', name: 'Monitor Stand', price: 59 },
  { id: 'p4', name: 'USB-C Hub', price: 49 },
  { id: 'p5', name: 'Webcam', price: 119 },
];

export const CartSpace = statespace('Cart', {
  nodes: {
    user: node({
      initial: { membership: 'free' as Membership, authenticated: false },
    }),
    cart: node({
      initial: { items: [] as CartItem[], discount: 0 },
    }),
    checkout: node({
      initial: { canProceed: false },
    }),
  },

  topology: {
    'cart.discount': derives(['user.membership'], (membership) => {
      if (membership === 'premium') return 0.2;
      if (membership === 'plus') return 0.1;
      return 0;
    }),
    'checkout.canProceed': requires(['cart.items.length > 0', 'user.authenticated']),
  },

  constraints: {
    noCyclesThrough: ['checkout'],
    strongConsistency: ['cart.discount'],
  },
});
