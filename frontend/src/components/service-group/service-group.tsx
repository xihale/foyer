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
  if (!st) return `${conn}，暂无数据`
  if (!st.up) return `${conn}，离线`
  const lat =
    typeof st.latency_ms === 'number' && st.latency_ms >= 0
      ? `${Math.round(st.latency_ms)}ms`
      : '正常'
  return `${conn}，延迟 ${lat}`
}

export const ServiceGroup = component$<ServiceGroupProps>(({ group, statuses, connected }) => {
  return (
    <section class={styles.section} aria-label={group.name}>
      <h2 class={styles.groupTitle}>{group.name}</h2>
      <div class={styles.list}>
        {(group.services ?? []).map((s) => {
          const st = statuses.value.get(s.id)
          const watched = !!s.monitor_enabled
          const state = watched ? dotState(st) : 'plain'
          const lat = latencyText(st)
          return (
            <a
              href={s.href}
              target="_blank"
              rel="noreferrer"
              class={styles.row}
              data-state={state}
              key={s.id}
            >
              {watched ? (
                <span class="dot" data-state={state === 'unknown' ? undefined : state} title={dotTitle(st, connected)}></span>
              ) : (
                <span class={styles.notchGap} aria-hidden="true"></span>
              )}
              {s.icon ? (
                <IconImage src={s.icon} class={styles.icon} />
              ) : (
                <span class={styles.fallback} aria-hidden="true">
                  {s.name.slice(0, 1)}
                </span>
              )}
              <span class={styles.info}>
                <span class={styles.name}>{s.name}</span>
                {s.description ? <span class={styles.desc}>{s.description}</span> : null}
              </span>
              {watched ? (
                <span class={['mono', styles.meta].join(' ')}>
                  {state === 'down' ? <span>离线</span> : null}
                  {state === 'unknown' ? <span>等待</span> : null}
                  {lat ? <span>{lat}</span> : null}
                </span>
              ) : null}
            </a>
          )
        })}
      </div>
    </section>
  )
})
