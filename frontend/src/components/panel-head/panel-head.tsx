import { component$ } from '@qwik.dev/core'

interface PanelHeadProps {
  title: string
  sub: string
}

export const PanelHead = component$<PanelHeadProps>(({ title, sub }) => {
  return (
    <div>
      <h2 class="page-title">{title}</h2>
      <p class="page-sub">{sub}</p>
    </div>
  )
})
