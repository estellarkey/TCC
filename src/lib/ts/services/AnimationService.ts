import { gsap } from 'gsap';

export class AnimationService {
    public static async animatePieceDirectly(
        fromCell: HTMLElement,
        toCell: HTMLElement
    ): Promise<void> {
        const piece = fromCell.querySelector('.piece') as HTMLElement;
        if (!piece) return;

  
        const originalParent = piece.parentElement;
        const originalStyles = {
            position: piece.style.position,
            top: piece.style.top,
            left: piece.style.left,
            width: piece.style.width,
            height: piece.style.height,
            zIndex: piece.style.zIndex,
            pointerEvents: piece.style.pointerEvents,
            transform: piece.style.transform
        };

       
        const pieceRect = piece.getBoundingClientRect();
        
        
        const fromRect = fromCell.getBoundingClientRect();
        const toRect = toCell.getBoundingClientRect();
        
   
        const offsetX = (fromRect.width - pieceRect.width) / 2;
        const offsetY = (fromRect.height - pieceRect.height) / 2;

  
        document.body.appendChild(piece);
        
    
        gsap.set(piece, {
            position: 'fixed',
            left: fromRect.left + offsetX,
            top: fromRect.top + offsetY,
            width: pieceRect.width,
            height: pieceRect.height,
            zIndex: 1000,
            pointerEvents: 'none',
            transform: 'none' 
        });

        await gsap.to(piece, {
            left: toRect.left + offsetX,
            top: toRect.top + offsetY,
            duration: 0.5,
            ease: 'power2.out'
        });

  
        toCell.appendChild(piece);
        gsap.set(piece, {
            ...originalStyles,
            left: '',
            top: ''
        });
    }
}