<script lang="ts">
  import type { Group, Service, ServiceStatus } from '../../lib/types'
  import { iconFit } from '../../lib/iconFit'

  let {
    group,
    statuses,
    connected,
  }: {
    group: Group
    statuses: Map<number, ServiceStatus>
    connected: boolean
  } = $props()

  const latencyText = (s: Service): string | null => {
    const st = statuses.get(s.id)
    if (!st || !st.up || typeof st.latency_ms !== 'number' || st.latency_ms < 0) return null
    if (st.latency_ms === 0) return '<1ms'
    if (st.latency_ms >= 1000) return `${(st.latency_ms / 1000).toFixed(1)}s`
    return `${Math.round(st.latency_ms)}ms`
  }

  const dotState = (s: Service): 'up' | 'down' | 'unknown' => {
    const st = statuses.get(s.id)
    if (!st) return 'unknown'
    return st.up ? 'up' : 'down'
  }

  const dotTitle = (s: Service) => {
    const conn = connected ? '实时连接' : '重连中'
    const st = statuses.get(s.id)
    if (!st) return `${conn} · 暂无数据`
    if (!st.up) return `${conn} · 离线`
    const lat =
      typeof st.latency_ms === 'number' && st.latency_ms >= 0
        ? `${Math.round(st.latency_ms)}ms`
        : '正常'
    return `${conn} · 延迟 ${lat}`
  }
</script>

<section class="section" aria-label={group.name}>
  <div class="head">
    <div class="title-wrap">
      <span class="group-title">{group.name}</span>
      <span class="count mono">{group.services?.length ?? 0}</span>
    </div>
  </div>

  <div class="grid" style={`--cols:${group.columns ?? 3}`}>
    {#each group.services ?? [] as s (s.id)}
      <a href={s.href} target="_blank" rel="noreferrer" class="card-item service-card">
        <div class="icon-box">
          {#if s.icon}
            <img src={s.icon} alt="" class="icon" loading="lazy" use:iconFit />
          {:else}
            <div class="icon fallback mono">{s.name.slice(0, 1).toUpperCase()}</div>
          {/if}
        </div>

        <div class="info">
          <div class="name">{s.name}</div>
          {#if s.description}
            <div class="desc">{s.description}</div>
          {/if}
        </div>

        {#if s.monitor_enabled}
          {@const lat = latencyText(s)}
          <div class="status-indicator mono">
            {#if lat}
              <span class="lat">{lat}</span>
            {/if}
            <span
              class="dot pulse"
              data-state={dotState(s)}
              title={dotTitle(s)}
            ></span>
          </div>
        {/if}
      </a>
    {/each}
  </div>
</section>

<style>
  .section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 2px;
  }
  .title-wrap {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .group-title {
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--md-sys-color-on-surface);
  }
  .count {
    font-size: 11.5px;
    font-weight: 500;
    color: var(--text-4);
  }

  .grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
  }
  @media (min-width: 640px) {
    .grid {
      grid-template-columns: repeat(var(--cols, 3), minmax(0, 1fr));
    }
  }

  .service-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: var(--md-sys-shape-corner-medium);
    text-decoration: none;
  }

  .icon-box {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    flex-shrink: 0;
    background: var(--md-sys-color-surface-container-highest);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--md-sys-shape-corner-small);
    overflow: hidden;
  }
  .icon {
    width: 24px;
    height: 24px;
    object-fit: contain;
  }
  .icon.fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 600;
    color: var(--md-sys-color-primary);
    user-select: none;
  }

  .info {
    min-width: 0;
    flex: 1;
  }
  .name {
    font-size: 13.5px;
    font-weight: 500;
    color: var(--md-sys-color-on-surface);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color var(--transition);
  }
  .service-card:hover .name {
    color: var(--md-sys-color-primary);
  }
  .desc {
    margin-top: 2px;
    font-size: 11.5px;
    color: var(--text-3);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .status-indicator {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 6px;
    font-variant-numeric: tabular-nums;
  }
  .lat {
    font-size: 11px;
    font-weight: 400;
    color: var(--text-4);
  }
</style>
