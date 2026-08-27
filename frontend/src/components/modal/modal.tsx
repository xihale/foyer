import { Slot, component$, useSignal, useTask$, useVisibleTask$ } from '@qwik.dev/core'
import styles from './modal.module.css'

interface ModalProps {
  /** 无障碍名称 */
  label: string
  /** 标题栏文案 */
  title: string
  /** 宽度变体:分组 sm / 书签 md / 服务 lg */
  width?: 'sm' | 'md' | 'lg'
  onSubmit$?: () => void
  onClose$: () => void
  submitLabel?: string
  /** 提交中:禁用按钮并显示「保存中...」 */
  saving?: boolean
  /** 底部错误条(校验 / 保存失败) */
  error?: string
}

// 渲染期内联取 styles(见下方 widthClass 使用处),不在模块顶层解引用,
// 规避跨 chunk 初始化顺序问题
const widthKey = { sm: 'wSm', md: 'wMd', lg: 'wLg' } as const

export const Modal = component$<ModalProps>(
  ({
    label,
    title,
    width = 'md',
    onSubmit$,
    onClose$,
    submitLabel = '保存',
    saving = false,
    error = '',
  }) => {
    // $() 闭包在序列化时定格原始值;镜像一份进 Signal,监听器才能读到最新 saving
    const savingSig = useSignal(saving)
    useTask$(({ track }) => {
      savingSig.value = track(() => saving)
    })

    const dialogRef = useSignal<HTMLDivElement>()

    // 挂载后聚焦第一个可输入控件;打开期间:焦点圈闭 + Esc 关闭(保存中禁用) + 锁定背景滚动
    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(({ cleanup }) => {
      const el = dialogRef.value
      if (!el) return
      el.querySelector<HTMLElement>('input, select, textarea')?.focus()

      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          if (!savingSig.value) onClose$()
          return
        }
        if (e.key !== 'Tab') return
        const focusables = el.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabIndex={-1}])',
        )
        if (focusables.length === 0) return
        const first = focusables[0] as HTMLElement
        const last = focusables[focusables.length - 1] as HTMLElement
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
      cleanup(() => {
        window.removeEventListener('keydown', onKey)
        document.body.style.overflow = ''
      })
    })

    return (
      <div class={styles.overlay}>
        {/* 入场动效由 CSS keyframes 承担(Svelte transition 的替代);退场直切 */}
        <button
          type="button"
          class={styles.backdrop}
          onClick$={() => onClose$()}
          aria-label="关闭弹窗"
          tabIndex={-1}
        />
        <div
          class={[styles.dialog, styles[widthKey[width]]]}
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={label}
        >
          <form
            class={styles.form}
            preventdefault:submit
            onSubmit$={() => onSubmit$?.()}
          >
            <div class={styles.head}>
              <h3 class={[styles.title].join(' ')}>{title}</h3>
              <button type="button" class="btn-close" onClick$={() => onClose$()} aria-label="关闭">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div class={styles.body}>
              <Slot />
            </div>

            {error ? <div class={styles.errorBar}>{error}</div> : null}

            <div class={styles.foot}>
              <button type="button" class="btn btn-secondary" onClick$={() => onClose$()}>
                取消
              </button>
              <button type="submit" disabled={saving} class="btn btn-primary">
                {saving ? '保存中...' : submitLabel}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  },
)
