import type { CellPosition } from '$lib/ts/models/types/ChessTypes';
import type { Chess, Color, Move } from 'chess.js';
import { Game } from '../../../models/Game';

export class BotService {
    private nivel: 'facil' | 'medio' | 'dificil';
    private cor: 'w' | 'b';
    private isProcessing = false;
    private recentMoves: { from: string, to: string }[] = [];

    private readonly pieceValues = { p: 100, n: 280, b: 320, r: 479, q: 929, k: 60000, k_e: 60000 };
    private readonly centerSquares = new Set(['d4', 'e4', 'd5', 'e5']);
    private readonly developmentSquares = new Set(['c3', 'd3', 'e3', 'f3', 'c6', 'd6', 'e6', 'f6']);
    private readonly maxRecentMoves = 4;
    private readonly pst_w: Record<'p' | 'n' | 'b' | 'r' | 'q' | 'k' | 'k_e', number[][]> = this.createPSTTables();
    private readonly pst_b: Record<'p' | 'n' | 'b' | 'r' | 'q' | 'k' | 'k_e', number[][]> = this.createOpponentPSTTables();
    private readonly pstOpponent: Record<'w' | 'b', Record<'p' | 'n' | 'b' | 'r' | 'q' | 'k' | 'k_e', number[][]>> = { 'w': this.pst_b, 'b': this.pst_w };
    private readonly pstSelf: Record<'w' | 'b', Record<'p' | 'n' | 'b' | 'r' | 'q' | 'k' | 'k_e', number[][]>> = { 'w': this.pst_w, 'b': this.pst_b };

    constructor(
        private game: Game,
        nivel: 'facil' | 'medio' | 'dificil' = 'facil',
        cor: 'w' | 'b' = 'b'
    ) {
        this.nivel = nivel;
        this.cor = cor;
    }


    public deveJogar(): boolean {
        return this.game.getCurrentTurn() === this.cor && !this.isProcessing;
    }

    public async fazerMovimento(): Promise<{ from: string, to: string, promotion?: string } | null> {
        if (!this.deveJogar()) return null;
        this.isProcessing = true;

        try {
            await this.delay(this.calculateDelay());
            const move = await this.selectMoveByLevel();
            if (move) this.updateRecentMoves(move);
            return move;
        } catch (error) {
            console.error('Erro no BotService:', error);
            return null;
        } finally {
            this.isProcessing = false;
        }
    }

    private async selectMoveByLevel(): Promise<{ from: string, to: string, promotion?: string } | null> {

        const mateMove = this.findCheckmateMove();
        if (mateMove) return mateMove;


        const valuableCapture = this.getValidMoves()
            .filter(m => m.captured &&
                typeof m.captured === 'string' &&
                m.captured in this.pieceValues &&
                this.pieceValues[m.captured as keyof typeof this.pieceValues] >= this.pieceValues.r)
            .sort((a, b) => this.pieceValues[b.captured as keyof typeof this.pieceValues] -
                this.pieceValues[a.captured as keyof typeof this.pieceValues])[0];

        if (valuableCapture) {
            const toPos = this.game.squareToCoords(valuableCapture.to);
            if (!this.game.isSquareDangerous(toPos.i, toPos.j)) {
                return valuableCapture;
            }
        }


        const kingDefenseMove = this.getKingDefenseMove();
        if (kingDefenseMove) return kingDefenseMove;


        const safeCapture = this.findSafeCapture();
        if (safeCapture) return safeCapture;


        const pieceRescueMove = this.findPieceRescueMove();
        if (pieceRescueMove) return pieceRescueMove;


        switch (this.nivel) {
            case 'facil': return this.fazerMovimentoFacil();
            case 'medio': return this.fazerMovimentoMedio();
            case 'dificil': return this.fazerMovimentoDificil();
            default: return this.fazerMovimentoFacil();
        }
    }

    private findCheckmateMove(): { from: string, to: string, promotion?: string } | null {
        const moves = this.getValidMoves();
        return moves.find(move => this.isCheckmateMove(move)) || null;
    }

