<script lang="ts">
  import type { Snippet } from 'svelte'

  export type Route = 'panel' | 'status' | 'admin'

  interface Props {
    /** 当前高亮的导航项 */
    active: Route
    /** 面包屑文案;面板页留空则只显示站点名 */
    label?: string
    siteTitle?: string
    /** 导航前的附加内容(监控页的时间窗切换等),仅桌面端显示 */
    actions?: Snippet
    /** 主栏下方的附加行(面板页移动端搜索框),仅移动端显示 */
    below?: Snippet
  }
  let { active, label = '', siteTitle = 'foyer', actions, below }: Props = $props()

  const navs: { href: string; key: Route; label: string; index: string }[] = [
    { href: '/', key: 'panel', label: '服务', index: '01' },
    { href: '/status', key: 'status', label: '监控', index: '02' },
    { href: '/admin', key: 'admin', label: '设置', index: '03' },
  ]
</script>

<header class="header">
  <div class="bar">
    <div class="crumbs">
      <a class="site" href="/">
        <span class="mark">■</span>
        <span class="site-name">{siteTitle}</span>
      </a>
      {#if label}
        <span class="sep" aria-hidden="true">/</span>
        <span class="label mono">{label}</span>
      {/if}
    </div>

    <div class="right">
      {#if actions}
        <div class="actions-slot">
          {@render actions()}
        </div>
      {/if}
      <nav class="nav" aria-label="页面导航">
        {#each navs as n (n.key)}
          <a href={n.href} class="link-nav" class:is-active={active === n.key}>
            <span class="nav-idx mono">{n.index}</span>
            <span class="nav-text">{n.label}</span>
          </a>
        {/each}
      </nav>
    </div>
  </div>

  {#if below}
    <div class="below">
      {@render below()}
    </div>
  {/if}
</header>

<style>
  .header {
    position: sticky;
    top: 0;
    z-index: 40;
    width: 100%;
    background: color-mix(in srgb, var(--color-surface) 92%, transparent);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--color-border);
  }

  .bar {
    max-width: 72rem;
    margin: 0 auto;
    height: 52px;
    padding: 0 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  @media (min-width: 640px) {
    .bar {
      padding: 0 24px;
    }
  }

  .crumbs {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  .site {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color var(--transition);
  }
  .site:hover {
    color: var(--color-accent);
  }
  .mark {
    font-size: 10px;
    color: var(--color-accent);
    line-height: 1;
  }
  .site-name {
    letter-spacing: -0.02em;
  }
  .sep {
    font-size: 12px;
    font-family: var(--font-mono);
    color: var(--color-text-quaternary);
  }
  .label {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .right {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .actions-slot {
    display: flex;
    align-items: center;
  }

  .nav {
    display: flex;
    align-items: center;
    gap: 2px;
    background: var(--color-surface-subtle);
    padding: 2px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-s);
  }

  .link-nav {
    gap: 5px;
    padding: 4px 10px;
    border-radius: var(--radius-xs);
    font-size: 12px;
  }
  .nav-idx {
    font-size: 10px;
    opacity: 0.6;
  }
  .link-nav.is-active {
    background: var(--color-accent);
    color: var(--color-on-accent);
    font-weight: 600;
  }
  .link-nav.is-active .nav-idx {
    opacity: 0.85;
    color: var(--color-on-accent);
  }

  .below {
    border-top: 1px solid var(--color-border);
    padding: 8px 16px;
    background: var(--color-surface);
  }
  @media (min-width: 640px) {
    .below {
      display: none;
    }
  }
</style>

