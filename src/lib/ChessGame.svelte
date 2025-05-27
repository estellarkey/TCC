<script lang="ts">
    import { onMount } from "svelte";
    import { browser } from "$app/environment";

    let gameController: any;
    let uiController: any;

    onMount(async () => {
        if (browser) {
            const gameModule = await import(
                "$lib/ts/controllers/GameController"
            );
            const uiModule = await import("$lib/ts/controllers/UIController");

            gameController = new gameModule.GameController();
            uiController = new uiModule.UIController(gameController);
            uiController.initializeUI();

            if (uiController) {
                uiController.updateMoveHistory();
            }
        }
    });

    async function startGame() {
        await uiController.handleStartGame();
    }

    async function restartGame() {
        await uiController.handleRestartGame();
    }
</script>

<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link
    rel="stylesheet"
    href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
/>

<div class="chess-app" data-theme="chess-theme">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex flex-col items-center">
    
            <div class="game-title-container">
                <h1 class="game-title">TIME TRAP CHESS</h1>
                <div class="title-decoration"></div>
            </div>

            <div class="flex flex-col lg:flex-row w-full gap-6">
           
                <div class="w-full lg:w-1/4 order-first">
                    <div class="rules-panel-left wooden-panel">
                        <div class="panel-header">
                            <i class="fas fa-info-circle"></i> Regras do Jogo
                        </div>
                        <div class="panel-content">
                            <div class="rule-item">
                                <div class="rule-icon">
                                    <i class="fas fa-exclamation-triangle"></i>
                                </div>
                                <div class="rule-text">
                                    <h4>Zona de Perigo</h4>
                                    <p>
                                        Toda peça (incluindo seu rei) que permanecer
                                        mais de 15 segundos na zona de perigo será
                                        eliminada. O rei do bot é imune a esta regra.
                                    </p>
                                </div>
                            </div>
                            <div class="rule-item">
                                <div class="rule-icon">
                                    <i class="fas fa-chess-king"></i>
                                </div>
                                <div class="rule-text">
                                    <h4>Objetivo do Jogo</h4>
                                    <p>
                                        Derrube o rei adversário enquanto protege o seu.
                                        Movimentos estratégicos são essenciais para
                                        evitar a zona de perigo.
                                    </p>
                                </div>
                            </div>
                            <div class="rule-item">
                                <div class="rule-icon">
                                    <i class="fas fa-clock"></i>
                                </div>
                                <div class="rule-text">
                                    <h4>Tempo de Movimento</h4>
                                    <p>
                                        Você tem até 15 segundos para tirar a sua peça
                                        da zona. Movimentos rápidos evitam riscos na
                                        zona de perigo.
                                    </p>
                                </div>
                            </div>
                            <div class="rule-item">
                                <div class="rule-icon">
                                    <i class="fas fa-chess-board"></i>
                                </div>
                                <div class="rule-text">
                                    <h4>Dicas Estratégicas</h4>
                                    <p>
                                        Mantenha suas peças em movimento constante para
                                        não ficarem presas na zona de perigo.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="flex-1 flex flex-col items-center bg">
                    <div class="moves-container w-full max-w-2xl mb-4">
                        <div class="moves-scroll-wrapper">
                            <div id="moves-list" class="moves-list-horizontal"></div>
                        </div>
                    </div>

                    <div class="board-with-coordinates flex">
                        <div class="vertical-coordinates">
                            {#each Array.from({ length: 8 }, (_, i) => 8 - i) as number}
                                <div>{number}</div>
                            {/each}
                        </div>

                        <div class="board-wrapper">
                            <div id="tabuleiro-container"></div>
                        </div>
                    </div>

                    <div class="horizontal-coordinates mt-2">
                        {#each ["a", "b", "c", "d", "e", "f", "g", "h"] as letter}
                            <div>{letter}</div>
                        {/each}
                    </div>
                </div>

                <div class="w-full lg:w-1/4">
                    <div class="chess-controls">
                        <div class="control-group">
                            <label for="bot-level">
                                <i class="fas fa-robot mr-2"></i> Nível
                            </label>
                            <select id="bot-level">
                                <option value="facil">Fácil</option>
                                <option value="medio">Médio</option>
                                <option value="dificil">Difícil</option>
                            </select>
                        </div>

                        <div class="control-group">
                            <label for="player-color">
                                <i class="fas fa-chess mr-2"></i> Jogar como
                            </label>
                            <select id="player-color">
                                <option value="w">Brancas</option>
                                <option value="b">Pretas</option>
                            </select>
                            
                            <label for="danger-zones-toggle">
                                <i class="fas fa-exclamation-triangle mr-2"></i> Zonas de Perigo
                            </label>
                            <div class="toggle-switch">
                                <input type="checkbox" id="danger-zones-toggle" checked />
                                <label for="danger-zones-toggle"></label>
                            </div>
                        </div>

                        <div class="action-buttons">
                            <button id="start-game" class="chess-btn" on:click={startGame}>
                                <i class="fas fa-play mr-2"></i> Iniciar
                            </button>
                            <button id="restart-game" class="chess-btn" on:click={restartGame}>
                                <i class="fas fa-redo mr-2"></i> Reiniciar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>