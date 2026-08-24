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
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
      </svg>
    </button>
  {:else}
    <span class="kbd-badge" title="按 / 键快速聚焦">/</span>
  {/if}
</div>

<style>
  .search-bar {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
    height: 36px;
    padding: 0 10px;
    background: var(--md-sys-color-surface-container);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--md-sys-shape-corner-full);
    transition:
      border-color var(--transition),
      background-color var(--transition),
      box-shadow var(--transition);
  }
  .search-bar:hover {
    background: var(--md-sys-color-surface-container-high);
    border-color: var(--md-sys-color-outline);
  }
  .search-bar:focus-within {
    background: var(--md-sys-color-surface-container-high);
    border-color: var(--md-sys-color-primary);
    box-shadow: 0 0 0 1px var(--md-sys-color-primary);
  }
  /* 移动端独占 header .below 整行;宽度限制只属于桌面顶栏(外层 .search-desktop 已有 max-width,此处兜底) */
  @media (min-width: 640px) {
    .search-bar {
      max-width: 20rem;
    }
  }
  /* 触屏窄屏无键盘,/ 快捷键徽章没意义还占位 */
  @media (max-width: 639px) {
    .kbd-badge {
      display: none;
    }
  }

  .glyph {
    width: 16px;
    height: 16px;
    color: var(--text-3);
    flex-shrink: 0;
    pointer-events: none;
    transition: color var(--transition);
  }
  .search-bar:focus-within .glyph {
    color: var(--md-sys-color-primary);
  }

  .input-box {
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0 8px;
    background: transparent;
    border: none;
    font-size: 13px;
    color: var(--md-sys-color-on-surface);
    outline: none;
  }
  .input-box::placeholder {
    color: var(--text-4);
    font-size: 12.5px;
  }

  .kbd-badge {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    background: var(--md-sys-color-surface-container-lowest);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--md-sys-shape-corner-extra-small);
    font-family: var(--font-mono);
    font-size: 10.5px;
    font-weight: 500;
    color: var(--text-3);
    user-select: none;
    pointer-events: none;
  }

  .clear-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border: none;
    background: transparent;
    border-radius: var(--md-sys-shape-corner-full);
    color: var(--text-3);
    outline: none;
    padding: 0;
    cursor: pointer;
    transition: color var(--transition), background-color var(--transition);
  }
  .clear-btn:hover {
    color: var(--md-sys-color-on-surface);
    background: color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent);
  }
</style>