    private findSafeCapture(): { from: string, to: string, promotion?: string } | null {
        const moves = this.getValidMoves()
            .filter(m => m.captured)
            .sort((a, b) => {
                const pieceKeys = Object.keys(this.pieceValues) as Array<keyof typeof this.pieceValues>;
                const bValue = pieceKeys.includes(b.captured) ? this.pieceValues[b.captured as keyof typeof this.pieceValues] : 0;
                const aValue = pieceKeys.includes(a.captured) ? this.pieceValues[a.captured as keyof typeof this.pieceValues] : 0;


                const bBonus = bValue >= this.pieceValues.q ? 500 : 0;
                const aBonus = aValue >= this.pieceValues.q ? 500 : 0;

                return (bValue + bBonus) - (aValue + aBonus);
            });

        for (const move of moves) {
            const toPos = this.game.squareToCoords(move.to);
            const isValuableCapture = typeof move.captured === 'string' &&
                move.captured in this.pieceValues &&
                typeof move.piece === 'string' &&
                move.piece in this.pieceValues &&
                this.pieceValues[move.captured as keyof typeof this.pieceValues] >=
                this.pieceValues[move.piece as keyof typeof this.pieceValues] * 1.5;

          
            if (move.captured === 'q' || isValuableCapture) {
                return move;
            }

           
            if (!this.game.isSquareDangerous(toPos.i, toPos.j) ||
                this.game.isSquareDefended(toPos.i, toPos.j, this.cor)) {
                return move;
            }
        }
        return null;
    }

    private getKingDefenseMove(): { from: string, to: string } | null {
        const kingPos = this.findKingPosition();
        if (!kingPos) return null;

        if (this.game.isSquareDangerous(kingPos.i, kingPos.j)) {
            const kingMoves = this.getValidMoves()
                .filter(move => this.isKingMove(move, kingPos))
                .filter(move => !this.isSquareDangerousAfterMove(move));

            if (kingMoves.length > 0) {
                return this.sortKingMoves(kingMoves)[0];
            }
            return this.findBlockOrCaptureMove(kingPos);
        }

        if (this.isEndGame()) {
            const kingMoves = this.getValidMoves()
                .filter(move => this.isKingMove(move, kingPos))
                .sort((a, b) => this.getMoveSafety(b) - this.getMoveSafety(a));

            return kingMoves[0] || null;
        }
        return null;
    }

    private findPieceRescueMove(): { from: string, to: string } | null {
    const threatenedPieces = this.findThreatenedPieces();
    
    const threatenedQueen = threatenedPieces.find(p => p.piece.type === 'q');
    if (threatenedQueen) {
        const rescueMove = this.findSafeMoveForPiece(threatenedQueen.position);
        if (rescueMove) return rescueMove;
    }

 
    const worthRescuing = threatenedPieces.filter(({ piece }) => {
        const pieceValue = this.pieceValues[piece.type as keyof typeof this.pieceValues];
        const hasBetterCapture = this.getValidMoves()
            .filter(m => m.captured)
            .some(m => this.pieceValues[m.captured as keyof typeof this.pieceValues] > pieceValue * 1.5);

        return !hasBetterCapture && pieceValue >= this.pieceValues.p * 1.5;
    });

    return worthRescuing
        .sort((a, b) => {
            const bValue = this.pieceValues[b.piece.type as keyof typeof this.pieceValues];
            const aValue = this.pieceValues[a.piece.type as keyof typeof this.pieceValues];
            return bValue - aValue;
        })
        .map(({ position }) => this.findSafeMoveForPiece(position))
        .find(move => move !== null) || null;
}

    private fazerMovimentoFacil(): any {
        const moves = this.getValidMoves();
        const goodMoves = moves.filter(move => move.captured || this.moveGivesCheck(move));
        return goodMoves.length > 0
            ? goodMoves[Math.floor(Math.random() * goodMoves.length)]
            : moves[Math.floor(Math.random() * moves.length)];
    }

    private fazerMovimentoMedio(): any {
        const moves = this.getValidMoves()
            .map(move => ({ move, score: this.avaliarMovimentoMedio(move) }))
            .sort((a, b) => b.score - a.score);

        const topMoves = moves.slice(0, 3);
        return topMoves[Math.floor(Math.random() * topMoves.length)].move;
    }

