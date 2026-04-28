/**
 * Vue 3 Wrapper Component
 */

import { defineComponent, h, ref, watch, onMounted } from 'vue'
import { Diagram } from '../diagram-component.jsx'
import { parseDSL } from '../parser.jsx'

/**
 * VueFlowDiagram - Vue 3 component
 */
export const FlowDiagram = defineComponent({
  name: 'FlowDiagram',
  props: {
    config: {
      type: Object,
      default: null
    },
    dsl: {
      type: String,
      default: ''
    },
    style: {
      type: String,
      default: 'sleek'
    },
    activeNodes: {
      type: Array,
      default: () => []
    },
    activeEdges: {
      type: Array,
      default: () => []
    },
    padding: {
      type: Number,
      default: 0
    },
    animate: {
      type: Boolean,
      default: true
    }
  },
  emits: ['node-click', 'edge-click'],
  setup(props, { emit, slots }) {
    const graph = ref(null)

    const updateGraph = () => {
      if (props.config) {
        graph.value = props.config
      } else if (props.dsl) {
        try {
          graph.value = parseDSL(props.dsl)
        } catch (e) {
          console.error('Flow: Failed to parse DSL', e)
          graph.value = null
        }
      }
    }

    watch(() => [props.config, props.dsl], updateGraph, { deep: true })
    onMounted(updateGraph)

    return () => {
      if (!graph.value) {
        return h('div', { class: 'flow-diagram-error' }, [
          h('p', 'No valid graph configuration provided.')
        ])
      }

      return h(Diagram, {
        graph: graph.value,
        style: props.style,
        activeNodes: props.activeNodes,
        activeEdges: props.activeEdges,
        padding: props.padding,
        animate: props.animate,
        onNodeClick: (node) => emit('node-click', node),
        onEdgeClick: (edge) => emit('edge-click', edge)
      })
    }
  }
})

export default FlowDiagram
