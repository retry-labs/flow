# @retry-labs/flow — Roadmap to compete with Mermaid, ReactFlow, D2

The strategic goal is to deliver everything users pay for in commercial
diagram tools — for free, open source, and with a better default look.

This roadmap is organized into 12 phases. Each phase has concrete tasks
sized in 1–3 hour chunks. Phases are ordered by dependency and impact.
Items marked `[done]` are already shipped; `[ ]` is queued.

## Hard constraint — standalone bundle stays dependency-free

`dist/flow.standalone.js` must always work as a drop-in `<script>` tag
with **zero external runtime dependencies**. React is bundled in;
nothing else can be added to that runtime path.

Practical implications for the roadmap:
- **All layouts** (dagre, force-directed, radial, tree) are hand-rolled
  in `src/layouts/*.js`. No `d3-force`, no `@dagrejs/dagre`, no
  `cytoscape`.
- **ELK** is opt-in only — ships as a *separate* subpath
  (`@retry-labs/flow/elk`) that consumers explicitly import. Never
  bundled into the IIFE.
- **Yjs / collab** is an opt-in subpath, not bundled in standalone.
- **AI features** use raw `fetch()` with the user's BYO API key. No
  `@anthropic-ai/sdk`, no `openai` SDK in the runtime path.
- **Tooling** (CLI, VS Code extension, GitHub Action) lives in
  `packages/flow-*` siblings and may have its own deps — but must
  never be imported by `packages/flow/src/`.

---

## Phase 1 — Multi-type diagram architecture

Currently the library renders one kind of diagram (architecture / flow).
Mermaid wins on having 20+ diagram types. We need a clean type-aware
abstraction so adding sequence/state/ER/mindmap doesn't fork the
codebase 4 times.

- [ ] T1.1 Design diagram-type contract (parse, layout, render).
- [ ] T1.2 Introduce `DIAGRAM_TYPES` registry in `src/types.js`.
- [ ] T1.3 Refactor parser entry to dispatch on `type:` directive (default `'flow'`).
- [ ] T1.4 Refactor `renderSVG` to dispatch on type → type-specific renderer.
- [ ] T1.5 Update `mount()` viewport to forward type through.
- [ ] T1.6 Backwards-compat: graphs without `type:` still parse + render as `flow`.
- [ ] T1.7 Tests: existing 10 suites still green; new test for registry dispatch.

## Phase 2 — Layout engines (beats D2's "Tala" premium)

D2 charges $299/year for their proprietary Tala layout. Dagre + ELK
together cover the same ground for free.

- [ ] T2.1 Add `LAYOUT_ENGINES` registry; route `layout:` directive to engines.
- [ ] T2.2 Port / wrap dagre as the `dagre` engine.
- [ ] T2.3 Switch the default DAG layout from rank-based to dagre when graph has edges.
- [ ] T2.4 Implement Fruchterman-Reingold `force` layout.
- [ ] T2.5 Implement `radial` layout (for mindmaps and hierarchies).
- [ ] T2.6 Implement `tree` layout (top-down hierarchy).
- [ ] T2.7 Optional: integrate elkjs as `elk` engine — ships from a *separate* subpath (`@retry-labs/flow/elk`), never bundled into standalone.
- [ ] T2.8 Document layout directive + tradeoffs in README.
- [ ] T2.9 Tests for each engine (no overlap, reasonable bounds).

## Phase 3 — Sequence diagram type

The #1 Mermaid use case. Adds participants, lifelines, messages,
activations, notes, loops/alts.

- [ ] T3.1 Sequence IR design: `{ actors: [], messages: [], notes: [], frames: [] }`.
- [ ] T3.2 Sequence parser: `participant`, `actor`, `Alice ->> Bob: msg`, `-->>` async, `Note over`.
- [ ] T3.3 Sequence parser: `loop`, `alt`/`else`, `opt`, `par` frames.
- [ ] T3.4 Sequence layout: vertical lifelines, messages stacked by order, frame nesting.
- [ ] T3.5 Sequence renderer: actor boxes top, lifelines, messages with arrow types.
- [ ] T3.6 Self-message rendering (arc back).
- [ ] T3.7 Activation bars on lifelines (when actor is "active").
- [ ] T3.8 Frame rendering: loop/alt/opt boxes around grouped messages.
- [ ] T3.9 Tests: parse + render 3 examples (login flow, retry, alt branches).
- [ ] T3.10 Showcase example + docs.

## Phase 4 — State diagram type

States, transitions, composite states. Same IR shape as flow but with
extra semantics (entry/exit/internal actions).

- [ ] T4.1 State IR: `{ states[], transitions[] }` with initial/final markers.
- [ ] T4.2 Parser: `[*] --> Idle`, `Idle --> Working: trigger`, composite states.
- [ ] T4.3 Layout: reuse dagre for transition graph.
- [ ] T4.4 Renderer: rounded state boxes, initial/final dots, transition labels.
- [ ] T4.5 Composite state rendering (state-within-state grouping).
- [ ] T4.6 Tests + showcase.

## Phase 5 — ER diagram type

