export default FlowDiagramElement;
export class FlowDiagramElement extends HTMLElement {
    static get observedAttributes(): string[];
    _root: HTMLDivElement;
    _reactRoot: ReactDOM.Root;
    connectedCallback(): void;
    disconnectedCallback(): void;
    attributeChangedCallback(): void;
    _mount(): void;
    set config(val: any);
    _configProp: any;
}
import ReactDOM from 'react-dom/client';
//# sourceMappingURL=angular.d.ts.map