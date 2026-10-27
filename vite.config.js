import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: 'demo',
  // OpenUI's source entry expects this compile-time environment value.
  define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  resolve: {
    alias: {
      '@openuidev/lang-core': fileURLToPath(new URL('./openui/packages/lang-core/src/index.ts', import.meta.url)),
      '@openuidev/observability': fileURLToPath(new URL('./openui/packages/observability/src/index.ts', import.meta.url)),
      '@openuidev/react-lang': fileURLToPath(new URL('./openui/packages/react-lang/src/exports.ts', import.meta.url)),
      '@base-ui/utils': fileURLToPath(new URL('./base-ui/packages/utils/src', import.meta.url)),
    },
    dedupe: ['react', 'react-dom'],
  },
});
