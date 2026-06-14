import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)))

export default defineConfig({
  plugins: [react()],
  // Build-time app info shown in Settings → About. The commit fields come from
  // Vercel's build env, so the version/"what's new" line updates every deploy.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__:  JSON.stringify(new Date().toISOString()),
    __COMMIT_SHA__:  JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7)),
    __COMMIT_MSG__:  JSON.stringify((process.env.VERCEL_GIT_COMMIT_MESSAGE || '').split('\n')[0].slice(0, 140)),
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 8080,
    allowedHosts: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    globals: true,
  },
})
