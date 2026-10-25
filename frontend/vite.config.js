import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const rootEnv = loadEnv(mode, path.resolve(process.cwd(), '..'), '')
  const demoMode = (
    env.VITE_DEMO_MODE ??
    env.DEMO_MODE ??
    rootEnv.VITE_DEMO_MODE ??
    rootEnv.DEMO_MODE ??
    'true'
  )

  return {
    define: {
      'import.meta.env.VITE_DEMO_MODE': JSON.stringify(demoMode),
    },
    plugins: [
      tailwindcss(),
      react()
    ],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true
        }
      }
    }
  }
})
