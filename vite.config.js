import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    basicSsl() // Enables HTTPS with a self-signed certificate
  ],
  server: {
    https: true,
    proxy: {
      // Proxy API requests to the backend to avoid Mixed Content errors
      '/api': {
        target: 'https://localhost:5174',
        changeOrigin: true,
        secure: false
      },
      // Also proxy the dynamic env file if needed during dev
      '/env.js': {
        target: 'https://localhost:5174',
        changeOrigin: true,
        secure: false
      }
    }
  }
})