export function shapeOf(node: any): any;
export function assignAnchors(nodes: any, edges: any): {
    anchors: {};
    edgeT: {};
};
export function routeEdge(fromNode: any, toNode: any, fromSide: any, toSide: any, fromT?: number, toT?: number): {
    x: any;
    y: any;
}[];
export function pathFromPoints(pts: any, rounded?: number): string;
export function roughPath(pts: any, amp?: number, seed?: number): string;
export function edgeMidpoint(pts: any): {
    x: number;
    y: number;
};
export function resolveGraph(graph: any): any;
export namespace NODE_KINDS {
    export namespace service {
        let label: string;
        let shape: string;
        let icon: string;
    }
    export namespace store {
        let label_1: string;
        export { label_1 as label };
        let shape_1: string;
        export { shape_1 as shape };
        let icon_1: string;
        export { icon_1 as icon };
    }
    export namespace cache {
        let label_2: string;
        export { label_2 as label };
        let shape_2: string;
        export { shape_2 as shape };
        let icon_2: string;
        export { icon_2 as icon };
    }
    export namespace queue {
        let label_3: string;
        export { label_3 as label };
        let shape_3: string;
        export { shape_3 as shape };
        let icon_3: string;
        export { icon_3 as icon };
    }
    export namespace actor {
        let label_4: string;
        export { label_4 as label };
        let shape_4: string;
        export { shape_4 as shape };
        let icon_4: string;
        export { icon_4 as icon };
    }
    export namespace gateway {
        let label_5: string;
        export { label_5 as label };
        let shape_5: string;
        export { shape_5 as shape };
        let icon_5: string;
        export { icon_5 as icon };
    }
    export namespace external {
        let label_6: string;
        export { label_6 as label };
        let shape_6: string;
        export { shape_6 as shape };
        let icon_6: string;
        export { icon_6 as icon };
    }
    export namespace boundary {
        let label_7: string;
        export { label_7 as label };
        let shape_7: string;
        export { shape_7 as shape };
        let icon_7: string;
        export { icon_7 as icon };
    }
    export namespace start {
        let label_8: string;
        export { label_8 as label };
        let shape_8: string;
        export { shape_8 as shape };
        let icon_8: string;
        export { icon_8 as icon };
    }
    export namespace stop {
        let label_9: string;
        export { label_9 as label };
        let shape_9: string;
        export { shape_9 as shape };
        let icon_9: string;
        export { icon_9 as icon };
    }
    export namespace decision {
        let label_10: string;
        export { label_10 as label };
        let shape_10: string;
        export { shape_10 as shape };
        let icon_10: string;
        export { icon_10 as icon };
    }
    export namespace process {
        let label_11: string;
        export { label_11 as label };
        let shape_11: string;
        export { shape_11 as shape };
        let icon_11: string;
        export { icon_11 as icon };
    }
    export namespace event {
        let label_12: string;
        export { label_12 as label };
        let shape_12: string;
        export { shape_12 as shape };
        let icon_12: string;
        export { icon_12 as icon };
    }
    export namespace step {
        let label_13: string;
        export { label_13 as label };
        let shape_13: string;
        export { shape_13 as shape };
        let icon_13: string;
        export { icon_13 as icon };
    }
    export namespace tree {
        let label_14: string;
        export { label_14 as label };
        let shape_14: string;
        export { shape_14 as shape };
        let icon_14: string;
        export { icon_14 as icon };
    }
    export namespace image {
        let label_15: string;
        export { label_15 as label };
        let shape_15: string;
        export { shape_15 as shape };
        let icon_15: string;
        export { icon_15 as icon };
    }
    export namespace _function {
        let label_16: string;
        export { label_16 as label };
        let shape_16: string;
        export { shape_16 as shape };
        let icon_16: string;
        export { icon_16 as icon };
    }
    export { _function as function };
    export namespace worker {
        let label_17: string;
        export { label_17 as label };
        let shape_17: string;
        export { shape_17 as shape };
        let icon_17: string;
        export { icon_17 as icon };
    }
    export namespace loadbalancer {
        let label_18: string;
        export { label_18 as label };
        let shape_18: string;
        export { shape_18 as shape };
        let icon_18: string;
        export { icon_18 as icon };
    }
    export namespace cdn {
        let label_19: string;
        export { label_19 as label };
        let shape_19: string;
        export { shape_19 as shape };
        let icon_19: string;
        export { icon_19 as icon };
    }
    export namespace auth {
        let label_20: string;
        export { label_20 as label };
        let shape_20: string;
        export { shape_20 as shape };
        let icon_20: string;
        export { icon_20 as icon };
    }
    export namespace monitor {
        let label_21: string;
        export { label_21 as label };
        let shape_21: string;
        export { shape_21 as shape };
        let icon_21: string;
        export { icon_21 as icon };
    }
    export namespace bus {
        let label_22: string;
        export { label_22 as label };
        let shape_22: string;
        export { shape_22 as shape };
        let icon_22: string;
        export { icon_22 as icon };
    }
    export namespace stream {
        let label_23: string;
        export { label_23 as label };
        let shape_23: string;
        export { shape_23 as shape };
        let icon_23: string;
        export { icon_23 as icon };
    }
    export namespace firewall {
        let label_24: string;
        export { label_24 as label };
        let shape_24: string;
        export { shape_24 as shape };
        let icon_24: string;
        export { icon_24 as icon };
    }
    export namespace mobile {
        let label_25: string;
        export { label_25 as label };
        let shape_25: string;
        export { shape_25 as shape };
        let icon_25: string;
        export { icon_25 as icon };
    }
}
export const SHAPES: string[];
export namespace EXAMPLE_GRAPH {
    namespace canvas {
        let w: number;
        let h: number;
        let grid: number;
    }
    let nodes: ({
        id: string;
        kind: string;
        label: string;
        x: number;
        y: number;
        w: number;
        h: number;
        sub?: undefined;
    } | {
        id: string;
        kind: string;
        label: string;
        x: number;
        y: number;
        w: number;
        h: number;
        sub: string;
    })[];
    let edges: {
        id: string;
        from: string;
        to: string;
        kind: string;
        label: string;
    }[];
}
export namespace EXAMPLE_GRAPH_FLAT {
    export namespace canvas_1 {
        let w_1: number;
        export { w_1 as w };
        let h_1: number;
        export { h_1 as h };
        let grid_1: number;
        export { grid_1 as grid };
    }
    export { canvas_1 as canvas };
    let nodes_1: ({
        id: string;
        kind: string;
        label: string;
        x: number;
        y: number;
        w: number;
        h: number;
        sub?: undefined;
    } | {
        id: string;
        kind: string;
        label: string;
        x: number;
        y: number;
        w: number;
        h: number;
        sub: string;
    })[];
    export { nodes_1 as nodes };
    let edges_1: {
        id: string;
        from: string;
        to: string;
        kind: string;
        label: string;
    }[];
    export { edges_1 as edges };
    export let steps: {
        id: string;
        title: string;
        narration: string;
        active: {
            nodes: string[];
            edges: string[];
        };
    }[];
}
export namespace HERO_GRAPH {
    export namespace canvas_2 {
        let w_2: number;
        export { w_2 as w };
        let h_2: number;
        export { h_2 as h };
        let grid_2: number;
        export { grid_2 as grid };
    }
    export { canvas_2 as canvas };
    let nodes_2: ({
        id: string;
        kind: string;
        label: string;
        x: number;
        y: number;
        w: number;
        h: number;
        sub?: undefined;
    } | {
        id: string;
        kind: string;
        label: string;
        x: number;
        y: number;
        w: number;
        h: number;
        sub: string;
    })[];
    export { nodes_2 as nodes };
    let edges_2: {
        id: string;
        from: string;
        to: string;
        kind: string;
        label: string;
    }[];
    export { edges_2 as edges };
    let steps_1: {
        id: string;
        title: string;
        active: {
            nodes: string[];
            edges: string[];
        };
    }[];
    export { steps_1 as steps };
}
//# sourceMappingURL=graph.d.ts.map