export function registerElement(): void;
declare const RLFlowElement_base: {
    new (): {};
};
export class RLFlowElement extends RLFlowElement_base {
    static get observedAttributes(): string[];
    connectedCallback(): void;
    disconnectedCallback(): void;
    _viewport: {
        update(next: any): void;
        setStyle(name: any): void;
        setActive(nodes: any, edges: any): void;
        play(): void;
        pause(): void;
        togglePlay(): void;
        nextStep(): void;
        prevStep(): void;
        gotoStep(i: any): void;
        setInterval(ms: any): void;
        setSpeed(s: any): void;
        readonly stepIndex: number;
        readonly playerMode: string;
        setZoom(z: any): void;
        resetView(): void;
        toggleFullscreen(): void;
        download(): void;
        destroy(): void;
        readonly host: HTMLDivElement;
        readonly stage: HTMLDivElement;
        readonly svg: SVGSVGElement;
    };
    attributeChangedCallback(): void;
    set config(val: any);
    _config: any;
    _render(): void;
    innerHTML: string;
    play(): void;
    pause(): void;
    togglePlay(): void;
    nextStep(): void;
    prevStep(): void;
    gotoStep(i: any): void;
    setStyle(s: any): void;
    setSpeed(s: any): void;
    setZoom(z: any): void;
    resetView(): void;
    download(): void;
    toggleFullscreen(): void;
}
export {};
//# sourceMappingURL=element.d.ts.map