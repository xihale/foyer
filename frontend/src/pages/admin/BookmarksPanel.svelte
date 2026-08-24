<script lang="ts">
  import type { Bookmark } from '../../lib/types'
  import { iconFit } from '../../lib/iconFit'
  import PanelHead from './PanelHead.svelte'
  import RowActions from './RowActions.svelte'

  let {
    bookmarks,
    groupName,
    onedit,
    ondelete,
    onadd,
  }: {
    bookmarks: Bookmark[]
    groupName: (id: number) => string
    onedit: (b: Bookmark) => void
    ondelete: (b: Bookmark) => void
    onadd: () => void
  } = $props()
</script>

<div class="wrap">
  <div class="head">
    <PanelHead title="快速书签" sub={`已收录 ${bookmarks.length} 个书签`} />
    <button type="button" class="btn btn-primary shrink" onclick={onadd}>
      + 新增书签
    </button>
  </div>

  <div class="list">
    {#each bookmarks as b (b.id)}
      <div class="list-row">
        {#if b.icon}
          <img src={b.icon} alt="" class="list-icon" loading="lazy" use:iconFit />
        {:else}
          <div class="list-icon fallback mono">{b.name.slice(0, 1).toUpperCase()}</div>
        {/if}

        <div class="list-info">
          <div class="list-line">
            <span class="list-name">{b.name}</span>
            <span class="badge">{groupName(b.group_id)}</span>
          </div>
          <a href={b.href} target="_blank" rel="noreferrer" class="href mono" title={b.href}>
            {b.href}
          </a>
        </div>

        <RowActions onedit={() => onedit(b)} ondelete={() => ondelete(b)} />
      </div>
    {:else}
      <div class="empty">暂无书签数据,点击右上角「+ 新增书签」添加</div>
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

  /* 书签图标 */
  .list-icon {
    width: 26px;
    height: 26px;
    font-size: 12px;
    border-radius: var(--md-sys-shape-corner-extra-small);
  }

  .href {
    display: block;
    margin-top: 3px;
    font-size: 12px;
    color: var(--md-sys-color-outline);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color var(--transition);
  }
  .href:hover {
    color: var(--md-sys-color-primary);
  }
</style>
