import { component$ } from '@qwik.dev/core'
import type { PropFunction } from '~/lib/qrl-types'
import type { Section } from '~/routes/admin/types'
import styles from './admin-sidebar.module.css'

interface AdminSidebarProps {
  section: Section
  counts: { groups: number; services: number; bookmarks: number }
  /** 分区切换(hash 深链由父级统一写地址栏) */
  onSelect$: PropFunction<(s: Section) => void>
}

const sections: { key: Section; label: string }[] = [
  { key: 'settings', label: '站点' },
  { key: 'groups', label: '分组' },
  { key: 'services', label: '服务' },
  { key: 'bookmarks', label: '书签' },
  { key: 'notify', label: '通知' },
  { key: 'security', label: '安全' },
]

const countOf = (key: Section, counts: AdminSidebarProps['counts']): number | undefined =>
  key === 'groups'
    ? counts.groups
    : key === 'services'
      ? counts.services
      : key === 'bookmarks'
        ? counts.bookmarks
        : undefined


export const AdminSidebar = component$<AdminSidebarProps>(({ section, counts, onSelect$ }) => {
  return (
    <nav class={styles.nav} aria-label="管理分区">
      {sections.map((sec) => {
        const count = countOf(sec.key, counts)
        return (
          <a
            href={`#${sec.key}`}
            key={sec.key}
            class={[styles.item, section === sec.key && styles.isActive].filter(Boolean).join(' ')}
            aria-current={section === sec.key ? 'page' : undefined}
            preventdefault:click
            onClick$={() => onSelect$(sec.key)}
          >
            <span>{sec.label}</span>
            {count !== undefined ? <span class={['mono', styles.count].join(' ')}>{count}</span> : null}
          </a>
        )
      })}
    </nav>
  )
})
