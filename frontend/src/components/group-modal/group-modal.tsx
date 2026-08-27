import { component$, useSignal } from '@qwik.dev/core'
import type { PropFunction } from '~/lib/qrl-types'
import { Modal } from '~/components/modal/modal'
import type { GroupEdit } from '~/routes/admin/types'
import styles from './group-modal.module.css'

interface GroupModalProps {
  form: GroupEdit
  saving: boolean
  error: string
  onSubmit$: PropFunction<() => void>
  onClose$: PropFunction<() => void>
}

export const GroupModal = component$<GroupModalProps>(
  ({ form, saving, error, onSubmit$, onClose$ }) => {
    // 编辑字段本地镜像;提交前回写表单 store
    const name = useSignal(form.name)
    const columns = useSignal(form.columns)
    const iconsOnly = useSignal(form.icons_only)

    return (
      <Modal
        label={form.kind === 'service' ? '编辑节点分组' : '编辑书签分组'}
        title={`编辑 · ${name.value || (form.kind === 'service' ? '节点分组' : '书签分组')}`}
        width="sm"
        submitLabel="保存修改"
        saving={saving}
        error={error}
        onSubmit$={() => {
          form.name = name.value
          form.columns = columns.value
          form.icons_only = iconsOnly.value
          return onSubmit$()
        }}
        onClose$={onClose$}
      >
        <label class={styles.field}>
          <span class="field-label">分组名称 *</span>
          <input bind:value={name} maxLength={64} class="input" />
        </label>

        {form.kind === 'service' ? (
          <label class={styles.field}>
            <span class="field-label">卡片列数 (1-8)</span>
            <input type="number" min={1} max={8} bind:value={columns} class="input" />
            <span class="field-hint">留空使用默认 3 列</span>
          </label>
        ) : (
          <label class="check">
            <input type="checkbox" bind:checked={iconsOnly} />
            <span class={styles.checkTitle}>仅显示图标</span>
          </label>
        )}
      </Modal>
    )
  },
)
