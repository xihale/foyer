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
      <h2 class={styles.groupTitle}>{group.name}</h2>
      <div class={styles.list}>
        {(group.bookmarks ?? []).map((b) => (
          <a
            href={b.href}
            target="_blank"
            rel="noreferrer"
            class={styles.row}
            key={b.id}
          >
            <span class={styles.notchGap} aria-hidden="true"></span>
            {b.icon ? (
              <IconImage src={b.icon} class={styles.icon} />
            ) : (
              <span class={styles.fallback} aria-hidden="true">
                {b.name.slice(0, 1)}
              </span>
            )}
            <span class={styles.name}>{b.name}</span>
          </a>
        ))}
      </div>
    </section>
  )
})
