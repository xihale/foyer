import { component$ } from '@qwik.dev/core'
import type { Signal } from '@qwik.dev/core'
import type { PropFunction } from '~/lib/qrl-types'
import { PanelHead } from '~/components/panel-head/panel-head'
import styles from './site-settings-panel.module.css'

interface SiteSettingsPanelProps {
  siteTitle: Signal<string>
  siteDescription: Signal<string>
  saving: boolean
  onSave$: PropFunction<() => void>
}

export const SiteSettingsPanel = component$<SiteSettingsPanelProps>(
  ({ siteTitle, siteDescription, saving, onSave$ }) => {
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
