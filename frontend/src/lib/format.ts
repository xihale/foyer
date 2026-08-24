// 跨页面共享的格式化工具(面板遥测 / 监控页共用)

/** 宽松数值:非有限数归一为 null */
export const num = (v: number | undefined | null): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

/** MB → "3.6 TB" / "5.2 GB" / "412 MB" */
export const fmtSize = (mb: number | null): string => {
  if (mb === null) return '--'
  if (mb >= 1024 * 1024) return `${(mb / 1024 / 1024).toFixed(1)} TB`
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${Math.round(mb)} MB`
}

/** 字节/秒 → "2.4 MB/s" / "620 KB/s" */
export const fmtRate = (bps: number | null): string => {
  if (bps === null) return '--'
  if (bps >= 1048576) return `${(bps / 1048576).toFixed(1)} MB/s`
  if (bps >= 1024) return `${Math.round(bps / 1024)} KB/s`
  return `${Math.round(bps)} B/s`
}

/** 秒 → "3d 5h" / "5h 12m" / "12m" */
export const fmtUptime = (s: number | null): string => {
  if (s === null || s < 0) return '--'
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return '<1m'
}

/** used/total → 0-100 之间的百分比;无意义时 null */
export const pctOf = (used: number | null, total: number | null): number | null => {
  if (used === null || total === null || total <= 0) return null
  return Math.min(100, Math.max(0, (used / total) * 100))
}

export const pctText = (p: number | null): string => (p === null ? '--' : `${Math.round(p)}%`)
