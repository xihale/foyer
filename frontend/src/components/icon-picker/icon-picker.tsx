import { $, component$, useComputed$, useSignal, useTask$ } from '@qwik.dev/core'
import type { PropFunction } from '~/lib/qrl-types'
import { translateError } from '~/lib/errors'
import { IconImage } from '~/components/icon-image/icon-image'
import styles from './icon-picker.module.css'

interface IconPickerProps {
  /** 当前图标路径(/icons/<name> 或外链);由父级持有,选定后经 onPick$ 回写 */
  value: string
  /** 所属条目的链接,自动取其 favicon */
  href: string
  /** 所属条目名称,新建时用于自动推导图标名与首字母占位 */
  label: string
  /** 选定(抓取/上传成功)或删除图标后回调 */
  onPick$: PropFunction<(icon: string) => void>
}

const ICONS_PREFIX = '/icons/'

function iconBasename(v: string): string {
  return v.startsWith(ICONS_PREFIX) ? v.slice(ICONS_PREFIX.length).split('?')[0] : ''
}

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

/** 图标选择器:名称 + 图标 URL + 两个来源——按 URL 抓取 / 上传本地文件。 */
export const IconPicker = component$<IconPickerProps>(({ value, href, label, onPick$ }) => {
  // 同名覆盖后预览破缓存计数
  const bustSig = useSignal(0)

  // 回显 value 自 config 可能带 ?v=(服务端 mtime 版本号);bust 破缓存前先剥旧 query 防叠加
  const currentName = useComputed$(() => iconBasename(value))
  const previewSrc = useComputed$(() => {
    const bust = bustSig.value
    return bust && currentName.value ? `${value.split('?')[0]}?v=${bust}` : value
  })

  const initial = (label.trim()[0] ?? '?').toUpperCase()

  // 编辑已有图标时名称以现名为准(不再跟随条目名重推),新建时保持自动跟随。
  const name = useSignal(currentName.value)
  const nameDirty = useSignal(currentName.value !== '')
  const iconUrl = useSignal('')
  const urlDirty = useSignal(false)
  const busy = useSignal<'fetch' | 'upload' | null>(null)
  const err = useSignal('')

  // 新建态下跟随条目链接 / 名称变化(user 改 URL 或名称时同步推导,一旦手改即停)
  useTask$(({ track }) => {
    const h = track(() => href)
    track(() => label)
    if (!urlDirty.value) {
      const o = originOf(h)
      if (o) iconUrl.value = `${o}/favicon.ico`
    }
    if (!nameDirty.value) {
      name.value = slugify(label) || nameFromHref(h)
    }
  })

  // 组件内互调的异步逻辑收拢为 $():$ 闭包无法捕获普通函数,QRL 之间可以
  const save = $(async (r: Response) => {
    const data = (await r.json().catch(() => ({}))) as { name?: string; error?: string }
    if (!r.ok) throw new Error(translateError(data.error ?? `HTTP ${r.status}`))
    await onPick$(ICONS_PREFIX + (data.name ?? ''))
    bustSig.value++
  })

  const fetchIcon = $(async () => {
    if (!iconUrl.value.trim() || !name.value.trim()) {
      err.value = '请先填写图标 URL 与名称'
      return
    }
    busy.value = 'fetch'
    err.value = ''
    try {
      const r = await fetch('/api/admin/icons/fetch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: iconUrl.value.trim(), name: name.value.trim() }),
      })
      await save(r)
    } catch (e) {
      err.value = e instanceof Error ? e.message : String(e)
    } finally {
      busy.value = null
    }
  })

  const upload = $(async (input: HTMLInputElement) => {
    const f = input.files?.[0]
    if (!f) return
    if (!name.value.trim()) {
      err.value = '请先填写名称'
      input.value = ''
      return
    }
    busy.value = 'upload'
    err.value = ''
    try {
      const fd = new FormData()
      fd.append('file', f)
      fd.append('name', name.value.trim())
      await save(await fetch('/api/admin/icons', { method: 'POST', body: fd }))
    } catch (e) {
      err.value = e instanceof Error ? e.message : String(e)
    } finally {
      input.value = ''
      busy.value = null
    }
  })

  const removeIcon = $(async () => {
    if (!currentName.value) return
    busy.value = 'fetch'
    err.value = ''
    try {
      const r = await fetch(`/api/admin/icons/${encodeURIComponent(currentName.value)}`, {
        method: 'DELETE',
      })
      const data = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`)
      await onPick$('')
    } catch (e) {
      err.value = e instanceof Error ? e.message : String(e)
    } finally {
      busy.value = null
    }
  })

  return (
    <div>
      <span class="field-label">图标 / ICON</span>

      <div class={styles.picker}>
        <div class={styles.row}>
          {value ? (
            <IconImage src={previewSrc.value} class={styles.preview} />
          ) : (
            <div class={['mono', styles.preview, styles.fallback].join(' ')}>{initial}</div>
          )}
          <input
            bind:value={name}
            onInput$={() => (nameDirty.value = true)}
            class={['input', 'grow'].join(' ')}
            placeholder="名称"
            maxLength={64}
            spellcheck={false}
          />
          {currentName.value ? (
            <button
              type="button"
              class={['btn', 'btn-secondary', styles.del].join(' ')}
              disabled={busy.value !== null}
              onClick$={() => removeIcon()}
              title={`删除磁盘图标 ${currentName.value}`}
            >
              删除
            </button>
          ) : null}
        </div>

        <input
          bind:value={iconUrl}
          onInput$={() => (urlDirty.value = true)}
          class="input"
          placeholder="图标 URL（自动取链接 favicon）"
          spellcheck={false}
        />

        <div class={styles.row}>
          <button
            type="button"
            class={['btn', 'btn-secondary', 'grow'].join(' ')}
            disabled={busy.value !== null}
            onClick$={() => fetchIcon()}
          >
            {busy.value === 'fetch' ? '抓取中…' : '按 URL 抓取'}
          </button>
          <label
            class={[
              'btn',
              'btn-secondary',
              'grow',
              styles.uploadLabel,
              busy.value !== null && styles.uploadOff,
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {busy.value === 'upload' ? '上传中…' : '上传文件'}
            <input
              type="file"
              class={styles.fileInput}
              accept=".svg,.png,.ico,.webp,.jpg,.jpeg,.gif,.bmp"
              onChange$={(_, el) => upload(el)}
            />
          </label>
        </div>

        {err.value ? <div class={['mono', styles.err].join(' ')}>{err.value}</div> : null}
      </div>
    </div>
  )
})
