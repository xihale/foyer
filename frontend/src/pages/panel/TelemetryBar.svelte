<script lang="ts">
  import { fmtRate, fmtSize, fmtUptime, num, pctOf, pctText } from '../../lib/format'
  import type { SystemInfo } from '../../lib/types'

  let { system }: { system: SystemInfo } = $props()

  const cpuPct = $derived(num(system.cpu_percent))
  const memPct = $derived(pctOf(num(system.mem_used_mb), num(system.mem_total_mb)))
  const rootDisk = $derived((system.disks ?? [])[0])
  const diskPct = $derived(rootDisk ? pctOf(num(rootDisk.used_mb), num(rootDisk.total_mb)) : null)

  const fmtLoad = (v: number | undefined): string =>
    num(v) === null ? '--' : (v as number).toFixed(2)

  const uptimeStr = $derived(system.uptime_s ? fmtUptime(num(system.uptime_s)) : null)

  // 提取简明的系统与内核名 (如 "Manjaro · 7.1.8")
  const osSummary = $derived.by(() => {
    const os = (system.os_name || '').replace(/\s*Linux\s*/i, '').trim() || system.os_name || 'Linux'
    const kern = system.kernel ? system.kernel.split('-')[0] : ''
    return [os, kern].filter(Boolean).join(' · ')
  })
</script>

<section class="telemetry-grid" aria-label="系统与资源监控">
  <!-- 1. HOST / 设备基本信息 -->
  <div class="metric-card system-card">
    <div class="card-head">
      <span class="label mono">HOST</span>
      <span class="meta mono">{system.hostname || 'localhost'}</span>
    </div>
    <div class="card-body">
      <span class="val system-val mono">{uptimeStr || '--'}</span>
    </div>
    <div class="card-foot mono">
      <span class="foot-text" title={`${system.os_name ?? ''} ${system.kernel ?? ''}`}>
        {osSummary || 'Online'}
      </span>
    </div>
  </div>

  <!-- 2. CPU -->
  <div class="metric-card">
    <div class="card-head">
      <span class="label mono">CPU</span>
      {#if system.cpu_cores}
        <span class="meta mono">{system.cpu_cores}c · load {fmtLoad(system.load_1)}</span>
      {/if}
    </div>
    <div class="card-body">
      <span class="val mono">{cpuPct !== null ? `${Math.round(cpuPct)}%` : '--'}</span>
    </div>
    <div class="card-foot">
      <div class="track" aria-hidden="true">
        <div class="fill cpu" style={`width: ${cpuPct !== null ? Math.min(100, Math.max(0, cpuPct)) : 0}%`}></div>
      </div>
    </div>
  </div>

  <!-- 3. MEM -->
  <div class="metric-card">
    <div class="card-head">
      <span class="label mono">MEM</span>
      <span class="meta mono">{fmtSize(num(system.mem_used_mb))}/{fmtSize(num(system.mem_total_mb))}</span>
    </div>
    <div class="card-body">
      <span class="val mono">{pctText(memPct)}</span>
    </div>
    <div class="card-foot">
      <div class="track" aria-hidden="true">
        <div class="fill mem" style={`width: ${memPct !== null ? Math.min(100, Math.max(0, memPct)) : 0}%`}></div>
      </div>
    </div>
  </div>

  <!-- 4. DISK -->
  <div class="metric-card">
    <div class="card-head">
      <span class="label mono">DISK</span>
      {#if rootDisk}
        <span class="meta mono">{fmtSize(num(rootDisk.used_mb))}/{fmtSize(num(rootDisk.total_mb))}</span>
      {/if}
    </div>
    <div class="card-body">
      <span class="val mono">{pctText(diskPct)}</span>
    </div>
    <div class="card-foot">
      <div class="track" aria-hidden="true">
        <div class="fill disk" style={`width: ${diskPct !== null ? Math.min(100, Math.max(0, diskPct)) : 0}%`}></div>
      </div>
    </div>
  </div>

  <!-- 5. NET (等宽吞吐) -->
  <div class="metric-card">
    <div class="card-head">
      <span class="label mono">NET</span>
    </div>
    <div class="card-body mono">
      <div class="net-wrap">
        <span class="net-item"><span class="arrow down">↓</span> <span class="net-val">{fmtRate(num(system.net_rx_bps))}</span></span>
      </div>
    </div>
    <div class="card-foot mono">
      <div class="net-wrap">
        <span class="net-item"><span class="arrow up">↑</span> <span class="net-val">{fmtRate(num(system.net_tx_bps))}</span></span>
      </div>
    </div>
  </div>
</section>

<style>
  .telemetry-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  @media (min-width: 640px) {
    .telemetry-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
  @media (min-width: 1024px) {
    .telemetry-grid {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }
  }

  .metric-card {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 80px;
    padding: 10px 14px;
    background: var(--md-sys-color-surface-container-low);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--md-sys-shape-corner-medium);
    box-shadow: var(--md-sys-elevation-level1);
    transition:
      border-color var(--transition),
      background-color var(--transition);
  }
  .metric-card:hover {
    border-color: var(--md-sys-color-outline);
    background: var(--md-sys-color-surface-container);
  }

  .card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    height: 16px;
  }
  .label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--text-3);
    text-transform: uppercase;
  }
  .meta {
    font-size: 11px;
    color: var(--text-4);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-body {
    display: flex;
    align-items: baseline;
    margin: 3px 0 5px;
    min-height: 22px;
  }
  .val {
    font-size: 17px;
    font-weight: 600;
    color: var(--md-sys-color-on-surface);
    letter-spacing: -0.01em;
    line-height: 1.2;
  }
  .val.system-val {
    font-size: 14.5px;
    font-weight: 600;
    color: var(--md-sys-color-on-surface);
  }

  .card-foot {
    display: flex;
    align-items: center;
    height: 14px;
  }
  .foot-text {
    font-size: 11px;
    color: var(--text-4);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* M3 Linear Progress Indicator */
  .track {
    width: 100%;
    height: 3px;
    background: var(--line-light);
    border-radius: var(--md-sys-shape-corner-full);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    border-radius: var(--md-sys-shape-corner-full);
    transition: width 250ms var(--md-sys-motion-easing-standard);
  }
  .fill.cpu {
    background: var(--md-sys-color-primary);
  }
  .fill.mem {
    background: var(--md-sys-color-tertiary);
  }
  .fill.disk {
    background: var(--md-sys-color-secondary);
  }

  .net-item {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11.5px;
    color: var(--md-sys-color-on-surface-variant);
    white-space: nowrap;
  }
  .arrow {
    font-size: 11px;
    font-weight: 700;
  }
  .arrow.down {
    color: var(--md-sys-color-success);
  }
  .arrow.up {
    color: var(--md-sys-color-primary);
  }
  .net-val {
    color: var(--md-sys-color-on-surface);
    font-weight: 500;
  }
  .net-wrap {
    display: flex;
    align-items: center;
    gap: 12px;
  }
</style>
