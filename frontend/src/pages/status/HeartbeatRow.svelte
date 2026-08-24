<script lang="ts">
  export interface Bar {
    t: number // 桶起始 unix millis
    total: number // 0 = 无数据
    ups: number
    avg_ms: number | null
  }

  export interface LastIncident {
    started_at: number // unix millis
    message: string
  }

  export interface StatusService {
    id: number
    name: string
    status: 'up' | 'down' | 'unknown'
    latency_ms?: number | null
    uptime_24h: number | null
    last_incident: LastIncident | null
    bars: Bar[]
  }

  interface Tip {
    x: number
    y: number
    lines: string[]
  }

  let {
    service: s,
    win,
    slotMs,
    uptime,
  }: {
    service: StatusService
    win: '24h' | '7d'
    slotMs: number
    uptime: number | null
  } = $props()

  let tip = $state<Tip | null>(null)

  const statusText = $derived(
    s.status === 'up' ? '运行正常' : s.status === 'down' ? '服务异常' : '未检测',
  )
  const fmtUptime = $derived(uptime === null ? '--' : `${uptime.toFixed(2)}%`)

  const barState = (b: Bar): 'none' | 'down' | 'partial' | 'up' =>
    b.total === 0 ? 'none' : b.ups === 0 ? 'down' : b.ups < b.total ? 'partial' : 'up'

  const fmtBarTime = (ms: number) => {
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

  function showTip(e: PointerEvent, b: Bar) {
    const end = b.t + slotMs
    const lines =
      b.total === 0
        ? [fmtBarTime(b.t), '无探活数据']
        : [
            `${fmtBarTime(b.t)} – ${fmtBarTime(end)}`,
            `${b.ups}/${b.total} 次成功 (${Math.round((b.ups / b.total) * 100)}%)${typeof b.avg_ms === 'number' ? ` · 延迟 ${Math.round(b.avg_ms)}ms` : ''}`,
          ]
    // 按估算半宽钳制在视口内,避免贴边溢出(tooltip 居中于 x、悬于 y 上方)
    const pad = 96
    const x = Math.min(Math.max(e.clientX, pad), Math.max(pad, window.innerWidth - pad))
    const y = Math.max(e.clientY, 64)
    tip = { x, y, lines }
  }

  /** 事件委托:柱状图容器监听 pointermove,目标 bar 带 data-i */
  function onBarsMove(e: PointerEvent & { currentTarget: EventTarget & HTMLElement }) {
    const el = (e.target as HTMLElement).closest('[data-i]')
    if (el) showTip(e, s.bars[Number(el.getAttribute('data-i'))]!)
  }
</script>

<div class="row">
  <div class="top">
    <!-- 左侧:服务名 + 状态 -->
    <div class="id">
      <span class="dot" data-state={s.status === 'unknown' ? undefined : s.status}></span>
      <span class="name">{s.name}</span>
      <span class="state mono" data-state={s.status}>{statusText}</span>
    </div>

    <!-- 右侧:当前延迟 + 窗口可用率 -->
    <div class="metrics mono">
      {#if s.status === 'up' && typeof s.latency_ms === 'number' && s.latency_ms >= 0}
        <span class="lat">{s.latency_ms < 1 ? '<1ms' : `${Math.round(s.latency_ms)}ms`}</span>
      {/if}
      <span>{fmtUptime}</span>
    </div>
  </div>

  <!-- 分段式心跳时间线柱状图 -->
  <div
    class="bars"
    style={`grid-template-columns: repeat(${s.bars?.length || 48}, minmax(0, 1fr));`}
    role="img"
    aria-label={`${s.name} 最近${win}心跳柱状图`}
    onpointermove={onBarsMove}
    onpointerleave={() => (tip = null)}
  >
    {#each s.bars ?? [] as b, i (i)}
      <div class="bar" data-state={barState(b)} data-i={i}></div>
    {/each}
  </div>

  <!-- 最近故障记录 -->
  {#if s.last_incident}
    <div class="incident mono">
      <span class="mark">异常:</span>
      <span class="msg">{s.last_incident.message}</span>
      <span class="time">{fmtTime(s.last_incident.started_at)}</span>
    </div>
  {/if}
</div>

<!-- 浮动 Tooltip(fixed 定位,不受父级布局影响) -->
{#if tip}
  <div
    class="tip mono"
    style={`left:${tip.x}px; top:${tip.y}px`}
    aria-hidden="true"
  >
    {#each tip.lines as l, i (i)}
      <div class="line" class:strong={i > 0}>{l}</div>
    {/each}
  </div>
{/if}

<style>
  .row {
    padding: 12px 16px;
    background: var(--md-sys-color-surface-container-low);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--md-sys-shape-corner-medium);
    box-shadow: var(--md-sys-elevation-level1);
    transition:
      border-color var(--transition),
      background-color var(--transition);
  }
  .row:hover {
    border-color: var(--md-sys-color-outline);
    background: var(--md-sys-color-surface-container);
  }

  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .id {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .name {
    font-size: 14px;
    font-weight: 500;
    color: var(--md-sys-color-on-surface);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .state {
    font-size: 11.5px;
    color: var(--text-4);
  }
  .state[data-state='up'] {
    color: var(--md-sys-color-success);
    font-weight: 500;
  }
  .state[data-state='down'] {
    color: var(--md-sys-color-error);
    font-weight: 500;
  }

  .metrics {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
    font-size: 12px;
    color: var(--md-sys-color-on-surface-variant);
  }
  .lat {
    color: var(--text-4);
  }

  .bars {
    display: grid;
    column-gap: 2px;
    height: 16px;
    margin-top: 10px;
    width: 100%;
  }
  .bar {
    width: 100%;
    height: 100%;
    min-width: 0;
    border-radius: 1px;
    cursor: pointer;
    transition: opacity var(--transition);
  }
  .bar:hover {
    opacity: 0.75;
  }
  .bar[data-state='up'] {
    background: var(--md-sys-color-success);
  }
  .bar[data-state='partial'] {
    background: var(--md-sys-color-warning);
  }
  .bar[data-state='down'] {
    background: var(--md-sys-color-error);
  }
  .bar[data-state='none'] {
    background: var(--md-sys-color-surface-container-highest);
  }

  .incident {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
    padding: 6px 10px;
    background: var(--md-sys-color-warning-container);
    border: 1px solid rgba(245, 190, 66, 0.25);
    border-radius: var(--md-sys-shape-corner-small);
    font-size: 11.5px;
    color: var(--md-sys-color-on-warning-container);
  }
  .mark {
    flex-shrink: 0;
    font-weight: 600;
  }
  .msg {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .time {
    margin-left: auto;
    flex-shrink: 0;
    color: var(--text-4);
  }

  /* M3 Tooltip (Rich Plain Tooltip) */
  .tip {
    position: fixed;
    z-index: 50;
    transform: translate(-50%, calc(-100% - 8px));
    white-space: nowrap;
    padding: 6px 11px;
    background: var(--md-sys-color-inverse-surface);
    color: var(--md-sys-color-inverse-on-surface);
    border-radius: var(--md-sys-shape-corner-small);
    box-shadow: var(--md-sys-elevation-level3);
    font-size: 11.5px;
    line-height: 1.5;
    pointer-events: none;
  }
  .line {
    color: var(--md-sys-color-inverse-on-surface);
    opacity: 0.85;
    font-variant-numeric: tabular-nums;
  }
  .line.strong {
    opacity: 1;
    font-weight: 600;
  }
</style>
