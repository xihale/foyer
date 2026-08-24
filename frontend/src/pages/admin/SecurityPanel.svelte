<script lang="ts">
  import PanelHead from './PanelHead.svelte'

  let {
    onchangepw,
    onlogout,
  }: {
    onchangepw: (currentPassword: string, newPassword: string) => void
    onlogout: () => void
  } = $props()

  let currentPassword = $state('')
  let newPassword = $state('')

  function submit(e: SubmitEvent) {
    e.preventDefault()
    if (!currentPassword || newPassword.length < 8) return
    onchangepw(currentPassword, newPassword)
    currentPassword = ''
    newPassword = ''
  }
</script>

<div class="wrap">
  <div class="block">
    <PanelHead title="修改管理密码" sub="更新管理员通行密码以保护控制台安全" />

    <form class="card form" onsubmit={submit}>
      <label class="field">
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
      <label class="field">
        <span class="field-label">新密码 (至少 8 位) *</span>
        <input
          type="password"
          bind:value={newPassword}
          required
          minlength="8"
          autocomplete="new-password"
          placeholder="••••••••"
          class="input"
        />
        <span class="field-hint">修改成功后当前会话立即失效，需用新密码重新登录</span>
      </label>
      <div class="foot">
        <button
          type="submit"
          disabled={!currentPassword || newPassword.length < 8}
          class="btn btn-primary"
        >
          更新密码
        </button>
      </div>
    </form>
  </div>

  <!-- 会话管理 -->
  <div class="block session">
    <div class="session-info">
      <h3 class="title">管理会话</h3>
      <p class="sub">结束本次管理会话并锁定控制台</p>
    </div>
    <button type="button" class="btn btn-danger session-btn" onclick={onlogout}>
      退出当前登录
    </button>
  </div>
</div>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .form {
    max-width: 26rem;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .field {
    display: block;
  }

  .foot {
    padding-top: 6px;
  }

  .session {
    display: flex;
    flex-direction: column;
    gap: 16px;
    border-top: 1px solid var(--color-border);
    padding-top: 24px;
  }
  @media (min-width: 640px) {
    .session {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
    }
  }
  .session-info {
    min-width: 0;
  }
  .session-btn {
    align-self: flex-start;
  }
  @media (min-width: 640px) {
    .session-btn {
      align-self: auto;
    }
  }
  .title {
    font-size: 13.5px;
    font-weight: 600;
    color: var(--color-text-primary);
  }
  .sub {
    margin-top: 2px;
    font-size: 12px;
    color: var(--color-text-secondary);
  }
</style>

