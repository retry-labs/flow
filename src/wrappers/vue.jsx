/**
 * Vue 3 Wrapper Component
 *
 * Mirrors the React wrapper:
 *   - Accepts either `config` (graph object) or `dsl` (string).
 *   - Optional step player when `graph.steps` exists. Honours `autoplay`,
 *     `interval`, `stepIndex`, and emits `step-change`. Active nodes/edges
 *     are derived from the current step unless explicitly passed.
 *   - Forwards click events to `node-click` / `edge-click`.
 */

import { defineComponent, h, ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { Diagram } from '../diagram-component.jsx'
import { parseDSL } from '../parser.js'

export const FlowDiagram = defineComponent({
  name: 'FlowDiagram',
  props: {
    config: { type: Object, default: null },
    dsl: { type: String, default: '' },
    style: { type: String, default: null },
    activeNodes: { type: Array, default: null },
    activeEdges: { type: Array, default: null },
    padding: { type: Number, default: 0 },
    animate: { type: Boolean, default: true },
    autoplay: { type: Boolean, default: false },
    interval: { type: Number, default: 2000 },
    stepIndex: { type: Number, default: null },
  },
  emits: ['node-click', 'edge-click', 'step-change'],
  setup(props, { emit }) {
    const graph = ref(null)
    const internalIdx = ref(0)
    let timer = null

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
      } else {
        graph.value = null
      }
      internalIdx.value = 0
    }

    const isControlled = computed(() => typeof props.stepIndex === 'number')
    const steps = computed(() => {
      const g = graph.value
      return g && Array.isArray(g.steps) ? g.steps : null
    })
    const currentIdx = computed(() => {
      const s = steps.value
      if (!s || !s.length) return 0
      const raw = isControlled.value ? props.stepIndex : internalIdx.value
      return ((raw % s.length) + s.length) % s.length
    })

    const stopTimer = () => { if (timer) { clearInterval(timer); timer = null } }
    const startTimer = () => {
      stopTimer()
      const s = steps.value
      if (!s || !s.length || !props.autoplay || isControlled.value) return
      const ms = Number(props.interval) > 0 ? Number(props.interval) : 2000
      timer = setInterval(() => {
        internalIdx.value = (internalIdx.value + 1) % s.length
      }, ms)
    }

    watch(() => [props.config, props.dsl], updateGraph, { deep: true })
    watch(() => [props.autoplay, props.interval, steps.value], startTimer, { immediate: false })
    watch(currentIdx, (i) => {
      const s = steps.value
      if (s && s.length) emit('step-change', { index: i, step: s[i] })
    })
    onMounted(() => { updateGraph(); startTimer() })
    onUnmounted(stopTimer)

    return () => {
      if (!graph.value) {
        return h('div', { class: 'flow-diagram-error' }, [
          h('p', 'No valid graph configuration provided.'),
        ])
      }

      // Derive active arrays from the current step when not explicitly set
      let derivedNodes = props.activeNodes
      let derivedEdges = props.activeEdges
      const s = steps.value
      if (s && s.length) {
        const step = s[currentIdx.value] || {}
        if (derivedNodes == null) derivedNodes = Array.isArray(step.nodes) ? step.nodes : []
        if (derivedEdges == null) derivedEdges = Array.isArray(step.edges) ? step.edges : []
      } else {
        if (derivedNodes == null) derivedNodes = []
        if (derivedEdges == null) derivedEdges = []
      }

      const resolvedStyle = props.style || graph.value.style || 'sleek'

      return h(Diagram, {
        graph: graph.value,
        style: resolvedStyle,
        activeNodes: derivedNodes,
        activeEdges: derivedEdges,
        padding: props.padding,
        animate: props.animate,
        onNodeClick: (node) => emit('node-click', node),
        onEdgeClick: (edge) => emit('edge-click', edge),
      })
    }
  },
})

export default FlowDiagram
