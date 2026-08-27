import { component$, useSignal } from '@qwik.dev/core'
import type { PropFunction } from '~/lib/qrl-types'
import { Modal } from '~/components/modal/modal'
import { IconPicker } from '~/components/icon-picker/icon-picker'
import type { GroupRow, SvcEdit } from '~/routes/admin/types'
import styles from './service-modal.module.css'

interface ServiceModalProps {
  form: SvcEdit
  groups: GroupRow[]
  saving: boolean
  error: string
  onSubmit$: PropFunction<() => void>
  onClose$: PropFunction<() => void>
}

export const ServiceModal = component$<ServiceModalProps>(
  ({ form, groups, saving, error, onSubmit$, onClose$ }) => {
    // 编辑字段以本地镜像信号承载(可序列化的双向绑定),提交前统一回写表单 store
    const icon = useSignal(form.icon)
    const name = useSignal(form.name)
    const groupId = useSignal(form.group_id)
    const href = useSignal(form.href)
    const description = useSignal(form.description)
    const monitorEnabled = useSignal(form.monitor_enabled)
    const interval = useSignal(form.interval)
    const retry = useSignal(form.retry)

    return (
      <Modal
        label={form.id === null ? '新建服务节点' : '编辑服务'}
        title={form.id === null ? '新建服务节点' : `编辑 · ${name.value || '服务'}`}
        width="lg"
        submitLabel="保存服务"
        saving={saving}
        error={error}
        onSubmit$={() => {
          form.icon = icon.value
          form.name = name.value
          form.group_id = groupId.value
          form.href = href.value
          form.description = description.value
          form.monitor_enabled = monitorEnabled.value
          form.interval = interval.value
          form.retry = retry.value
          return onSubmit$()
        }}
        onClose$={onClose$}
      >
        <div class={styles.grid}>
          <label class={styles.field}>
            <span class="field-label">服务名称 *</span>
            <input bind:value={name} required maxLength={64} class="input" placeholder="例如:Plex / Jellyfin" />
          </label>

          <label class={styles.field}>
            <span class="field-label">所属节点分组 *</span>
            <select bind:value={groupId} required class="select">
              {groups.map((g) => (
                <option value={g.id} key={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            {groups.length === 0 ? (
              <span class="field-hint">请先在分组里创建一个节点分组</span>
            ) : null}
          </label>

          <label class={[styles.field, styles.span2].join(' ')}>
            <span class="field-label">跳转链接 (URL) *</span>
            <input
              bind:value={href}
              required
              inputMode="url"
              placeholder="https://...(裸域名自动补 https://)"
              class="input"
            />
          </label>

          <label class={[styles.field, styles.span2].join(' ')}>
            <span class="field-label">简短说明</span>
            <input bind:value={description} maxLength={200} placeholder="家庭媒体服务器" class="input" />
          </label>

          <div class={styles.span2}>
            <IconPicker value={icon.value} href={href.value} label={name.value} onPick$={(v) => (icon.value = v)} />
          </div>
        </div>

        <div class={styles.monitor}>
          <label class="check">
            <input type="checkbox" bind:checked={monitorEnabled} />
            <span class={styles.monitorTitle}>开启定时探活与状态监控</span>
          </label>

          {monitorEnabled.value ? (
            <div class={styles.params}>
              <label class={styles.field}>
                <span class="field-label">探活周期 (秒)</span>
                <input type="number" min={30} max={86400} bind:value={interval} class="input" />
                <span class="field-hint">30-86400</span>
              </label>
              <label class={styles.field}>
                <span class="field-label">失败重试阈值</span>
                <input type="number" min={0} max={10} bind:value={retry} class="input" />
                <span class="field-hint">连续失败 N 次后判定离线(0-10)</span>
              </label>
            </div>
          ) : null}
        </div>
      </Modal>
    )
  },
)
