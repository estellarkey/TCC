export type GameMode = 'singleplayer';
export type PlayerColor = 'w' | 'b';
export type GameResult = 'Brancas' | 'Pretas' | 'Empate' | false;
export type PieceType = 'k' | 'q' | 'r' | 'b' | 'n' | 'p' | 'k_e';


export type DangerZone = {
    position: CellPosition;
    timestamp: number;
    active: boolean;

};
export interface CellPosition {
    i: number;
    j: number;
}

export interface MovePair {
    white: string;
    black: string;
}

export interface PieceData {
    type?: PieceType;
    id: number;
    color: PlayerColor;

}

export interface GameSettings {
    mode: GameMode;
    botLevel?: 'facil' | 'medio' | 'dificil';
    playerColor?: PlayerColor;
    roomId?: string;
    dangerZonesEnabled?: boolean;
}

export interface EvaluatedMove {
    move: any;
    score: number;
    depth?: number;
}

export interface SearchResult {
    bestMove: any;
    score: number;
}