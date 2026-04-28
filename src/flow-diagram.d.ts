/**
 * Type definitions for Flow Diagram library
 */

declare module 'flow-diagram' {
  // Node kinds
  export interface NodeKind {
    label: string
    shape?: string
    icon?: string
  }

  // Node interface
  export interface DiagramNode {
    id: string
    label: string
    kind?: string
    shape?: string
    x?: number
    y?: number
    w?: number
    h?: number
    sub?: string
    [key: string]: any
  }

  // Edge interface
  export interface DiagramEdge {
    id: string
    from: string
    to: string
    kind?: 'solid' | 'dashed'
    label?: string
    fromSide?: 'l' | 'r' | 't' | 'b'
    toSide?: 'l' | 'r' | 't' | 'b'
    [key: string]: any
  }

  // Canvas configuration
  export interface CanvasConfig {
    w: number
    h: number
    grid?: number
  }

  // Graph configuration
  export interface GraphConfig {
    nodes: DiagramNode[]
    edges: DiagramEdge[]
    canvas?: CanvasConfig
    steps?: Array<{
      id: string
      active: {
        nodes: string[]
        edges: string[]
      }
    }>
  }

  // Style tokens
  export interface StyleTokens {
    bg: string
    grid?: string
    nodeBg: string
    nodeBorder: string
    nodeInk: string
    nodeSub: string
    edge: string
    edgeActive: string
    edgeLabel: string
    [key: string]: string
  }

  // Style renderer functions
  export interface StyleRenderer {
    Defs?: React.FC<{}>
    Background?: React.FC<{ width: number; height: number; grid?: number }>
    Node: React.FC<{
      node: DiagramNode
      active?: boolean
      pulse?: boolean
      style: { tokens: StyleTokens }
    }>
    Edge: React.FC<{
      edge: DiagramEdge
      active?: boolean
      progress?: number
      style: { tokens: StyleTokens }
    }>
    tokens: StyleTokens
    motion?: {
      pulse?: string
      flow?: string
    }
  }

  // Diagram component props
  export interface DiagramProps {
    graph: GraphConfig
    style?: 'sleek' | 'sketch' | 'iso' | 'blueprint' | string
    activeNodes?: string[]
    activeEdges?: string[]
    padding?: number
    className?: string
    onNodeClick?: (node: DiagramNode) => void
    onEdgeClick?: (edge: DiagramEdge) => void
    fullscreenTarget?: React.RefObject<any>
    showControls?: boolean
    animate?: boolean
    children?: React.ReactNode
  }

  // FlowDiagram component props
  export interface FlowDiagramProps {
    config?: GraphConfig
    dsl?: string
    style?: 'sleek' | 'sketch' | 'iso' | 'blueprint' | string
    activeNodes?: string[]
    activeEdges?: string[]
    padding?: number
    className?: string
    onNodeClick?: (node: DiagramNode) => void
    onEdgeClick?: (edge: DiagramEdge) => void
    showControls?: boolean
    animate?: boolean
    children?: React.ReactNode
  }

  // Vue component props
  export interface VueFlowDiagramProps {
    config?: GraphConfig
    dsl?: string
    style?: string
    activeNodes?: string[]
    activeEdges?: string[]
    padding?: number
    animate?: boolean
  }

  // Core exports
  export const NODE_KINDS: Record<string, NodeKind>
  export const SHAPES: string[]
  export const EXAMPLE_GRAPH: GraphConfig
  export const EXAMPLE_GRAPH_FLAT: GraphConfig
  export const HERO_GRAPH: GraphConfig

  // Functions
  export function shapePath(shape: string, w: number, h: number): {
    d: string
    cx: number
    cy: number
    rx?: number
    [key: string]: any
  }
  export function shapeAnchor(node: DiagramNode, side: 'l' | 'r' | 't' | 'b'): { x: number; y: number }
  export function parseDSL(text: string): GraphConfig
  export function resolveGraph(graph: GraphConfig): GraphConfig
  export function routeEdge(fromNode: DiagramNode, toNode: DiagramNode, fromSide: string, toSide: string, fromT?: number, toT?: number): Array<{ x: number; y: number }>
  export function pathFromPoints(pts: Array<{ x: number; y: number }>, rounded?: number): string
  export function roughPath(pts: Array<{ x: number; y: number }>, amp?: number, seed?: number): string
  export function downloadSVG(svgElement: SVGElement, filename?: string): void

  // Style management
  export const STYLES: Record<string, StyleRenderer>
  export function registerStyle(name: string, styleModule: StyleRenderer): void
  export function getStyle(name: string): StyleRenderer | undefined
  export function listStyles(): string[]

  // DSL utilities
  export function createGraphFromConfig(config: string | GraphConfig | { url: string }, options?: { resolve?: boolean }): Promise<GraphConfig>
  export function dsl(strings: TemplateStringsArray, ...values: any[]): string
  export const templates: Record<string, { code: string; description: string }>

  // Components
  export const Diagram: React.FC<DiagramProps>
  export const FlowDiagram: React.FC<FlowDiagramProps>

  // Framework exports
  export { FlowDiagram as VueFlowDiagram } // Vue 3 component
  export const FlowDiagramModule // Angular module

  // Default export
  const FlowDiagramLib: {
    NODE_KINDS: Record<string, NodeKind>
    SHAPES: string[]
    EXAMPLE_GRAPH: GraphConfig
    EXAMPLE_GRAPH_FLAT: GraphConfig
    HERO_GRAPH: GraphConfig
    shapePath: typeof shapePath
    shapeAnchor: typeof shapeAnchor
    parseDSL: typeof parseDSL
    resolveGraph: typeof resolveGraph
    routeEdge: typeof routeEdge
    pathFromPoints: typeof pathFromPoints
    roughPath: typeof roughPath
    downloadSVG: typeof downloadSVG
    Diagram: React.FC<DiagramProps>
    FlowDiagram: React.FC<FlowDiagramProps>
    STYLES: Record<string, StyleRenderer>
    registerStyle: typeof registerStyle
    createGraphFromConfig: typeof createGraphFromConfig
  }
  export default FlowDiagramLib
}
