import { component$ } from '@qwik.dev/core'
import type { Signal } from '@qwik.dev/core'
import type { PropFunction } from '~/lib/qrl-types'
import { PanelHead } from '~/components/panel-head/panel-head'
import styles from './site-settings-panel.module.css'

interface SiteSettingsPanelProps {
  siteTitle: Signal<string>
  siteDescription: Signal<string>
  telemetryPublic: Signal<boolean>
  saving: boolean
  onSave$: PropFunction<() => void>
}

export const SiteSettingsPanel = component$<SiteSettingsPanelProps>(
  ({ siteTitle, siteDescription, telemetryPublic, saving, onSave$ }) => {
    return (
      <div class={styles.wrap}>
        <PanelHead title="站点通用设置" sub="配置控制台主标题与一句话说明" />

        <form class={['card', styles.form].join(' ')} preventdefault:submit onSubmit$={() => onSave$()}>
          <label class={styles.field}>
            <span class="field-label">站点名称 *</span>
            <input bind:value={siteTitle} required maxLength={64} class="input" placeholder="例如:foyer" />
          </label>

          <label class={styles.field}>
            <span class="field-label">站点描述</span>
            <input bind:value={siteDescription} maxLength={200} placeholder="一句话说明" class="input" />
          </label>

          <label class={[styles.check, 'check'].join(' ')}>
            <input type="checkbox" bind:checked={telemetryPublic} />
            <span>
              <span class={styles.checkTitle}>公开主机遥测</span>
              <span class="field-hint">
                关闭后 /api/system（CPU/内存/磁盘/主机名/内核）仅管理会话可见，首页遥测卡对访客隐藏
              </span>
            </span>
          </label>

          <div class={styles.foot}>
            <button type="submit" disabled={saving || !siteTitle.value.trim()} class="btn btn-primary">
              {saving ? '保存中...' : '保存设置'}
            </button>
          </div>
        </form>
      </div>
    )
  },
)
