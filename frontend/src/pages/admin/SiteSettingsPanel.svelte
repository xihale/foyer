<script lang="ts">
  import PanelHead from './PanelHead.svelte'

  let {
    siteTitle = $bindable(''),
    siteDescription = $bindable(''),
    telemetryPublic = $bindable(true),
    saving = false,
    onsave,
  }: {
    siteTitle: string
    siteDescription: string
    telemetryPublic: boolean
    saving?: boolean
    onsave: (e: SubmitEvent) => void
  } = $props()
</script>

<div class="wrap">
  <PanelHead title="站点通用设置" sub="配置控制台主标题与一句话说明" />

  <form class="card form" onsubmit={onsave}>
    <label class="field">
      <span class="field-label">站点名称 *</span>
      <input bind:value={siteTitle} required maxlength="64" class="input" placeholder="例如:foyer" />
    </label>

    <label class="field">
      <span class="field-label">站点描述</span>
      <input bind:value={siteDescription} maxlength="200" placeholder="一句话说明" class="input" />
    </label>

    <label class="field check">
      <input type="checkbox" bind:checked={telemetryPublic} />
      <span>
        <span class="check-title">公开主机遥测</span>
        <span class="field-hint">关闭后 /api/system（CPU/内存/磁盘/主机名/内核）仅管理会话可见，首页遥测卡对访客隐藏</span>
      </span>
    </label>

    <div class="foot">
      <button type="submit" disabled={saving || !siteTitle.trim()} class="btn btn-primary">
        {saving ? '保存中...' : '保存设置'}
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
    max-width: 34rem;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .field {
    display: block;
  }

  .check {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    cursor: pointer;
  }
  .check input {
    margin-top: 2px;
  }
  .check span {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .check-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .foot {
    display: flex;
    justify-content: flex-end;
    padding-top: 8px;
    border-top: 1px solid var(--color-border);
  }
</style>

