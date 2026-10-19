import { component$ } from '@qwik.dev/core'
import styles from './kpi-bar.module.css'

interface KpiBarProps {
  win: '24h' | '7d'
  uptime: number | null
  upCount: number
  total: number
  downCount: number
}

export const KpiBar = component$<KpiBarProps>(({ win, uptime, upCount, total, downCount }) => {
  const fmtUptime = uptime === null ? '--' : `${uptime.toFixed(2)}%`
  const winLabel = win === '24h' ? '24 小时' : '7 天'

  return (
    <section class={styles.kpi} aria-label="可用情况">
      <span class={styles.item}>
        <span class={styles.k}>{winLabel}可用</span>
        <span class={['mono', styles.v].join(' ')}>{fmtUptime}</span>
      </span>
      <span class={styles.item}>
        <span class={styles.k}>在线</span>
        <span class={['mono', styles.v].join(' ')}>
          {upCount} <span class={styles.sub}>/ {total}</span>
        </span>
      </span>
      <span class={styles.item}>
        <span class={styles.k}>离线</span>
        <span class={['mono', styles.v, downCount > 0 ? styles.vBad : ''].filter(Boolean).join(' ')}>
          {downCount}
        </span>
      </span>
    </section>
  )
})
