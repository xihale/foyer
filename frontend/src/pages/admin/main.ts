import '../../styles/tokens.css'
import '../../styles/base.css'
import '../../styles/ui.css'
import { mount } from 'svelte'
import Admin from './Admin.svelte'

export default mount(Admin, {
  target: document.getElementById('app')!,
})
