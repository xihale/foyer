import { component$, useSignal } from '@qwik.dev/core'
import type { PropFunction } from '~/lib/qrl-types'
import { PanelHead } from '~/components/panel-head/panel-head'
import styles from './security-panel.module.css'

interface SecurityPanelProps {
  onChangePw$: PropFunction<(currentPassword: string, newPassword: string) => void>
  onLogout$: PropFunction<() => void>
}

export const SecurityPanel = component$<SecurityPanelProps>(({ onChangePw$, onLogout$ }) => {
  const currentPassword = useSignal('')
  const newPassword = useSignal('')

  return (
    <div class={styles.wrap}>
      <div class={styles.block}>
        <PanelHead title="修改管理密码" sub="更新管理员通行密码以保护控制台安全" />

        <form
          class={['card', styles.form].join(' ')}
          preventdefault:submit
          onSubmit$={() => {
            const cur = currentPassword.value
            const next = newPassword.value
            if (!cur || next.length < 8) return
            void onChangePw$(cur, next)
            currentPassword.value = ''
            newPassword.value = ''
          }}
        >
          <label class={styles.field}>
            <span class="field-label">当前密码 *</span>
            <input
              type="password"
              bind:value={currentPassword}
              required
              autocomplete="current-password"
              placeholder="••••••••"
              class="input"
            />
          </label>
          <label class={styles.field}>
            <span class="field-label">新密码 (至少 8 位) *</span>
            <input
              type="password"
              bind:value={newPassword}
              required
              minLength={8}
              autocomplete="new-password"
              placeholder="••••••••"
              class="input"
            />
            <span class="field-hint">修改成功后当前会话立即失效，需用新密码重新登录</span>
          </label>
          <div class={styles.foot}>
            <button
              type="submit"
              disabled={!currentPassword.value || newPassword.value.length < 8}
              class="btn btn-primary"
            >
              更新密码
            </button>
          </div>
        </form>
      </div>

      {/* 会话管理 */}
      <div class={[styles.block, styles.session].join(' ')}>
        <div class={styles.sessionInfo}>
          <h3 class={styles.sessionTitle}>管理会话</h3>
          <p class={styles.sessionSub}>结束本次管理会话并锁定控制台</p>
        </div>
        <button type="button" class={['btn', 'btn-danger', styles.sessionBtn].join(' ')} onClick$={() => onLogout$()}>
          退出当前登录
        </button>
      </div>
    </div>
  )
})
