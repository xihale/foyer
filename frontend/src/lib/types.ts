// /api/config 的共享类型：面板页与管理台消费同一份数据

export interface Service {
  id: number
  name: string
  icon: string | null
  href: string
  description: string | null
  monitor_enabled: boolean
  // 管理台编辑所需，/api/config 一并返回
  group_id: number
  monitor_interval_s: number
  monitor_retry_max: number
  // 监控引擎内存态（unknown|up|down）
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
  general: Record<string, any>
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

