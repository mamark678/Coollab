import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { config } from 'dotenv'

// Load .env so non-VITE_ vars are available at build time
config()

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: 'src/main/index.ts'
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: 'src/preload/index.ts'
      }
    }
  },
  renderer: {
    plugins: [react()],
    define: {
      '__GROQ_API_KEY__': JSON.stringify(process.env.GROQ_API_KEY || ''),
    },
    server: {
      host: true,
      allowedHosts: true
    }
  },
})
