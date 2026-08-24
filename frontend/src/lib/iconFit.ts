/* 暗色单色图标适配:favicon 抓取常拿到"黑色 logo + 透明底"(如 GitHub),
   在深色 UI 上几乎不可见。这里降采样分析像素:整体暗且低饱和 → invert 反色提亮。
   彩色图标(npm 红标等)饱和度高,不满足条件,原样显示。
   判定结果只做内存缓存:单页会话内不重复解码,图标被覆盖上传后下次导航自然重判。 */

/** url → 是否需要反色 */
const verdicts = new Map<string, boolean>()

const SAMPLE = 16 // 采样边长,16×16 足够判断整体明暗

async function isDarkMono(url: string): Promise<boolean> {
  const cached = verdicts.get(url)
  if (cached !== undefined) return cached

  let dark = false
  try {
    const img = new Image()
    img.decoding = 'async'
    await new Promise<void>((ok, err) => {
      img.onload = () => ok()
      img.onerror = () => err(new Error('load failed'))
      img.src = url
    })
    const c = document.createElement('canvas')
    c.width = SAMPLE
    c.height = SAMPLE
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('no 2d ctx')
    ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE)
    const d = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data

    // alpha 加权累计 HSL 亮度与通道极差(饱和度近似)
    let lSum = 0
    let sSum = 0
    let wSum = 0
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3] / 255
      if (a < 0.1) continue // 透明像素不算
      const r = d[i] / 255
      const g = d[i + 1] / 255
      const b = d[i + 2] / 255
      const mx = Math.max(r, g, b)
      const mn = Math.min(r, g, b)
      lSum += ((mx + mn) / 2) * a
      sSum += (mx - mn) * a
      wSum += a
    }
    if (wSum === 0) throw new Error('fully transparent')
    dark = lSum / wSum < 0.35 && sSum / wSum < 0.25
  } catch {
    dark = false // 解码失败(SVG 无固有尺寸等)就不处理
  }
  verdicts.set(url, dark)
  return dark
}

/** 用在 <img> 上:加载后自动判定,暗色单色图标加 invert 滤镜 */
export function iconFit(node: HTMLImageElement) {
  let dead = false
  const apply = async () => {
    const url = node.currentSrc || node.src
    if (!url || dead) return
    node.style.filter = (await isDarkMono(url)) ? 'invert(1) hue-rotate(180deg)' : ''
  }
  // 持续监听:src 变更(如覆盖上传后 ?v= 破缓存)重载时也重新判定
  node.addEventListener('load', apply)
  // 缓存命中时挂载前可能已加载完,不会再触发 load
  if (node.complete && node.naturalWidth > 0) apply()
  return {
    destroy() {
      dead = true
      node.removeEventListener('load', apply)
    },
  }
}
