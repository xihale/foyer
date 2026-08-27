import { component$ } from '@qwik.dev/core'
import type { PropFunction } from '~/lib/qrl-types'
import { IconImage } from '~/components/icon-image/icon-image'
import { PanelHead } from '~/components/panel-head/panel-head'
import { RowActions } from '~/components/row-actions/row-actions'
import type { Service } from '~/lib/types'
import styles from './services-panel.module.css'

interface ServicesPanelProps {
  services: Service[]
  monitoredCount: number
  groupNames: Record<number, string>
  onEdit$: PropFunction<(s: Service) => void>
  onDelete$: PropFunction<(s: Service) => void>
  onAdd$: PropFunction<() => void>
}

export const ServicesPanel = component$<ServicesPanelProps>(
  ({ services, monitoredCount, groupNames, onEdit$, onDelete$, onAdd$ }) => {
    return (
      <div class={styles.wrap}>
        <div class={styles.head}>
          <PanelHead
            title="服务节点"
            sub={`已收录 ${services.length} 个 · ${monitoredCount} 个开启探活`}
          />
          <button type="button" class="btn btn-primary shrink" onClick$={() => onAdd$()}>
            + 新增服务
          </button>
        </div>

        <div class="list">
          {services.length === 0 ? (
            <div class="empty">暂无服务节点,点击右上角「+ 新增服务」创建</div>
          ) : (
            services.map((s) => (
              <div class="list-row" key={s.id}>
                {s.icon ? (
                  <IconImage src={s.icon} class={['list-icon', styles.listIcon].join(' ')} />
                ) : (
                  <div class={['list-icon', 'fallback', 'mono'].join(' ')}>
                    {s.name.slice(0, 1).toUpperCase()}
                  </div>
                )}

                <div class="list-info">
                  <div class="list-line">
                    <span class="list-name">{s.name}</span>
                    <span class="badge">{groupNames[s.group_id] ?? `#` + s.group_id}</span>
                    {s.monitor_enabled ? (
                      <span class={['mono', styles.watch].join(' ')}>{s.monitor_interval_s}s 探活</span>
                    ) : null}
                  </div>
                  {s.href || s.description ? (
                    <p class="list-sub">{s.description || s.href}</p>
                  ) : null}
                </div>

                <RowActions onEdit$={() => onEdit$(s)} onDelete$={() => onDelete$(s)} />
              </div>
            ))
          )}
        </div>
      </div>
    )
  },
)
