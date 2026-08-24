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
    background: var(--md-sys-color-surface-container);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--md-sys-shape-corner-full);
    overflow: hidden;
    flex-shrink: 0;
  }

  .action-btn {
    border: none;
    background: transparent;
    padding: 3px 10px;
    min-height: 26px;
    font-size: 12px;
    font-weight: 500;
    color: var(--md-sys-color-on-surface-variant);
    cursor: pointer;
    outline: none;
    user-select: none;
    white-space: nowrap;
    transition: background-color var(--transition), color var(--transition);
  }
  .action-btn:hover {
    background: var(--md-sys-color-surface-container-high);
    color: var(--md-sys-color-on-surface);
  }
  .action-btn.danger:hover {
    background: var(--md-sys-color-error-container);
    color: var(--md-sys-color-on-error-container);
  }
  .action-btn.confirm {
    background: var(--md-sys-color-error);
    color: var(--md-sys-color-on-error);
    font-weight: 600;
  }
  .action-btn.confirm:hover {
    background: #f87171;
  }

  .sep {
    width: 1px;
    height: 12px;
    background: var(--md-sys-color-outline-variant);
    flex-shrink: 0;
  }
</style>
