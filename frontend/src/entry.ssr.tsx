// SSR 渲染函数:Qwik Router 唯一调用渲染器的地方(客户端在浏览器上恢复,
// 不再调用 render)。SSG 也经它把每条路由预渲染成静态 HTML。
import { createRenderer } from '@qwik.dev/router'
import Root from './root'

export default createRenderer((opts) => {
  return {
    jsx: <Root />,
    options: {
      ...opts,
      containerAttributes: {
        lang: 'zh-Hans',
        ...opts.containerAttributes,
      },
    },
  }
})
