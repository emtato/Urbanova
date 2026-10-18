import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: process.env.BASE_PATH || './',
  plugins: [react()],
  // Standalone viewers in public/ resolve their own import maps in the browser.
  optimizeDeps: { entries: ['index.html'] },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:8010' },
  },
})
