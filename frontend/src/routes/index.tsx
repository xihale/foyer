import {
  component$,
  useComputed$,
  useSignal,
  useVisibleTask$,
} from '@qwik.dev/core'
import type { Signal } from '@qwik.dev/core'
import type { DocumentHead } from '@qwik.dev/router'

import { AppHeader } from '~/components/app-header/app-header'
import { SearchBox } from '~/components/search-box/search-box'
import { BookmarkGroup } from '~/components/bookmark-group/bookmark-group'
import { ServiceGroup } from '~/components/service-group/service-group'
import { getCached, setCached } from '~/lib/cache'
import type { Config, ServiceStatus } from '~/lib/types'
import styles from './panel.module.css'

interface StatusEvent {
  type: string
  service_id?: number
  up?: boolean
  latency_ms?: number | null
}

// 配置快照里的监控状态 seed 进实时表;unknown(引擎刚启动/新加未探活)不 seed,
// 保持灰点等 SSE 首推,避免先闪一排"离线"红点。
// 模块级纯函数:$() 闭包无法捕获组件作用域的普通函数
function seedStatuses(statuses: Signal<Map<number, ServiceStatus>>, c: Config) {
  const next = new Map(statuses.value)
  for (const g of c.service_groups ?? []) {
    for (const s of g.services ?? []) {
      if (s.monitor_enabled && s.status && s.status !== 'unknown') {
        next.set(s.id, {
          up: s.status === 'up',
          latency_ms: typeof s.latency_ms === 'number' ? s.latency_ms : null,
        })
      }
    }
  }
  statuses.value = next
}

export default component$(() => {
  const config = useSignal<Config | null>(null)
  const error = useSignal('')
  // 首屏来自缓存且尚未拉取成功:提示"当前为缓存数据"
  const stale = useSignal(false)
  const statuses = useSignal<Map<number, ServiceStatus>>(new Map())
  const connected = useSignal(false)
  const searchQuery = useSignal('')
  // 桌面(顶栏)/移动(页头下方)两个搜索框同时挂载、靠 CSS 显隐,/ 快捷键聚焦可见的那个
  const searchDesktopRef = useSignal<HTMLInputElement>()
  const searchMobileRef = useSignal<HTMLInputElement>()

  // 搜索过滤后的服务与书签
  const filteredServiceGroups = useComputed$(() => {
    if (!config.value?.service_groups) return []
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return config.value.service_groups
    return config.value.service_groups
      .map((g) => ({
        ...g,
        services: (g.services ?? []).filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            (s.description ?? '').toLowerCase().includes(q) ||
            s.href.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => (g.services?.length ?? 0) > 0)
  })

  const filteredBookmarkGroups = useComputed$(() => {
    if (!config.value?.bookmark_groups) return []
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return config.value.bookmark_groups
    return config.value.bookmark_groups
      .map((g) => ({
        ...g,
        bookmarks: (g.bookmarks ?? []).filter(
          (b) => b.name.toLowerCase().includes(q) || b.href.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => (g.bookmarks?.length ?? 0) > 0)
  })

  // 键盘快捷键:按 / 聚焦搜索框,按 Escape 退出搜索
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/') {
        const tag = (document.activeElement?.tagName || '').toLowerCase()
        if (tag !== 'input' && tag !== 'textarea') {
          // display:none 容器里的输入框 offsetParent 为 null,取当前可见者
          const target = [searchDesktopRef.value, searchMobileRef.value].find(
            (el) => el && el.offsetParent !== null,
          )
          if (target) {
            e.preventDefault()
            target.focus()
          }
        }
      } else if (e.key === 'Escape') {
        const a = document.activeElement
        if (a === searchDesktopRef.value || a === searchMobileRef.value) {
          ;(a as HTMLInputElement).blur()
          searchQuery.value = ''
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    cleanup(() => window.removeEventListener('keydown', onKeyDown))
  })

  // ---- 数据拉取:失败指数退避重试(3s 起、封顶 30s),别让用户手动刷新 ----
  // 缓存命中先直出,消除首帧"加载中"
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    let alive = true
    let attempt = 0
    let timer: ReturnType<typeof setTimeout> | undefined

    const cachedCfg = getCached<Config>('foyer_config')
    if (cachedCfg) {
      config.value = cachedCfg
      stale.value = true
      seedStatuses(statuses, cachedCfg)
    }

    const load = async () => {
      try {
        const r = await fetch('/api/config')
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const c = (await r.json()) as Config
        if (!alive) return
        config.value = c
        stale.value = false
        error.value = ''
        setCached('foyer_config', c)
        seedStatuses(statuses, c)
      } catch (e) {
        if (!alive) return
        error.value = e instanceof Error ? e.message : String(e)
        timer = setTimeout(() => void load(), Math.min(30_000, 3_000 * 2 ** attempt++))
      }
    }
    void load()
    cleanup(() => {
      alive = false
      clearTimeout(timer)
    })
  })

  // ---- SSE 实时状态 ----
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const es = new EventSource('/api/events')
    es.onopen = () => (connected.value = true)
    es.onerror = () => (connected.value = false)
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as StatusEvent
        if (
          msg.type === 'status' &&
          typeof msg.service_id === 'number' &&
          typeof msg.up === 'boolean'
        ) {
          const next = new Map(statuses.value)
          next.set(msg.service_id, {
            up: msg.up,
            latency_ms: typeof msg.latency_ms === 'number' ? msg.latency_ms : null,
          })
          statuses.value = next
        }
      } catch {
        // 忽略无法解析的消息
      }
    }
    cleanup(() => es.close())
  })

  return (
    <div class={styles.page}>
      <AppHeader active="panel" siteTitle={config.value?.general?.title as string ?? 'foyer'}>
        <div q:slot="actions" class={styles.searchDesktop}>
          <SearchBox query={searchQuery} inputRef={searchDesktopRef} />
        </div>

        <div q:slot="below">
          <SearchBox query={searchQuery} inputRef={searchMobileRef} />
        </div>
      </AppHeader>

      <main class={styles.main}>
        {error.value ? (
          <div class="alert">
            获取站点配置失败:{error.value}
            {stale.value ? '(当前显示缓存数据,正在重试)' : ''}
          </div>
        ) : null}



        {!config.value && !error.value ? (
          <div class={['empty', 'mono', styles.loading].join(' ')}>加载中...</div>
        ) : (
          <>
            {filteredServiceGroups.value.map((group) => (
              <ServiceGroup group={group} statuses={statuses} connected={connected.value} key={group.id} />
            ))}

            {filteredBookmarkGroups.value.map((group) => (
              <BookmarkGroup group={group} key={group.id} />
            ))}
            {searchQuery.value &&
            filteredServiceGroups.value.length === 0 &&
            filteredBookmarkGroups.value.length === 0 ? (
              <div class="empty">无匹配项</div>
            ) : null}
          </>
        )}
      </main>
    </div>
  )
})

export const head: DocumentHead = {
  title: 'foyer',
  meta: [{ name: 'description', content: 'foyer · 自建服务的入口' }],
}
