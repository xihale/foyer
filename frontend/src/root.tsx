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
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f7f8fa" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0b0c0e" />
        {/* 防闪白/闪黑:与 tokens.css 的双主题保持一致(SSG 产物首帧即有底色) */}
        {/* Chrome 121+: 导航前预取另两个入口,命中缓存后近瞬开 */}
        <script
          type="speculationrules"
          dangerouslySetInnerHTML={`{"prefetch":[{"source":"document","urls":["/","/status","/admin"]}]}`}
        />
        <DocumentHeadTags />
      </head>
      <body>
        <RouterOutlet />
      </body>
    </>
  )
})
