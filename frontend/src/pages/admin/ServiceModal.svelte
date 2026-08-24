<script lang="ts">
  import Modal from '../../lib/Modal.svelte'
  import IconPicker from '../../lib/IconPicker.svelte'
  import type { GroupRow, SvcForm } from './types'

  let {
    form,
    groups,
    saving,
    error,
    onsubmit,
    onclose,
  }: {
    form: SvcForm
    groups: GroupRow[]
    saving: boolean
    error: string
    onsubmit: (e: SubmitEvent) => void
    onclose: () => void
  } = $props()
</script>

<Modal
  label={form.id === null ? '新建服务节点' : '编辑服务'}
  title={form.id === null ? '新建服务节点' : `编辑 · ${form.name || '服务'}`}
  width="lg"
  submitLabel="保存服务"
  {saving}
  {error}
  {onsubmit}
  {onclose}
>
  <div class="grid">
    <label class="field">
      <span class="field-label">服务名称 *</span>
      <input bind:value={form.name} required maxlength="64" class="input" placeholder="例如:Plex / Jellyfin" />
    </label>

    <label class="field">
      <span class="field-label">所属节点分组 *</span>
      <select bind:value={form.group_id} required class="select">
        {#each groups as g (g.id)}
          <option value={g.id}>{g.name}</option>
        {/each}
      </select>
      {#if groups.length === 0}
        <span class="field-hint">请先在分组里创建一个节点分组</span>
      {/if}
    </label>

    <label class="field span-2">
      <span class="field-label">跳转链接 (URL) *</span>
      <input
        bind:value={form.href}
        required
        inputmode="url"
        placeholder="https://...(裸域名自动补 https://)"
        class="input"
      />
    </label>

    <label class="field span-2">
      <span class="field-label">简短说明</span>
      <input bind:value={form.description} maxlength="200" placeholder="家庭媒体服务器" class="input" />
    </label>

    <div class="span-2">
      <IconPicker bind:value={form.icon} href={form.href} label={form.name} />
    </div>
  </div>

  <div class="monitor">
    <label class="check">
      <input type="checkbox" bind:checked={form.monitor_enabled} />
      <span>开启定时探活与状态监控</span>
    </label>

    {#if form.monitor_enabled}
      <div class="params">
        <label class="field">
          <span class="field-label">探活周期 (秒)</span>
          <input type="number" min="30" max="86400" bind:value={form.interval} class="input" />
          <span class="field-hint">30-86400</span>
        </label>
        <label class="field">
          <span class="field-label">失败重试阈值</span>
          <input type="number" min="0" max="10" bind:value={form.retry} class="input" />
          <span class="field-hint">连续失败 N 次后判定离线(0-10)</span>
        </label>
      </div>
    {/if}
  </div>
</Modal>

<style>
  .grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
  }
  @media (min-width: 640px) {
    .grid {
      grid-template-columns: 1fr 1fr;
    }
    .span-2 {
      grid-column: span 2;
    }
  }

  .field {
    display: block;
  }

  .monitor {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 18px;
    background: var(--md-sys-color-surface-container-lowest);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--md-sys-shape-corner-medium);
  }

  .params {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--md-sys-color-outline-variant);
  }
  @media (min-width: 640px) {
    .params {
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
