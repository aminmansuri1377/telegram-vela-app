import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
export default defineConfig({ root: resolve(__dirname), envDir: resolve(__dirname, '../..'), plugins: [react()], server: { host: '0.0.0.0', port: 5173, proxy: { '/api': 'http://localhost:3001', '/socket.io': { target: 'http://localhost:3001', ws: true } } }, build: { outDir: '../../dist/web', emptyOutDir: true, rollupOptions: { output: { manualChunks: { react: ['react', 'react-dom', '@tanstack/react-query'], i18n: ['i18next', 'react-i18next'] } } } } });
