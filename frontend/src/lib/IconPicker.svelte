<script lang="ts">
  // 图标选择器：名称 + 图标 URL + 两个来源——按 URL 抓取 / 上传本地文件。
  import { untrack } from 'svelte'
  import { iconFit } from './iconFit'
  import { translateError } from './errors'

  let { value = $bindable(''), href = '', label = '' }: { value: string; href: string; label: string } = $props()

  const ICONS_PREFIX = '/icons/'
  const currentName = $derived.by(() =>
    value.startsWith(ICONS_PREFIX) ? value.slice(ICONS_PREFIX.length).split('?')[0] : '',
  )
  const initial = $derived((label.trim()[0] ?? '?').toUpperCase())
  let bust = $state(0) // 同名覆盖后预览破缓存
  // 回显 value 自 config 可能带 ?v=（服务端 mtime 版本号）；bust 破缓存前先剥旧 query 防叠加
  const previewSrc = $derived(bust && currentName ? `${value.split('?')[0]}?v=${bust}` : value)

  // 编辑已有图标时名称以现名为准(不再跟随条目名重推),新建时保持自动跟随。
  const initialName = untrack(() => currentName)
  let name = $state(initialName)
  let nameDirty = $state(initialName !== '')
  let iconUrl = $state('')
  let urlDirty = $state(false)
  let busy = $state<'fetch' | 'upload' | null>(null)
  let err = $state('')

  function originOf(u: string): string | null {
    try {
      return new URL(u).origin
    } catch {
      return null
    }
  }

  function nameFromHref(u: string): string {
    const o = originOf(u)
    if (!o) return ''
    let parts = new URL(u).hostname.split('.')
    if (parts.length >= 2) parts = parts.slice(0, -1)
    if (parts[0] === 'www') parts = parts.slice(1)
    return parts.join('.')
  }

  function slugify(s: string): string {
    return s
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, '-')
      .replace(/[^a-z0-9._-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  $effect(() => {
    if (!urlDirty) {
      const o = originOf(href)
      if (o) iconUrl = `${o}/favicon.ico`
    }
    if (!nameDirty) {
      name = slugify(label) || nameFromHref(href)
    }
  })

  async function save(r: Response): Promise<void> {
    const data = (await r.json().catch(() => ({}))) as { name?: string; error?: string }
    if (!r.ok) throw new Error(translateError(data.error ?? `HTTP ${r.status}`))
    value = ICONS_PREFIX + (data.name ?? '')
    bust++
  }

  async function fetchIcon() {
    if (!iconUrl.trim() || !name.trim()) {
      err = '请先填写图标 URL 与名称'
      return
    }
    busy = 'fetch'
    err = ''
    try {
      const r = await fetch('/api/admin/icons/fetch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: iconUrl.trim(), name: name.trim() }),
      })
      await save(r)
    } catch (e) {
      err = e instanceof Error ? e.message : String(e)
    } finally {
      busy = null
    }
  }

  async function upload(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const f = input.files?.[0]
    if (!f) return
    if (!name.trim()) {
      err = '请先填写名称'
      input.value = ''
      return
    }
    busy = 'upload'
    err = ''
    try {
      const fd = new FormData()
      fd.append('file', f)
      fd.append('name', name.trim())
      await save(await fetch('/api/admin/icons', { method: 'POST', body: fd }))
    } catch (e) {
      err = e instanceof Error ? e.message : String(e)
    } finally {
      input.value = ''
      busy = null
    }
  }

  async function remove() {
    if (!currentName) return
    busy = 'fetch'
    err = ''
    try {
      const r = await fetch(`/api/admin/icons/${encodeURIComponent(currentName)}`, { method: 'DELETE' })
      const data = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`)
      value = ''
    } catch (e) {
      err = e instanceof Error ? e.message : String(e)
    } finally {
      busy = null
    }
  }
</script>

<div class="field">
  <span class="field-label">图标 / ICON</span>

  <div class="picker">
    <div class="row">
      {#if value}
        <img src={previewSrc} alt="" class="preview" use:iconFit />
      {:else}
        <div class="preview fallback mono">{initial}</div>
      {/if}
      <input
        bind:value={name}
        oninput={() => (nameDirty = true)}
        class="input grow"
        placeholder="名称"
        maxlength="64"
        spellcheck="false"
      />
      {#if currentName}
        <button
          type="button"
          class="btn btn-secondary del"
          disabled={busy !== null}
          onclick={remove}
          title={`删除磁盘图标 ${currentName}`}
        >
          删除
        </button>
      {/if}
    </div>

    <input
      bind:value={iconUrl}
      oninput={() => (urlDirty = true)}
      class="input"
      placeholder="图标 URL（自动取链接 favicon）"
      spellcheck="false"
    />

    <div class="row">
      <button type="button" class="btn btn-secondary grow" disabled={busy !== null} onclick={fetchIcon}>
        {busy === 'fetch' ? '抓取中…' : '按 URL 抓取'}
      </button>
      <label class="btn btn-secondary grow" class:disabled={busy !== null}>
        {busy === 'upload' ? '上传中…' : '上传文件'}
        <input
          type="file"
          class="file-input"
          accept=".svg,.png,.ico,.webp,.jpg,.jpeg,.gif,.bmp"
          onchange={upload}
        />
      </label>
    </div>

    {#if err}
      <div class="err mono">{err}</div>
    {/if}
  </div>
</div>

<style>
  .field {
    display: block;
  }

  .picker {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    background: var(--color-surface-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-s);
  }

  .row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .grow {
    flex: 1;
    min-width: 0;
  }

  .del {
    flex-shrink: 0;
    padding-inline: 10px;
    font-size: 11.5px;
  }

  .preview {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    object-fit: contain;
    border-radius: var(--radius-xs);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
  }
  .preview.fallback {
    display: grid;
    place-items: center;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
    font-size: 12px;
    font-weight: 700;
  }

  label.btn {
    cursor: pointer;
  }
  label.btn.disabled {
    pointer-events: none;
    opacity: 0.35;
  }

  .file-input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    clip-path: inset(50%);
    overflow: hidden;
  }
  label.btn:focus-within {
    outline: 2px solid var(--color-border-focus);
    outline-offset: 2px;
  }

  .err {
    font-size: 11.5px;
    color: var(--color-error);
  }
</style>

