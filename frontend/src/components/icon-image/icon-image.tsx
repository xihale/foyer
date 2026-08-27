import { component$, useSignal, useVisibleTask$ } from '@qwik.dev/core'
import { iconFilter } from '~/lib/icon-dark'

/**
 * 图标 <img> 包装:加载完成(或 src 破缓存重载)后自动判定,
 * 暗色单色图标加 invert 滤镜保证深色主题下可见。
 */
export const IconImage = component$<{ src: string; class?: string }>(({ src, ...rest }) => {
  const imgRef = useSignal<HTMLImageElement>()
  const filterStyle = useSignal('')

  useVisibleTask$(({ track }) => {
    track(() => src)
    const el = imgRef.value
    if (!el) return
    let dead = false
    const apply = async () => {
      const url = el.currentSrc || el.src
      if (!url || dead) return
      filterStyle.value = await iconFilter(url)
    }
    // 缓存命中时挂载前可能已加载完,不会再触发 load
    if (el.complete && el.naturalWidth > 0) void apply()
    el.addEventListener('load', apply)
    return () => {
      dead = true
      el.removeEventListener('load', apply)
    }
  })

  return (
    <img
      {...rest}
      src={src}
      alt=""
      loading="lazy"
      ref={imgRef}
      style={filterStyle.value || undefined}
    />
  )
})
