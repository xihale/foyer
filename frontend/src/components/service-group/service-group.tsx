import type { Signal } from '@qwik.dev/core'
import { component$ } from '@qwik.dev/core'
import type { Group, ServiceStatus } from '~/lib/types'
import { IconImage } from '~/components/icon-image/icon-image'
import styles from './service-group.module.css'

interface ServiceGroupProps {
  group: Group
  /** 实时监控状态表(id → up/延迟),整体替换驱动更新 */
  statuses: Signal<Map<number, ServiceStatus>>
  connected: boolean
}

const latencyText = (st: ServiceStatus | undefined): string | null => {
  if (!st || !st.up || typeof st.latency_ms !== 'number' || st.latency_ms < 0) return null
  if (st.latency_ms === 0) return '<1ms'
  if (st.latency_ms >= 1000) return `${(st.latency_ms / 1000).toFixed(1)}s`
  return `${Math.round(st.latency_ms)}ms`
}

const dotState = (st: ServiceStatus | undefined): 'up' | 'down' | 'unknown' => {
  if (!st) return 'unknown'
  return st.up ? 'up' : 'down'
}

const dotTitle = (st: ServiceStatus | undefined, connected: boolean): string => {
  const conn = connected ? '实时连接' : '重连中'
  if (!st) return `${conn} · 暂无数据`
  if (!st.up) return `${conn} · 离线`
  const lat =
    typeof st.latency_ms === 'number' && st.latency_ms >= 0
      ? `${Math.round(st.latency_ms)}ms`
      : '正常'
  return `${conn} · 延迟 ${lat}`
}

export const ServiceGroup = component$<ServiceGroupProps>(({ group, statuses, connected }) => {
  return (
    <section class={styles.section} aria-label={group.name}>
      <div class={styles.head}>
        <div class={styles.titleWrap}>
          <span class={['mono', styles.groupTitle].join(' ')}>{group.name}</span>
          <span class={['mono', styles.count].join(' ')}>{group.services?.length ?? 0}</span>
        </div>
      </div>

      {/* 列数经 CSS 变量下发,模块内不出现动态类名 */}
      <div class={styles.grid} style={`--cols:${group.columns ?? 3}`}>
        {(group.services ?? []).map((s) => {
          const st = statuses.value.get(s.id)
          const lat = latencyText(st)
          return (
            <a
              href={s.href}
              target="_blank"
              rel="noreferrer"
              class={['card-item', styles.serviceCard].join(' ')}
              key={s.id}
            >
              <div class={styles.iconBox}>
                {s.icon ? (
                  <IconImage src={s.icon} class={styles.icon} />
                ) : (
                  <div class={['mono', styles.fallback].join(' ')}>
                    {s.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>

              <div class={styles.info}>
                <div class={styles.name}>{s.name}</div>
                {s.description ? <div class={styles.desc}>{s.description}</div> : null}
              </div>

              {s.monitor_enabled ? (
                <div class={['mono', styles.statusIndicator].join(' ')}>
                  {lat ? <span class={styles.lat}>{lat}</span> : null}
                  <span
                    class="dot pulse"
                    data-state={dotState(st)}
                    title={dotTitle(st, connected)}
                  ></span>
                </div>
              ) : null}
            </a>
          )
        })}
      </div>
    </section>
  )
})
