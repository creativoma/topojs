import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const corePkg = JSON.parse(
  readFileSync(resolve(__dirname, '../../packages/core/package.json'), 'utf-8'),
) as { version: string };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __TOPO_VERSION__: JSON.stringify(corePkg.version),
  },
});
