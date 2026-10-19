import { component$, Slot } from '@qwik.dev/core'
import { Link } from '@qwik.dev/router'
import styles from './app-header.module.css'

export type Route = 'panel' | 'status' | 'admin'

interface AppHeaderProps {
  /** 当前高亮的导航项 */
  active: Route
  /** 面包屑文案;留空则只显示站点名 */
  label?: string
  siteTitle?: string
}

const navs: { href: string; key: Route; label: string }[] = [
  { href: '/', key: 'panel', label: '服务' },
  { href: '/status', key: 'status', label: '监控' },
  { href: '/admin', key: 'admin', label: '设置' },
]

const cx = (...names: Array<string | false | undefined>) => names.filter(Boolean).join(' ')

export const AppHeader = component$<AppHeaderProps>(
  ({ active, label = '', siteTitle = 'foyer' }) => {

    return (
      <header class={styles.header}>
        <div class={styles.bar}>
          <div class={styles.crumbs}>
            <Link class={styles.site} href="/">
              {siteTitle}
            </Link>
            {label ? (
              <span class={styles.label}>{label}</span>
            ) : null}
          </div>

          <div class={styles.right}>
            <div class={styles.actionsSlot}>
              <Slot name="actions" />
            </div>
            <nav class={styles.nav} aria-label="页面导航">
              {navs.map((n) => (
                <Link
                  href={n.href}
                  key={n.key}
                  class={cx(styles.linkNav, active === n.key && styles.isActive)}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <div class={styles.below}>
          <Slot name="below" />
        </div>
      </header>
    )
  },
)
