import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  cacheDir: process.env.VITE_CACHE_DIR || resolve(process.cwd(), 'node_modules', `.vite-slsu-${process.pid}`),
  server: {
    port: Number(process.env.VITE_PORT || 5173),
    host: '0.0.0.0',
    proxy: {
      '/api': process.env.API_PROXY_TARGET || 'http://127.0.0.1:3001',
    },
  },
})
