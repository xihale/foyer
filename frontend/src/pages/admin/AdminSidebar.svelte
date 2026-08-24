<script module lang="ts">
  // 分区路由:hash 即地址(#services 等),Admin 监听 hashchange 渲染
  export const section_keys = ['settings', 'groups', 'services', 'bookmarks', 'notify', 'security'] as const
  export type Section = (typeof section_keys)[number]
</script>

<script lang="ts">
  let {
    section,
    counts,
  }: {
    section: Section
    counts: { groups: number; services: number; bookmarks: number }
  } = $props()

  // 图标为内联 SVG,不引入图标字体
  const sections: { key: Section; label: string; icon: string }[] = [
    {
      key: 'settings',
      label: '站点设置',
      icon: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
    },
    {
      key: 'groups',
      label: '分组配置',
      icon: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    },
    {
      key: 'services',
      label: '服务节点',
      icon: '<rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/>',
    },
    {
      key: 'bookmarks',
      label: '快速书签',
      icon: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
    },
    {
      key: 'notify',
      label: '通知配置',
      icon: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    },
    {
      key: 'security',
      label: '安全设置',
      icon: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    },
  ]

  // 模板调用时现取,保证计数随 props 更新
  const countOf = (key: Section): number | undefined =>
    key === 'groups'
      ? counts.groups
      : key === 'services'
        ? counts.services
        : key === 'bookmarks'
          ? counts.bookmarks
          : undefined
</script>

<nav class="nav" aria-label="管理分区">
  {#each sections as sec (sec.key)}
    <a
      href="#{sec.key}"
      class="item"
      class:is-active={section === sec.key}
      aria-current={section === sec.key ? 'page' : undefined}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="icon"
        class:is-active={section === sec.key}
        aria-hidden="true"
      >
        {@html sec.icon}
      </svg>
      <span class="label">{sec.label}</span>
      {#if countOf(sec.key) !== undefined}
        <span class="count mono">{countOf(sec.key)}</span>
      {/if}
    </a>
  {/each}
</nav>

<style>
  .nav {
    display: flex;
    gap: 4px;
    overflow-x: auto;
  }
  @media (min-width: 768px) {
    .nav {
      flex-direction: column;
      gap: 3px;
    }
  }

  /* Material 3 Navigation Drawer Item (Mature & Compact) */
  .item {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
    padding: 8px 14px;
    border: none;
    background: transparent;
    border-radius: var(--md-sys-shape-corner-full);
    font-size: 13.5px;
    font-weight: 500;
    color: var(--md-sys-color-on-surface-variant);
    text-align: left;
    text-decoration: none;
    outline: none;
    transition:
      background-color var(--transition),
      color var(--transition);
    user-select: none;
  }
  .item:hover {
    background: color-mix(in srgb, var(--md-sys-color-on-surface) 5%, transparent);
    color: var(--md-sys-color-on-surface);
  }
  .item.is-active {
    background: var(--md-sys-color-secondary-container);
    color: var(--md-sys-color-on-secondary-container);
    font-weight: 600;
  }
  .item:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    color: var(--text-3);
    transition: color var(--transition);
  }
  .item:hover .icon {
    color: var(--md-sys-color-on-surface);
  }
  .icon.is-active {
    color: var(--md-sys-color-on-secondary-container);
  }

  .label {
    white-space: nowrap;
  }

  .count {
    margin-left: auto;
    background: var(--md-sys-color-surface-container-highest);
    border: 1px solid var(--md-sys-color-outline-variant);
    padding: 1px 6px;
    border-radius: var(--md-sys-shape-corner-full);
    font-family: var(--font-mono);
    font-size: 10.5px;
    font-weight: 500;
    color: var(--text-3);
  }
</style>
