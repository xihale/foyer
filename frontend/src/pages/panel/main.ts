import '../../styles/tokens.css'
import '../../styles/base.css'
import '../../styles/ui.css'
import { mount } from 'svelte'
import Panel from './Panel.svelte'

export default mount(Panel, {
  target: document.getElementById('app')!,
})
