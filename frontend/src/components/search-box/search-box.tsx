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

export const SearchBox = component$<SearchBoxProps>(({ query, inputRef, placeholder = '搜索' }) => {
  return (
    <div class={styles.searchBar}>
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
          清除
        </button>
      ) : null}
    </div>
  )
})
