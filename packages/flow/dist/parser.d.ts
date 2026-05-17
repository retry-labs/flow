export function parseDSL(text: any): {
    steps?: any[];
    nodes: any[];
    edges: any[];
    title?: any;
    style?: any;
    canvas: {
        grid: number;
    };
};
export function graphToDSL(graph: any, options: any): string;
export default parseDSL;
//# sourceMappingURL=parser.d.ts.map