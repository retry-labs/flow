# Changelog

All notable changes to **flow-diagram** are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] — production-ready vanilla parity

The headline change in this cycle: **the standalone JavaScript bundle is now
feature-equivalent to the React / Vue / Angular wrappers**. One file, no
peer deps, every interactive feature on board.

### Added

- **`mount(target, options)` API** (`src/viewport.js`) — drop-in vanilla viewport
  with built-in zoom, pan, fullscreen, SVG download, hover-revealing control
  panel, and a step player. Returns a handle with `setStyle`, `setActive`,
  `setZoom`, `resetView`, `toggleFullscreen`, `download`, `play`, `pause`,
  `togglePlay`, `nextStep`, `prevStep`, `gotoStep`, `setInterval`, `destroy`,
  and the `stepIndex` getter.
- **Step player**: when `graph.steps` exists, the viewport auto-renders a
  prev / play-pause / step-counter / next group plus a caption. Honours
  `autoplay`, `interval`, `stepIndex`, and `onStepChange`. The
  `<flow-diagram>` web component exposes the same imperative methods and
  dispatches a `step-change` `CustomEvent`.
- **React wrapper player support**: `<FlowDiagram autoplay interval onStepChange />`
  derives active nodes/edges from the current step automatically.
- **Vue 3 wrapper player support**: matching props plus a `step-change` event.
- **DSL serializer** `graphToDSL(graph, { compact })` — round-trips with
  `parseDSL`; `compact: true` strips coordinates for a clean source view.
- **Top-level DSL directives** `style:` and `title:` parsed and honoured by
  `renderSVG` / `mount`.
- **Smart auto-layout** in `resolveGraph`: if any node omits `x`/`y`, the
  resolver assigns ranks by longest-path and lays nodes out left-to-right
  with sensible canvas sizing. Existing positioned nodes are preserved.
- **Live editor page** `editor.html` — DSL textarea with live preview, style
  chips, template selector, shareable hash link, and download SVG button.
- **Curated showcase page** `showcase.html` — eight real-world diagrams
  (microservice, event-driven, auth, CDN, realtime, city, boundary, flow)
  with per-card DSL / JSON / compact source viewer.
- **Documentation site** `docs.html` — DSL grammar, full kind / edge / style
  galleries, interactive-features reference (zoom · pan · fullscreen · player),
  click-handler docs, and a complete JavaScript API reference.
- **CSS keyframe animations embedded in the SVG `<defs>`** so exported SVGs
  retain the active-node pulse glow when viewed standalone.
- **Embedded `data-node-id` / `data-edge-id` attributes** on every rendered
  node and edge — used by `onNodeClick` / `onEdgeClick` and by the web
  component's bubbling `node-click` / `edge-click` events.
- **Tests**: `scripts/showcase-test.cjs`, `scripts/viewport-test.cjs`,
  `scripts/mount-e2e.cjs` (jsdom), and `scripts/player-test.cjs` (jsdom).
  All wired into `npm test`. Total suite: **28 / 28 passing**.

### Changed

- **Standalone bundle** (`dist/flow-diagram.standalone.js`) now exposes
  the full library API on `window.FlowDiagram`, including `mount`,
  `renderSVG`, `parseDSL`, `graphToDSL`, `resolveGraph`, `SVG_STYLES`,
  and the shape helpers.
- **`<flow-diagram>` web component** now uses the new `mount()` viewport
  internally, gaining the floating control panel, the step player, and a
  consistent look on every page (no more orphan diagrams without controls).
- **City style** rewritten to match the reference React renderer:
  isometric projection with proper depth-sort, projected bounds, and
  split `cityEdge` / `cityEdgeOverlay` so labels render above the
  isometric block geometry. Edge overlays are now positioned in screen
  space rather than inside the isometric transform.
- **Sleek style** node bodies refactored to mirror the reference React
  renderer; active-state glow uses keyframed CSS (`sleek-pulse`) embedded
  directly in `<defs>`.
- **DSL parser** correctly handles unquoted values with trailing commas
  and coerces numeric fields. Edge regex hardened against the same
  comma-trailing pattern.
- **Edge anchor logic** (`sideCandidates`) now returns opposite sides for
  edge-enter anchors so labels and arrowheads land on the right edge.
- **README** rewritten to lead with the `mount()` API, document the new
  bundle sizes, link the editor / showcase / docs pages, and remove the
  stale React+ReactDOM plain-HTML example.

### Fixed

- Hero animation on `index.html` no longer crashed on a syntax error
  introduced by the legacy `tickHero()` orphan code path; the viewport's
  `autoplay` + `onStepChange` now drives both the diagram and the
  chrome labels.
- Stale-cached standalone bundle no longer prevents pages from
  rendering: every demo loads the bundle with a `?v=3` cache-bust
  querystring and the page has a defensive fallback polyfill for
  `FD.mount`.
- Edge labels in the `city` style no longer get clipped by isometric
  block geometry.
- Auto-layout no longer mis-positions `boundary` nodes (now treated as
  layout containers and skipped during rank assignment).

### Removed

- `index.html.bak` and `legacy-react-demo.html` removed from the repo root.
- Internal "dumb grid" fallback removed from `parser.js` — auto-layout
  is now centralized in `resolveGraph` for consistent behaviour across
  the React `Diagram`, vanilla `mount`, and SSR `renderSVG`.

### Tooling

- `package.json` gained `test:showcase`, `test:viewport`, `test:mount`,
  and `test:player` scripts; the umbrella `npm test` runs all of them.
- Added `jsdom` as a devDependency for the mount and player E2E tests.
