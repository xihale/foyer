import { component$ } from '@qwik.dev/core'
import type { Group } from '~/lib/types'
import { IconImage } from '~/components/icon-image/icon-image'
import styles from './bookmark-group.module.css'

interface BookmarkGroupProps {
  group: Group
}

export const BookmarkGroup = component$<BookmarkGroupProps>(({ group }) => {
  return (
    <section class={styles.group} aria-label={group.name}>
      <div class={styles.head}>
        <div class={styles.titleWrap}>
          <span class={['mono', styles.groupTitle].join(' ')}>{group.name}</span>
          <span class={['mono', styles.count].join(' ')}>{group.bookmarks?.length ?? 0}</span>
        </div>
      </div>

      <div class={styles.tags}>
        {(group.bookmarks ?? []).map((b) => (
          <a
            href={b.href}
            target="_blank"
            rel="noreferrer"
            title={b.name}
            class={styles.chip}
            key={b.id}
          >
            {b.icon ? <IconImage src={b.icon} class={styles.icon} /> : null}
            <span>{b.name}</span>
          </a>
        ))}
      </div>
    </section>
  )
})
