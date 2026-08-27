import { component$ } from '@qwik.dev/core'
import { fmtRate, fmtSize, fmtUptime, num, pctOf, pctText } from '~/lib/format'
import type { SystemInfo } from '~/lib/types'
import styles from './telemetry-bar.module.css'

interface TelemetryBarProps {
  system: SystemInfo
}

export const TelemetryBar = component$<TelemetryBarProps>(({ system }) => {
  const cpuPct = num(system.cpu_percent)
  const memPct = pctOf(num(system.mem_used_mb), num(system.mem_total_mb))
  const rootDisk = (system.disks ?? [])[0]
  const diskPct = rootDisk ? pctOf(num(rootDisk.used_mb), num(rootDisk.total_mb)) : null
  const uptimeStr = system.uptime_s ? fmtUptime(num(system.uptime_s)) : null

  const fmtLoad = (v: number | undefined): string => (num(v) === null ? '--' : (v as number).toFixed(2))

  // 提取简明的系统与内核名 (如 "Manjaro · 7.1.8")
  const os =
    (system.os_name || '').replace(/\s*Linux\s*/i, '').trim() || system.os_name || 'Linux'
  const kern = system.kernel ? system.kernel.split('-')[0] : ''
  const osSummary = [os, kern].filter(Boolean).join(' · ')

  return (
    <section class={styles.telemetryGrid} aria-label="系统与资源监控">
      {/* 1. HOST */}
      <div class={styles.metricCard}>
        <div class={styles.cardHead}>
          <span class={['mono', styles.label].join(' ')}>
            <span class={styles.idx}>01</span> HOST
          </span>
          <span class={['mono', styles.meta].join(' ')}>{system.hostname || 'localhost'}</span>
        </div>
        <div class={styles.cardBody}>
          <span class={['mono', styles.val, styles.systemVal].join(' ')}>{uptimeStr || '--'}</span>
        </div>
        <div class={['mono', styles.cardFoot].join(' ')}>
          <span class={styles.footText} title={`${system.os_name ?? ''} ${system.kernel ?? ''}`}>
            {osSummary || 'Online'}
          </span>
        </div>
      </div>

      {/* 2. CPU */}
      <div class={styles.metricCard}>
        <div class={styles.cardHead}>
          <span class={['mono', styles.label].join(' ')}>
            <span class={styles.idx}>02</span> CPU
          </span>
          {system.cpu_cores ? (
            <span class={['mono', styles.meta].join(' ')}>
              {system.cpu_cores}C · L1 {fmtLoad(system.load_1)}
            </span>
          ) : null}
        </div>
        <div class={styles.cardBody}>
          <span class={'mono ' + styles.val}>{cpuPct !== null ? `${Math.round(cpuPct)}%` : '--'}</span>
        </div>
        <div class={styles.cardFoot}>
          <div class={styles.track} aria-hidden="true">
            <div
              class={[styles.fill, styles.fillCpu].join(' ')}
              style={`width: ${cpuPct !== null ? Math.min(100, Math.max(0, cpuPct)) : 0}%`}
            ></div>
          </div>
        </div>
      </div>

      {/* 3. MEM */}
      <div class={styles.metricCard}>
        <div class={styles.cardHead}>
          <span class={['mono', styles.label].join(' ')}>
            <span class={styles.idx}>03</span> MEM
          </span>
          <span class={['mono', styles.meta].join(' ')}>
            {fmtSize(num(system.mem_used_mb))}/{fmtSize(num(system.mem_total_mb))}
          </span>
        </div>
        <div class={styles.cardBody}>
          <span class={'mono ' + styles.val}>{pctText(memPct)}</span>
        </div>
        <div class={styles.cardFoot}>
          <div class={styles.track} aria-hidden="true">
            <div
              class={[styles.fill, styles.fillMem].join(' ')}
              style={`width: ${memPct !== null ? Math.min(100, Math.max(0, memPct)) : 0}%`}
            ></div>
          </div>
        </div>
      </div>

      {/* 4. DISK */}
      <div class={styles.metricCard}>
        <div class={styles.cardHead}>
          <span class={['mono', styles.label].join(' ')}>
            <span class={styles.idx}>04</span> DISK
          </span>
          {rootDisk ? (
            <span class={['mono', styles.meta].join(' ')}>
              {fmtSize(num(rootDisk.used_mb))}/{fmtSize(num(rootDisk.total_mb))}
            </span>
          ) : null}
        </div>
        <div class={styles.cardBody}>
          <span class={'mono ' + styles.val}>{pctText(diskPct)}</span>
        </div>
        <div class={styles.cardFoot}>
          <div class={styles.track} aria-hidden="true">
            <div
              class={[styles.fill, styles.fillDisk].join(' ')}
              style={`width: ${diskPct !== null ? Math.min(100, Math.max(0, diskPct)) : 0}%`}
            ></div>
          </div>
        </div>
      </div>

      {/* 5. NET */}
      <div class={styles.metricCard}>
        <div class={styles.cardHead}>
          <span class={['mono', styles.label].join(' ')}>
            <span class={styles.idx}>05</span> NET
          </span>
        </div>
        <div class={[styles.cardBody, 'mono'].join(' ')}>
          <div class={styles.netItem}>
            <span class={[styles.arrow, styles.arrowDown].join(' ')}>↓</span>
            <span>{fmtRate(num(system.net_rx_bps))}</span>
          </div>
        </div>
        <div class={[styles.cardFoot, 'mono'].join(' ')}>
          <div class={styles.netItem}>
            <span class={[styles.arrow, styles.arrowUp].join(' ')}>↑</span>
            <span>{fmtRate(num(system.net_tx_bps))}</span>
          </div>
        </div>
      </div>
    </section>
  )
})
