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

  const sections: { key: Section; label: string; index: string; icon: string }[] = [
    {
      key: 'settings',
      label: '站点设置',
      index: '01',
      icon: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
    },
    {
      key: 'groups',
      label: '分组配置',
      index: '02',
      icon: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    },
    {
      key: 'services',
      label: '服务节点',
      index: '03',
      icon: '<rect width="20" height="8" x="2" y="2" rx="1" ry="1"/><rect width="20" height="8" x="2" y="14" rx="1" ry="1"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/>',
    },
    {
      key: 'bookmarks',
      label: '快速书签',
      index: '04',
      icon: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
    },
    {
      key: 'notify',
      label: '通知配置',
      index: '05',
      icon: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    },
    {
      key: 'security',
      label: '安全设置',
      index: '06',
      icon: '<rect width="18" height="11" x="3" y="11" rx="1" ry="1"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    },
  ]

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
      <span class="idx mono">{sec.index}</span>
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
      gap: 2px;
    }
  }

  /* Swiss Minimalist Sidebar Nav Item */
  .item {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    padding: 7px 10px;
    border: 1px solid transparent;
    background: transparent;
    border-radius: var(--radius-xs);
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-secondary);
    text-align: left;
    text-decoration: none;
    outline: none;
    transition:
      background-color var(--transition),
      color var(--transition),
      border-color var(--transition);
    user-select: none;
  }
  .item:hover:not(.is-active) {
    background: var(--color-surface-hover);
    color: var(--color-text-primary);
  }
  .item.is-active {
    background: var(--color-accent);
    color: var(--color-on-accent);
    font-weight: 600;
    border-color: var(--color-accent);
  }
  .item.is-active:hover {
    background: var(--color-accent-hover);
    color: var(--color-on-accent);
    border-color: var(--color-accent-hover);
  }
  .item:focus-visible {
    outline: 2px solid var(--color-border-focus);
    outline-offset: 2px;
  }

  .idx {
    font-size: 10px;
    opacity: 0.6;
  }
  .item.is-active .idx,
  .item.is-active:hover .idx {
    color: var(--color-on-accent);
    opacity: 0.85;
    font-weight: 700;
  }

  .icon {
    width: 15px;
    height: 15px;
    flex-shrink: 0;
    color: var(--color-text-tertiary);
    transition: color var(--transition);
  }
  .item:hover:not(.is-active) .icon {
    color: var(--color-text-primary);
  }
  .item.is-active .icon,
  .item.is-active:hover .icon {
    color: var(--color-on-accent);
  }

  .label {
    white-space: nowrap;
  }

  .count {
    margin-left: auto;
    background: var(--color-surface-subtle);
    border: 1px solid var(--color-border);
    padding: 1px 5px;
    border-radius: var(--radius-xs);
    font-size: 10px;
    font-weight: 600;
    color: var(--color-text-tertiary);
  }
  .item.is-active .count {
    background: color-mix(in srgb, var(--color-on-accent) 18%, transparent);
    border-color: transparent;
    color: var(--color-on-accent);
  }
</style>

