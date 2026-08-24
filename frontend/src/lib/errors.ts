// 后端错误串 → 用户可读中文;未收录的原样透出。
// 后端 API 错误保持英文(machine-readable),人机翻译统一收敛在这张表里维护。

const errorZh: Record<string, string> = {
  unauthorized: '未登录或会话已过期',
  'too many failed attempts, retry later': '失败次数过多,已临时锁定',
  'invalid json': '请求数据无效',
  'invalid multipart form': '上传表单无效',
  'db error': '数据库写入失败',
  'hash error': '密码加密失败,请重试',
  'bad id': '无效的资源 ID',
  'name required': '名称不能为空',
  'name required (1-64 chars)': '名称长度需在 1-64 字符之间',
  'title required (1-64 chars)': '站点名称长度需在 1-64 字符之间',
  'href required (1-2048 chars)': '链接不能为空(最长 2048 字符)',
  'href must be http(s)': '链接必须以 http:// 或 https:// 开头',
  'group must be a service group': '目标分组不是节点分组',
  'group must be a bookmark group': '目标分组不是书签分组',
  'group not empty': '分组内仍有节点或书签,请先移出或删除',
  'kind must be service|bookmark': '分组类型无效',
  'columns out of range (1-8)': '列数需在 1-8 之间',
  'monitor_interval_s out of range (30-86400)': '探活周期需在 30-86400 秒之间',
  'monitor_retry_max out of range (0-10)': '失败重试阈值需在 0-10 之间',
  'password too short (min 8)': '密码至少 8 位',
  'url and name required': '图标 URL 与名称为必填项',
  'url must be http(s)': '图标 URL 必须是 http(s) 链接',
  'file required': '未选择文件',
  'empty file': '文件为空',
  'invalid name (a-z 0-9 . _ -)': '图标名称只能包含 a-z 0-9 . _ -',
  'url and topic required': '服务器 URL 与 Topic 为必填项',
  'ntfy rejected the message (check topic/token)': 'ntfy 拒绝了推送,请检查 Topic 与 Token',
  UnknownHostName: '无法解析 ntfy 服务器域名',
  ConnectionRefused: '无法连接 ntfy 服务器',
}

export function translateError(raw: string): string {
  return errorZh[raw] ?? raw
}
