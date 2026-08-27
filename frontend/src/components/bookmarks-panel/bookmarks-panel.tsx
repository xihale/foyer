import { component$ } from '@qwik.dev/core'
import type { PropFunction } from '~/lib/qrl-types'
import { IconImage } from '~/components/icon-image/icon-image'
import { PanelHead } from '~/components/panel-head/panel-head'
import { RowActions } from '~/components/row-actions/row-actions'
import type { Bookmark } from '~/lib/types'
import styles from './bookmarks-panel.module.css'

interface BookmarksPanelProps {
  bookmarks: Bookmark[]
  groupNames: Record<number, string>
  onEdit$: PropFunction<(b: Bookmark) => void>
  onDelete$: PropFunction<(b: Bookmark) => void>
  onAdd$: PropFunction<() => void>
}

export const BookmarksPanel = component$<BookmarksPanelProps>(
  ({ bookmarks, groupNames, onEdit$, onDelete$, onAdd$ }) => {
    return (
      <div class={styles.wrap}>
        <div class={styles.head}>
          <PanelHead title="快速书签" sub={`已收录 ${bookmarks.length} 个书签`} />
          <button type="button" class="btn btn-primary shrink" onClick$={() => onAdd$()}>
            + 新增书签
          </button>
        </div>

        <div class="list">
          {bookmarks.length === 0 ? (
            <div class="empty">暂无书签数据,点击右上角「+ 新增书签」添加</div>
          ) : (
            bookmarks.map((b) => (
              <div class="list-row" key={b.id}>
                {b.icon ? (
                  <IconImage src={b.icon} class={['list-icon', styles.listIcon].join(' ')} />
                ) : (
                  <div class={['list-icon', 'fallback', 'mono'].join(' ')}>
                    {b.name.slice(0, 1).toUpperCase()}
                  </div>
                )}

                <div class="list-info">
                  <div class="list-line">
                    <span class="list-name">{b.name}</span>
                    <span class="badge">{groupNames[b.group_id] ?? `#` + b.group_id}</span>
                  </div>
                  <a href={b.href} target="_blank" rel="noreferrer" class={styles.href} title={b.href}>
                    {b.href}
                  </a>
                </div>

                <RowActions onEdit$={() => onEdit$(b)} onDelete$={() => onDelete$(b)} />
              </div>
            ))
          )}
        </div>
      </div>
    )
  },
)
