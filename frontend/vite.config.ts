import { qwikVite } from '@qwik.dev/core/optimizer'
import { qwikRouter } from '@qwik.dev/router/vite'
import { defineConfig, type ProxyOptions, type UserConfig } from 'vite'

// 页面由 Qwik 出(dev 模式 SSR / 构建时 SSG);API 与图标走 Go。
// dev 代理强制不缓存,生产仍走 Go 自己的头。
const noStore: NonNullable<ProxyOptions['configure']> = (proxy) => {
  proxy.on('proxyRes', (res) => {
    res.headers['cache-control'] = 'no-store'
  })
}

export default defineConfig((): UserConfig => {
  return {
    plugins: [qwikRouter(), qwikVite()],
    resolve: { tsconfigPaths: true },
    server: {
      port: 5173,
      strictPort: true,
      // Node 把 localhost 解析成 ::1;Chrome 的 HMR WebSocket 会连 127.0.0.1 且不回退 IPv6
      host: '127.0.0.1',
      hmr: { host: '127.0.0.1' },
      proxy: {
        '/api': { target: 'http://127.0.0.1:3002', changeOrigin: true, configure: noStore },
        '/icons': { target: 'http://127.0.0.1:3002', changeOrigin: true, configure: noStore },
      },
    },
  }
})
