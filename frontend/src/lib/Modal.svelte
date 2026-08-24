<script lang="ts">
  import { fade } from 'svelte/transition'
  import type { TransitionConfig } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
  import type { Snippet } from 'svelte'

  interface Props {
    /** 无障碍名称 */
    label: string
    /** 标题栏文案 */
    title: string
    /** 宽度变体:分组 sm / 书签 md / 服务 lg */
    width?: 'sm' | 'md' | 'lg'
    onsubmit: (e: SubmitEvent) => void
    onclose: () => void
    submitLabel?: string
    /** 提交中:禁用按钮并显示「保存中...」 */
    saving?: boolean
    /** 底部错误条(校验 / 保存失败) */
    error?: string
    children?: Snippet
  }
  let {
    label,
    title,
    width = 'md',
    onsubmit,
    onclose,
    submitLabel = '保存',
    saving = false,
    error = '',
    children,
  }: Props = $props()

  // 弹窗过渡:0.96 缩放 + 淡入,ease-out(移动端为底部抽屉)
  const dialogTransition = (
    _node: Element,
    _params?: Record<string, unknown>,
  ): TransitionConfig => ({
    duration: 180,
    easing: cubicOut,
    css: (t: number) => `opacity: ${t}; transform: scale(${0.96 + 0.04 * t})`,
  })

  let dialogEl = $state<HTMLDivElement | null>(null)

  // 挂载后聚焦第一个可输入控件;打开期间:焦点圈闭 + Esc 关闭(保存中禁用) + 锁定背景滚动
  $effect(() => {
    const el = dialogEl
    if (!el) return
    el.querySelector<HTMLElement>('input, select, textarea')?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!saving) onclose()
        return
      }
      if (e.key !== 'Tab') return
      const focusables = el.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return
      const first = focusables[0]!
      const last = focusables[focusables.length - 1]!
      const active = document.activeElement
      if (e.shiftKey && (active === first || !el.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !el.contains(active))) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  })
</script>

<div class="overlay">
  <button
    type="button"
    class="backdrop"
    transition:fade={{ duration: 150 }}
    onclick={onclose}
    aria-label="关闭弹窗"
    tabindex="-1"
  ></button>
  <div
    class="dialog w-{width}"
    transition:dialogTransition
    bind:this={dialogEl}
    role="dialog"
    aria-modal="true"
    aria-label={label}
  >
    <form class="form" {onsubmit}>
      <div class="head">
        <h3 class="title">{title}</h3>
        <button type="button" class="btn-close" onclick={onclose} aria-label="关闭">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
          </svg>
        </button>
      </div>

      <div class="body">
        {@render children?.()}
      </div>

      {#if error}
        <div class="error-bar">{error}</div>
      {/if}

      <div class="foot">
        <button type="button" class="btn btn-secondary" onclick={onclose}>取消</button>
        <button type="submit" disabled={saving} class="btn btn-primary">
          {saving ? '保存中...' : submitLabel}
        </button>
      </div>
    </form>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  @media (min-width: 640px) {
    .overlay {
      align-items: center;
      padding: 24px;
    }
  }

  .backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: none;
  }

  .dialog {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-height: 88dvh;
    background: var(--md-sys-color-surface-container-high);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--md-sys-shape-corner-extra-large) var(--md-sys-shape-corner-extra-large) 0 0;
    box-shadow: var(--md-sys-elevation-level3);
    overflow: hidden;
  }
  @media (min-width: 640px) {
    .dialog {
      border-radius: var(--md-sys-shape-corner-extra-large);
    }
  }
  .dialog.w-sm { max-width: 22rem; }
  .dialog.w-md { max-width: 28rem; }
  .dialog.w-lg { max-width: 34rem; }

  .form {
    display: flex;
    flex-direction: column;
    min-height: 0;
    flex: 1;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    padding: 16px 20px;
    border-bottom: 1px solid var(--md-sys-color-outline-variant);
  }
  .title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--md-sys-color-on-surface);
  }

  .body {
    min-height: 0;
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .error-bar {
    flex-shrink: 0;
    padding: 10px 20px;
    border-top: 1px solid rgba(242, 184, 181, 0.3);
    background: var(--md-sys-color-error-container);
    font-size: 12.5px;
    color: var(--md-sys-color-on-error-container);
  }

  .foot {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    flex-shrink: 0;
    padding: 14px 20px;
    border-top: 1px solid var(--md-sys-color-outline-variant);
  }
</style>
