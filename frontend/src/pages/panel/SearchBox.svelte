<script lang="ts">
  interface Props {
    value: string
    /** / 快捷键聚焦的目标元素,由父级持有 */
    bindEl?: HTMLInputElement | null
    placeholder?: string
  }
  let { value = $bindable(''), bindEl = $bindable(null), placeholder = '搜索服务或书签...' }: Props = $props()

  let el = $state<HTMLInputElement | null>(null)

  // 同步给父级供 / 快捷键聚焦
  $effect(() => {
    bindEl = el
  })
</script>

<div class="search-bar">
  <svg viewBox="0 0 24 24" class="glyph" aria-hidden="true">
    <path
      d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
      fill="currentColor"
    />
  </svg>
  <input
    bind:this={el}
    bind:value
    type="text"
    {placeholder}
    aria-label="搜索服务或书签"
    class="input-box"
  />
  {#if value}
    <button
      type="button"
      class="clear-btn"
      aria-label="清空搜索"
      onclick={() => {
        value = ''
        el?.focus()
      }}
    >
      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
        <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
      </svg>
    </button>
  {:else}
    <span class="kbd-badge mono" title="按 / 键快速聚焦">/</span>
  {/if}
</div>

<style>
  .search-bar {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
    height: 32px;
    padding: 0 8px;
    background: var(--color-surface);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-s);
    transition:
      border-color var(--transition),
      background-color var(--transition);
  }
  .search-bar:hover {
    border-color: var(--color-text-secondary);
  }
  .search-bar:focus-within {
    border-color: var(--color-border-focus);
    background: var(--color-surface);
  }
  @media (min-width: 640px) {
    .search-bar {
      max-width: 18rem;
    }
  }
  @media (max-width: 639px) {
    .kbd-badge {
      display: none;
    }
  }

  .glyph {
    width: 14px;
    height: 14px;
    color: var(--color-text-tertiary);
    flex-shrink: 0;
    pointer-events: none;
    transition: color var(--transition);
  }
  .search-bar:focus-within .glyph {
    color: var(--color-text-primary);
  }

  .input-box {
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0 6px;
    background: transparent;
    border: none;
    font-size: 12.5px;
    color: var(--color-text-primary);
    outline: none;
  }
  .input-box::placeholder {
    color: var(--color-text-quaternary);
    font-size: 12px;
  }

  .kbd-badge {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    background: var(--color-surface-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xs);
    font-size: 10px;
    font-weight: 600;
    color: var(--color-text-tertiary);
    user-select: none;
    pointer-events: none;
  }

  .clear-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: none;
    background: transparent;
    border-radius: var(--radius-xs);
    color: var(--color-text-tertiary);
    outline: none;
    padding: 0;
    cursor: pointer;
    transition: color var(--transition), background-color var(--transition);
  }
  .clear-btn:hover {
    color: var(--color-text-primary);
    background: var(--color-surface-subtle);
  }
</style>

