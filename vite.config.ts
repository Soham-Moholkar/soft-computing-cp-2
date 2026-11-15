import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';
import vinext from 'vinext';
import { defineConfig } from 'vite';

export default defineConfig({
  css: { postcss: { plugins: [tailwindcss()] } },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [
      {
        find: /^use-sync-external-store\/shim$/,
        replacement: fileURLToPath(new URL('./lib/compat/use-sync-external-store-shim.ts', import.meta.url)),
      },
      {
        find: /^use-sync-external-store\/shim\/with-selector$/,
        replacement: fileURLToPath(new URL('./lib/compat/use-sync-external-store-with-selector.ts', import.meta.url)),
      },
    ],
  },
  optimizeDeps: { exclude: ['@base-ui/react', 'lucide-react'] },
  server: {
    host: '127.0.0.1',
    port: 3001,
    strictPort: true,
    ...(process.env.CODEX_SANDBOX === 'seatbelt'
      ? { watch: { useFsEvents: false, usePolling: true } }
      : {}),
  },
  plugins: [vinext()],
});
