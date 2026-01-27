import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-utils': ['dayjs', 'clsx', 'framer-motion', 'lucide-react'],
          'vendor-ui': ['date-fns', 'react-day-picker'],
        }
      }
    }
  }
})
