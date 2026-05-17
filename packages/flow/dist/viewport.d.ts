/**
 * Mount an interactive Flow viewport into a container element.
 *
 *   const v = mount('#arch', { graph, styleName: 'sleek' })
 *   v.update({ activeNodes: ['client'], activeEdges: ['e1'] })
 *   v.setStyle('city')
 *   v.resetView()
 *   v.destroy()
 */
export function mount(target: any, opts?: {}): {
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
export default mount;
//# sourceMappingURL=viewport.d.ts.map