import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['localhost', 'singles-fits-teenage-corresponding.trycloudflare.com'],
    proxy: {
      '/api': 'http://localhost:3001',
      '/i':   'http://localhost:3001',
    },
  },
})
