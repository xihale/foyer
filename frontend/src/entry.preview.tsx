// vite preview 的服务入口:以 SSR 方式伺服生产构建,便于不接后端时预览页面。
import { createQwikRouter } from '@qwik.dev/router/middleware/node'
import render from './entry.ssr'

export default createQwikRouter({ render })
