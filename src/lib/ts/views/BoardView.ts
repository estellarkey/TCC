import type { CellPosition } from '../models/types/ChessTypes';
import { AnimationService } from '../services/AnimationService';
import { PieceView } from './components/Piece';
import { Game } from '../models/Game';

export class BoardView {
    private _game: Game;
    private _isFlipped: boolean = false;

    constructor(game: Game) {
        this._game = game;
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
        }
    }

    private generateBoard(): string {
        let table = "<table id='tabuleiro'>";
        let isDark = false;
        
        // Determina a ordem das linhas baseado no flip
        const rowOrder = this._isFlipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];
        
        for (const row of rowOrder) {
            table += "<tr>";
            for (let j = 0; j < 8; j++) {
                // Inverte a coluna se o tabuleiro estiver invertido
                const col = this._isFlipped ? 7 - j : j;
                const piece = this._game.getPiece(row, col);
                const cellClass = isDark ? "dark" : "light";
                const conteudo = piece ? PieceView.createSvg(piece.id) : '';
                
                // Usa as coordenadas originais para os IDs e eventos
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

        // Determina a ordem das linhas baseado no flip
        const rowOrder = this._isFlipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];

        for (let displayRow = 0; displayRow < 8; displayRow++) {
            const actualRow = rowOrder[displayRow];
            for (let j = 0; j < 8; j++) {
                // Inverte a coluna se o tabuleiro estiver invertido
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