// /api/config 与相关接口的共享类型:面板页与管理台消费同一份数据

export interface Service {
  id: number
  name: string
  icon: string | null
  href: string
  description: string | null
  monitor_enabled: boolean
  // 管理台编辑所需,/api/config 一并返回
  group_id: number
  monitor_interval_s: number
  monitor_retry_max: number
  // 监控引擎内存态(unknown|up|down)
  status?: 'up' | 'down' | 'unknown'
  latency_ms?: number | null
}

export interface Bookmark {
  id: number
  name: string
  icon: string | null
  href: string
  group_id: number
}

export interface Group {
  id: number
  name: string
  style: string
  columns: number | null
  icons_only: boolean
  services?: Service[]
  bookmarks?: Bookmark[]
}

export interface Config {
  general: Record<string, unknown>
  service_groups: Group[]
  bookmark_groups: Group[]
}

// SSE /api/events 推送的实时监控状态
export interface ServiceStatus {
  up: boolean
  latency_ms: number | null
}

// /api/system 的采样(面板遥测栏)
export interface DiskMount {
  mount: string
  total_mb: number
  used_mb: number
}

export interface SystemInfo {
  cpu_percent?: number
  cpu_cores?: number
  cpu_model?: string
  mem_total_mb?: number
  mem_used_mb?: number
  swap_total_mb?: number
  swap_used_mb?: number
  disks?: DiskMount[]
  load_1?: number
  load_5?: number
  load_15?: number
  uptime_s?: number
  hostname?: string
  os_name?: string
  kernel?: string
  net_rx_bps?: number
  net_tx_bps?: number
}

// /api/status 的单节点心跳窗口(status 页)
export interface StatusBar {
  t: number // 桶起始 unix millis
  total: number // 0 = 无数据
  ups: number
  avg_ms: number | null
}

export interface LastIncident {
  started_at: number // unix millis
  message: string
}

export interface StatusService {
  id: number
  name: string
  status: 'up' | 'down' | 'unknown'
  latency_ms?: number | null
  uptime_24h: number | null
  last_incident: LastIncident | null
  bars: StatusBar[]
}

// 管理台会话(GET /api/admin/session)
export interface NotificationInfo {
  url: string
  topic: string
  has_token: boolean
}

export interface SessionInfo {
  authed: boolean
  notification?: NotificationInfo | null
}
