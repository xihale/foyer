<script lang="ts">
  import Modal from '../../lib/Modal.svelte'
  import type { GroupEdit } from './types'

  let {
    form,
    saving,
    error,
    onsubmit,
    onclose,
  }: {
    form: GroupEdit
    saving: boolean
    error: string
    onsubmit: (e: SubmitEvent) => void
    onclose: () => void
  } = $props()
</script>

<Modal
  label={form.kind === 'service' ? '编辑节点分组' : '编辑书签分组'}
  title={`编辑 · ${form.name || (form.kind === 'service' ? '节点分组' : '书签分组')}`}
  width="sm"
  submitLabel="保存修改"
  {saving}
  {error}
  {onsubmit}
  {onclose}
>
  <label class="field">
    <span class="field-label">分组名称 *</span>
    <input bind:value={form.name} maxlength="64" class="input" />
  </label>

  {#if form.kind === 'service'}
    <label class="field">
      <span class="field-label">卡片列数 (1-8)</span>
      <input type="number" min="1" max="8" bind:value={form.columns} class="input" />
      <span class="field-hint">留空使用默认 3 列</span>
    </label>
  {:else}
    <label class="check">
      <input type="checkbox" bind:checked={form.icons_only} />
      <span class="check-title">仅显示图标</span>
    </label>
  {/if}
</Modal>

<style>
  .field {
    display: block;
  }
  .check-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-primary);
  }
</style>

