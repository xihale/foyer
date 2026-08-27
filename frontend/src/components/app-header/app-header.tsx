import { component$, Slot } from '@qwik.dev/core'
import styles from './app-header.module.css'

export type Route = 'panel' | 'status' | 'admin'

interface AppHeaderProps {
  /** 当前高亮的导航项 */
  active: Route
  /** 面包屑文案;留空则只显示站点名 */
  label?: string
  siteTitle?: string
}

const navs: { href: string; key: Route; label: string; index: string }[] = [
  { href: '/', key: 'panel', label: '服务', index: '01' },
  { href: '/status', key: 'status', label: '监控', index: '02' },
  { href: '/admin', key: 'admin', label: '设置', index: '03' },
]

/** 一元工具:把全局原子类(mono 等)与模块类拼成一个字符串 */
const cx = (...names: Array<string | false | undefined>) => names.filter(Boolean).join(' ')

export const AppHeader = component$<AppHeaderProps>(
  ({ active, label = '', siteTitle = 'foyer' }) => {
    return (
      <header class={styles.header}>
        <div class={styles.bar}>
          <div class={styles.crumbs}>
            <a class={styles.site} href="/">
              <span class={styles.mark}>■</span>
              <span>{siteTitle}</span>
            </a>
            {label ? (
              <>
                <span class={styles.sep} aria-hidden="true">
                  /
                </span>
                <span class={cx('mono', styles.label)}>{label}</span>
              </>
            ) : null}
          </div>

          <div class={styles.right}>
            {/* 桌面端动作区(搜索框 / 时间窗切换);空时整体隐藏 */}
            <div class={styles.actionsSlot}>
              <Slot name="actions" />
            </div>
            <nav class={styles.nav} aria-label="页面导航">
              {navs.map((n) => (
                <a
                  href={n.href}
                  key={n.key}
                  class={cx(styles.linkNav, active === n.key && styles.isActive)}
                >
                  <span class={cx('mono', styles.navIdx)}>{n.index}</span>
                  <span>{n.label}</span>
                </a>
              ))}
            </nav>
          </div>
        </div>

        {/* 主栏下方附加行(移动端搜索框等),仅移动端显示;空时折叠 */}
        <div class={styles.below}>
          <Slot name="below" />
        </div>
      </header>
    )
  },
)
