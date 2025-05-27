import type { GameMode, PlayerColor, GameResult, GameSettings } from '../../models/types/ChessTypes';

export interface IGameController {
   
    startGame(settings: GameSettings): void;
    resetGame(): void;
    handleCellClick(i: number, j: number): void;
    getCurrentTurn(): PlayerColor;
    getGameResult(): GameResult;
    
    readonly gameMode: GameMode;
    readonly playerColor: PlayerColor;
}