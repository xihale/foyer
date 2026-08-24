<script lang="ts">
  interface Props {
    onedit: () => void
    ondelete: () => void
  }
  let { onedit, ondelete }: Props = $props()

  // 两步删除:第一次点击进入确认态(3s 未确认自动复位),再次点击执行——替代原生 confirm()
  let armed = $state(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  $effect(() => () => clearTimeout(timer))

  function clickDelete() {
    if (armed) {
      armed = false
      clearTimeout(timer)
      ondelete()
    } else {
      armed = true
      clearTimeout(timer)
      timer = setTimeout(() => (armed = false), 3000)
    }
  }
</script>

<div class="action-group">
  <button type="button" class="action-btn" onclick={onedit}>编辑</button>
  <span class="sep" aria-hidden="true"></span>
  {#if armed}
    <button type="button" class="action-btn confirm" onclick={clickDelete}>确认删除</button>
  {:else}
    <button type="button" class="action-btn danger" onclick={clickDelete}>删除</button>
  {/if}
</div>

<style>
  .action-group {
    display: inline-flex;
    align-items: center;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xs);
    overflow: hidden;
    flex-shrink: 0;
  }

  .action-btn {
    border: none;
    background: transparent;
    padding: 3px 8px;
    min-height: 24px;
    font-size: 11.5px;
    font-weight: 500;
    color: var(--color-text-secondary);
    cursor: pointer;
    outline: none;
    user-select: none;
    white-space: nowrap;
    transition: background-color var(--transition), color var(--transition);
  }
  .action-btn:hover {
    background: var(--color-surface-hover);
    color: var(--color-text-primary);
  }
  .action-btn.danger:hover {
    background: var(--color-error-bg);
    color: var(--color-error-text);
  }
  .action-btn.confirm {
    background: var(--color-error);
    color: #ffffff;
    font-weight: 600;
  }
  .action-btn.confirm:hover {
    background: #b91c1c;
  }

  .sep {
    width: 1px;
    height: 12px;
    background: var(--color-border);
    flex-shrink: 0;
  }
</style>

