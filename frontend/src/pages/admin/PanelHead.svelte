<script lang="ts">
  let { title, sub }: { title: string; sub: string } = $props()
</script>

<div>
  <h2 class="page-title">{title}</h2>
  <p class="page-sub">{sub}</p>
</div>
