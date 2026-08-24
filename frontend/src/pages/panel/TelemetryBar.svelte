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
  <!-- 1. HOST -->
  <div class="metric-card">
    <div class="card-head">
      <span class="label mono"><span class="idx">01</span> HOST</span>
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
      <span class="label mono"><span class="idx">02</span> CPU</span>
      {#if system.cpu_cores}
        <span class="meta mono">{system.cpu_cores}C · L1 {fmtLoad(system.load_1)}</span>
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
      <span class="label mono"><span class="idx">03</span> MEM</span>
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
      <span class="label mono"><span class="idx">04</span> DISK</span>
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

  <!-- 5. NET -->
  <div class="metric-card">
    <div class="card-head">
      <span class="label mono"><span class="idx">05</span> NET</span>
    </div>
    <div class="card-body mono">
      <div class="net-item">
        <span class="arrow down">↓</span>
        <span class="net-val">{fmtRate(num(system.net_rx_bps))}</span>
      </div>
    </div>
    <div class="card-foot mono">
      <div class="net-item">
        <span class="arrow up">↑</span>
        <span class="net-val">{fmtRate(num(system.net_tx_bps))}</span>
      </div>
    </div>
  </div>
</section>

<style>
  .telemetry-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  @media (min-width: 640px) {
    .telemetry-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
  @media (min-width: 1024px) {
    .telemetry-grid {
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 12px;
    }
  }

  .metric-card {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 84px;
    padding: 10px 12px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-s);
    transition:
      border-color var(--transition),
      background-color var(--transition);
  }
  .metric-card:hover {
    border-color: var(--color-border-strong);
    background: var(--color-surface-hover);
  }

  .card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .label {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    display: flex;
    align-items: baseline;
    gap: 4px;
    line-height: 1.3;
  }
  .idx {
    color: var(--color-accent);
    font-weight: 700;
  }
  .meta {
    font-size: 10.5px;
    color: var(--color-text-tertiary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-body {
    display: flex;
    align-items: baseline;
    margin: 4px 0 6px;
    min-height: 24px;
  }
  .val {
    font-size: 18px;
    font-weight: 700;
    color: var(--color-text-primary);
    letter-spacing: -0.02em;
    line-height: 1.2;
  }
  .val.system-val {
    font-size: 14.5px;
    font-weight: 600;
  }

  .card-foot {
    display: flex;
    align-items: center;
    min-height: 12px;
  }
  .foot-text {
    font-size: 10.5px;
    color: var(--color-text-tertiary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Swiss Precision Hairline Progress Bar */
  .track {
    width: 100%;
    height: 2px;
    background: var(--color-border);
    border-radius: var(--radius-none);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    border-radius: var(--radius-none);
    transition: width 200ms ease-out;
  }
  .fill.cpu {
    background: var(--color-accent);
  }
  .fill.mem {
    background: var(--color-text-primary);
  }
  .fill.disk {
    background: var(--color-text-secondary);
  }

  .net-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11.5px;
    color: var(--color-text-secondary);
    white-space: nowrap;
  }
  .arrow {
    font-size: 10.5px;
    font-weight: 700;
  }
  .arrow.down {
    color: var(--color-success);
  }
  .arrow.up {
    color: var(--color-accent);
  }
  .net-val {
    color: var(--color-text-primary);
    font-weight: 600;
  }
</style>

