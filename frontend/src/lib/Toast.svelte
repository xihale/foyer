<script lang="ts">
  import { fly } from 'svelte/transition'

  interface Props {
    msg: string
    kind: 'ok' | 'err'
  }
  let { msg, kind }: Props = $props()
</script>

<!-- 右下角 toast:反馈始终在视线可及处 -->
<div
  class="toast"
  role={kind === 'err' ? 'alert' : 'status'}
  data-kind={kind}
  transition:fly={{ duration: 150, y: 8, opacity: 0 }}
>
  <span class="dot" data-state={kind === 'ok' ? 'up' : 'down'}></span>
  <span class="text">{msg}</span>
</div>

<style>
  .toast {
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 60;
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: min(24rem, calc(100vw - 40px));
    padding: 10px 16px;
    background: var(--md-sys-color-inverse-surface);
    border-radius: var(--md-sys-shape-corner-medium);
    box-shadow: var(--md-sys-elevation-level3);
    font-size: 13px;
    font-weight: 500;
    color: var(--md-sys-color-inverse-on-surface);
  }
  .toast[data-kind='ok'] {
    border-left: 3px solid var(--md-sys-color-success);
  }
  .toast[data-kind='err'] {
    border-left: 3px solid var(--md-sys-color-error);
  }

  .text {
    line-height: 1.4;
  }
</style>
