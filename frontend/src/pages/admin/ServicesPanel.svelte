<script lang="ts">
  import type { Service } from '../../lib/types'
  import { iconFit } from '../../lib/iconFit'
  import PanelHead from './PanelHead.svelte'
  import RowActions from './RowActions.svelte'

  let {
    services,
    monitoredCount,
    groupName,
    onedit,
    ondelete,
    onadd,
  }: {
    services: Service[]
    monitoredCount: number
    groupName: (id: number) => string
    onedit: (s: Service) => void
    ondelete: (s: Service) => void
    onadd: () => void
  } = $props()
</script>

<div class="wrap">
  <div class="head">
    <PanelHead title="服务节点" sub={`已收录 ${services.length} 个 · ${monitoredCount} 个开启探活`} />
    <button type="button" class="btn btn-primary shrink" onclick={onadd}>
      + 新增服务
    </button>
  </div>

  <div class="list">
    {#each services as s (s.id)}
      <div class="list-row">
        {#if s.icon}
          <img src={s.icon} alt="" class="list-icon" loading="lazy" use:iconFit />
        {:else}
          <div class="list-icon fallback mono">{s.name.slice(0, 1).toUpperCase()}</div>
        {/if}

        <div class="list-info">
          <div class="list-line">
            <span class="list-name">{s.name}</span>
            <span class="badge">{groupName(s.group_id)}</span>
            {#if s.monitor_enabled}
              <span class="watch mono">{s.monitor_interval_s}s 探活</span>
            {/if}
          </div>
          {#if s.href || s.description}
            <p class="list-sub">{s.description || s.href}</p>
          {/if}
        </div>

        <RowActions onedit={() => onedit(s)} ondelete={() => ondelete(s)} />
      </div>
    {:else}
      <div class="empty">暂无服务节点,点击右上角「+ 新增服务」创建</div>
    {/each}
  </div>
</div>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .shrink {
    flex-shrink: 0;
  }

  .watch {
    flex-shrink: 0;
    border: 1px solid rgba(133, 217, 150, 0.3);
    background: var(--md-sys-color-success-container);
    padding: 2px 8px;
    border-radius: var(--md-sys-shape-corner-small);
    font-size: 11px;
    font-weight: 500;
    color: var(--md-sys-color-on-success-container);
  }
</style>
