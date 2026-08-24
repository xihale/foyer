<script lang="ts">
  import Header from '../../lib/Header.svelte'
  import Toast from '../../lib/Toast.svelte'
  import { getCached, removeCached, setCached } from '../../lib/cache'
  import { translateError } from '../../lib/errors'
  import type { Bookmark, Config, Group, Service } from '../../lib/types'
  import AdminSidebar, { section_keys, type Section } from './AdminSidebar.svelte'
  import BookmarkModal from './BookmarkModal.svelte'
  import BookmarksPanel from './BookmarksPanel.svelte'
  import GroupModal from './GroupModal.svelte'
  import GroupsPanel from './GroupsPanel.svelte'
  import NotifyPanel from './NotifyPanel.svelte'
  import SecurityPanel from './SecurityPanel.svelte'
  import ServiceModal from './ServiceModal.svelte'
  import ServicesPanel from './ServicesPanel.svelte'
  import SiteSettingsPanel from './SiteSettingsPanel.svelte'
  import type { BmForm, GroupEdit, GroupRow, SessionInfo, SvcForm } from './types'

  const cachedSession = getCached<SessionInfo>('foyer_admin_session')
  const cachedConfig = getCached<Config>('foyer_config')

  let session = $state<SessionInfo | null>(cachedSession)
  let config = $state<Config | null>(cachedConfig)
  let initError = $state('')

  let password = $state('')
  let loginError = $state('')
  let busy = $state(false)
  let loginInput = $state<HTMLInputElement | null>(null)

  // 登录框出现即聚焦(会话校验完成后才渲染,autofocus 属性不可靠)
  $effect(() => {
    if (session && !session.authed) loginInput?.focus()
  })

  // 分区路由:hash 是唯一真相源(#services 等),非法值回落 settings
  function fromHash(): Section {
    const h = location.hash.slice(1) as Section
    return section_keys.includes(h) ? h : 'settings'
  }
  let section = $state<Section>(fromHash())
  $effect(() => {
    const sync = () => (section = fromHash())
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  })

  // 站点设置表单
  let siteTitle = $state(typeof cachedConfig?.general?.title === 'string' ? cachedConfig.general.title : '')
  let siteDescription = $state(typeof cachedConfig?.general?.description === 'string' ? cachedConfig.general.description : '')
  let siteTelemetryPublic = $state(cachedConfig?.general?.telemetry_public !== false)

  let ntfyUrl = $state(cachedSession?.notification?.url ?? '')
  let ntfyTopic = $state(cachedSession?.notification?.topic ?? '')
  let ntfyToken = $state('')

  let svcForm = $state<SvcForm | null>(null)
  let bmForm = $state<BmForm | null>(null)
  let groupEdit = $state<GroupEdit | null>(null)

  // 弹窗内联错误(校验 / 保存失败),显示在模态框底部
  let formError = $state('')
  let saving = $state(false)
  let testing = $state(false)

  // 右下角 toast:成功约 3s 自动消失,失败稍长
  let toast = $state<{ id: number; msg: string; kind: 'ok' | 'err' } | null>(null)
  let toastSeq = 0
  let toastTimer: ReturnType<typeof setTimeout> | undefined
  function showToast(msg: string, kind: 'ok' | 'err' = 'ok') {
    toast = { id: ++toastSeq, msg, kind }
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => (toast = null), kind === 'err' ? 3600 : 2800)
  }

  function closeModals() {
    svcForm = null
    bmForm = null
    groupEdit = null
    formError = ''
  }

  const toRows = (gs: Group[] | undefined, kind: GroupRow['kind']): GroupRow[] =>
    (gs ?? []).map((g) => ({ id: g.id, name: g.name, columns: g.columns, icons_only: g.icons_only, kind }))
  const serviceGroups = $derived(toRows(config?.service_groups, 'service'))
  const bookmarkGroups = $derived(toRows(config?.bookmark_groups, 'bookmark'))
  const services = $derived.by<Service[]>(() => {
    const out: Service[] = []
    for (const g of config?.service_groups ?? []) for (const s of g.services ?? []) out.push(s)
    return out
  })
  const bookmarks = $derived.by<Bookmark[]>(() => {
    const out: Bookmark[] = []
    for (const g of config?.bookmark_groups ?? []) for (const b of g.bookmarks ?? []) out.push(b)
    return out
  })
  const monitoredCount = $derived(services.filter((s) => s.monitor_enabled).length)

  const groupName = (id: number) =>
    serviceGroups.find((g) => g.id === id)?.name ?? bookmarkGroups.find((g) => g.id === id)?.name ?? `#${id}`

  // 后端错误串的中文翻译统一收敛在 lib/errors.ts(与 IconPicker 共用)
  async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const r = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    // 会话过期:直接退回登录页重新验证,而不是每个操作都弹一条 401。
    // 例外:改密接口的 401 是"当前密码错误",不是会话过期
    if (r.status === 401 && path.startsWith('/api/admin')) {
      if (path === '/api/admin/password') throw new Error('当前密码不正确')
      session = { authed: false, notification: null }
      removeCached('foyer_admin_session')
      closeModals()
      throw new Error('登录已过期,请重新验证')
    }
    const data = (await r.json().catch(() => ({}))) as Record<string, unknown>
    if (!r.ok) {
      throw new Error(translateError(typeof data.error === 'string' ? data.error : `HTTP ${r.status}`))
    }
    return data as T
  }

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

  // 写入一成功就提示；列表刷新失败另报，避免用户空等、误以为没保存
  async function afterSaved(msg: string, refresh: () => Promise<unknown> = reloadConfig) {
    showToast(msg)
    try {
      await refresh()
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'err')
    }
  }

  async function run(
    fn: () => Promise<unknown>,
    msg = '已保存',
    refresh: () => Promise<unknown> = reloadConfig,
  ) {
    try {
      await fn()
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'err')
      return
    }
    await afterSaved(msg, refresh)
  }

  async function refreshSession() {
    const s = await api<SessionInfo>('/api/admin/session')
    session = s
    setCached('foyer_admin_session', s)
    if (s.authed) {
      ntfyUrl = s.notification?.url ?? ''
      ntfyTopic = s.notification?.topic ?? ''
      await reloadConfig()
    }
  }

  async function reloadConfig() {
    config = await api<Config>('/api/config')
    setCached('foyer_config', config)
    siteTitle = typeof config.general?.title === 'string' ? config.general.title : ''
    siteDescription = typeof config.general?.description === 'string' ? config.general.description : ''
    siteTelemetryPublic = config.general?.telemetry_public !== false
  }

  $effect(() => {
    refreshSession().catch((e) => (initError = e instanceof Error ? e.message : String(e)))
  })

  async function login(e: SubmitEvent) {
    e.preventDefault()
    loginError = ''
    busy = true
    try {
      await api('/api/login', 'POST', { password })
      password = ''
      await refreshSession()
    } catch (e) {
      loginError = e instanceof Error ? e.message : String(e)
    }
    busy = false
  }

  function logout() {
    void run(
      async () => {
        await api('/api/logout', 'POST')
        session = { authed: false, notification: null }
        removeCached('foyer_admin_session')
        config = null
        closeModals()
      },
      '已安全退出',
      async () => {},
    )
  }

  // ---- 站点设置 ----
  async function saveSettings(e: SubmitEvent) {
    e.preventDefault()
    if (!siteTitle.trim()) {
      showToast('站点名称不能为空', 'err')
      return
    }
    saving = true
    await run(async () => {
      await api('/api/admin/settings', 'PUT', {
        title: siteTitle.trim(),
        description: siteDescription.trim(),
        telemetry_public: siteTelemetryPublic,
      })
    }, '设置已保存')
    saving = false
  }

  // ---- 服务 ----
  function openSvcForm(s: Service | null) {
    formError = ''
    svcForm = s
      ? {
          id: s.id,
          name: s.name,
          icon: s.icon ?? '',
          href: s.href ?? '',
          description: s.description ?? '',
          group_id: s.group_id,
          monitor_enabled: s.monitor_enabled,
          interval: s.monitor_interval_s,
          retry: s.monitor_retry_max,
        }
      : {
          id: null,
          name: '',
          icon: '',
          href: '',
          description: '',
          group_id: serviceGroups[0]?.id ?? null,
          monitor_enabled: true,
          interval: 30,
          retry: 2,
        }
  }

  async function saveService(e: SubmitEvent) {
    e.preventDefault()
    const f = svcForm
    if (!f) return
    formError = ''
    const gid = f.group_id
    if (!f.name.trim() || gid === null) {
      formError = '名称与分组为必填项'
      return
    }
    const href = normalizeHref(f.href)
    if (href === null) {
      formError = '跳转链接不能为空,且必须是 http(s) 地址(裸域名会自动补 https://)'
      return
    }
    // 与后端同一套白名单,越界响亮报错,绝不静默纠偏
    const interval = Math.round(Number(f.interval))
    if (!Number.isFinite(interval) || interval < 30 || interval > 86400) {
      formError = '探活周期需在 30-86400 秒之间'
      return
    }
    const retry = Math.round(Number(f.retry))
    if (!Number.isFinite(retry) || retry < 0 || retry > 10) {
      formError = '失败重试阈值需在 0-10 之间'
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
    saving = true
    try {
      if (id === null) await api('/api/admin/services', 'POST', payload)
      else await api(`/api/admin/services/${id}`, 'PUT', payload)
      svcForm = null
      await afterSaved(id === null ? '服务已创建' : '服务已更新')
    } catch (e) {
      formError = e instanceof Error ? e.message : String(e)
    }
    saving = false
  }

  function deleteService(s: Service) {
    void run(async () => {
      await api(`/api/admin/services/${s.id}`, 'DELETE')
      if (svcForm?.id === s.id) svcForm = null
    }, '已删除')
  }

  // ---- 书签 ----
  function openBmForm(b: Bookmark | null) {
    formError = ''
    bmForm = b
      ? {
          id: b.id,
          name: b.name,
          icon: b.icon ?? '',
          href: b.href,
          group_id: b.group_id,
        }
      : { id: null, name: '', icon: '', href: '', group_id: bookmarkGroups[0]?.id ?? null }
  }

  async function saveBookmark(e: SubmitEvent) {
    e.preventDefault()
    const f = bmForm
    if (!f) return
    formError = ''
    const gid = f.group_id
    const href = normalizeHref(f.href)
    if (!f.name.trim() || href === null || gid === null) {
      formError = '名称、链接与分组为必填项(链接须为 http(s) 地址,裸域名自动补 https://)'
      return
    }
    const payload = {
      name: f.name.trim(),
      icon: f.icon.trim() || null,
      href,
      group_id: gid,
    }
    const id = f.id
    saving = true
    try {
      if (id === null) await api('/api/admin/bookmarks', 'POST', payload)
      else await api(`/api/admin/bookmarks/${id}`, 'PUT', payload)
      bmForm = null
      await afterSaved(id === null ? '书签已创建' : '书签已更新')
    } catch (e) {
      formError = e instanceof Error ? e.message : String(e)
    }
    saving = false
  }

  function deleteBookmark(b: Bookmark) {
    void run(async () => {
      await api(`/api/admin/bookmarks/${b.id}`, 'DELETE')
      if (bmForm?.id === b.id) bmForm = null
    }, '已删除')
  }

  // ---- 分组 ----
  function addGroup(name: string, kind: 'service' | 'bookmark') {
    void run(async () => {
      await api('/api/admin/groups', 'POST', { name, kind })
    }, '分组已添加')
  }

  function editGroup(g: GroupRow) {
    formError = ''
    groupEdit = {
      id: g.id,
      name: g.name,
      kind: g.kind,
      columns: g.columns === null ? '' : String(g.columns),
      icons_only: g.icons_only,
    }
  }

  async function saveGroup(e: SubmitEvent) {
    e.preventDefault()
    const f = groupEdit
    if (!f) return
    formError = ''
    if (!f.name.trim()) {
      formError = '分组名称不能为空'
      return
    }
    // 列数严格校验(1-8 整数,留空默认),不静默取整/钳制
    const colsRaw = f.columns.trim()
    let cols: number | null = null
    if (colsRaw !== '') {
      const n = Number(colsRaw)
      if (!Number.isInteger(n) || n < 1 || n > 8) {
        formError = '列数需为 1-8 的整数(留空使用默认 3 列)'
        return
      }
      cols = n
    }
    saving = true
    try {
      await api(`/api/admin/groups/${f.id}`, 'PUT', {
        name: f.name.trim(),
        columns: cols,
        icons_only: f.icons_only,
      })
      groupEdit = null
      await afterSaved('分组已保存')
    } catch (e) {
      formError = e instanceof Error ? e.message : String(e)
    }
    saving = false
  }

  function deleteGroup(g: GroupRow) {
    void run(async () => {
      await api(`/api/admin/groups/${g.id}`, 'DELETE')
    }, '已删除')
  }

  // ---- ntfy 通知 ----
  function ntfyBody() {
    const body: { url: string; topic: string; token?: string } = {
      url: ntfyUrl.trim(),
      topic: ntfyTopic.trim(),
    }
    if (ntfyToken.trim()) body.token = ntfyToken.trim()
    return body
  }

  async function saveNotification(e: SubmitEvent) {
    e.preventDefault()
    const body = ntfyBody()
    saving = true
    await run(
      async () => {
        await api('/api/admin/notification', 'PUT', body)
        ntfyToken = ''
      },
      '通知配置已保存',
      refreshSession,
    )
    saving = false
  }

  // 测试推送:后端用表单当前值真实发一条消息,token 留空沿用已存配置
  async function testNotification() {
    const body = ntfyBody()
    if (!body.url || !body.topic) {
      showToast('服务器 URL 与 Topic 为必填项', 'err')
      return
    }
    testing = true
    await run(
      async () => {
        await api('/api/admin/notification/test', 'POST', body)
      },
      '测试推送已发送,请查收',
      async () => {},
    )
    testing = false
  }

  function clearNotification() {
    void run(
      async () => {
        await api('/api/admin/notification', 'DELETE')
        ntfyToken = ''
      },
      '已清除',
      refreshSession,
    )
  }

  // ---- 修改密码 ----
  // 后端改密即注销会话，成功后回落登录页重新认证
  function changePassword(currentPassword: string, newPassword: string) {
    void run(
      async () => {
        await api('/api/admin/password', 'PUT', {
          current_password: currentPassword,
          new_password: newPassword,
        })
      },
      '密码已更新，请重新登录',
      async () => {
        session = { authed: false, notification: null }
        removeCached('foyer_admin_session')
      },
    )
  }
</script>

<div class="page">
  <Header active="admin" label="控制台" siteTitle={config?.general?.title ?? 'foyer'} />

  {#if initError}
    <main class="main">
      <div class="alert">会话初始化失败:{initError}</div>
    </main>
  {:else if !session}
    <div class="empty boot">验证会话中...</div>
  {:else if !session.authed}
    <!-- 登录界面 -->
    <div class="login-wrap">
      <form class="login" onsubmit={login}>
        <div>
          <h2 class="page-title">管理认证</h2>
          <p class="page-sub">请输入管理员通行密码以解锁控制台</p>
        </div>

        <label class="field">
          <span class="field-label">通行密码</span>
          <input
            type="password"
            bind:value={password}
            bind:this={loginInput}
            placeholder="••••••••"
            aria-label="管理密码"
            autocomplete="current-password"
            class="input"
          />
        </label>

        {#if loginError}
          <div class="alert">{loginError}</div>
        {/if}

        <button type="submit" disabled={busy || !password} class="btn btn-primary wide">
          {busy ? '验证中...' : '解锁控制台'}
        </button>
      </form>
    </div>
  {:else}
    <!-- 管理主界面:侧边栏 + 主内容工作区 -->
    <div class="workspace">
      <aside class="side">
        <AdminSidebar {section} counts={{ groups: serviceGroups.length + bookmarkGroups.length, services: services.length, bookmarks: bookmarks.length }} />
      </aside>

      <main class="content">
        {#if section === 'settings'}
          <SiteSettingsPanel bind:siteTitle bind:siteDescription bind:telemetryPublic={siteTelemetryPublic} {saving} onsave={saveSettings} />

        {:else if section === 'groups'}
          <GroupsPanel {serviceGroups} {bookmarkGroups} onedit={editGroup} ondelete={deleteGroup} onadd={addGroup} />

        {:else if section === 'services'}
          <ServicesPanel
            {services}
            {monitoredCount}
            {groupName}
            onedit={(s) => openSvcForm(s)}
            ondelete={deleteService}
            onadd={() => openSvcForm(null)}
          />

        {:else if section === 'bookmarks'}
          <BookmarksPanel
            {bookmarks}
            {groupName}
            onedit={(b) => openBmForm(b)}
            ondelete={deleteBookmark}
            onadd={() => openBmForm(null)}
          />

        {:else if section === 'notify'}
          <NotifyPanel
            notification={session.notification}
            bind:ntfyUrl
            bind:ntfyTopic
            bind:ntfyToken
            {saving}
            {testing}
            onsave={saveNotification}
            onclear={clearNotification}
            ontest={testNotification}
          />

        {:else if section === 'security'}
          <SecurityPanel onchangepw={changePassword} onlogout={logout} />
        {/if}
      </main>
    </div>
  {/if}

  {#if svcForm}
    <ServiceModal form={svcForm} groups={serviceGroups} {saving} error={formError} onsubmit={saveService} onclose={closeModals} />
  {/if}

  {#if bmForm}
    <BookmarkModal form={bmForm} groups={bookmarkGroups} {saving} error={formError} onsubmit={saveBookmark} onclose={closeModals} />
  {/if}

  {#if groupEdit}
    <GroupModal form={groupEdit} {saving} error={formError} onsubmit={saveGroup} onclose={closeModals} />
  {/if}

  {#if toast}
    {#key toast.id}
      <Toast msg={toast.msg} kind={toast.kind} />
    {/key}
  {/if}
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
    color: var(--md-sys-color-on-surface-variant);
    background: var(--md-sys-color-surface);
  }

  .main {
    max-width: 48rem;
    margin: 0 auto;
    padding: 48px 20px;
    width: 100%;
  }

  .boot {
    padding: 96px 0;
    font-size: 14px;
    color: var(--md-sys-color-outline);
  }

  /* 登录界面 (M3 Auth Dialog / Card) */
  .login-wrap {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 64px 20px;
  }
  .login {
    width: 100%;
    max-width: 25rem;
    display: flex;
    flex-direction: column;
    gap: 22px;
    padding: 32px 28px;
    background: var(--md-sys-color-surface-container-high);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--md-sys-shape-corner-extra-large);
    box-shadow: var(--md-sys-elevation-level3);
  }
  .field {
    display: block;
  }
  .wide {
    width: 100%;
    min-height: 42px;
  }

  /* 管理主界面 (M3 Workspace) */
  .workspace {
    display: flex;
    flex-direction: column;
    flex: 1;
    width: 100%;
    max-width: 68rem;
    margin: 0 auto;
    padding: 28px 20px;
    gap: 28px;
  }
  @media (min-width: 768px) {
    .workspace {
      flex-direction: row;
      padding: 32px 24px;
      gap: 36px;
    }
  }

  .side {
    flex-shrink: 0;
  }
  @media (min-width: 768px) {
    .side {
      width: 13.5rem;
    }
  }

  .content {
    min-width: 0;
    flex: 1;
    padding-bottom: 64px;
  }
</style>
