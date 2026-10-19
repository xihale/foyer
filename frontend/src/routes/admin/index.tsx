import {
  $,
  component$,
  useComputed$,
  useSignal,
  useStore,
  useVisibleTask$,
} from '@qwik.dev/core'
import type { DocumentHead } from '@qwik.dev/router'

import { AppHeader } from '~/components/app-header/app-header'
import { Toast } from '~/components/toast/toast'
import { getCached, removeCached, setCached } from '~/lib/cache'
import { translateError } from '~/lib/errors'
import type { Bookmark, Config, Group, Service, SessionInfo } from '~/lib/types'
import { AdminSidebar } from '~/components/admin-sidebar/admin-sidebar'
import { BookmarkModal } from '~/components/bookmark-modal/bookmark-modal'
import { BookmarksPanel } from '~/components/bookmarks-panel/bookmarks-panel'
import { GroupModal } from '~/components/group-modal/group-modal'
import { GroupsPanel } from '~/components/groups-panel/groups-panel'
import { NotifyPanel } from '~/components/notify-panel/notify-panel'
import { SecurityPanel } from '~/components/security-panel/security-panel'
import { ServiceModal } from '~/components/service-modal/service-modal'
import { ServicesPanel } from '~/components/services-panel/services-panel'
import { SiteSettingsPanel } from '~/components/site-settings-panel/site-settings-panel'
import type { BmEdit, GroupEdit, GroupRow, Section, SvcEdit } from './types'
import { sectionFromHash } from './types'
import styles from './admin.module.css'

