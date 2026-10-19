import { component$, useSignal } from '@qwik.dev/core'
import type { StatusBar, StatusService } from '~/lib/types'
import styles from './heartbeat-row.module.css'

interface HeartbeatRowProps {
  service: StatusService
  win: '24h' | '7d'
  slotMs: number
  uptime: number | null
}

interface Tip {
  x: number
  y: number
  lines: string[]
}

const barState = (b: StatusBar): 'none' | 'down' | 'partial' | 'up' =>
  b.total === 0 ? 'none' : b.ups === 0 ? 'down' : b.ups < b.total ? 'partial' : 'up'

const fmtBarTime = (ms: number, win: '24h' | '7d') => {
  if (!ms || ms <= 0) return '未知时间'
  const d = new Date(ms)
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const md = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return win === '24h' ? `${md} ${hm}` : md
}

const fmtTime = (ms: number) => {
  const t = new Date(ms)
  return Number.isNaN(t.getTime()) ? String(ms) : t.toLocaleString()
}

export const HeartbeatRow = component$<HeartbeatRowProps>(({ service: s, win, slotMs, uptime }) => {
  const tip = useSignal<Tip | null>(null)

  const fmtUptimeText = uptime === null ? '--' : `${uptime.toFixed(2)}%`

  return (
    <>
      <div class={styles.row} data-state={s.status}>
        <div class={styles.top}>
          <div class={styles.id}>
            <span class="dot" data-state={s.status === 'unknown' ? undefined : s.status}></span>
            <span class={styles.name}>{s.name}</span>
            {s.status === 'down' ? <span class={styles.state}>离线</span> : null}
            {s.status === 'unknown' ? <span class={styles.state}>等待</span> : null}
          </div>

          <div class={['mono', styles.metrics].join(' ')}>
            {s.status === 'up' && typeof s.latency_ms === 'number' && s.latency_ms >= 0 ? (
              <span class={styles.lat}>
                {s.latency_ms < 1 ? '<1ms' : `${Math.round(s.latency_ms)}ms`}
              </span>
            ) : null}
            <span class={styles.uptimeVal}>{fmtUptimeText}</span>
          </div>
        </div>

        {/* 分段式心跳时间线柱状图 */}
        <div
          class={styles.bars}
          style={`grid-template-columns: repeat(${s.bars?.length || 48}, minmax(0, 1fr));`}
          role="img"
          aria-label={`${s.name} 最近${win}心跳柱状图`}
          onPointerMove$={(e, el) => {
            const target = (e.target as HTMLElement).closest('[data-i]') as HTMLElement | null
            if (!target) return
            const b = s.bars[Number(target.getAttribute('data-i'))] as StatusBar | undefined
            if (!b) return
            const end = b.t + slotMs
            const lines =
              b.total === 0
                ? [fmtBarTime(b.t, win), '无探活数据']
                : [
                    `${fmtBarTime(b.t, win)} – ${fmtBarTime(end, win)}`,
                    `${b.ups}/${b.total} 次成功 (${Math.round((b.ups / b.total) * 100)}%)${typeof b.avg_ms === 'number' ? `，延迟 ${Math.round(b.avg_ms)}ms` : ''}`,
                  ]
            const pad = 96
            const x = Math.min(Math.max(e.clientX, pad), Math.max(pad, window.innerWidth - pad))
            const y = Math.max(e.clientY, 64)
            tip.value = { x, y, lines }
          }}
          onPointerLeave$={() => (tip.value = null)}
        >
          {(s.bars ?? []).map((b, i) => (
            <div class={styles.bar} data-state={barState(b)} data-i={i} key={i}></div>
          ))}
        </div>

        {/* 最近故障记录 */}
        {s.last_incident ? (
          <div class={['mono', styles.incident].join(' ')}>
            <span class={styles.mark}>故障</span>
            <span class={styles.msg}>{s.last_incident.message}</span>
            <span class={styles.time}>{fmtTime(s.last_incident.started_at)}</span>
          </div>
        ) : null}
      </div>

      {/* 浮动 Tooltip */}
      {tip.value ? (
        <div class={['mono', styles.tip].join(' ')} style={`left:${tip.value.x}px; top:${tip.value.y}px`} aria-hidden="true">
          {tip.value.lines.map((l, i) => (
            <div class={[styles.line, i > 0 && styles.strong].filter(Boolean).join(' ')} key={i}>
              {l}
            </div>
          ))}
        </div>
      ) : null}
    </>
  )
})
