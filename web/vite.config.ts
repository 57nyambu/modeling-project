import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The React app calls /api/...; Vite forwards those requests to Django on port 8000,
// so the browser sees one origin and no CORS setup is needed.
const proxy = { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true } }

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy },
  preview: { port: 4173, proxy },
})
