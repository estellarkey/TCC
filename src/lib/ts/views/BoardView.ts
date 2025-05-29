import type { CellPosition } from '../models/types/ChessTypes';
import { AnimationService } from '../services/AnimationService';
import { PieceView } from './components/Piece';
import { Game } from '../models/Game';
import { GameController } from '../controllers/GameController';

export class BoardView {
    private _game: Game;
    private _isFlipped: boolean = false;
    private _controller: GameController;

    constructor(game: Game, controller: GameController) {
        this._game = game;
        this._controller = controller;
    }

    public flipBoard(flip: boolean): void {
        this._isFlipped = flip;
        this.render();
    }

    public async render(): Promise<void> {
        const boardHTML = this.generateBoard();
        const container = document.getElementById('tabuleiro-container');
        if (container) {
            container.innerHTML = boardHTML;
            await new Promise((r) => requestAnimationFrame(() => r(null)));
            this.addDragListeners();
        }
    }

    private generateBoard(): string {
        let table = "<table id='tabuleiro'>";
        let isDark = false;

        const rowOrder = this._isFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

        for (const row of rowOrder) {
            table += "<tr>";
            for (let j = 0; j < 8; j++) {
                const col = this._isFlipped ? 7 - j : j;
                const piece = this._game.getPiece(row, col);
                const cellClass = isDark ? "dark" : "light";
                const conteudo = piece ? PieceView.createSvg(piece.id) : '';

                table += `
                   <td id='i${row}j${col}' class='chess-square ${cellClass}' onclick='window.handleChessClick(${row},${col})'>
                        ${conteudo}
                    </td>
                `;
                isDark = !isDark;
            }
            table += "</tr>";
            isDark = !isDark;
        }
        return table + "</table>";
    }

    public updateBoard(): void {
        const tabuleiro = document.getElementById('tabuleiro') as HTMLTableElement;
        if (!tabuleiro) return;

        const tabData = this._game.getBoard();
        const dangerZones = this._game.getDangerZones();
        const now = Date.now();

        const rowOrder = this._isFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

        for (let displayRow = 0; displayRow < 8; displayRow++) {
            const actualRow = rowOrder[displayRow];
            for (let j = 0; j < 8; j++) {
                const actualCol = this._isFlipped ? 7 - j : j;
                const celula = tabuleiro.rows[displayRow].cells[j];
                const idPiece = tabData[actualRow][actualCol];
                celula.innerHTML = idPiece !== null ? PieceView.createSvg(idPiece) : '';

                celula.classList.remove(
                    'danger-zone',
                    'new-danger-zone',
                    'danger-empty',
                    'danger-with-piece'
                );

                const dangerZone = dangerZones.find(zone =>
                    zone.position.i === actualRow && zone.position.j === actualCol
                );

                if (dangerZone) {
                    const elapsed = now - dangerZone.timestamp;
                    const remainingTime = 15000 - elapsed;

                    const isEmpty = idPiece === null;

                    celula.classList.add('danger-zone');
                    celula.classList.add(isEmpty ? 'danger-empty' : 'danger-with-piece');

                    if (elapsed < 2000) {
                        celula.classList.add('new-danger-zone');
                    }

                    const intensity = 0.3 + (0.7 * (remainingTime / 15000));
                    celula.style.setProperty('--danger-intensity', intensity.toString());
                }
            }
        }
    }

    private getCoordsFromId(id: string): CellPosition {
        const match = id.match(/i(\d+)j(\d+)/);
        if (!match) {
            throw new Error(`Invalid cell id format: ${id}`);
        }
        return { i: parseInt(match[1]), j: parseInt(match[2]) };
    }

    public addDragListeners(): void {
        const container = document.getElementById('tabuleiro-container');
        if (!container) return;

        container.addEventListener('mousedown', (e: MouseEvent) => {
            const piece = (e.target as HTMLElement).closest('.piece') as HTMLElement;
            if (!piece) return;

            const originCell = piece.closest('td') as HTMLElement;
            if (!originCell || !originCell.id) return;
            const from = this.getCoordsFromId(originCell.id);
            const pieceInfo = this._game.getPiece(from.i, from.j);

            const isPlayerTurn = this._game.getCurrentTurn() === pieceInfo?.color;
            if (!pieceInfo || !isPlayerTurn) return;

            const rect = piece.getBoundingClientRect();

            const pieceClone = piece.cloneNode(true) as HTMLElement;
            pieceClone.style.position = 'fixed';
            pieceClone.style.left = `${rect.left}px`;
            pieceClone.style.top = `${rect.top}px`;
            pieceClone.style.width = `${rect.width}px`;
            pieceClone.style.height = `${rect.height}px`;
            pieceClone.style.zIndex = '1000';
            pieceClone.style.pointerEvents = 'none';
            pieceClone.style.opacity = '1';
            pieceClone.style.transform = 'none';
            document.body.appendChild(pieceClone);

            piece.style.visibility = 'hidden';

            this.showValidMoves(this._game.getValidMoves(from.i, from.j));

            const onMouseMove = (e: MouseEvent) => {
                pieceClone.style.left = `${e.clientX - rect.width / 2}px`;
                pieceClone.style.top = `${e.clientY - rect.height / 2}px`;
            };

            const onMouseUp = async (e: MouseEvent) => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);

                pieceClone.remove();
                piece.style.visibility = 'visible';
                this.clearValidMoves();

                const allCells = Array.from(document.querySelectorAll('td')) as HTMLElement[];
                const targetCell = allCells.find(cell => {
                    const r = cell.getBoundingClientRect();
                    return (
                        e.clientX >= r.left &&
                        e.clientX <= r.right &&
                        e.clientY >= r.top &&
                        e.clientY <= r.bottom
                    );
                });

                if (!targetCell) return;
                const to = this.getCoordsFromId(targetCell.id);

                const validMoves = this._game.getValidMoves(from.i, from.j);
                const isValid = validMoves.some(move => move.i === to.i && move.j === to.j);
                if (!isValid) return;

                const moveSuccess = await this._controller.executeMove(from, to);
                if (moveSuccess && this._controller.gameMode === 'singleplayer') {
                    await this._controller.botTurn();
                }
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    public highlightCell(i: number, j: number, color: string): void {
        const cell = document.getElementById(`i${i}j${j}`);
        if (cell) {
            cell.style.boxShadow = color ? 'inset 0 0 10px rgba(0,0,0,0.5)' : 'none';
        }
    }

    public async showValidMoves(positions: CellPosition[]): Promise<void> {
        positions.forEach(pos => {
            const cell = document.getElementById(`i${pos.i}j${pos.j}`);
            if (cell) {
                const marker = document.createElement('div');
                marker.className = 'valid-move-marker';
                cell.appendChild(marker);
            }
        });
    }

    public async clearValidMoves(): Promise<void> {
        document.querySelectorAll('.valid-move-marker').forEach(marker => marker.remove());
    }

    public async animateMove(from: CellPosition, to: CellPosition): Promise<void> {
        const fromCell = document.getElementById(`i${from.i}j${from.j}`);
        const toCell = document.getElementById(`i${to.i}j${to.j}`);

        if (fromCell && toCell) {
            await AnimationService.animatePieceDirectly(fromCell, toCell);
        }
    }
}
    