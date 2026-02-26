import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts:['flag-sentences-firm-boating.trycloudflare.com'],
    proxy: {
      '/api': 'http://localhost:3001',
      '/i':   'http://localhost:3001',
    },
  },
})
