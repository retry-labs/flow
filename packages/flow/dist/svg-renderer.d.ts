export function renderSVG(graphInput: any, { styleName, activeNodes, activeEdges, padding, width, height, }?: {
    activeNodes?: any[];
    activeEdges?: any[];
    padding?: number;
}): string;
export default renderSVG;
export namespace SVG_STYLES {
    namespace sleek {
        export namespace tokens {
            let bg: string;
            let ink: string;
            let muted: string;
            let accent: string;
            let line: string;
        }
        export { sleekDefs as defs };
        export { sleekBackground as background };
        export { sleekNode as node };
        export { sleekEdge as edge };
    }
    namespace sketch {
        export namespace tokens_1 {
            let bg_1: string;
            export { bg_1 as bg };
            let ink_1: string;
            export { ink_1 as ink };
            let muted_1: string;
            export { muted_1 as muted };
            let accent_1: string;
            export { accent_1 as accent };
            let line_1: string;
            export { line_1 as line };
        }
        export { tokens_1 as tokens };
        export { sketchDefs as defs };
        export { sketchBackground as background };
        export { sketchNode as node };
        export { sketchEdge as edge };
    }
    namespace iso {
        export namespace tokens_2 {
            let bg_2: string;
            export { bg_2 as bg };
            let ink_2: string;
            export { ink_2 as ink };
            let muted_2: string;
            export { muted_2 as muted };
            let accent_2: string;
            export { accent_2 as accent };
            let line_2: string;
            export { line_2 as line };
        }
        export { tokens_2 as tokens };
        export { isoDefs as defs };
        export { isoBackground as background };
        export { isoNode as node };
        export { isoEdge as edge };
    }
    namespace blueprint {
        export namespace tokens_3 {
            let bg_3: string;
            export { bg_3 as bg };
            let ink_3: string;
            export { ink_3 as ink };
            let muted_3: string;
            export { muted_3 as muted };
            let accent_3: string;
            export { accent_3 as accent };
            let line_3: string;
            export { line_3 as line };
        }
        export { tokens_3 as tokens };
        export { blueprintDefs as defs };
        export { blueprintBackground as background };
        export { blueprintNode as node };
        export { blueprintEdge as edge };
    }
    namespace city {
        export namespace tokens_4 {
            let bg_4: string;
            export { bg_4 as bg };
            let ink_4: string;
            export { ink_4 as ink };
            let muted_4: string;
            export { muted_4 as muted };
            let accent_4: string;
            export { accent_4 as accent };
            let line_4: string;
            export { line_4 as line };
        }
        export { tokens_4 as tokens };
        export let isometric: boolean;
        export { cityDefs as defs };
        export { cityBackground as background };
        export { cityNode as node };
        export { cityEdge as edge };
        export { cityEdgeOverlay as edgeOverlay };
    }
}
declare function sleekDefs(): string;
declare function sleekBackground(w: any, h: any): string;
declare function sleekNode(node: any, active: any): string;
declare function sleekEdge(edge: any, active: any): string;
declare function sketchDefs(): string;
declare function sketchBackground(w: any, h: any): string;
declare function sketchNode(node: any, active: any): string;
declare function sketchEdge(edge: any, active: any): string;
declare function isoDefs(): string;
declare function isoBackground(w: any, h: any): string;
declare function isoNode(node: any, active: any): string;
declare function isoEdge(edge: any, active: any): string;
declare function blueprintDefs(): string;
declare function blueprintBackground(w: any, h: any): string;
declare function blueprintNode(node: any, active: any): string;
declare function blueprintEdge(edge: any, active: any): string;
declare function cityDefs(): string;
declare function cityBackground(w: any, h: any): string;
declare function cityNode(node: any, active: any): string;
declare function cityEdge(edge: any, active: any): string;
declare function cityEdgeOverlay(edge: any, active: any, helpers: any): string;
//# sourceMappingURL=svg-renderer.d.ts.map