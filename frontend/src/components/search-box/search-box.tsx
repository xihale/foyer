import { component$ } from '@qwik.dev/core'
import type { Signal } from '@qwik.dev/core'
import styles from './search-box.module.css'

interface SearchBoxProps {
  /** 搜索词(受控双向) */
  query: Signal<string>
  /** 输入框元素引用,由父级持有以便 / 快捷键聚焦 */
  inputRef: Signal<HTMLInputElement | undefined>
  placeholder?: string
}

export const SearchBox = component$<SearchBoxProps>(({ query, inputRef, placeholder = '搜索服务或书签...' }) => {
  return (
    <div class={styles.searchBar}>
      <svg viewBox="0 0 24 24" class={styles.glyph} aria-hidden="true">
        <path
          d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
          fill="currentColor"
        />
      </svg>
      <input
        ref={inputRef}
        bind:value={query}
        type="text"
        placeholder={placeholder}
        aria-label="搜索服务或书签"
        class={styles.inputBox}
      />
      {query.value ? (
        <button
          type="button"
          class={styles.clearBtn}
          aria-label="清空搜索"
          onClick$={() => {
            query.value = ''
            inputRef.value?.focus()
          }}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      ) : (
        <span class={['mono', styles.kbdBadge].join(' ')} title="按 / 键快速聚焦">
          /
        </span>
      )}
    </div>
  )
})
