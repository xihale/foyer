<script lang="ts">
  let {
    win,
    uptime,
    upCount,
    total,
    downCount,
  }: {
    win: '24h' | '7d'
    uptime: number | null
    upCount: number
    total: number
    downCount: number
  } = $props()

  const fmtUptime = (u: number | null) => (u === null ? '--' : `${u.toFixed(2)}%`)
</script>

<section class="stat kpi">
  <div class="kpi-col">
    <div class="k mono">{win} 可用率</div>
    <div class="v mono ok">{fmtUptime(uptime)}</div>
  </div>

  <div class="kpi-col">
    <div class="k mono">在线节点</div>
    <div class="v mono">
      {upCount} <span class="sub">/ {total}</span>
    </div>
  </div>

  <div class="kpi-col">
    <div class="k mono">离线节点</div>
    <div class="v mono" class:bad={downCount > 0}>{downCount}</div>
  </div>
</section>

<style>
  /* 容器外观由 .stat (M3 Surface Container Low) 提供 */
  .kpi {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    padding: 16px 20px;
    background: var(--md-sys-color-surface-container-low);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--md-sys-shape-corner-medium);
    box-shadow: var(--md-sys-elevation-level1);
  }

  .kpi-col {
    display: flex;
    flex-direction: column;
  }

  .k {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--text-3);
    text-transform: uppercase;
  }
  .v {
    margin-top: 4px;
    font-size: 19px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--md-sys-color-on-surface);
  }
  .v.ok {
    color: var(--md-sys-color-success);
  }
  .v.bad {
    color: var(--md-sys-color-error);
  }
  .sub {
    font-size: 12.5px;
    font-weight: 400;
    color: var(--text-4);
  }
</style>
