import { GameController } from './GameController';
import type { GameSettings, PlayerColor, GameResult } from '../models/types/ChessTypes';
import { HistoryView } from '../views/HistoryView';

export class UIController {
    private static readonly BOT_LEVELS = ['facil', 'medio', 'dificil'] as const;
    private static readonly PLAYER_COLORS = ['w', 'b'] as const;
    private gameInProgress = false;

    constructor(private readonly gameController: GameController) {}

    public initializeUI(): void {
        this.updateGameControls();
    }

    public async handleStartGame(): Promise<void> {
        try {
            const settings = this.getGameSettings();
            await this.gameController.startGame(settings);
            this.gameInProgress = true;
            this.updateGameControls();
        } catch (error) {
            this.showError('Falha ao iniciar o jogo');
            console.error('Start game error:', error);
        }
    }

    public async handleRestartGame(): Promise<void> {
        await this.gameController.resetGame();
        this.gameInProgress = false;
        this.updateGameControls();
    }

    private getGameSettings(): GameSettings {
        const botLevel = this.getValidatedSelectValue('bot-level', UIController.BOT_LEVELS);
        const playerColor = this.getValidatedSelectValue('player-color', UIController.PLAYER_COLORS);
        const dangerZonesEnabled = this.getDangerZonesToggleValue();
        
        return {
            mode: 'singleplayer',
            botLevel,
            playerColor,
            dangerZonesEnabled
        };
    }

    private getDangerZonesToggleValue(): boolean {
        const toggle = document.getElementById('danger-zones-toggle') as HTMLInputElement | null;
        return toggle ? toggle.checked : true; // Padrão: true (ativado)
    }

    private getValidatedSelectValue<T extends string>(
        elementId: string, 
        validValues: readonly T[]
    ): T {
        const element = document.getElementById(elementId) as HTMLSelectElement;
        const value = element.value as T;
        return validValues.includes(value) ? value : validValues[0];
    }

    public showError(message: string): void {
        console.error(message);
        alert(message);
    }

    public updateGameControls(): void {
        const startBtn = document.getElementById('start-game') as HTMLButtonElement | null;
        const restartBtn = document.getElementById('restart-game') as HTMLButtonElement | null;
        const dangerToggle = document.getElementById('danger-zones-toggle') as HTMLInputElement | null;

        if (startBtn) startBtn.style.display = this.gameInProgress ? 'none' : 'block';
        if (restartBtn) restartBtn.style.display = this.gameInProgress ? 'block' : 'none';
        
      
        if (dangerToggle) {
            dangerToggle.disabled = this.gameInProgress;
        }
    }

    public updateMoveHistory(): void {
        const moves = this.gameController._moveHistory.getMoves();
        const currentIndex = this.gameController._moveHistory.getCurrentIndex();
        HistoryView.update(moves, currentIndex);
    }

    public showGameResult(result: GameResult): void {
        const message = result === 'Empate' 
            ? 'O jogo terminou em empate!' 
            : `Vitória das ${result}!`;
        
        alert(message);
        this.gameInProgress = false;
        this.updateGameControls();
    }
}