<script lang="ts">
  import Header from '../../lib/Header.svelte'
  import { getCached, removeCached, setCached } from '../../lib/cache'
  import type { Config, ServiceStatus, SystemInfo } from '../../lib/types'
  import BookmarkGroup from './BookmarkGroup.svelte'
  import SearchBox from './SearchBox.svelte'
  import ServiceGroup from './ServiceGroup.svelte'
  import TelemetryBar from './TelemetryBar.svelte'

  interface StatusEvent {
    type: string
    service_id?: number
    up?: boolean
    latency_ms?: number | null
  }

  const cachedCfg = getCached<Config>('foyer_config')
  let config = $state<Config | null>(cachedCfg)
  let error = $state('')
  // 首屏来自缓存且尚未拉取成功:提示"当前为缓存数据"
  let stale = $state(cachedCfg !== null)
  let statuses = $state(new Map<number, ServiceStatus>())
  let connected = $state(false)
  let system = $state<SystemInfo | null>(getCached<SystemInfo>('foyer_system'))
  let searchQuery = $state('')
  // 桌面(顶栏)/移动(页头下方)两个搜索框同时挂载、靠 CSS 显隐,/ 快捷键聚焦可见的那个
  let searchDesktopEl = $state<HTMLInputElement | null>(null)
  let searchMobileEl = $state<HTMLInputElement | null>(null)

  // 配置快照里的监控状态 seed 进实时表;unknown(引擎刚启动/新加未探活)不 seed,
  // 保持灰点等 SSE 首推,避免先闪一排"离线"红点
  function seedStatuses(c: Config) {
    for (const g of c.service_groups ?? []) {
      for (const s of g.services ?? []) {
        if (s.monitor_enabled && s.status && s.status !== 'unknown') {
          statuses.set(s.id, {
            up: s.status === 'up',
            latency_ms: typeof s.latency_ms === 'number' ? s.latency_ms : null,
          })
        }
      }
    }
  }
  if (cachedCfg) seedStatuses(cachedCfg)

  // 键盘快捷键:按 / 聚焦搜索框,按 Escape 退出搜索
  $effect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/') {
        const tag = (document.activeElement?.tagName || '').toLowerCase()
        if (tag !== 'input' && tag !== 'textarea') {
          // display:none 容器里的输入框 offsetParent 为 null,取当前可见者
          const target = [searchDesktopEl, searchMobileEl].find((el) => el && el.offsetParent !== null)
          if (target) {
            e.preventDefault()
            target.focus()
          }
        }
      } else if (e.key === 'Escape') {
        const a = document.activeElement
        if (a === searchDesktopEl || a === searchMobileEl) {
          ;(a as HTMLInputElement).blur()
          searchQuery = ''
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  // 搜索过滤后的服务与书签
  const filteredServiceGroups = $derived.by(() => {
    if (!config?.service_groups) return []
    const q = searchQuery.trim().toLowerCase()
    if (!q) return config.service_groups
    return config.service_groups
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

  const filteredBookmarkGroups = $derived.by(() => {
    if (!config?.bookmark_groups) return []
    const q = searchQuery.trim().toLowerCase()
    if (!q) return config.bookmark_groups
    return config.bookmark_groups
      .map((g) => ({
        ...g,
        bookmarks: (g.bookmarks ?? []).filter(
          (b) => b.name.toLowerCase().includes(q) || b.href.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => (g.bookmarks?.length ?? 0) > 0)
  })

  // ---- 数据拉取:失败指数退避重试(3s 起、封顶 30s),别让用户手动刷新 ----
  $effect(() => {
    let alive = true
    let attempt = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    const load = async () => {
      try {
        const r = await fetch('/api/config')
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const c = (await r.json()) as Config
        if (!alive) return
        config = c
        stale = false
        error = ''
        setCached('foyer_config', c)
        seedStatuses(c)
      } catch (e) {
        if (!alive) return
        error = e instanceof Error ? e.message : String(e)
        timer = setTimeout(() => void load(), Math.min(30_000, 3_000 * 2 ** attempt++))
      }
    }
    void load()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  })

  $effect(() => {
    const es = new EventSource('/api/events')
    es.onopen = () => (connected = true)
    es.onerror = () => (connected = false)
    es.onmessage = (ev: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(ev.data) as StatusEvent
        if (msg.type === 'status' && typeof msg.service_id === 'number' && typeof msg.up === 'boolean') {
          statuses.set(msg.service_id, {
            up: msg.up,
            latency_ms: typeof msg.latency_ms === 'number' ? msg.latency_ms : null,
          })
        }
      } catch {
        // 忽略无法解析的消息
      }
    }
    return () => es.close()
  })

  // 系统资源:立即拉取一次,之后每 3s 刷新;失败静默降级。
  // 页面不可见时暂停轮询(后台 tab 不空耗),回来立即补一次;
  // 缓存至多 30s 落一次盘,避免每 3s 全量序列化写 sessionStorage。
  // 401 = 遥测被管理端关闭:连同 sessionStorage 旧快照一并清掉,否则缓存的
  // 旧数据会让遥测卡在开关关闭后仍然常驻显示
  $effect(() => {
    let alive = true
    let lastCached = 0
    const load = () => {
      fetch('/api/system')
        .then((r) => (r.ok ? (r.json() as Promise<SystemInfo>) : Promise.reject(new Error(String(r.status)))))
        .then((d) => {
          if (alive && d && typeof d === 'object') {
            system = d
            if (Date.now() - lastCached > 30_000) {
              setCached('foyer_system', d)
              lastCached = Date.now()
            }
          }
        })
        .catch((e: unknown) => {
          if (!alive) return
          if (e instanceof Error && e.message === '401') {
            system = null
            removeCached('foyer_system')
          }
          /* 其余失败静默降级 */
        })
    }
    const tick = () => {
      if (!document.hidden) load()
    }
    const onVis = () => {
      if (!document.hidden) load()
    }
    load()
    const timer = setInterval(tick, 3000)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      alive = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVis)
    }
  })
</script>

<div class="page">
  <Header active="panel" siteTitle={config?.general?.title ?? 'foyer'}>
    {#snippet actions()}
      <div class="search-desktop">
        <SearchBox bind:value={searchQuery} bind:bindEl={searchDesktopEl} />
      </div>
    {/snippet}

    {#snippet below()}
      <SearchBox bind:value={searchQuery} bind:bindEl={searchMobileEl} />
    {/snippet}
  </Header>

  <main class="main">
    {#if error}
      <div class="alert">
        获取站点配置失败:{error}{stale ? '(当前显示缓存数据,正在重试)' : ''}
      </div>
    {/if}

    {#if !searchQuery && system}
      <TelemetryBar {system} />
    {/if}

    {#if !config && !error}
      <div class="empty loading">加载中...</div>
    {:else}
      {#each filteredServiceGroups as group (group.id)}
        <ServiceGroup {group} {statuses} {connected} />
      {/each}

      {#each filteredBookmarkGroups as group (group.id)}
        <BookmarkGroup {group} />
      {/each}

      {#if searchQuery && filteredServiceGroups.length === 0 && filteredBookmarkGroups.length === 0}
        <div class="empty">无匹配项</div>
      {/if}
    {/if}
  </main>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
    color: var(--color-text-secondary);
    background: var(--color-canvas);
  }

  .search-desktop {
    display: none;
    flex: 1;
    max-width: 18rem;
  }
  @media (min-width: 640px) {
    .search-desktop {
      display: block;
    }
  }

  .main {
    flex: 1;
    width: 100%;
    max-width: 72rem;
    margin: 0 auto;
    padding: 20px 16px 48px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  @media (min-width: 640px) {
    .main {
      padding: 28px 24px 64px;
      gap: 28px;
    }
  }

  .loading {
    padding: 72px 0;
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--color-text-quaternary);
  }
</style>
