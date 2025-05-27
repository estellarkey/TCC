<script lang="ts">
  import { onMount } from 'svelte';
  import { Chess3DGame } from '$lib/ts/models/Game3d';
  import * as THREE from 'three';
  
  let loadingProgress = 0;
  let isLoading = true;
  let loadingError = false;
  let game: Chess3DGame;
  
  onMount(() => {
    const originalLoader = THREE.DefaultLoadingManager.onProgress;
    
    // Override the THREE.js loading manager to track progress
    THREE.DefaultLoadingManager.onProgress = (url, loaded, total) => {
      if (originalLoader) originalLoader(url, loaded, total);
      loadingProgress = Math.round((loaded / total) * 100);
      if (url.includes('Chessboard.glb') && loaded === total) {
        setTimeout(() => { isLoading = false }, 500);
      }
    };
    
    THREE.DefaultLoadingManager.onError = (url) => {
      if (url.includes('Chessboard.glb')) {
        loadingError = true;
        setTimeout(() => { isLoading = false }, 2000);
      }
    };
    
    // Initialize game after setting up loading handlers
    game = new Chess3DGame();
    
    return () => {
      if (game) game.dispose();
      THREE.DefaultLoadingManager.onProgress = originalLoader;
    };
  });
</script>

<div id="chess3d-container" class="container">
  {#if isLoading}
    <div class="loading-overlay">
      <h2>Carregando tabuleiro de xadrez</h2>
      <div class="progress-bar">
        <div class="progress-fill" style="width: {loadingProgress}%"></div>
      </div>
      <p>{loadingProgress}% carregado</p>
      {#if loadingError}
        <p class="error">Erro ao carregar o modelo. Tentando alternativa...</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .container {
    position: relative;
    width: 100%;
    height: 100vh;
  }
  
  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background-color: rgba(0, 0, 0, 0.8);
    color: white;
    z-index: 1000;
    font-family: Arial, sans-serif;
  }
  
  .progress-bar {
    width: 300px;
    height: 20px;
    background-color: #444;
    border-radius: 10px;
    margin: 20px 0;
    overflow: hidden;
  }
  
  .progress-fill {
    height: 100%;
    background-color: #3498db;
    transition: width 0.3s ease;
  }
  
  .error {
    color: #ff6666;
    margin-top: 10px;
  }
</style>
