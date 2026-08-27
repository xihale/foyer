import { component$ } from '@qwik.dev/core'
import type { DocumentHead } from '@qwik.dev/router'

import styles from './404.module.css'

export default component$(() => {
  return (
    <main class={styles.page}>
      <p class={[styles.code, 'mono'].join(' ')}>404</p>
      <h1 class={styles.title}>页面不存在</h1>
      <p class={styles.sub}>地址可能有误，或内容已被移动。</p>
      <div class={styles.actions}>
        <a href="/" class="btn btn-primary">
          返回首页
        </a>
        <a href="/status" class="btn btn-secondary">
          查看状态页
        </a>
      </div>
    </main>
  )
})

export const head: DocumentHead = {
  title: '404 · foyer',
  meta: [{ name: 'robots', content: 'noindex' }],
}
