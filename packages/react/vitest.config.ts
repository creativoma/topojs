import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'jsdom',
  },
  resolve: {
    alias: {
      '@topojs/core': resolve(__dirname, '../core/src/index.ts'),
    },
  },
});
