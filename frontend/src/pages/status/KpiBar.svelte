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
    <div class="k mono"><span class="idx">01</span><span>{win} 可用率</span></div>
    <div class="v mono ok">{fmtUptime(uptime)}</div>
  </div>

  <div class="kpi-col">
    <div class="k mono"><span class="idx">02</span><span>在线节点</span></div>
    <div class="v mono">
      {upCount} <span class="sub">/ {total}</span>
    </div>
  </div>

  <div class="kpi-col">
    <div class="k mono"><span class="idx">03</span><span>离线节点</span></div>
    <div class="v mono" class:bad={downCount > 0}>{downCount}</div>
  </div>
</section>

<style>
  .kpi {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-s);
    overflow: hidden;
  }

  .kpi-col {
    display: flex;
    flex-direction: column;
    padding: 16px 20px;
  }
  .kpi-col + .kpi-col {
    border-left: 1px solid var(--color-border);
  }

  .k {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    display: flex;
    align-items: baseline;
    gap: 6px;
    line-height: 1.3;
  }
  .idx {
    color: var(--color-accent);
    font-size: 11px;
    font-weight: 700;
  }
  .v {
    margin-top: 6px;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--color-text-primary);
  }
  .v.ok {
    color: var(--color-success);
  }
  .v.bad {
    color: var(--color-error);
  }
  .sub {
    font-size: 12px;
    font-weight: 400;
    color: var(--color-text-quaternary);
  }
</style>

