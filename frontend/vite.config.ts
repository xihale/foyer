import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin, type ProxyOptions } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

const noStore: NonNullable<ProxyOptions['configure']> = (proxy) => {
  proxy.on('proxyRes', (res) => {
    res.headers['cache-control'] = 'no-store'
  })
}

function prettyUrls(): Plugin {
  return {
    name: 'pretty-urls',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url === '/status' || req.url === '/admin') req.url += '.html'
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte(), prettyUrls()],
  appType: 'mpa',
  build: {
    rollupOptions: {
      input: {
        panel: fileURLToPath(new URL('./index.html', import.meta.url)),
        status: fileURLToPath(new URL('./status.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin.html', import.meta.url)),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    // Node 把 localhost 解析成 ::1；Chrome 的 HMR WebSocket 会连 127.0.0.1 且不回退 IPv6
    host: '127.0.0.1',
    hmr: { host: '127.0.0.1' },
    proxy: {
      // 页面由 vite 出；API / 图标走 zig。dev 强制不缓存，生产仍走 zig 自己的头
      '/api': {
        target: 'http://127.0.0.1:3002',
        changeOrigin: true,
        timeout: 0,
        proxyTimeout: 0,
        configure: noStore,
      },
      '/icons': { target: 'http://127.0.0.1:3002', changeOrigin: true, configure: noStore },
    },
  },
})
