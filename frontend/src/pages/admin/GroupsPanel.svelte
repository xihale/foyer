<script lang="ts">
  import PanelHead from './PanelHead.svelte'
  import RowActions from './RowActions.svelte'
  import type { GroupRow } from './types'

  let {
    serviceGroups,
    bookmarkGroups,
    onedit,
    ondelete,
    onadd,
  }: {
    serviceGroups: GroupRow[]
    bookmarkGroups: GroupRow[]
    onedit: (g: GroupRow) => void
    ondelete: (g: GroupRow) => void
    onadd: (name: string, kind: 'service' | 'bookmark') => void
  } = $props()

  let newSvc = $state('')
  let newBm = $state('')

  function submit(e: SubmitEvent, kind: 'service' | 'bookmark') {
    e.preventDefault()
    const name = (kind === 'service' ? newSvc : newBm).trim()
    if (!name) return
    onadd(name, kind)
    if (kind === 'service') newSvc = ''
    else newBm = ''
  }
</script>

{#snippet rows(items: GroupRow[], empty: string)}
  <div class="list">
    {#each items as g (g.id)}
      <div class="list-row">
        <div class="list-info">
          <span class="list-name">{g.name}</span>
          {#if g.kind === 'service'}
            <span class="badge">{g.columns ?? '默认 3'} 列</span>
          {:else if g.icons_only}
            <span class="badge">仅图标</span>
          {/if}
        </div>
        <RowActions onedit={() => onedit(g)} ondelete={() => ondelete(g)} />
      </div>
    {:else}
      <p class="none mono">{empty}</p>
    {/each}
  </div>
{/snippet}

<div class="wrap">
  <PanelHead title="分组管理" sub="节点分组与书签分组分开，互不混用" />

  <section class="block">
    <div class="head">
      <span class="group-title">节点分组</span>
      <span class="count mono">{serviceGroups.length}</span>
    </div>
    {@render rows(serviceGroups, '暂无节点分组')}
    <form class="card add" onsubmit={(e) => submit(e, 'service')}>
      <input bind:value={newSvc} maxlength="64" placeholder="新节点分组..." aria-label="新节点分组名称" class="input grow" />
      <button type="submit" disabled={!newSvc.trim()} class="btn btn-primary shrink">+ 添加</button>
    </form>
  </section>

  <section class="block">
    <div class="head">
      <span class="group-title">书签分组</span>
      <span class="count mono">{bookmarkGroups.length}</span>
    </div>
    {@render rows(bookmarkGroups, '暂无书签分组')}
    <form class="card add" onsubmit={(e) => submit(e, 'bookmark')}>
      <input bind:value={newBm} maxlength="64" placeholder="新书签分组..." aria-label="新书签分组名称" class="input grow" />
      <button type="submit" disabled={!newBm.trim()} class="btn btn-primary shrink">+ 添加</button>
    </form>
  </section>
</div>

<style>
  .wrap,
  .block {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .wrap {
    gap: 28px;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 2px;
  }
  .count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 1px 6px;
    background: var(--color-surface-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xs);
    font-size: 10.5px;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .list-row {
    gap: 16px;
  }
  .list-info {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .none {
    padding: 28px 16px;
    text-align: center;
    font-size: 12px;
    color: var(--color-text-quaternary);
  }

  .add {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
  }
  .grow {
    flex: 1;
    min-width: 160px;
    width: auto;
  }
  .shrink {
    flex-shrink: 0;
  }
</style>

