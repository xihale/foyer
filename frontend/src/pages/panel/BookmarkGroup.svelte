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
    gap: 10px;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 2px;
  }
  .title-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .group-title {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
  }
  .count {
    font-size: 11px;
    font-weight: 500;
    color: var(--color-text-quaternary);
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  /* Swiss Minimalist Tag / Chip */
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    min-height: 28px;
    font-size: 12px;
    font-weight: 500;
    color: var(--color-text-primary);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xs);
    text-decoration: none;
    transition:
      color var(--transition),
      border-color var(--transition),
      background-color var(--transition);
  }
  .chip:hover {
    color: var(--color-accent);
    border-color: var(--color-border-strong);
    background: var(--color-surface-hover);
  }
  .chip:active {
    background: var(--color-surface-subtle);
  }

  .icon {
    width: 14px;
    height: 14px;
    object-fit: contain;
    border-radius: var(--radius-none);
  }
  .name {
    white-space: nowrap;
  }
</style>

