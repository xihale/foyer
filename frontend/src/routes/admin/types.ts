// 管理台内部类型:跨页面 / 面板 / 弹窗共享,独立成文件避免循环 import
// (会话类型在 ~/lib/types)

/** 分区路由:hash 即地址(#services 等),Admin 监听 hashchange 渲染 */
export const sectionKeys = ['settings', 'groups', 'services', 'bookmarks', 'notify', 'security'] as const
export type Section = (typeof sectionKeys)[number]

export function sectionFromHash(): Section {
  const h = location.hash.slice(1) as Section
  return (sectionKeys as readonly string[]).includes(h) ? h : 'settings'
}

// 列表行里仅用到分组的少数字段
export interface GroupRow {
  id: number
  name: string
  kind: 'service' | 'bookmark'
  columns: number | null
  icons_only: boolean
}

export interface SvcEdit {
  id: number | null
  name: string
  icon: string
  href: string
  description: string
  // 分组 id 与探活参数同为字符串承载(select/number input 原生吐字符串),
  // 保存时严格校验转换,坏输入响亮报错
  group_id: string
  monitor_enabled: boolean
  interval: string
  retry: string
}

export interface BmEdit {
  id: number | null
  name: string
  icon: string
  href: string
  group_id: string
}

export interface GroupEdit {
  id: number
  name: string
  kind: 'service' | 'bookmark'
  columns: string // 空 = 默认
  icons_only: boolean
}
