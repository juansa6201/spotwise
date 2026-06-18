import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// El frontend hace peticiones a /api y Vite las redirige al backend Django,
// evitando problemas de CORS en desarrollo.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
