<script lang="ts">
  import type { Group } from '../../lib/types'
  import { iconFit } from '../../lib/iconFit'

  let { group }: { group: Group } = $props()
</script>

<section class="group" aria-label={group.name}>
  <div class="head">
    <div class="title-wrap">
      <span class="group-title">{group.name}</span>
      <span class="count mono">{group.bookmarks?.length ?? 0}</span>
    </div>
  </div>

  <div class="tags">
    {#each group.bookmarks ?? [] as b (b.id)}
      <a href={b.href} target="_blank" rel="noreferrer" title={b.name} class="chip">
        {#if b.icon}
          <img src={b.icon} alt="" class="icon" loading="lazy" use:iconFit />
        {/if}
        <span class="name">{b.name}</span>
      </a>
    {/each}
  </div>
</section>

<style>
  .group {
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

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  /* Material 3 Assist / Filter Chip (Mature & Sleek) */
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 4px 12px;
    min-height: 32px;
    font-size: 12.5px;
    font-weight: 500;
    color: var(--md-sys-color-on-surface-variant);
    background: var(--md-sys-color-surface-container-low);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--md-sys-shape-corner-small);
    box-shadow: var(--md-sys-elevation-level1);
    text-decoration: none;
    transition:
      color var(--transition),
      border-color var(--transition),
      background-color var(--transition);
  }
  .chip:hover {
    color: var(--md-sys-color-on-surface);
    border-color: var(--md-sys-color-outline);
    background: var(--md-sys-color-surface-container);
  }
  .chip:active {
    background: var(--md-sys-color-surface-container-high);
  }

  .icon {
    width: 16px;
    height: 16px;
    object-fit: contain;
    border-radius: 3px;
  }
  .name {
    white-space: nowrap;
  }
</style>
