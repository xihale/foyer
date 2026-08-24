<script lang="ts">
  import Modal from '../../lib/Modal.svelte'
  import IconPicker from '../../lib/IconPicker.svelte'
  import type { BmForm, GroupRow } from './types'

  let {
    form,
    groups,
    saving,
    error,
    onsubmit,
    onclose,
  }: {
    form: BmForm
    groups: GroupRow[]
    saving: boolean
    error: string
    onsubmit: (e: SubmitEvent) => void
    onclose: () => void
  } = $props()
</script>

<Modal
  label={form.id === null ? '新建快速书签' : '编辑书签'}
  title={form.id === null ? '新建快速书签' : `编辑 · ${form.name || '书签'}`}
  width="md"
  submitLabel="保存书签"
  {saving}
  {error}
  {onsubmit}
  {onclose}
>
  <label class="field">
    <span class="field-label">书签名称 *</span>
    <input bind:value={form.name} required maxlength="64" class="input" placeholder="例如:GitHub" />
  </label>

  <label class="field">
    <span class="field-label">链接地址 (URL) *</span>
    <input
      bind:value={form.href}
      required
      inputmode="url"
      placeholder="https://github.com(裸域名自动补 https://)"
      class="input"
    />
  </label>

  <IconPicker bind:value={form.icon} href={form.href} label={form.name} />

  <label class="field">
    <span class="field-label">所属书签分组 *</span>
    <select bind:value={form.group_id} required class="select">
      {#each groups as g (g.id)}
        <option value={g.id}>{g.name}</option>
      {/each}
    </select>
    {#if groups.length === 0}
      <span class="field-hint">请先在分组里创建一个书签分组</span>
    {/if}
  </label>
</Modal>

<style>
  .field {
    display: block;
  }
</style>

