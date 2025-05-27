import { Game } from '../models/Game';
import { AudioService } from '../services/AudioService';
import type { CellPosition } from '../models/types/ChessTypes';

export class DangerZoneManager {
    private _game: Game;
    private _dangerZoneTimer: number | null = null;
    private _lastDangerSide: 'w' | 'b' = 'b';
    private _dangerSoundPlayedThisCycle = false;
    private _onDangerZoneAdded?: (position: CellPosition) => void;
    private _dangerSoundAlreadyPlayed = false;

    constructor(game: Game, onDangerZoneAdded?: (position: CellPosition) => void) {
        this._game = game;
        this._onDangerZoneAdded = onDangerZoneAdded;
    }

    public startDangerZoneTimer(): void {
    if (this._dangerZoneTimer) {
        clearInterval(this._dangerZoneTimer);
        this._dangerZoneTimer = null;
    }

  
    if (!this._game.areDangerZonesEnabled()) return;

    this._dangerZoneTimer = window.setInterval(() => {
        this._lastDangerSide = this._lastDangerSide === 'w' ? 'b' : 'w';
        
        let zonesCreated = 0;
        while (zonesCreated < 3) {
            if (this.generateDangerZoneForSide(this._lastDangerSide)) {
                zonesCreated++;
            } else {
                this._lastDangerSide = this._lastDangerSide === 'w' ? 'b' : 'w';
            }
        }
    }, 15000);
}
    public stopDangerZoneTimer(): void {
        if (this._dangerZoneTimer) {
            clearInterval(this._dangerZoneTimer);
            this._dangerZoneTimer = null;
        }
    }

    public clearDangerZones(): void {
        this._game.clearDangerZones();
    }
    private generateDangerZoneForSide(side: 'w' | 'b'): boolean {
        const dangerZones = this._game.getDangerZones();
        const startRow = side === 'w' ? 4 : 0;
        const endRow = side === 'w' ? 7 : 3;

        const validPositions: CellPosition[] = [];

        for (let i = startRow; i <= endRow; i++) {
            for (let j = 0; j < 8; j++) {
                const isDanger = dangerZones.some(z =>
                    z.position.i === i && z.position.j === j
                );

                if (!isDanger) {
                    validPositions.push({ i, j });
                }
            }
        }

        if (validPositions.length === 0) return false;

        const randomIndex = Math.floor(Math.random() * validPositions.length);
        const position = validPositions[randomIndex];
        this._game.addDangerZone(position);

        if (this._onDangerZoneAdded) {
            this._onDangerZoneAdded(position);
        }

        if (!this._dangerSoundAlreadyPlayed) {
            this._dangerSoundAlreadyPlayed = true;
            AudioService.play('danger');
        }

        return true;
    }

}
