import type{ MovePair } from '../models/types/ChessTypes';

export class HistoryView {
    public static update(moves: MovePair[], currentIndex: number): void {
        const movesList = document.getElementById('moves-list');
        if (!movesList) return;

        movesList.innerHTML = '';
        const startIndex = Math.max(0, moves.length - 100);

        if (moves.length > 10) {
            const hiddenMoves = document.createElement('div');
            hiddenMoves.className = 'hidden-moves';
            movesList.appendChild(hiddenMoves);
        }

        for (let i = startIndex; i < moves.length; i++) {
            const moveEntry = this.createMoveEntry(i + 1, moves[i]);
            movesList.appendChild(moveEntry);
        }
        movesList.scrollTop = movesList.scrollHeight;
    }

    private static createMoveEntry(number: number, movePair: MovePair): HTMLElement {
        const entry = document.createElement('div');
        entry.className = 'move-entry';

        const numberSpan = document.createElement('span');
        numberSpan.className = 'move-number';
        numberSpan.textContent = `${number}.`;

        const whiteMove = document.createElement('span');
        whiteMove.className = 'white-move';
        whiteMove.textContent = movePair.white || '';

        const blackMove = document.createElement('span');
        blackMove.className = 'black-move';
        blackMove.textContent = movePair.black || '';

        entry.appendChild(numberSpan);
        entry.appendChild(whiteMove);
        if (movePair.black) entry.appendChild(blackMove);

        return entry;
    }
}