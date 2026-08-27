import { component$, useComputed$, useSignal, useVisibleTask$ } from '@qwik.dev/core'
import type { Signal } from '@qwik.dev/core'
import type { DocumentHead } from '@qwik.dev/router'

import { AppHeader } from '~/components/app-header/app-header'
import { KpiBar } from '~/components/kpi-bar/kpi-bar'
import { HeartbeatRow } from '~/components/heartbeat-row/heartbeat-row'
import { WinSwitch } from '~/components/win-switch/win-switch'
import { getCached, setCached } from '~/lib/cache'
import type { Config, StatusService } from '~/lib/types'
import styles from './status.module.css'

interface StatusResponse {
  services: StatusService[]
}

// 轮询与落盘共用一个加载函数;显式传依赖,$() 闭包才能跨作用域引用
async function loadStatus(
  win: Signal<'24h' | '7d'>,
  services: Signal<StatusService[] | null>,
  error: Signal<string>,
  refreshFailed: Signal<boolean>,
  updatedAt: Signal<string>,
  cell: { lastCached: number },
  w: '24h' | '7d',
) {
  try {
    const r = await fetch(`/api/status?window=${w}`)
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const d = (await r.json()) as StatusResponse
    const list = Array.isArray(d.services) ? d.services : []
    if (w !== win.value) return
    services.value = list
    if (Date.now() - cell.lastCached > 60_000) {
      setCached('foyer_status_' + w, list)
      cell.lastCached = Date.now()
    }
    error.value = ''
    refreshFailed.value = false
    updatedAt.value = new Date().toLocaleTimeString()
  } catch (e) {
    if (w !== win.value) return
    if (services.value === null) error.value = e instanceof Error ? e.message : String(e)
    else refreshFailed.value = true
  }
}

/** 窗口内在线率:24h 用后端聚合值,7d 从柱状图求和 */
function uptimeOf(win: '24h' | '7d', s: StatusService): number | null {
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

export default component$(() => {
  const cachedCfg = getCached<Config>('foyer_config')
  const win = useSignal<'24h' | '7d'>('24h')
  // null = 尚无数据(走 loading);有值但刷新失败时保留旧数据
  const services = useSignal<StatusService[] | null>(null)
  const error = useSignal('')
  const updatedAt = useSignal('')
  // 轮询失败但手里还有旧数据:更新时间处标"刷新失败",而不是全页报错
  const refreshFailed = useSignal(false)
  let lastCached = 0 // 轮询数据落盘节流(非响应式,纯记账)

  const slotMs = win.value === '24h' ? 30 * 60 * 1000 : 3 * 3600 * 1000


  // 立即拉取一次,之后每 10s 静默轮询;失败保留上次数据;后台 tab 暂停,回来立即补拉。
  // sessionStorage 缓存命中先直出,消除首帧"加载中"
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    // 只认默认窗口(24h)自己的缓存键;别的窗口留给切换逻辑按需直出
    const cachedList = getCached<StatusService[]>('foyer_status_24h')
    if (cachedList) services.value = cachedList

    const cell = { lastCached: 0 }
    void loadStatus(win, services, error, refreshFailed, updatedAt, cell, win.value)
    const timer = setInterval(() => {
      if (!document.hidden) void loadStatus(win, services, error, refreshFailed, updatedAt, cell, win.value)
    }, 10_000)
    const onVis = () => {
      if (!document.hidden) void loadStatus(win, services, error, refreshFailed, updatedAt, cell, win.value)
    }
    document.addEventListener('visibilitychange', onVis)
    cleanup(() => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVis)
    })
  })

  // 切窗口:有缓存先直出;无缓存置空走 loading,绝不让旧窗口数据顶着新窗口的桶宽渲染
  // (WinSwitch 通过 win signal 回写触发这里的效果逻辑)
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const w = track(() => win.value)
    services.value = getCached<StatusService[]>('foyer_status_' + w) ?? null
    error.value = ''
    refreshFailed.value = false
    updatedAt.value = ''
    void loadStatus(win, services, error, refreshFailed, updatedAt, { lastCached: 0 }, w)
  })

  const downCount = useComputed$(
    () => services.value?.filter((s) => s.status === 'down').length ?? 0,
  )
  const upCount = useComputed$(() => services.value?.filter((s) => s.status === 'up').length ?? 0)

  const overallUptime = useComputed$(() => {
    const list = services.value
    if (!list || list.length === 0) return null
    let sum = 0
    let count = 0
    for (const s of list) {
      const u = uptimeOf(win.value, s)
      if (u !== null) {
        sum += u
        count++
      }
    }
    return count > 0 ? sum / count : null
  })

  return (
    <div class={styles.page}>
      <AppHeader active="status" label="服务监控" siteTitle={cachedCfg?.general?.title as string ?? 'foyer'}>
        <div q:slot="actions" class={styles.switchDesktop}>
          <WinSwitch win={win} />
        </div>

        <div q:slot="below">
          <WinSwitch win={win} />
        </div>
      </AppHeader>

      <main class={styles.main}>
        {error.value && services.value === null ? (
          <div class="alert">加载服务状态失败:{error.value}</div>
        ) : services.value === null ? (
          <div class={['empty', 'mono', styles.loading].join(' ')}>加载中...</div>
        ) : (
          <div class={[styles.stack, styles.contentStack].join(' ')}>
            <KpiBar
              win={win.value}
              uptime={overallUptime.value}
              upCount={upCount.value}
              total={services.value.length}
              downCount={downCount.value}
            />

            <section class={styles.stack} aria-label="服务心跳列表">
              <div class={styles.sectionHead}>
                <span class={['mono', styles.groupTitle].join(' ')}>
                  节点状态 / MONITORED NODES
                </span>
                <span
                  class={['mono', styles.updated, refreshFailed.value && styles.fail]
                    .filter(Boolean)
                    .join(' ')}
                  title="每 10 秒自动刷新"
                >
                  {refreshFailed.value
                    ? '刷新失败 · 显示上次数据'
                    : updatedAt.value
                      ? `更新于 ${updatedAt.value}`
                      : ''}
                </span>
              </div>

              {services.value.length === 0 ? (
                <div class="empty">暂无监控服务</div>
              ) : (
                <div class={styles.rows}>
                  {services.value.map((s) => (
                    <HeartbeatRow service={s} win={win.value} slotMs={slotMs} uptime={uptimeOf(win.value, s)} key={s.id} />
                  ))}
                </div>
              )}
            </section>

            {/* 状态图例(dot 变体样式在全局 ui.css) */}
            <div class={['mono', styles.legend].join(' ')}>
              <span>
                <i class="dot" data-state="up"></i>正常
              </span>
              <span>
                <i class="dot dot-warn"></i>波动
              </span>
              <span>
                <i class="dot" data-state="down"></i>离线
              </span>
              <span>
                <i class="dot dot-none"></i>无数据
              </span>
            </div>
          </div>
        )}
      </main>
    </div>
  )
})

export const head: DocumentHead = {
  title: '监控 · foyer',
  meta: [{ name: 'description', content: 'foyer · 服务监控' }],
}