/** 链接归一化:裸域名补 https://(localhost:8096 也能正确补);最终协议非 http(s) 一律拒绝 */
function normalizeHref(raw: string): string | null {
  const u = raw.trim()
  if (!u) return null
  const candidate = /^https?:\/\//i.test(u) ? u : u.includes('://') ? null : `https://${u}`
  if (candidate === null) return null
  try {
    const url = new URL(candidate)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

const toRows = (gs: Group[] | undefined, kind: GroupRow['kind']): GroupRow[] =>
  (gs ?? []).map((g) => ({ id: g.id, name: g.name, columns: g.columns, icons_only: g.icons_only, kind }))

export default component$(() => {
  // ---- 会话与配置 ----
  const session = useSignal<SessionInfo | null>(null)
  const config = useSignal<Config | null>(null)
  const initError = useSignal('')

  // ---- 分区路由:hash 是唯一真相源(#services 等),非法值回落 settings。
  // 侧栏点击经 onSelect$ 接管(Qwik Router 会吞 hash 锚点点击),
  // 直达链接/前进后退仍走下面的 hashchange + popstate 监听 ----
  const section = useSignal<Section>('settings')

  const selectSection = $((s: Section) => {
    section.value = s
    history.replaceState(history.state, '', `#${s}`)
  })

  // ---- 站点设置表单 ----
  const siteTitle = useSignal('')
  const siteDescription = useSignal('')

  // ---- ntfy 表单 ----
  const ntfyUrl = useSignal('')
  const ntfyTopic = useSignal('')
  const ntfyToken = useSignal('')

  // ---- 登录 ----
  const password = useSignal('')
  const loginError = useSignal('')
  const busy = useSignal(false)
  const loginInput = useSignal<HTMLInputElement>()

  // ---- 弹窗与其错误条(form store 常驻,open 开关控制挂载) ----
  const svcForm = useStore<SvcEdit>({ id: null, name: '', icon: '', href: '', description: '', group_id: '', monitor_enabled: true, interval: '30', retry: '2' })
  const bmForm = useStore<BmEdit>({ id: null, name: '', icon: '', href: '', group_id: '' })
  const groupEdit = useStore<GroupEdit>({ id: 0, name: '', kind: 'service', columns: '', icons_only: false })
  const svcOpen = useSignal(false)
  const bmOpen = useSignal(false)
  const groupOpen = useSignal(false)
  const formError = useSignal('')
  const saving = useSignal(false)
  const testing = useSignal(false)

  // ---- 右下角 toast ----
  const toast = useSignal<{ id: number; msg: string; kind: 'ok' | 'err' } | null>(null)
  const toastSeq = useSignal(0)
  const toastTimer = useSignal<number | null>(null)

  // 派生列表(与管理台各分区共享);先于下方 $() 定义,避免闭包捕获踩 TDZ
  const serviceGroups = useComputed$(() => toRows(config.value?.service_groups, 'service'))
  const bookmarkGroups = useComputed$(() => toRows(config.value?.bookmark_groups, 'bookmark'))
  const services = useComputed$<Service[]>(() => {
    const out: Service[] = []
    for (const g of config.value?.service_groups ?? []) for (const s of g.services ?? []) out.push(s)
    return out
  })
  const bookmarks = useComputed$<Bookmark[]>(() => {
    const out: Bookmark[] = []
    for (const g of config.value?.bookmark_groups ?? []) for (const b of g.bookmarks ?? []) out.push(b)
    return out
  })
  const monitoredCount = useComputed$(() => services.value.filter((s) => s.monitor_enabled).length)

  // id → 分组名的查找表(普通对象可序列化,面板渲染时同步取用)
  const groupNames = useComputed$<Record<number, string>>(() => {
    const m: Record<number, string> = {}
    for (const g of [...serviceGroups.value, ...bookmarkGroups.value]) m[g.id] = g.name
    return m
  })

  // 组件内互调的逻辑一律收拢为 $() QRL:$ 闭包无法捕获普通函数,QRL 之间可以

  const showToast = $((msg: string, kind: 'ok' | 'err' = 'ok') => {
    toastSeq.value += 1
    toast.value = { id: toastSeq.value, msg, kind }
    if (toastTimer.value !== null) clearTimeout(toastTimer.value)
    toastTimer.value = window.setTimeout(
      () => (toast.value = null),
      kind === 'err' ? 3600 : 2800,
    )
  })

  const closeModals = $(() => {
    svcOpen.value = false
    bmOpen.value = false
    groupOpen.value = false
    formError.value = ''
  })

  // 后端错误串的中文翻译统一收敛在 lib/errors(与 IconPicker 共用);
  // 会话过期:直接退回登录页重新验证,而不是每个操作都弹一条 401。
  // 例外:改密接口的 401 是"当前密码错误",不是会话过期
  const api = $(async (path: string, method = 'GET', body?: unknown): Promise<unknown> => {
    const r = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (r.status === 401 && path.startsWith('/api/admin')) {
      if (path === '/api/admin/password') throw new Error('当前密码不正确')
      session.value = { authed: false, notification: null }
      removeCached('foyer_admin_session')
      await closeModals()
      throw new Error('登录已过期,请重新验证')
    }
    const data = (await r.json().catch(() => ({}))) as Record<string, unknown>
    if (!r.ok) {
      throw new Error(translateError(typeof data.error === 'string' ? data.error : `HTTP ${r.status}`))
    }
    return data
  })

  const reloadConfig = $(async () => {
    const c = (await api('/api/config')) as Config
    config.value = c
    setCached('foyer_config', c)
    siteTitle.value = typeof c.general?.title === 'string' ? c.general.title : ''
    siteDescription.value = typeof c.general?.description === 'string' ? c.general.description : ''
  })

  // 写入一成功就提示；列表刷新失败另报，避免用户空等、误以为没保存
  const afterSaved = $(async (msg: string, refresh?: () => Promise<unknown>) => {
    await showToast(msg)
    try {
      await (refresh ?? reloadConfig)()
    } catch (e) {
      await showToast(e instanceof Error ? e.message : String(e), 'err')
    }
  })

  const run = $(async (fn: () => Promise<unknown>, msg = '已保存', refresh?: () => Promise<unknown>) => {
    try {
      await fn()
    } catch (e) {
      await showToast(e instanceof Error ? e.message : String(e), 'err')
      return
    }
    await afterSaved(msg, refresh)
  })

  const refreshSession = $(async () => {
    const s = (await api('/api/admin/session')) as SessionInfo
    session.value = s
    setCached('foyer_admin_session', s)
    if (s.authed) {
      ntfyUrl.value = s.notification?.url ?? ''
      ntfyTopic.value = s.notification?.topic ?? ''
      await reloadConfig()
    }
  })

  // ---- 启动:恢复缓存快照 → 校验会话 → 挂 hash 监听 ----
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const cachedSession = getCached<SessionInfo>('foyer_admin_session')
    const cachedConfig = getCached<Config>('foyer_config')
    if (cachedSession) session.value = cachedSession
    if (cachedConfig) {
      config.value = cachedConfig
      siteTitle.value = typeof cachedConfig.general?.title === 'string' ? cachedConfig.general.title : ''
      siteDescription.value =
        typeof cachedConfig.general?.description === 'string' ? cachedConfig.general.description : ''
    }
    section.value = sectionFromHash()

    const sync = () => (section.value = sectionFromHash())
    window.addEventListener('hashchange', sync)
    window.addEventListener('popstate', sync)

    refreshSession().catch((e) => (initError.value = e instanceof Error ? e.message : String(e)))

    cleanup(() => {
      window.removeEventListener('hashchange', sync)
      window.removeEventListener('popstate', sync)
    })
  })

  // 登录框出现即聚焦(会话校验完成后才渲染,autofocus 属性不可靠)
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const s = track(() => session.value)
    if (s && !s.authed) loginInput.value?.focus()
  })

  const login = $(async () => {
    loginError.value = ''
    busy.value = true
    try {
      await api('/api/login', 'POST', { password: password.value })
      password.value = ''
      await refreshSession()
    } catch (e) {
      loginError.value = e instanceof Error ? e.message : String(e)
    }
    busy.value = false
  })

  const logout = $(async () => {
    await run(async () => {
      await api('/api/logout', 'POST')
      session.value = { authed: false, notification: null }
      removeCached('foyer_admin_session')
      config.value = null
      await closeModals()
    }, '已安全退出')
  })

  // ---- 站点设置 ----
  const saveSettings = $(async () => {
    if (!siteTitle.value.trim()) {
      await showToast('站点名称不能为空', 'err')
      return
    }
    saving.value = true
    await run(async () => {
      await api('/api/admin/settings', 'PUT', {
        title: siteTitle.value.trim(),
        description: siteDescription.value.trim(),
      })
    }, '设置已保存')
    saving.value = false
  })

  // ---- 服务 ----
  const openSvcForm = $((s: Service | null) => {
    formError.value = ''
    svcForm.id = s ? s.id : null
    svcForm.name = s?.name ?? ''
    svcForm.icon = s?.icon ?? ''
    svcForm.href = s?.href ?? ''
    svcForm.description = s?.description ?? ''
    svcForm.group_id = s ? String(s.group_id) : String(serviceGroups.value[0]?.id ?? '')
    svcForm.monitor_enabled = s?.monitor_enabled ?? true
    svcForm.interval = s ? String(s.monitor_interval_s) : '30'
    svcForm.retry = s ? String(s.monitor_retry_max) : '2'
    svcOpen.value = true
  })

  const saveService = $(async () => {
    const f = svcForm
    formError.value = ''
    if (!f.name.trim() || f.group_id === '') {
      formError.value = '名称与分组为必填项'
      return
    }
    const gid = Number(f.group_id)
    if (!Number.isInteger(gid)) {
      formError.value = '名称与分组为必填项'
      return
    }
    const href = normalizeHref(f.href)
    if (href === null) {
      formError.value = '跳转链接不能为空,且必须是 http(s) 地址(裸域名会自动补 https://)'
      return
    }
    // 与后端同一套白名单,越界响亮报错,绝不静默纠偏
    const interval = Math.round(Number(f.interval))
    if (!Number.isFinite(interval) || interval < 30 || interval > 86400) {
      formError.value = '探活周期需在 30-86400 秒之间'
      return
    }
    const retry = Math.round(Number(f.retry))
    if (!Number.isFinite(retry) || retry < 0 || retry > 10) {
      formError.value = '失败重试阈值需在 0-10 之间'
      return
    }
    const payload = {
      name: f.name.trim(),
      icon: f.icon.trim() || null,
      href,
      description: f.description.trim() || null,
      monitor_enabled: f.monitor_enabled,
      monitor_interval_s: interval,
      monitor_retry_max: retry,
      group_id: gid,
    }
    const id = f.id
    saving.value = true
    try {
      if (id === null) await api('/api/admin/services', 'POST', payload)
      else await api(`/api/admin/services/${id}`, 'PUT', payload)
      svcOpen.value = false
      await afterSaved(id === null ? '服务已创建' : '服务已更新')
    } catch (e) {
      formError.value = e instanceof Error ? e.message : String(e)
    }
    saving.value = false
  })

  const deleteService = $((s: Service) =>
    run(async () => {
      await api(`/api/admin/services/${s.id}`, 'DELETE')
      if (svcOpen.value && svcForm.id === s.id) svcOpen.value = false
    }, '已删除'),
  )

  // ---- 书签 ----
  const openBmForm = $((b: Bookmark | null) => {
    formError.value = ''
    bmForm.id = b ? b.id : null
    bmForm.name = b?.name ?? ''
    bmForm.icon = b?.icon ?? ''
    bmForm.href = b?.href ?? ''
    bmForm.group_id = b ? String(b.group_id) : String(bookmarkGroups.value[0]?.id ?? '')
    bmOpen.value = true
  })

  const saveBookmark = $(async () => {
    const f = bmForm
    formError.value = ''
    const failMsg = '名称、链接与分组为必填项(链接须为 http(s) 地址,裸域名自动补 https://)'
    if (!f.name.trim() || f.group_id === '') {
      formError.value = failMsg
      return
    }
    const gid = Number(f.group_id)
    if (!Number.isInteger(gid)) {
      formError.value = failMsg
      return
    }
    const href = normalizeHref(f.href)
    if (href === null) {
      formError.value = failMsg
      return
    }
    const payload = {
      name: f.name.trim(),
      icon: f.icon.trim() || null,
      href,
      group_id: gid,
    }
    const id = f.id
    saving.value = true
    try {
      if (id === null) await api('/api/admin/bookmarks', 'POST', payload)
      else await api(`/api/admin/bookmarks/${id}`, 'PUT', payload)
      bmOpen.value = false
      await afterSaved(id === null ? '书签已创建' : '书签已更新')
    } catch (e) {
      formError.value = e instanceof Error ? e.message : String(e)
    }
    saving.value = false
  })

  const deleteBookmark = $((b: Bookmark) =>
    run(async () => {
      await api(`/api/admin/bookmarks/${b.id}`, 'DELETE')
      if (bmOpen.value && bmForm.id === b.id) bmOpen.value = false
    }, '已删除'),
  )

  // ---- 分组 ----
  const addGroup = $((name: string, kind: 'service' | 'bookmark') =>
    run(async () => {
      await api('/api/admin/groups', 'POST', { name, kind })
    }, '分组已添加'),
  )

  const editGroup = $((g: GroupRow) => {
    formError.value = ''
    groupEdit.id = g.id
    groupEdit.name = g.name
    groupEdit.kind = g.kind
    groupEdit.columns = g.columns === null ? '' : String(g.columns)
    groupEdit.icons_only = g.icons_only
    groupOpen.value = true
  })

  const saveGroup = $(async () => {
    const f = groupEdit
    formError.value = ''
    if (!f.name.trim()) {
      formError.value = '分组名称不能为空'
      return
    }
    // 列数严格校验(1-8 整数,留空默认),不静默取整/钳制
    const colsRaw = f.columns.trim()
    let cols: number | null = null
    if (colsRaw !== '') {
      const n = Number(colsRaw)
      if (!Number.isInteger(n) || n < 1 || n > 8) {
        formError.value = '列数需为 1-8 的整数(留空使用默认 3 列)'
        return
      }
      cols = n
    }
    saving.value = true
    try {
      await api(`/api/admin/groups/${f.id}`, 'PUT', {
        name: f.name.trim(),
        columns: cols,
        icons_only: f.icons_only,
      })
      groupOpen.value = false
      await afterSaved('分组已保存')
    } catch (e) {
      formError.value = e instanceof Error ? e.message : String(e)
    }
    saving.value = false
  })

  const deleteGroup = $((g: GroupRow) =>
    run(async () => {
      await api(`/api/admin/groups/${g.id}`, 'DELETE')
    }, '已删除'),
  )

  // ---- ntfy 通知 ----
  const ntfyBody = $(() => {
    const body: { url: string; topic: string; token?: string } = {
      url: ntfyUrl.value.trim(),
      topic: ntfyTopic.value.trim(),
    }
    if (ntfyToken.value.trim()) body.token = ntfyToken.value.trim()
    return body
  })

  const saveNotification = $(async () => {
    const body = await ntfyBody()
    saving.value = true
    await run(async () => {
      await api('/api/admin/notification', 'PUT', body)
      ntfyToken.value = ''
    }, '通知配置已保存', refreshSession)
    saving.value = false
  })

  // 测试推送:后端用表单当前值真实发一条消息,token 留空沿用已存配置
  const testNotification = $(async () => {
    const body = await ntfyBody()
    if (!body.url || !body.topic) {
      await showToast('服务器 URL 与 Topic 为必填项', 'err')
      return
    }
    testing.value = true
    await run(async () => {
      await api('/api/admin/notification/test', 'POST', body)
    }, '测试推送已发送,请查收')
    testing.value = false
  })

  const clearNotification = $(() =>
    run(async () => {
      await api('/api/admin/notification', 'DELETE')
      ntfyToken.value = ''
    }, '已清除', refreshSession),
  )

  // ---- 修改密码 ----
  // 后端改密即注销会话，成功后回落登录页重新认证
  const changePassword = $((currentPassword: string, newPassword: string) =>
    run(async () => {
      await api('/api/admin/password', 'PUT', {
        current_password: currentPassword,
        new_password: newPassword,
      })
    }, '密码已更新，请重新登录', async () => {
      session.value = { authed: false, notification: null }
      removeCached('foyer_admin_session')
    }),
  )

  return (
    <div class={styles.page}>
      <AppHeader active="admin" siteTitle={(config.value?.general?.title as string | undefined) ?? 'foyer'}>
        {session.value?.authed ? (
          <div q:slot="below">
            <AdminSidebar
              section={section.value}
              counts={{
                groups: serviceGroups.value.length + bookmarkGroups.value.length,
                services: services.value.length,
                bookmarks: bookmarks.value.length,
              }}
              onSelect$={(s) => selectSection(s)}
            />
          </div>
        ) : null}
      </AppHeader>

      {initError.value ? (
        <main class={styles.main}>
          <div class="alert">会话初始化失败:{initError.value}</div>
        </main>
      ) : !session.value ? (
        <div class={['empty', 'mono', styles.boot].join(' ')}>验证会话中...</div>
      ) : !session.value.authed ? (
        /* 登录界面 */
        <div class={styles.loginWrap}>
          <form class={styles.login} preventdefault:submit onSubmit$={() => login()}>
            <div>
              <h2 class="page-title">设置</h2>
              <p class="page-sub">输入密码</p>
            </div>

            <label class={styles.field}>
              <span class="field-label">密码</span>
              <input
                type="password"
                bind:value={password}
                ref={loginInput}
                aria-label="管理密码"
                autocomplete="current-password"
                class="input"
              />
            </label>

            {loginError.value ? <div class="alert">{loginError.value}</div> : null}

            <button type="submit" disabled={busy.value || !password.value} class={['btn', 'btn-primary', styles.wide].join(' ')}>
              {busy.value ? '正在核对' : '进入'}
            </button>
          </form>
        </div>
      ) : (
        /* 管理主界面:侧边栏 + 主内容工作区 */
        <div class={styles.workspace}>
          <aside class={styles.side}>
            <AdminSidebar
              section={section.value}
              counts={{
                groups: serviceGroups.value.length + bookmarkGroups.value.length,
                services: services.value.length,
                bookmarks: bookmarks.value.length,
              }}
              onSelect$={(s) => selectSection(s)}
            />
          </aside>

          <main class={styles.content}>
            {section.value === 'settings' ? (
              <SiteSettingsPanel
                siteTitle={siteTitle}
                siteDescription={siteDescription}
                saving={saving.value}
                onSave$={() => saveSettings()}
              />
            ) : null}

            {section.value === 'groups' ? (
              <GroupsPanel
                serviceGroups={serviceGroups.value}
                bookmarkGroups={bookmarkGroups.value}
                onEdit$={(g) => editGroup(g)}
                onDelete$={(g) => deleteGroup(g)}
                onAdd$={(name, kind) => addGroup(name, kind)}
              />
            ) : null}

            {section.value === 'services' ? (
              <ServicesPanel
                services={services.value}
                monitoredCount={monitoredCount.value}
                groupNames={groupNames.value}
                onEdit$={(s) => openSvcForm(s)}
                onDelete$={(s) => deleteService(s)}
                onAdd$={() => openSvcForm(null)}
              />
            ) : null}

            {section.value === 'bookmarks' ? (
              <BookmarksPanel
                bookmarks={bookmarks.value}
                groupNames={groupNames.value}
                onEdit$={(b) => openBmForm(b)}
                onDelete$={(b) => deleteBookmark(b)}
                onAdd$={() => openBmForm(null)}
              />
            ) : null}

            {section.value === 'notify' ? (
              <NotifyPanel
                notification={session.value.notification}
                ntfyUrl={ntfyUrl}
                ntfyTopic={ntfyTopic}
                ntfyToken={ntfyToken}
                saving={saving.value}
                testing={testing.value}
                onSave$={() => saveNotification()}
                onClear$={() => clearNotification()}
                onTest$={() => testNotification()}
              />
            ) : null}

            {section.value === 'security' ? (
              <SecurityPanel
                onChangePw$={(cur, next) => changePassword(cur, next)}
                onLogout$={() => logout()}
              />
            ) : null}
          </main>
        </div>
      )}

      {/* 弹窗挂在页面根部,不随分区内联 */}
      {svcOpen.value ? (
        <ServiceModal
          form={svcForm}
          groups={serviceGroups.value}
          saving={saving.value}
          error={formError.value}
          onSubmit$={() => saveService()}
          onClose$={() => closeModals()}
        />
      ) : null}

      {bmOpen.value ? (
        <BookmarkModal
          form={bmForm}
          groups={bookmarkGroups.value}
          saving={saving.value}
          error={formError.value}
          onSubmit$={() => saveBookmark()}
          onClose$={() => closeModals()}
        />
      ) : null}

      {groupOpen.value ? (
        <GroupModal
          form={groupEdit}
          saving={saving.value}
          error={formError.value}
          onSubmit$={() => saveGroup()}
          onClose$={() => closeModals()}
        />
      ) : null}

      {toast.value ? (
        <Toast msg={toast.value.msg} kind={toast.value.kind} key={toast.value.id} />
      ) : null}
    </div>
  )
})

export const head: DocumentHead = {
  title: '设置 · foyer',
  meta: [
    { name: 'description', content: 'foyer · 管理后台' },
    { name: 'robots', content: 'noindex' },
  ],
}
