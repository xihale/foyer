import '../../styles/tokens.css'
import '../../styles/base.css'
import '../../styles/ui.css'
import { mount } from 'svelte'
import Status from './Status.svelte'

export default mount(Status, {
  target: document.getElementById('app')!,
})
