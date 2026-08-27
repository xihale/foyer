import { component$, useSignal } from '@qwik.dev/core'
import type { PropFunction } from '~/lib/qrl-types'
import { Modal } from '~/components/modal/modal'
import { IconPicker } from '~/components/icon-picker/icon-picker'
import type { BmEdit, GroupRow } from '~/routes/admin/types'
import styles from './bookmark-modal.module.css'

interface BookmarkModalProps {
  form: BmEdit
  groups: GroupRow[]
  saving: boolean
  error: string
  onSubmit$: PropFunction<() => void>
  onClose$: PropFunction<() => void>
}

export const BookmarkModal = component$<BookmarkModalProps>(
  ({ form, groups, saving, error, onSubmit$, onClose$ }) => {
    // 编辑字段本地镜像;提交前回写表单 store
    const icon = useSignal(form.icon)
    const name = useSignal(form.name)
    const groupId = useSignal(form.group_id)
    const href = useSignal(form.href)

    return (
      <Modal
        label={form.id === null ? '新建快速书签' : '编辑书签'}
        title={form.id === null ? '新建快速书签' : `编辑 · ${name.value || '书签'}`}
        width="md"
        submitLabel="保存书签"
        saving={saving}
        error={error}
        onSubmit$={() => {
          form.icon = icon.value
          form.name = name.value
          form.group_id = groupId.value
          form.href = href.value
          return onSubmit$()
        }}
        onClose$={onClose$}
      >
        <label class={styles.field}>
          <span class="field-label">书签名称 *</span>
          <input bind:value={name} required maxLength={64} class="input" placeholder="例如:GitHub" />
        </label>

        <label class={styles.field}>
          <span class="field-label">链接地址 (URL) *</span>
          <input
            bind:value={href}
            required
            inputMode="url"
            placeholder="https://github.com(裸域名自动补 https://)"
            class="input"
          />
        </label>

        <IconPicker value={icon.value} href={href.value} label={name.value} onPick$={(v) => (icon.value = v)} />

        <label class={styles.field}>
          <span class="field-label">所属书签分组 *</span>
          <select bind:value={groupId} required class="select">
            {groups.map((g) => (
              <option value={g.id} key={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          {groups.length === 0 ? (
            <span class="field-hint">请先在分组里创建一个书签分组</span>
          ) : null}
        </label>
      </Modal>
    )
  },
)
