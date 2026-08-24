<script lang="ts">
  import { fly } from 'svelte/transition'

  interface Props {
    msg: string
    kind: 'ok' | 'err'
  }
  let { msg, kind }: Props = $props()
</script>

<div
  class="toast mono"
  role={kind === 'err' ? 'alert' : 'status'}
  data-kind={kind}
  transition:fly={{ duration: 120, y: 6, opacity: 0 }}
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
    gap: 8px;
    max-width: min(24rem, calc(100vw - 40px));
    padding: 8px 14px;
    background: var(--color-text-primary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xs);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    font-size: 12px;
    font-weight: 500;
    color: var(--color-surface);
  }
  .toast[data-kind='ok'] {
    border-left: 3px solid var(--color-success);
  }
  .toast[data-kind='err'] {
    border-left: 3px solid var(--color-error);
  }

  .text {
    line-height: 1.4;
  }
</style>

