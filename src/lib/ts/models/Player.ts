import type { PlayerColor } from './types/ChessTypes';

export class Player {
    constructor(
        public color: PlayerColor,
        public isHuman: boolean = true,
        public isLocal: boolean = true
    ) {}
}   