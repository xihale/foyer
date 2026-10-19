import { component$ } from '@qwik.dev/core'
import { Link } from '@qwik.dev/router'
import type { DocumentHead } from '@qwik.dev/router'

import styles from './404.module.css'

export default component$(() => {
  return (
    <main class={styles.page}>
      <p class={styles.code}>404</p>
      <h1 class={styles.title}>这个地址没有页面</h1>
      <p class={styles.sub}>地址写错了，或内容已经移走。</p>
      <div class={styles.actions}>
        <Link href="/" class="btn btn-primary">
          回到首页
        </Link>
        <Link href="/status" class="btn btn-secondary">
          查看监控
        </Link>
      </div>
    </main>
  )
})

export const head: DocumentHead = {
  title: '404 · foyer',
  meta: [{ name: 'robots', content: 'noindex' }],
}
