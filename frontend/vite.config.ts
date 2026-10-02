/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
  build: {
    rollupOptions: {
      output: {
        // Keep big libraries in their own cached chunks.
        manualChunks(id: string) {
          if (id.includes('@fullcalendar')) return 'calendar'
          if (id.includes('framer-motion')) return 'motion'
          if (id.includes('node_modules/react') || id.includes('react-router')) return 'react'
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
})
