// -----------------------------------------------------------
// Player — the hero piece.
// Steps play through the diagram. For each step, we light up
// the active nodes & edges, run the edge flow animation, and
// show the narration.
// -----------------------------------------------------------

const { EXAMPLE_GRAPH, EXAMPLE_GRAPH_FLAT, STYLES, Diagram } = window.Flow;

function Player() {
  const [styleId, setStyleId] = React.useState("sleek");
  const [stepIdx, setStepIdx] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [autoAdvance] = React.useState(true);
  
  const graphToUse = STYLES[styleId].isometric ? EXAMPLE_GRAPH : EXAMPLE_GRAPH_FLAT;
  const steps = graphToUse.steps;
  const step = steps[stepIdx];

  // Playback timer
  React.useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      setStepIdx(i => {
        if (i + 1 >= steps.length) { setPlaying(false); return i; }
        return i + 1;
      });
    }, 2400);
    return () => clearTimeout(t);
  }, [playing, stepIdx, steps.length]);

  const active = step.active;
  const styleTokens = STYLES[styleId].tokens;

  return (
    <div className="player">
      <div className="player-canvas" style={{ background: styleTokens.bg }}>
        <Diagram
          graph={graphToUse}
          style={styleId}
          activeNodes={active.nodes}
          activeEdges={active.edges}
        />
        <div className="player-overlay">
          <div className="overlay-pill">
            <span className="overlay-dot"/>
            <span className="overlay-text">playing step {stepIdx + 1} of {steps.length}</span>
          </div>
        </div>
      </div>

      <aside className="player-side">
        <div className="side-head">
          <div className="side-label">playback</div>
          <div className="style-switcher">
            {Object.values(STYLES).map(s => (
              <button key={s.id}
                className={"style-chip " + (s.id === styleId ? "is-active" : "")}
                onClick={() => setStyleId(s.id)}>
                {s.name}
              </button>
            ))}
          </div>
        </div>

        <div className="transport">
          <button className="transport-btn" onClick={() => setStepIdx(Math.max(0, stepIdx - 1))} aria-label="prev">
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M10 2 L4 7 L10 12" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round"/></svg>
          </button>
          <button className="transport-btn play" onClick={() => {
            if (stepIdx >= steps.length - 1) setStepIdx(0);
            setPlaying(p => !p);
          }} aria-label="play">
            {playing ? (
              <svg width="16" height="16" viewBox="0 0 16 16"><rect x="3" y="2" width="3" height="12" fill="currentColor"/><rect x="10" y="2" width="3" height="12" fill="currentColor"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 2 L13 8 L4 14 Z" fill="currentColor"/></svg>
            )}
          </button>
          <button className="transport-btn" onClick={() => setStepIdx(Math.min(steps.length - 1, stepIdx + 1))} aria-label="next">
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M4 2 L10 7 L4 12" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round"/></svg>
          </button>
          <div className="transport-time">
            <span className="tt-cur">{String(stepIdx + 1).padStart(2, "0")}</span>
            <span className="tt-sep">/</span>
            <span className="tt-tot">{String(steps.length).padStart(2, "0")}</span>
          </div>
        </div>

        <div className="step-list">
          {steps.map((s, i) => (
            <button key={s.id}
              className={"step-item " + (i === stepIdx ? "is-active" : "") + (i < stepIdx ? " is-done" : "")}
              onClick={() => { setStepIdx(i); setPlaying(false); }}>
              <div className="step-dot">
                <span className="step-dot-num">{i + 1}</span>
              </div>
              <div className="step-body">
                <div className="step-title">{s.title}</div>
                {i === stepIdx && <div className="step-nar">{s.narration}</div>}
              </div>
            </button>
          ))}
        </div>

        <div className="side-foot">
          <div className="side-foot-col">
            <div className="k">active nodes</div>
            <div className="v mono">{active.nodes.length}</div>
          </div>
          <div className="side-foot-col">
            <div className="k">active edges</div>
            <div className="v mono">{active.edges.length}</div>
          </div>
          <div className="side-foot-col">
            <div className="k">style</div>
            <div className="v mono">{styleId}</div>
          </div>
        </div>
      </aside>
    </div>
  );
}

window.Flow = Object.assign(window.Flow || {}, { Player });
