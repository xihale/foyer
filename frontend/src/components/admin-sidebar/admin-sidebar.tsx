import { component$ } from '@qwik.dev/core'
import type { PropFunction } from '~/lib/qrl-types'
import { sectionKeys, type Section } from '~/routes/admin/types'
import styles from './admin-sidebar.module.css'

interface AdminSidebarProps {
  section: Section
  counts: { groups: number; services: number; bookmarks: number }
  /** 分区切换(hash 深链由父级统一写地址栏) */
  onSelect$: PropFunction<(s: Section) => void>
}

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
            class={[styles.item, section === sec.key && styles.isActive]
              .filter(Boolean)
              .join(' ')}
            aria-current={section === sec.key ? 'page' : undefined}
            // Qwik Router 会把纯 hash 点击吞成 pushState(不触发 hashchange),
            // 这里主动接管:防默认 + 回调父级切分区并同步地址栏
            preventdefault:click
            onClick$={() => onSelect$(sec.key)}
          >
            <span class={['mono', styles.idx].join(' ')}>{sec.index}</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.75"
              stroke-linecap="round"
              stroke-linejoin="round"
              class={[styles.icon, section === sec.key && styles.iconActive]
                .filter(Boolean)
                .join(' ')}
              aria-hidden="true"
              dangerouslySetInnerHTML={sec.icon}
            ></svg>
            <span>{sec.label}</span>
            {count !== undefined ? (
              <span class={['mono', styles.count].join(' ')}>{count}</span>
            ) : null}
          </a>
        )
      })}
    </nav>
  )
})
