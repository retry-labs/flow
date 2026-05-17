export function parseSequenceDSL(text: any): {
    type: string;
    title: any;
    style: any;
    actors: any[];
    events: any[];
};
declare namespace _default {
    export { parseSequenceDSL };
    export { renderSequence };
}
export default _default;
declare function renderSequence(graph: any, opts?: {}): string;
//# sourceMappingURL=sequence.d.ts.map