    private async fazerMovimentoDificil(): Promise<{ from: string, to: string, promotion?: string } | null> {
        const depth = this.isEndGame() ? 4 : 3;
        const { move } = this.minimax(this.game.chessInstance, depth, -Infinity, Infinity, true, 0, this.cor);

        return move ? { from: move.from, to: move.to, promotion: move.promotion } : this.fazerMovimentoMedio();
    }


    private minimax(game: Chess, depth: number, alpha: number, beta: number, isMaximizing: boolean, sum: number, color: Color): { move: Move | null, value: number } {
        const children = game.moves({ verbose: true }).sort(() => Math.random() - 0.5);

        if (depth === 0 || children.length === 0) {
            return { move: null, value: sum };
        }

        let bestMove = null;
        let bestValue = isMaximizing ? -Infinity : Infinity;

        for (const child of children) {
            const currMove = game.move(child);
            if (!currMove) continue;

            const newSum = this.evaluateMove(currMove, sum, color);
            const { value } = this.minimax(game, depth - 1, alpha, beta, !isMaximizing, newSum, color);
            game.undo();

            if (isMaximizing ? value > bestValue : value < bestValue) {
                bestValue = value;
                bestMove = currMove;
            }

            if (isMaximizing) {
                alpha = Math.max(alpha, bestValue);
            } else {
                beta = Math.min(beta, bestValue);
            }

            if (alpha >= beta) break;
        }

        return { move: bestMove, value: bestValue };
    }

    private evaluateMove(move: Move, prevSum: number, color: Color): number {
        const from = this.getBoardPosition(move.from);
        const to = this.getBoardPosition(move.to);
        const pieceType = this.isEndGame() && move.piece === 'k' ? 'k_e' : move.piece;

        if (move.captured) {
            const capturedValue = this.pieceValues[move.captured] + this.getPSTValue(move.captured, to, move.color !== color);
            prevSum += move.color === color ? capturedValue : -capturedValue;
        }

        if (move.flags.includes('p')) {
            move.promotion = 'q';
            const pieceValue = this.pieceValues[pieceType] + this.getPSTValue(pieceType, from, move.color === color);
            const promoValue = this.pieceValues[move.promotion] + this.getPSTValue(move.promotion, to, move.color === color);
            prevSum += move.color === color ? (promoValue - pieceValue) : (pieceValue - promoValue);
        } else {
            const pstDiff = this.getPSTValue(pieceType, to, move.color === color) -
                this.getPSTValue(pieceType, from, move.color === color);
            prevSum += move.color === color ? pstDiff : -pstDiff;
        }

        // Bônus posicionais
        if (this.isMidGame()) {
            if (this.centerSquares.has(move.to)) prevSum += move.color === color ? 20 : -20;
            if (this.developmentSquares.has(move.to)) prevSum += move.color === color ? 15 : -15;
        }
        if (move.san.includes('+')) prevSum += move.color === color ? 10 : -10;

        return prevSum;
    }

    private avaliarMovimentoMedio(move: any): number {
        const toPos = this.game.squareToCoords(move.to);
        let score = 0;

        if (typeof move.captured === 'string' && move.captured in this.pieceValues) {
            score += this.pieceValues[move.captured as keyof typeof this.pieceValues] * 10;
        }
        if (this.game.isSquareDangerous(toPos.i, toPos.j)) score -= this.pieceValues[move.piece as keyof typeof this.pieceValues] * 5;
        if (this.game.isSquareDefended(toPos.i, toPos.j, this.cor)) score += this.pieceValues[move.piece as keyof typeof this.pieceValues] * 2;
        if (this.centerSquares.has(move.to)) score += 3;
        if (this.isEarlyGame() && this.developmentSquares.has(move.to)) score += 2;
        if (this.moveGivesCheck(move)) score += 5;

        return score;
    }


