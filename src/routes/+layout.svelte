<script lang="ts">
  import '../app.css';
  import '../chess-theme.css'; // Adicione esta linha
  
  let { children } = $props();
</script>

{@render children()}