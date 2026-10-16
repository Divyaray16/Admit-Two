import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { invitationApi } from './server/plugin.ts'

export default defineConfig({
  plugins: [invitationApi(), react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 4731,
    strictPort: true,
    allowedHosts: ['.trycloudflare.com'],
    watch: {
      ignored: ['**/data/**'],
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4731,
    strictPort: true,
    allowedHosts: ['.trycloudflare.com'],
  },
})