    private createPSTTables() {
        return {
            'p': [[100, 100, 100, 100, 105, 100, 100, 100],
            [78, 83, 86, 73, 102, 82, 85, 90],
            [7, 29, 21, 44, 40, 31, 44, 7],
            [-17, 16, -2, 15, 14, 0, 15, -13],
            [-26, 3, 10, 9, 6, 1, 0, -23],
            [-22, 9, 5, -11, -10, -2, 3, -19],
            [-31, 8, -7, -37, -36, -14, 3, -31],
            [0, 0, 0, 0, 0, 0, 0, 0]
            ],
            'n': [[-66, -53, -75, -75, -10, -55, -58, -70],
            [-3, -6, 100, -36, 4, 62, -4, -14],
            [10, 67, 1, 74, 73, 27, 62, -2],
            [24, 24, 45, 37, 33, 41, 25, 17],
            [-1, 5, 31, 21, 22, 35, 2, 0],
            [-18, 10, 13, 22, 18, 15, 11, -14],
            [-23, -15, 2, 0, 2, 0, -23, -20],
            [-74, -23, -26, -24, -19, -35, -22, -69]
            ],
            'b': [[-59, -78, -82, -76, -23, -107, -37, -50],
            [-11, 20, 35, -42, -39, 31, 2, -22],
            [-9, 39, -32, 41, 52, -10, 28, -14],
            [25, 17, 20, 34, 26, 25, 15, 10],
            [13, 10, 17, 23, 17, 16, 0, 7],
            [14, 25, 24, 15, 8, 25, 20, 15],
            [19, 20, 11, 6, 7, 6, 20, 16],
            [-7, 2, -15, -12, -14, -15, -10, -10]
            ],
            'r': [[35, 29, 33, 4, 37, 33, 56, 50],
            [55, 29, 56, 67, 55, 62, 34, 60],
            [19, 35, 28, 33, 45, 27, 25, 15],
            [0, 5, 16, 13, 18, -4, -9, -6],
            [-28, -35, -16, -21, -13, -29, -46, -30],
            [-42, -28, -42, -25, -25, -35, -26, -46],
            [-53, -38, -31, -26, -29, -43, -44, -53],
            [-30, -24, -18, 5, -2, -18, -31, -32]
            ],
            'q': [[6, 1, -8, -104, 69, 24, 88, 26],
            [14, 32, 60, -10, 20, 76, 57, 24],
            [-2, 43, 32, 60, 72, 63, 43, 2],
            [1, -16, 22, 17, 25, 20, -13, -6],
            [-14, -15, -2, -5, -1, -10, -20, -22],
            [-30, -6, -13, -11, -16, -11, -16, -27],
            [-36, -18, 0, -19, -15, -15, -21, -38],
            [-39, -30, -31, -13, -31, -36, -34, -42]
            ],
            'k': [[4, 54, 47, -99, -99, 60, 83, -62],
            [-32, 10, 55, 56, 56, 55, 10, 3],
            [-62, 12, -57, 44, -67, 28, 37, -31],
            [-55, 50, 11, -4, -19, 13, 0, -49],
            [-55, -43, -52, -28, -51, -47, -8, -50],
            [-47, -42, -43, -79, -64, -32, -29, -32],
            [-4, 3, -14, -50, -57, -18, 13, 4],
            [17, 30, -3, -14, 6, -1, 40, 18]
            ],
    
            'k_e': [[-50, -40, -30, -20, -20, -30, -40, -50],
            [-30, -20, -10, 0, 0, -10, -20, -30],
            [-30, -10, 20, 30, 30, 20, -10, -30],
            [-30, -10, 30, 40, 40, 30, -10, -30],
            [-30, -10, 30, 40, 40, 30, -10, -30],
            [-30, -10, 20, 30, 30, 20, -10, -30],
            [-30, -30, 0, 0, 0, 0, -30, -30],
            [-50, -30, -30, -30, -30, -30, -30, -50]
            ]
        };
    }

    private createOpponentPSTTables() {
        const pst_w = this.pst_w;
        return {
            'p': pst_w['p'].slice().reverse(),
            'n': pst_w['n'].slice().reverse(),
            'b': pst_w['b'].slice().reverse(),
            'r': pst_w['r'].slice().reverse(),
            'q': pst_w['q'].slice().reverse(),
            'k': pst_w['k'].slice().reverse(),
            'k_e': pst_w['k_e'].slice().reverse()
        };
    }

    private getPSTValue(piece: string, pos: number[], isSelf: boolean): number {
        const table = isSelf ? this.pstSelf : this.pstOpponent;
        const color = this.cor;
        return table[color][piece as 'p' | 'n' | 'b' | 'r' | 'q' | 'k' | 'k_e'][pos[0]][pos[1]] || 0;
    }

