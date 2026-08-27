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
  const fmtUptime = (u: number | null) => (u === null ? '--' : `${u.toFixed(2)}%`)

  return (
    <section class={['stat', styles.kpi].join(' ')}>
      <div class={styles.kpiCol}>
        <div class={['mono', styles.k].join(' ')}>
          <span class={styles.idx}>01</span>
          <span>{win} 可用率</span>
        </div>
        <div class={['mono', styles.v, styles.vOk].join(' ')}>{fmtUptime(uptime)}</div>
      </div>

      <div class={styles.kpiCol}>
        <div class={['mono', styles.k].join(' ')}>
          <span class={styles.idx}>02</span>
          <span>在线节点</span>
        </div>
        <div class={'mono ' + styles.v}>
          {upCount} <span class={styles.sub}>/ {total}</span>
        </div>
      </div>

      <div class={styles.kpiCol}>
        <div class={['mono', styles.k].join(' ')}>
          <span class={styles.idx}>03</span>
          <span>离线节点</span>
        </div>
        <div class={['mono', styles.v, downCount > 0 && styles.vBad].filter(Boolean).join(' ')}>
          {downCount}
        </div>
      </div>
    </section>
  )
})
