<script lang="ts">
  import type { NotificationInfo } from './types'
  import PanelHead from './PanelHead.svelte'

  let {
    notification,
    ntfyUrl = $bindable(''),
    ntfyTopic = $bindable(''),
    ntfyToken = $bindable(''),
    saving = false,
    testing = false,
    onsave,
    onclear,
    ontest,
  }: {
    notification?: NotificationInfo | null
    ntfyUrl: string
    ntfyTopic: string
    ntfyToken: string
    saving?: boolean
    testing?: boolean
    onsave: (e: SubmitEvent) => void
    onclear: () => void
    ontest: () => void
  } = $props()

  const configured = $derived(
    notification?.url || notification?.topic || notification?.has_token,
  )
</script>

<div class="wrap">
  <PanelHead title="ntfy 报警推送" sub="当受监控的服务状态翻转(离线/恢复)时发送即时通知" />

  <form class="card form" onsubmit={onsave}>
    <label class="field">
      <span class="field-label">ntfy 服务器 URL</span>
      <input bind:value={ntfyUrl} placeholder="https://ntfy.sh" class="input" />
      <span class="field-hint">自建实例填完整地址</span>
    </label>

    <label class="field">
      <span class="field-label">Topic 主题 *</span>
      <input bind:value={ntfyTopic} placeholder="homelab-alerts" class="input" />
      <span class="field-hint">订阅同一 topic 的设备都会收到推送</span>
    </label>

    <label class="field">
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

    <div class="foot">
      <div class="foot-left">
        {#if configured}
          <button type="button" class="btn btn-danger" disabled={saving || testing} onclick={onclear}>
            清除配置
          </button>
        {/if}
        <button type="button" class="btn btn-secondary" disabled={saving || testing} onclick={ontest}>
          {testing ? '发送中...' : '发送测试'}
        </button>
      </div>
      <button type="submit" disabled={saving || testing} class="btn btn-primary">
        {saving ? '保存中...' : '保存通知配置'}
      </button>
    </div>
  </form>
</div>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .form {
    max-width: 36rem;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .field {
    display: block;
  }

  .foot-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-top: 14px;
    border-top: 1px solid var(--color-border);
  }
</style>

