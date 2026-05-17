/**
 * Vue 3 wrapper for @retry-labs/flow.
 *
 * Renders a real Vue component that drives the same `mount()` viewport
 * the standalone bundle uses — so Vue users get zoom / pan / fullscreen /
 * download / step-player without React in the loop.
 *
 * Props:
 *   dsl         string                     YAML-like graph source
 *   config      object                     graph object (used if `dsl` absent)
 *   style       string                     'sleek' | 'sketch' | 'iso' | 'city' | 'blueprint'
 *   activeNodes string[]                   highlighted node ids
 *   activeEdges string[]                   highlighted edge ids
 *   controls    boolean                    show floating zoom/pan/fullscreen panel (default true)
 *   player      'basic'|'advanced'|'off'   step-player tier (default 'basic' when steps present)
 *   autoplay    boolean                    auto-advance steps
 *   interval    number                     ms between steps
 *   speed       number                     playback speed multiplier (advanced)
 *
 * Events:
 *   @node-click   detail: { id }
 *   @edge-click   detail: { id }
 *   @step-change  detail: { index, step }
 */

import { defineComponent, h, ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { parseDSL } from '../parser.js';
import { mount } from '../viewport.js';

export const RLFlow = defineComponent({
  name: 'RLFlow',
  props: {
    dsl: { type: String, default: '' },
    config: { type: Object, default: null },
    style: { type: String, default: null },
    activeNodes: { type: Array, default: null },
    activeEdges: { type: Array, default: null },
    controls: { type: Boolean, default: true },
    player: { type: [String, Boolean], default: undefined },
    autoplay: { type: Boolean, default: false },
    interval: { type: Number, default: 2000 },
    speed: { type: Number, default: 1 },
    height: { type: String, default: '400px' },
    width: { type: String, default: '100%' },
  },
  emits: ['node-click', 'edge-click', 'step-change'],
  setup(props, { emit, expose }) {
    const hostRef = ref(null);
    let vp = null;

    const buildGraph = () => {
      if (props.config) return props.config;
      if (props.dsl) {
        try { return parseDSL(props.dsl); }
        catch (e) { console.error('[rl-flow] DSL parse error:', e); return null; }
      }
      return null;
    };

    onMounted(() => {
      const graph = buildGraph();
      if (!graph || !hostRef.value) return;
      vp = mount(hostRef.value, {
        graph,
        styleName: props.style || graph.style || 'sleek',
        activeNodes: props.activeNodes || [],
        activeEdges: props.activeEdges || [],
        controls: props.controls,
        player: props.player,
        autoplay: props.autoplay,
        interval: props.interval,
        speed: props.speed,
        onNodeClick: (id) => emit('node-click', { id }),
        onEdgeClick: (id) => emit('edge-click', { id }),
        onStepChange: (index, step) => emit('step-change', { index, step }),
      });
    });

    onBeforeUnmount(() => { if (vp) { vp.destroy(); vp = null; } });

    // React to prop changes — re-mount or hot-update as appropriate.
    watch(() => [props.dsl, props.config], () => {
      if (!vp || !hostRef.value) return;
      const graph = buildGraph();
      if (!graph) return;
      vp.update({ graph, styleName: props.style || graph.style || 'sleek' });
    }, { deep: true });

    watch(() => props.style, (s) => { if (vp && s) vp.setStyle(s); });
    watch(() => [props.activeNodes, props.activeEdges], () => {
      if (vp) vp.setActive(props.activeNodes || [], props.activeEdges || []);
    }, { deep: true });

    // Expose the viewport handle so refs from the parent can drive playback.
    expose({
      play:        () => vp && vp.play(),
      pause:       () => vp && vp.pause(),
      togglePlay:  () => vp && vp.togglePlay(),
      nextStep:    () => vp && vp.nextStep(),
      prevStep:    () => vp && vp.prevStep(),
      gotoStep:    (i) => vp && vp.gotoStep(i),
      setStyle:    (s) => vp && vp.setStyle(s),
      setZoom:     (z) => vp && vp.setZoom(z),
      resetView:   () => vp && vp.resetView(),
      download:    () => vp && vp.download(),
      toggleFullscreen: () => vp && vp.toggleFullscreen(),
    });

    return () => h('div', {
      ref: hostRef,
      style: { width: props.width, height: props.height },
    });
  },
});

export default RLFlow;
