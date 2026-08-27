import { component$, useComputed$ } from '@qwik.dev/core'
import type { Signal } from '@qwik.dev/core'
import type { PropFunction } from '~/lib/qrl-types'
import { PanelHead } from '~/components/panel-head/panel-head'
import type { NotificationInfo } from '~/lib/types'
import styles from './notify-panel.module.css'

interface NotifyPanelProps {
  notification?: NotificationInfo | null
  ntfyUrl: Signal<string>
  ntfyTopic: Signal<string>
  ntfyToken: Signal<string>
  saving: boolean
  testing: boolean
  onSave$: PropFunction<() => void>
  onClear$: PropFunction<() => void>
  onTest$: PropFunction<() => void>
}

export const NotifyPanel = component$<NotifyPanelProps>(
  ({ notification, ntfyUrl, ntfyTopic, ntfyToken, saving, testing, onSave$, onClear$, onTest$ }) => {
    const configured = useComputed$(
      () => notification?.url || notification?.topic || notification?.has_token,
    )

    return (
      <div class={styles.wrap}>
        <PanelHead title="ntfy 报警推送" sub="当受监控的服务状态翻转(离线/恢复)时发送即时通知" />

        <form class={['card', styles.form].join(' ')} preventdefault:submit onSubmit$={() => onSave$()}>
          <label class={styles.field}>
            <span class="field-label">ntfy 服务器 URL</span>
            <input bind:value={ntfyUrl} placeholder="https://ntfy.sh" class="input" />
            <span class="field-hint">自建实例填完整地址</span>
          </label>

          <label class={styles.field}>
            <span class="field-label">Topic 主题 *</span>
            <input bind:value={ntfyTopic} placeholder="homelab-alerts" class="input" />
            <span class="field-hint">订阅同一 topic 的设备都会收到推送</span>
          </label>

          <label class={styles.field}>
            <span class="field-label">
              访问 Token {notification?.has_token ? '(已配置,留空保持不变)' : '(可选)'}
            </span>
            <input
              type="password"
              bind:value={ntfyToken}
              placeholder="留空保持不变"
              autocomplete="new-password"
              class="input"
            />
          </label>

          <div class={styles.foot}>
            <div class={styles.footLeft}>
              {configured.value ? (
                <button type="button" class="btn btn-danger" disabled={saving || testing} onClick$={() => onClear$()}>
                  清除配置
                </button>
              ) : null}
              <button type="button" class="btn btn-secondary" disabled={saving || testing} onClick$={() => onTest$()}>
                {testing ? '发送中...' : '发送测试'}
              </button>
            </div>
            <button type="submit" disabled={saving || testing} class="btn btn-primary">
              {saving ? '保存中...' : '保存通知配置'}
            </button>
          </div>
        </form>
      </div>
    )
  },
)
