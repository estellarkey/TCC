import type { MovePair } from './types/ChessTypes';

export class MoveHistory {
    private moves: MovePair[] = [];
    private currentIndex: number = -1;

    public async addMove(move: string, isWhiteMove: boolean): Promise<void> {
        return new Promise((resolve) => {
            if (isWhiteMove) {
                this.moves.push({ white: move, black: '' });
                this.currentIndex = this.moves.length - 1;
            } else {
                if (this.moves.length === 0) {
                    this.moves.push({ white: '', black: move });
                } else {
                    this.moves[this.currentIndex].black = move;
                }
            }
            resolve();
        });
    }

    public async sync(moves: MovePair[]): Promise<void> {
        return new Promise((resolve) => {
            this.moves = [...moves];
            this.currentIndex = moves.length - 1;
            resolve();
        });
    }

   
    public getMoves(): MovePair[] {
        return [...this.moves];
    }

    public getCurrentIndex(): number {
        return this.currentIndex;
    }

    public async clear(): Promise<void> {
        return new Promise((resolve) => {
            this.moves = [];
            this.currentIndex = -1;
            resolve();
        });
    }

    // Novo método para adição em batch
    public async addMoves(moves: {move: string, isWhiteMove: boolean}[]): Promise<void> {
        for (const {move, isWhiteMove} of moves) {
            await this.addMove(move, isWhiteMove);
        }
    }
}