    private getBoardPosition(square: string): number[] {
        return [8 - parseInt(square[1]), square.charCodeAt(0) - 'a'.charCodeAt(0)];
    }

    private updateRecentMoves(move: { from: string, to: string }): void {
        this.recentMoves.unshift(move);
        if (this.recentMoves.length > this.maxRecentMoves) this.recentMoves.pop();
    }

    private getValidMoves(): any[] {
        const validMoves: any[] = [];
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const piece = this.game.getPiece(i, j);
                if (piece?.color === this.cor) {
                    const from = this.game.coordsToSquare(i, j);
                    this.game.getValidMoves(i, j).forEach(target => {
                        const to = this.game.coordsToSquare(target.i, target.j);
                        validMoves.push({
                            from,
                            to,
                            piece: piece.type,
                            captured: this.getCapturedPiece(target.i, target.j)
                        });
                    });
                }
            }
        }
        return validMoves;
    }

    private getCapturedPiece(i: number, j: number): string | null {
        const piece = this.game.getPiece(i, j);
        return piece?.color !== this.cor ? piece?.type || null : null;
    }

    private moveGivesCheck(move: any): boolean {
        const tempGame = new Game();
        tempGame.chessInstance.load(this.game.chessInstance.fen());
        return tempGame.chessInstance.move({ ...move, promotion: 'q' })?.san.includes('+') || false;
    }

    private isCheckmateMove(move: any): boolean {
        const tempGame = new Game();
        tempGame.chessInstance.load(this.game.chessInstance.fen());
        return tempGame.chessInstance.move({ ...move, promotion: 'q' }) && tempGame.chessInstance.isCheckmate();
    }

    private findKingPosition(): CellPosition | null {
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const piece = this.game.getPiece(i, j);
                if (piece?.type === 'k' && piece.color === this.cor) return { i, j };
            }
        }
        return null;
    }

    private findThreatenedPieces(): { position: CellPosition, piece: any }[] {
        const threatened = [];
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const piece = this.game.getPiece(i, j);
                if (piece?.color === this.cor && this.game.isSquareDangerous(i, j)) {
                    threatened.push({ position: { i, j }, piece });
                }
            }
        }
        return threatened.sort((a, b) => {
            const aType = a.piece?.type;
            const bType = b.piece?.type;
            const aValue = aType && aType in this.pieceValues ? this.pieceValues[aType as keyof typeof this.pieceValues] : 0;
            const bValue = bType && bType in this.pieceValues ? this.pieceValues[bType as keyof typeof this.pieceValues] : 0;
            return bValue - aValue;
        });
    }

    private findSafeMoveForPiece(pos: CellPosition): { from: string, to: string } | null {
        const safeMoves = this.getValidMoves()
            .filter(move => {
                const fromPos = this.game.squareToCoords(move.from);
                if (fromPos.i !== pos.i || fromPos.j !== pos.j) return false;
                const toPos = this.game.squareToCoords(move.to);
                return !this.game.isSquareDangerous(toPos.i, toPos.j);
            })
            .sort((a, b) => this.getMoveSafety(b) - this.getMoveSafety(a));

        return safeMoves[0] || this.findDefenderMoves(pos);
    }

    private findDefenderMoves(pos: CellPosition): { from: string, to: string } | null {
        const defenders = this.getValidMoves()
            .filter(move => {
                const toPos = this.game.squareToCoords(move.to);
                return toPos.i === pos.i && toPos.j === pos.j;
            })
            .sort(
                (a, b) =>
                    this.pieceValues[a.piece as keyof typeof this.pieceValues] -
                    this.pieceValues[b.piece as keyof typeof this.pieceValues]
            );

        return defenders[0] || null;
    }

    private findBlockOrCaptureMove(kingPos: CellPosition): { from: string, to: string } | null {
        const attackers = this.findAttackers(kingPos);
        for (const attacker of attackers) {
            const captureMoves = this.getValidMoves()
                .filter(move => {
                    const toPos = this.game.squareToCoords(move.to);
                    return toPos.i === attacker.i && toPos.j === attacker.j;
                })
                .sort(
                    (a, b) =>
                        this.pieceValues[a.piece as keyof typeof this.pieceValues] -
                        this.pieceValues[b.piece as keyof typeof this.pieceValues]
                );

            if (captureMoves.length > 0) return captureMoves[0];

            if (attackers.length === 1) {
                const attackerPiece = this.game.getPiece(attacker.i, attacker.j);
                if (['q', 'r', 'b'].includes(attackerPiece?.type || '')) {
                    const blockMove = this.findBlockMove(kingPos, attacker);
                    if (blockMove) return blockMove;
                }
            }
        }
        return null;
    }

    private findBlockMove(kingPos: CellPosition, attacker: CellPosition): { from: string, to: string } | null {
        const betweenSquares = this.getSquaresBetween(kingPos, attacker);
        for (const square of betweenSquares) {
            const blockMoves = this.getValidMoves()
                .filter(move => {
                    const toPos = this.game.squareToCoords(move.to);
                    return toPos.i === square.i && toPos.j === square.j;
                })
                .sort(
                    (a, b) =>
                        this.pieceValues[a.piece as keyof typeof this.pieceValues] -
                        this.pieceValues[b.piece as keyof typeof this.pieceValues]
                );

            if (blockMoves.length > 0) return blockMoves[0];
        }
        return null;
    }

    private findAttackers(position: CellPosition): CellPosition[] {
        const attackers = [];
        const opponent = this.cor === 'w' ? 'b' : 'w';

        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const piece = this.game.getPiece(i, j);
                if (piece?.color === opponent) {
                    const moves = this.game.getValidMoves(i, j);
                    if (moves.some(m => m.i === position.i && m.j === position.j)) {
                        attackers.push({ i, j });
                    }
                }
            }
        }
        return attackers;
    }

    private getSquaresBetween(pos1: CellPosition, pos2: CellPosition): CellPosition[] {
        const squares: CellPosition[] = [];
        const di = Math.sign(pos2.i - pos1.i);
        const dj = Math.sign(pos2.j - pos1.j);

        if (di === 0 && dj === 0) return squares;

        for (let i = pos1.i + di, j = pos1.j + dj; i !== pos2.i || j !== pos2.j; i += di, j += dj) {
            squares.push({ i, j });
        }

        return squares;
    }

    private isKingMove(move: any, kingPos: CellPosition): boolean {
        const fromPos = this.game.squareToCoords(move.from);
        return fromPos.i === kingPos.i && fromPos.j === kingPos.j;
    }

    private isSquareDangerousAfterMove(move: any): boolean {
        const toPos = this.game.squareToCoords(move.to);
        return this.game.isSquareDangerous(toPos.i, toPos.j);
    }

    private sortKingMoves(moves: any[]): any[] {
        if (this.isMidGame()) {
            return moves.sort((a, b) =>
                this.distanceFromEdge(this.game.squareToCoords(a.to)) -
                this.distanceFromEdge(this.game.squareToCoords(b.to))
            );
        }
        return moves;
    }

    private getMoveSafety(move: any): number {
        const pos = this.game.squareToCoords(move.to);
        let safety = 0;

        if (!this.game.isSquareDangerous(pos.i, pos.j)) safety += 10;
        if (this.game.isSquareDefended(pos.i, pos.j, this.cor)) safety += 5;
        if (this.isEndGame()) safety += this.distanceFromEdge(pos);

        return safety;
    }

    private distanceFromEdge(pos: CellPosition): number {
        return Math.min(pos.i, 7 - pos.i, pos.j, 7 - pos.j);
    }

    private distanceFromCenter(pos: CellPosition): number {
        const center = { i: 3.5, j: 3.5 };
        return Math.sqrt(Math.pow(pos.i - center.i, 2) + Math.pow(pos.j - center.j, 2));
    }

    private isMidGame(): boolean {
        const pieceCount = this.countPieces();
        return pieceCount <= 16 && pieceCount > 8;
    }

    private isEndGame(): boolean {
        return this.countPieces() <= 8;
    }

    private isEarlyGame(): boolean {
        return this.countPieces() > 20;
    }

    private countPieces(): number {
        let count = 0;
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                if (this.game.getPiece(i, j)) count++;
            }
        }
        return count;
    }

    private calculateDelay(): number {
        const delays = { facil: 300, medio: 700, dificil: 900 };
        return delays[this.nivel] + Math.random() * (this.nivel === 'dificil' ? 1500 : 800);
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}