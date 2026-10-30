import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// Plain ESM module shared by the production server (server.js) and the Vite
// dev middleware below. Keeping one implementation avoids API drift.
// @ts-expect-error - no declaration file for the shared Node ESM module
import { createVavooApi } from "./vavoo-api.js"
// @ts-expect-error - no declaration file for the shared Node ESM module
import { createVodApi } from "./vod-api.js"
// @ts-expect-error - no declaration file for the shared Node ESM module
import { createGeilApi } from "./geil-api.js"

function vavooApiPlugin(): Plugin {
  return {
    name: "notflix-vavoo-api",
    configureServer(server) {
      const api = createVavooApi()
      const vodApi = createVodApi()
      const geilApi = createGeilApi()
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith("/api/geil/")) {
          void geilApi(req, res)
          return
        }
        if (req.url?.startsWith("/api/vavoo/")) {
          void api(req, res)
          return
        }
        if (req.url?.startsWith("/api/vod/")) {
          void vodApi(req, res)
          return
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [vavooApiPlugin(), inspectAttr(), react()],
  build: { chunkSizeWarningLimit: 1000 },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/xtream-api': {
        target: 'http://ctn34.xyz:8080',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/xtream-api/, ''),
      },
      '/xtream': {
        target: 'http://dzcvip1.xyz:2095',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/xtream/, ''),
      },
      '/p2095': {
        target: 'http://dzcvip1.xyz:2095',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/p2095/, ''),
      },
      '/p8080': {
        target: 'http://dzcvip1.xyz:8080',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/p8080/, ''),
      },
      '/tv8daion': {
        target: 'https://tv8.daioncdn.net',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/tv8daion/, ''),
      },
    },
  },
});
