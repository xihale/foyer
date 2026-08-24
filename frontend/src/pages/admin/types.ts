// 后台页内部类型:跨 Admin / 面板 / 弹窗共享,独立成文件避免循环 import

// 列表行里仅用到分组的少数字段
export interface GroupRow {
  id: number
  name: string
  kind: 'service' | 'bookmark'
  columns: number | null
  icons_only: boolean
}

export interface NotificationInfo {
  url: string
  topic: string
  has_token: boolean
}

export interface SessionInfo {
  authed: boolean
  notification?: NotificationInfo | null
}

export interface SvcForm {
  id: number | null
  name: string
  icon: string
  href: string
  description: string
  group_id: number | null
  monitor_enabled: boolean
  interval: number
  retry: number
}

export interface BmForm {
  id: number | null
  name: string
  icon: string
  href: string
  group_id: number | null
}

export interface GroupEdit {
  id: number
  name: string
  kind: 'service' | 'bookmark'
  columns: string // 空 = 默认
  icons_only: boolean
}
