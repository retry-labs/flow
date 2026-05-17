export const RLFlow: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    dsl: {
        type: StringConstructor;
        default: string;
    };
    config: {
        type: ObjectConstructor;
        default: any;
    };
    style: {
        type: StringConstructor;
        default: any;
    };
    activeNodes: {
        type: ArrayConstructor;
        default: any;
    };
    activeEdges: {
        type: ArrayConstructor;
        default: any;
    };
    controls: {
        type: BooleanConstructor;
        default: boolean;
    };
    player: {
        type: (StringConstructor | BooleanConstructor)[];
        default: any;
    };
    autoplay: {
        type: BooleanConstructor;
        default: boolean;
    };
    interval: {
        type: NumberConstructor;
        default: number;
    };
    speed: {
        type: NumberConstructor;
        default: number;
    };
    height: {
        type: StringConstructor;
        default: string;
    };
    width: {
        type: StringConstructor;
        default: string;
    };
}>, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, ("node-click" | "edge-click" | "step-change")[], "node-click" | "edge-click" | "step-change", import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    dsl: {
        type: StringConstructor;
        default: string;
    };
    config: {
        type: ObjectConstructor;
        default: any;
    };
    style: {
        type: StringConstructor;
        default: any;
    };
    activeNodes: {
        type: ArrayConstructor;
        default: any;
    };
    activeEdges: {
        type: ArrayConstructor;
        default: any;
    };
    controls: {
        type: BooleanConstructor;
        default: boolean;
    };
    player: {
        type: (StringConstructor | BooleanConstructor)[];
        default: any;
    };
    autoplay: {
        type: BooleanConstructor;
        default: boolean;
    };
    interval: {
        type: NumberConstructor;
        default: number;
    };
    speed: {
        type: NumberConstructor;
        default: number;
    };
    height: {
        type: StringConstructor;
        default: string;
    };
    width: {
        type: StringConstructor;
        default: string;
    };
}>> & Readonly<{
    "onNode-click"?: (...args: any[]) => any;
    "onEdge-click"?: (...args: any[]) => any;
    "onStep-change"?: (...args: any[]) => any;
}>, {
    style: string;
    activeNodes: unknown[];
    activeEdges: unknown[];
    width: string;
    height: string;
    controls: boolean;
    player: string | boolean;
    autoplay: boolean;
    interval: number;
    speed: number;
    dsl: string;
    config: Record<string, any>;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
export default RLFlow;
//# sourceMappingURL=vue.d.ts.map