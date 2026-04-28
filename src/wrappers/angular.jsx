/**
 * Angular Wrapper Module & Directive
 * 
 * Note: This is a conceptual wrapper since Angular typically
 * uses TypeScript components with proper DI. In a real Angular
 * app, you would create a proper Angular component that mounts
 * the Flow diagram.
 * 
 * Usage:
 * 
 * import { FlowDiagramModule } from 'flow-diagram'
 * 
 * // Create an Angular component that uses FlowDiagram
 * @Component({
 *   selector: 'app-diagram',
 *   template: '<div #diagramContainer></div>'
 * })
 * export class DiagramComponent implements AfterViewInit {
 *   @ViewChild('diagramContainer', {static: true}) container: ElementRef;
 *   
 *   ngAfterViewInit() {
 *     // Use FlowDiagram with the container
 *   }
 * }
 */

// The wrapper provides the conceptual structure for Angular integration
// since actual Angular components require TypeScript compilation

export const FlowDiagramModule = {
  name: 'FlowDiagramModule',
  description: 'Angular wrapper for Flow Diagram (conceptual - see docs for implementation)',
  
  // Configuration helpers
  withConfig(config) {
    return {
      provide: 'FLOW_DIAGRAM_CONFIG',
      useValue: config
    }
  }
}

export default FlowDiagramModule

// For actual Angular usage, users should:
// 1. Install flow-diagram: npm install flow-diagram
// 2. Create an Angular component that mounts the diagram
// 3. Use the Diagram component directly or via the FlowDiagram component
// See the README for Angular integration examples
