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

  const navs: { href: string; key: Route; label: string }[] = [
    { href: '/', key: 'panel', label: '服务' },
    { href: '/status', key: 'status', label: '监控' },
    { href: '/admin', key: 'admin', label: '设置' },
  ]
</script>

<header class="header">
  <div class="bar">
    <div class="crumbs">
      <a class="site" href="/">{siteTitle}</a>
      {#if label}
        <span class="sep">/</span>
        <span class="label">{label}</span>
      {/if}
    </div>

    <div class="right">
      {#if actions}
        {@render actions()}
      {/if}
      <nav class="nav" aria-label="页面导航">
        {#each navs as n (n.key)}
          <a href={n.href} class="link-nav" class:is-active={active === n.key}>{n.label}</a>
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
    background: rgba(13, 15, 18, 0.82);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--md-sys-color-outline-variant);
  }

  .bar {
    max-width: 68rem;
    margin: 0 auto;
    height: 54px;
    padding: 0 18px;
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
    gap: 8px;
    min-width: 0;
  }
  .site {
    font-size: 16px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--md-sys-color-on-surface);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color var(--transition);
  }
  .site:hover {
    color: var(--md-sys-color-primary);
  }
  .sep {
    font-size: 13px;
    color: var(--text-4);
  }
  .label {
    font-size: 13.5px;
    font-weight: 500;
    color: var(--md-sys-color-on-surface-variant);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }
  .nav {
    display: flex;
    align-items: center;
    gap: 3px;
    background: var(--md-sys-color-surface-container);
    padding: 3px;
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--md-sys-shape-corner-full);
  }

  .below {
    border-top: 1px solid var(--md-sys-color-outline-variant);
    padding: 8px 18px;
  }
  @media (min-width: 640px) {
    .below {
      display: none;
    }
  }
</style>
