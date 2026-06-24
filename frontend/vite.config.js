import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// El frontend hace peticiones a /api y Vite las redirige al backend Django,
// evitando problemas de CORS en desarrollo.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // escucha en 0.0.0.0 para ser accesible dentro de Docker
    port: 5173,
    proxy: {
      '/api': {
        // En Docker apunta al servicio backend; local, a localhost.
        target: process.env.API_PROXY_TARGET || 'http://localhost:8000',
        // changeOrigin false: conserva el Host "localhost" (lo permite ALLOWED_HOSTS).
        changeOrigin: false,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
  },
})
