/**
 * 轻量级 sessionStorage 缓存
 * 用于首屏直出,消除"加载中..."和 DOM 跳变闪烁
 * vite 开发模式关掉:改后台后立刻看到新数据,不必跟 sessionStorage 较劲
 */

// 缓存结构演进时 +1,旧版本数据自然失效(读取时键不匹配)
const VERSION = 1
const vk = (key: string): string => `v${VERSION}:${key}`

export function getCached<T>(key: string): T | null {
  // SSG 构建在服务端跑组件代码,浏览器存储不可用
  if (typeof window === 'undefined' || import.meta.env.DEV) return null
  try {
    const raw = sessionStorage.getItem(vk(key))
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function setCached<T>(key: string, data: T): void {
  if (typeof window === 'undefined' || import.meta.env.DEV) return
  try {
    sessionStorage.setItem(vk(key), JSON.stringify(data))
  } catch {
    // 忽略存储超额等异常
  }
}

export function removeCached(key: string): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(vk(key))
  } catch {
    // 忽略异常
  }
}
