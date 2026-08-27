import { component$, useSignal } from '@qwik.dev/core'
import type { PropFunction } from '~/lib/qrl-types'
import { PanelHead } from '~/components/panel-head/panel-head'
import { RowActions } from '~/components/row-actions/row-actions'
import type { GroupRow } from '~/routes/admin/types'
import styles from './groups-panel.module.css'

interface GroupsPanelProps {
  serviceGroups: GroupRow[]
  bookmarkGroups: GroupRow[]
  onEdit$: PropFunction<(g: GroupRow) => void>
  onDelete$: PropFunction<(g: GroupRow) => void>
  onAdd$: PropFunction<(name: string, kind: 'service' | 'bookmark') => void>
}

export const GroupsPanel = component$<GroupsPanelProps>(
  ({ serviceGroups, bookmarkGroups, onEdit$, onDelete$, onAdd$ }) => {
    const newSvc = useSignal('')
    const newBm = useSignal('')

    return (
      <div class={styles.wrap}>
        <PanelHead title="分组管理" sub="节点分组与书签分组分开，互不混用" />

        <section class={styles.block}>
          <div class={styles.head}>
            <span class="group-title">节点分组</span>
            <span class={['mono', styles.count].join(' ')}>{serviceGroups.length}</span>
          </div>

          {/* 节点分组列表 */}
          <div class="list">
            {serviceGroups.length === 0 ? (
              <p class={['mono', styles.none].join(' ')}>暂无节点分组</p>
            ) : (
              serviceGroups.map((g) => (
                <div class="list-row" key={g.id}>
                  <div class={styles.rowBody}>
                    <span class="list-name">{g.name}</span>
                    <span class="badge">{g.columns ?? '默认 3'} 列</span>
                  </div>
                  <RowActions onEdit$={() => onEdit$(g)} onDelete$={() => onDelete$(g)} />
                </div>
              ))
            )}
          </div>

          <form
            class={['card', styles.add].join(' ')}
            preventdefault:submit
            onSubmit$={() => {
              const name = newSvc.value.trim()
              if (!name) return
              void onAdd$(name, 'service')
              newSvc.value = ''
            }}
          >
            <input
              bind:value={newSvc}
              maxLength={64}
              placeholder="新节点分组..."
              aria-label="新节点分组名称"
              class="input grow"
            />
            <button type="submit" disabled={!newSvc.value.trim()} class="btn btn-primary shrink">
              + 添加
            </button>
          </form>
        </section>

        <section class={styles.block}>
          <div class={styles.head}>
            <span class="group-title">书签分组</span>
            <span class={['mono', styles.count].join(' ')}>{bookmarkGroups.length}</span>
          </div>

          {/* 书签分组列表 */}
          <div class="list">
            {bookmarkGroups.length === 0 ? (
              <p class={['mono', styles.none].join(' ')}>暂无书签分组</p>
            ) : (
              bookmarkGroups.map((g) => (
                <div class="list-row" key={g.id}>
                  <div class={styles.rowBody}>
                    <span class="list-name">{g.name}</span>
                    {g.icons_only ? <span class="badge">仅图标</span> : null}
                  </div>
                  <RowActions onEdit$={() => onEdit$(g)} onDelete$={() => onDelete$(g)} />
                </div>
              ))
            )}
          </div>

          <form
            class={['card', styles.add].join(' ')}
            preventdefault:submit
            onSubmit$={() => {
              const name = newBm.value.trim()
              if (!name) return
              void onAdd$(name, 'bookmark')
              newBm.value = ''
            }}
          >
            <input
              bind:value={newBm}
              maxLength={64}
              placeholder="新书签分组..."
              aria-label="新书签分组名称"
              class="input grow"
            />
            <button type="submit" disabled={!newBm.value.trim()} class="btn btn-primary shrink">
              + 添加
            </button>
          </form>
        </section>
      </div>
    )
  },
)