Entities + relationships + cardinality (crow's-foot notation).

- [ ] T5.1 ER IR: `{ entities: [{ id, attrs }], relationships: [{ from, to, cardinality }] }`.
- [ ] T5.2 Parser: `Customer { string name PK }`, `Customer ||--o{ Order : places`.
- [ ] T5.3 Layout: dagre with entity boxes as nodes.
- [ ] T5.4 Renderer: entity tables with attribute rows, crow's-foot endings.
- [ ] T5.5 Tests + showcase.

## Phase 6 — Mindmap diagram type

Radial tree from a root. Uses the force-directed/radial layout.

- [ ] T6.1 Mindmap IR: tree of nodes.
- [ ] T6.2 Parser: indentation-based hierarchy under `mindmap` type.
- [ ] T6.3 Layout: radial — children placed in arcs around parent.
- [ ] T6.4 Renderer: curved branches, varying line weight per depth.
- [ ] T6.5 Tests + showcase.

## Phase 7 — VS Code extension

Live preview pane + autocomplete + hover hints. Mermaid's VS Code
extension is the #1 driver of their adoption among devs.

- [ ] T7.1 Create `packages/flow-vscode/` package.
- [ ] T7.2 Implement preview webview (hosts standalone bundle).
- [ ] T7.3 Live re-render on file save / cursor change.
- [ ] T7.4 TextMate grammar for `.rlflow` / `.flow` files.
- [ ] T7.5 Completion provider for `kind:` / `icon:` / `shape:` / `style:`.
- [ ] T7.6 Hover provider showing kind/icon previews.
- [ ] T7.7 "Export as SVG" command.
- [ ] T7.8 Build + package as VSIX; publish to marketplace.

## Phase 8 — GitHub Action (Markdown rendering)

Mermaid's distribution advantage is GitHub rendering ` ```mermaid ` code
fences natively. We can't ship into GitHub itself, but we can ship an
Action that pre-renders ` ```rl-flow ` fences into PR comments / commits.

- [ ] T8.1 Create `packages/flow-action/` package.
- [ ] T8.2 Walk markdown files in the repo, extract `rl-flow` code fences.
- [ ] T8.3 Render each fence to SVG, write to `assets/diagrams/`.
- [ ] T8.4 Replace fence with image link in the rendered markdown.
- [ ] T8.5 Open PR / commit with the changes.
- [ ] T8.6 `action.yml` descriptor + README with usage example.
- [ ] T8.7 Test on a sample repo.

## Phase 9 — AI playground (BYO API key)

Mermaid Chart charges $30/mo for natural-language → diagram. Ship the
same feature client-side with the user's own API key.

- [ ] T9.1 New website page: `website/ai.html`.
- [ ] T9.2 Provider selector (Claude / OpenAI / Gemini).
- [ ] T9.3 API key input → stored in `localStorage` (never sent to us).
- [ ] T9.4 Prompt textarea + "Generate" button.
- [ ] T9.5 Call the user-selected API via raw `fetch()` (NO SDK imports — keeps standalone bundle clean).
- [ ] T9.6 Parse response, extract DSL fence, render via standalone bundle.
- [ ] T9.7 Side-by-side: prompt | DSL | diagram. Iterate by editing prompt.
- [ ] T9.8 Save prompt history to `localStorage`.
- [ ] T9.9 Privacy banner (BYO key, nothing routed through our servers).

## Phase 10 — Interactive authoring (beats ReactFlow Pro)

ReactFlow Pro charges $400-1500/year for drag-to-reposition + smart
routing + undo/redo. Ship the equivalent open.

- [ ] T10.1 Drag node to reposition (vanilla + React).
- [ ] T10.2 Snap-to-grid option.
- [ ] T10.3 Connection handles: drag from a node side → create edge.
- [ ] T10.4 Multi-select + marquee.
- [ ] T10.5 Group move when multiple selected.
- [ ] T10.6 Undo/redo via command-stack pattern.
- [ ] T10.7 Keyboard shortcuts (Cmd+Z / Cmd+Shift+Z / arrow keys).
- [ ] T10.8 Tests + showcase: edit-in-place demo on the website.

## Phase 11 — Collab (beats Mermaid Chart team plan)

Real-time multi-cursor editing via Yjs. We ship the client + a
self-host server, not a hosted SaaS.

- [ ] T11.1 Add yjs + y-protocols **only to the opt-in `@retry-labs/flow/collab` subpath bundle**, never to the standalone IIFE.
- [ ] T11.2 Wrap the graph IR in a Y.Doc.
- [ ] T11.3 Two-way bind DSL edits ↔ Y.Doc.
- [ ] T11.4 WebRTC provider for peer-to-peer (no server needed).
- [ ] T11.5 Optional WebSocket provider with self-host instructions.
- [ ] T11.6 Cursor presence indicators (other-user cursors in the editor).
- [ ] T11.7 Showcase: open the same editor link in two tabs, see live updates.

## Phase 12 — Polish + distribution

Smaller items that compound into "the most polished free option."

- [ ] T12.1 Edge draw-on for iso / blueprint / city styles (currently sleek + sketch only).
- [ ] T12.2 Dark variants for sleek / sketch (only blueprint is dark today).
- [ ] T12.3 Theming tokens API (override fonts / radii / shadows without forking).
- [ ] T12.4 KaTeX support in labels (`label: "$\\sum_{i=1}^n x_i$"`).
- [ ] T12.5 Export as animated GIF / MP4 of the step player.
- [ ] T12.6 Export as PDF (vector).
- [ ] T12.7 Lucid/draw.io import (parse their XML → RLFlow DSL).
- [ ] T12.8 Performance: virtualize for 1000+ node graphs.
- [ ] T12.9 Internationalization / RTL support.
- [ ] T12.10 Plugin system: third-party shapes / layouts / styles published as npm packages.

---

## Order of execution

Foundation first (Phases 1+2) because everything else builds on them.
Then ship one diagram type (Phase 3 — sequence) end-to-end to validate
the architecture. Then VS Code extension (Phase 7) for distribution.
Then more diagram types (4-6). Then AI (Phase 9). Interactive authoring
(Phase 10) and collab (Phase 11) are biggest scope — leave for last.

```
Phase 1 → Phase 2 → Phase 3 → Phase 7 → Phase 8
                         ↓
                  Phases 4, 5, 6
                         ↓
                     Phase 9
                         ↓
                  Phases 10, 11, 12
```
