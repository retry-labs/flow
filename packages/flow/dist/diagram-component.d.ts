/**
 * `playerControls` (optional): when present, Diagram renders a step player
 * overlay. Shape:
 *   {
 *     mode: 'basic' | 'advanced',
 *     stepIndex, totalSteps, stepTitle,
 *     playing, speed, interval,
 *     onPlayPause, onPrev, onNext, onGoto(i), onSpeedChange(s),
 *   }
 */
export function Diagram({ graph, style, activeNodes, activeEdges, padding, className, fullscreenTarget, onNodeClick, onEdgeClick, playerControls, }: {
    graph: any;
    style?: string;
    activeNodes?: any[];
    activeEdges?: any[];
    padding?: number;
    className: any;
    fullscreenTarget?: any;
    onNodeClick: any;
    onEdgeClick: any;
    playerControls?: any;
}): import("react/jsx-runtime").JSX.Element;
export default Diagram;
//# sourceMappingURL=diagram-component.d.ts.map