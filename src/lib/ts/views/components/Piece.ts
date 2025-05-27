export class PieceView {
    private static readonly pieceSvgIds = ["", "wk", "wq", "wr", "wb", "wn", "wp", "bk", "bq", "br", "bb", "bn", "bp"];
    private static readonly svgPath = "./assets/images/chessboard-sprite-staunty.svg";

    public static createSvg(id: number): string {
        const svgId = this.pieceSvgIds[id];
        return `
            <svg class="piece" width="40" height="40" viewBox="0 0 45 45">
                <use xlink:href="${this.svgPath}#${svgId}" transform="scale(0.78) translate(9, 7)" />
            </svg>
        `;
    }
}