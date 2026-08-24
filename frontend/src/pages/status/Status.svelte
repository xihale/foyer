<script lang="ts">
  import Header from '../../lib/Header.svelte'
  import { getCached, setCached } from '../../lib/cache'
  import type { Config } from '../../lib/types'
  import HeartbeatRow, { type StatusService } from './HeartbeatRow.svelte'
  import KpiBar from './KpiBar.svelte'

  interface StatusResponse {
    services: StatusService[]
  }

  const cachedCfg = getCached<Config>('foyer_config')
  let win = $state<'24h' | '7d'>('24h')
  let services = $state<StatusService[] | null>(getCached<StatusService[]>('foyer_status_24h'))
  let error = $state('')
  let updatedAt = $state('')
  // 轮询失败但手里还有旧数据:更新时间处标"刷新失败",而不是全页报错
  let refreshFailed = $state(false)
  let lastCached = 0 // 轮询数据落盘节流(非响应式,纯记账)

  const SLOT_MS = $derived(win === '24h' ? 30 * 60 * 1000 : 3 * 3600 * 1000)

  // 捕获发起时的窗口:切换后迟到的旧窗口响应直接丢弃,防止旧数据混进新窗口的桶宽/口径
  async function load(w: '24h' | '7d') {
    try {
      const r = await fetch(`/api/status?window=${w}`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = (await r.json()) as StatusResponse
      const list = Array.isArray(d.services) ? d.services : []
      if (w !== win) return
      services = list
      if (Date.now() - lastCached > 60_000) {
        setCached('foyer_status_' + w, list)
        lastCached = Date.now()
      }
      error = ''
      refreshFailed = false
      updatedAt = new Date().toLocaleTimeString()
    } catch (e) {
      if (w !== win) return
      if (services === null) error = e instanceof Error ? e.message : String(e)
      else refreshFailed = true
    }
  }

  // 立即拉取一次,之后每 10s 静默轮询;失败保留上次数据;后台 tab 暂停,回来立即补拉
  $effect(() => {
    void load(win)
    const timer = setInterval(() => {
      if (!document.hidden) void load(win)
    }, 10_000)
    const onVis = () => {
      if (!document.hidden) void load(win)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVis)
    }
  })

  // 切窗口:有缓存先直出;无缓存置空走 loading,绝不让旧窗口数据顶着新窗口的桶宽渲染
  function pickWin(w: '24h' | '7d') {
    if (win === w) return
    win = w
    services = getCached<StatusService[]>('foyer_status_' + w) ?? null
    error = ''
    refreshFailed = false
    updatedAt = ''
  }

  const downCount = $derived(services?.filter((s) => s.status === 'down').length ?? 0)
  const upCount = $derived(services?.filter((s) => s.status === 'up').length ?? 0)

  /** 窗口内在线率:24h 用后端聚合值,7d 从柱状图求和 */
  const uptimeOf = (s: StatusService): number | null => {
    if (win === '24h') {
      return typeof s.uptime_24h === 'number' && Number.isFinite(s.uptime_24h) ? s.uptime_24h : null
    }
    let total = 0
    let ups = 0
    for (const b of s.bars ?? []) {
      total += b.total
      ups += b.ups
    }
    return total > 0 ? (ups / total) * 100 : null
  }

  const overallUptime = $derived.by(() => {
    if (!services || services.length === 0) return null
    let sum = 0
    let count = 0
    for (const s of services) {
      const u = uptimeOf(s)
      if (u !== null) {
        sum += u
        count++
      }
    }
    return count > 0 ? sum / count : null
  })
</script>

{#snippet winSwitch()}
  <!-- 24h / 7d 切换: Swiss Segmented Switch -->
  <div class="win-switch" role="radiogroup" aria-label="时间窗口">
    {#each ['24h', '7d'] as w (w)}
      <button
        type="button"
        class="opt mono"
        class:is-active={win === w}
        role="radio"
        aria-checked={win === w}
        onclick={() => pickWin(w as '24h' | '7d')}
      >
        {w}
      </button>
    {/each}
  </div>
{/snippet}

<div class="page">
  <Header active="status" label="服务监控" siteTitle={cachedCfg?.general?.title ?? 'foyer'}>
    {#snippet actions()}
      <div class="switch-desktop">
        {@render winSwitch()}
      </div>
    {/snippet}

    {#snippet below()}
      {@render winSwitch()}
    {/snippet}
  </Header>

  <main class="main">
    {#if error && services === null}
      <div class="alert">加载服务状态失败:{error}</div>
    {:else if services === null}
      <div class="empty loading">加载中...</div>
    {:else}
      <div class="stack content-stack">
        <KpiBar {win} uptime={overallUptime} upCount={upCount} total={services.length} downCount={downCount} />

        <section class="stack" aria-label="服务心跳列表">
          <div class="section-head">
            <span class="group-title">节点状态 / MONITORED NODES</span>
            <span class="updated mono" class:fail={refreshFailed} title="每 10 秒自动刷新">
              {refreshFailed ? '刷新失败 · 显示上次数据' : updatedAt ? `更新于 ${updatedAt}` : ''}
            </span>
          </div>

          {#if services.length === 0}
            <div class="empty">暂无监控服务</div>
          {:else}
            <div class="rows">
              {#each services as s (s.id)}
                <HeartbeatRow service={s} {win} slotMs={SLOT_MS} uptime={uptimeOf(s)} />
              {/each}
            </div>
          {/if}
        </section>

        <!-- 状态图例 -->
        <div class="legend mono">
          <span><i class="dot" data-state="up"></i>正常</span>
          <span><i class="dot warn"></i>波动</span>
          <span><i class="dot" data-state="down"></i>离线</span>
          <span><i class="dot none"></i>无数据</span>
        </div>
      </div>
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

  .switch-desktop {
    display: none;
  }
  @media (min-width: 640px) {
    .switch-desktop {
      display: block;
    }
  }

  /* Swiss Minimalist Segmented Button */
  .win-switch {
    display: inline-flex;
    background: var(--color-surface-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-s);
    padding: 2px;
    gap: 2px;
  }
  .opt {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    padding: 2px 10px;
    min-height: 24px;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--color-text-secondary);
    border-radius: var(--radius-xs);
    outline: none;
    cursor: pointer;
    transition: background-color var(--transition), color var(--transition);
  }
  .opt:hover:not(.is-active) {
    color: var(--color-text-primary);
    background: var(--color-surface-hover);
  }
  .opt.is-active {
    background: var(--color-accent);
    color: var(--color-on-accent);
    font-weight: 700;
  }
  .opt.is-active:hover {
    background: var(--color-accent-hover);
    color: var(--color-on-accent);
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

  .stack {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .content-stack {
    gap: 24px;
  }

  .section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 0 2px;
  }
  .updated {
    font-size: 11px;
    color: var(--color-text-quaternary);
  }
  .updated.fail {
    color: var(--color-error);
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 12px 0;
    font-size: 11px;
    color: var(--color-text-tertiary);
  }
  .legend span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .legend .dot.warn {
    background: var(--color-warning);
  }
  .legend .dot.none {
    background: var(--color-border-strong);
  }
</style>

