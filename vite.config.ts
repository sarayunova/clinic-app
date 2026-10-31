import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: `npm run dev` (API on :3080) + `npm run dev:web` (UI on :5173, proxies /api).
export default defineConfig({
  root: 'web',
  plugins: [react()],
  build: { outDir: '../dist/web', emptyOutDir: true },
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:3080' } },
});
