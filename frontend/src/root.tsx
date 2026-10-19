import { component$ } from '@qwik.dev/core'
import { DocumentHeadTags, RouterOutlet, useQwikRouter } from '@qwik.dev/router'

import './global.css'

/**
 * 文档骨架:head/body 与全局注入项。每页专属的 title/description
 * 由各路由的 `head` 导出提供,经 <DocumentHeadTags /> 汇入。
 */
export default component$(() => {
  useQwikRouter()

  return (
    <>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        {/* 跟随系统 prefers-color-scheme:明暗两套 theme-color */}
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#d9ddd4" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#1c211c" />
        {/* 防闪白/闪黑:与 tokens.css 的双主题保持一致(SSG 产物首帧即有底色) */}
        <DocumentHeadTags />
      </head>
      <body>
        <RouterOutlet />
      </body>
    </>
  )
})
