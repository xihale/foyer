// SSG 构建:客户端产物之上补一层服务端渲染,把三条路由预渲染为静态 HTML。
// 官方模板见 starters/adapters/ssg(adapters/ssg/vite)。
import { ssgAdapter } from '@qwik.dev/router/adapters/ssg/vite'
import { extendConfig } from '@qwik.dev/router/vite'
import baseConfig from '../../vite.config'

export default extendConfig(baseConfig, () => {
  return {
    build: {
      ssr: true,
      rolldownOptions: {
        input: ['@qwik-router-config'],
      },
    },
    plugins: [
      ssgAdapter({
        origin: 'https://home.xeed.ink',
        log: 'quiet',
        // 自动 sitemap 不辨公私,连 /admin、/404 都会收进去;改由 public/sitemap.xml 手工维护
        sitemapOutFile: null,
      }),
    ],
  }
})
