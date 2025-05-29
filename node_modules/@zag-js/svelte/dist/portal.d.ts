export interface PortalActionProps {
    disabled?: boolean;
    container?: HTMLElement;
    getRootNode?: () => ShadowRoot | Document | Node;
}
export declare function portal(node: HTMLElement, props?: PortalActionProps): {
    destroy: () => void;
    update: (props?: PortalActionProps) => void;
};
