// -----------------------------------------------------------
// Built-in icon sprite library. Each entry returns an `<svg>`
// fragment string sized to a 24×24 viewBox so renderers can
// drop it inside a node at whatever scale they want.
//
// The shapes are deliberately simple monochrome glyphs rather
// than brand-accurate logos — they read at small sizes inside
// architecture nodes, and they sidestep trademark concerns.
//
// Usage from a DSL:
//
//     nodes:
//       - id: pg, kind: store, label: Postgres, icon: "postgres"
//
// Looking up by name returns the inner-SVG markup (no <svg>
// wrapper) so the renderer controls width/height/color.
// Unknown names return null — renderers fall back silently.
// -----------------------------------------------------------

// Inner-SVG fragments. All paths assume currentColor for fills/strokes
// so the host renderer can tint via fill / stroke on the wrapping <g>.
const ICONS = {
  // Databases
  postgres: '<path d="M12 3c4 0 7 1 7 3v12c0 2-3 3-7 3s-7-1-7-3V6c0-2 3-3 7-3z" fill="none" stroke="currentColor" stroke-width="1.8"/><ellipse cx="12" cy="6" rx="7" ry="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9 11l3 2 3-2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  mysql:    '<path d="M3 12c0-3 2-5 5-5h8c3 0 5 2 5 5s-2 5-5 5h-8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 17l-3 3 3-3z" fill="currentColor"/><path d="M7 11l2 1 2-1m2 0l2 1 2-1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  mongo:    '<path d="M12 2c-2 4-4 6-4 11 0 4 2 7 4 9 2-2 4-5 4-9 0-5-2-7-4-11z" fill="none" stroke="currentColor" stroke-width="1.6"/><line x1="12" y1="22" x2="12" y2="16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  redis:    '<path d="M3 8l9-4 9 4-9 4-9-4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M3 12l9 4 9-4M3 16l9 4 9-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  sqlite:   '<rect x="3" y="6" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 10h18M8 10v8M14 10v8" stroke="currentColor" stroke-width="1.4"/>',

  // Messaging
  kafka:    '<circle cx="6" cy="6" r="2" fill="currentColor"/><circle cx="6" cy="18" r="2" fill="currentColor"/><circle cx="18" cy="12" r="2" fill="currentColor"/><path d="M8 7l8 4M8 17l8-4" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  rabbitmq: '<rect x="4" y="11" width="6" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="14" y="11" width="6" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="9" y="4" width="6" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/>',

  // Cloud / Infra
  's3':       '<path d="M5 7l7-3 7 3v10l-7 3-7-3V7z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M5 7l7 3 7-3M12 10v10" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  'aws-s3':   '<path d="M5 7l7-3 7 3v10l-7 3-7-3V7z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M5 7l7 3 7-3M12 10v10" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  aws:        '<path d="M3 14c3 2 7 3 9 3s6-1 9-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="6" cy="9" r="2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="7" r="2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="18" cy="9" r="2" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  gcp:        '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  azure:      '<path d="M3 19l7-13 4 6-5 3 6 4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  k8s:        '<polygon points="12,3 21,8 21,16 12,21 3,16 3,8" fill="none" stroke="currentColor" stroke-width="1.6"/><polygon points="12,7 17,10 17,14 12,17 7,14 7,10" fill="none" stroke="currentColor" stroke-width="1.4"/>',
  docker:     '<rect x="3" y="11" width="3" height="3" fill="currentColor"/><rect x="7" y="11" width="3" height="3" fill="currentColor"/><rect x="11" y="11" width="3" height="3" fill="currentColor"/><rect x="7" y="7" width="3" height="3" fill="currentColor"/><rect x="11" y="7" width="3" height="3" fill="currentColor"/><path d="M3 15h13c3 0 5-2 5-5" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  nginx:      '<path d="M3 5l9-2 9 2v14l-9 2-9-2V5z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 16V9l8 6V9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  cloudflare: '<path d="M5 14c-1-3 1-6 4-6 1-2 4-3 6-2 3 0 5 2 5 5 0 0 0 0 0 0H7c-1 0-2 1-2 2z" fill="none" stroke="currentColor" stroke-width="1.6"/>',

  // Source control / CI
  github:     '<path d="M12 3a9 9 0 00-3 17.5c.5.1.7-.2.7-.5v-2c-3 .6-3.5-1-3.5-1-.5-1-1-1.5-1-1.5-.8-.5 0-.5 0-.5 1 0 1.5 1 1.5 1 .9 1.5 2.5 1 3 .8.1-.6.4-1 .7-1.3-2.2-.2-4.5-1.1-4.5-5 0-1 .3-1.9 1-2.5-.1-.3-.5-1.3.1-2.7 0 0 .8-.3 2.7 1a9 9 0 015 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.7.7 1 1.5 1 2.5 0 3.9-2.3 4.8-4.5 5 .4.3.7 1 .7 2v3c0 .3.2.6.7.5A9 9 0 0012 3z" fill="currentColor"/>',
  gitlab:     '<path d="M12 22l-9-7 2-9 3 6h8l3-6 2 9z" fill="currentColor"/>',
  git:        '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="6" cy="12" r="1.5" fill="currentColor"/><circle cx="18" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="6" r="1.5" fill="currentColor"/><circle cx="12" cy="18" r="1.5" fill="currentColor"/><path d="M6 12h12M12 6v12" stroke="currentColor" stroke-width="1.4"/>',

  // Languages / Runtimes
  node:       '<path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 9v4c0 1 1 2 2 2h3" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  python:     '<rect x="6" y="2" width="12" height="10" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="6" y="12" width="12" height="10" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="9" cy="6" r="1" fill="currentColor"/><circle cx="15" cy="18" r="1" fill="currentColor"/>',
  go:         '<path d="M4 14h7M3 11h6M5 17h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="17" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="19" cy="11" r="1" fill="currentColor"/>',
  rust:       '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 4v16M4 12h16M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="1.4"/>',
  java:       '<path d="M10 4c0 2 4 3 4 6s-3 4-3 4M12 14c0 0 5 1 5 4 0 1-1 2-3 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M5 19c3 1 11 1 14 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',

  // Frontend
  react:      '<circle cx="12" cy="12" r="2" fill="currentColor"/><ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="currentColor" stroke-width="1.4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" fill="none" stroke="currentColor" stroke-width="1.4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" fill="none" stroke="currentColor" stroke-width="1.4"/>',
  vue:        '<path d="M3 4l9 16 9-16h-4l-5 9-5-9z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  angular:    '<path d="M12 2L3 6l1 12 8 4 8-4 1-12z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 16l3-9 3 9M10 13h4" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" fill="none"/>',
  svelte:     '<path d="M16 6c-3-2-7-1-9 2L3 13c-2 3-1 7 2 9 3 2 7 1 9-2l4-5c2-3 1-7-2-9z" fill="none" stroke="currentColor" stroke-width="1.6"/>',

  // Comms / Auth / Misc
  graphql:    '<polygon points="12,3 21,8 21,16 12,21 3,16 3,8" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="3" r="1.5" fill="currentColor"/><circle cx="21" cy="8" r="1.5" fill="currentColor"/><circle cx="21" cy="16" r="1.5" fill="currentColor"/><circle cx="12" cy="21" r="1.5" fill="currentColor"/><circle cx="3" cy="16" r="1.5" fill="currentColor"/><circle cx="3" cy="8" r="1.5" fill="currentColor"/>',
  jwt:        '<rect x="3" y="9" width="18" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7 9v6M11 9v6M15 9v6M19 9v6" stroke="currentColor" stroke-width="1.4"/>',
  user:       '<circle cx="12" cy="9" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  globe:      '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" fill="none" stroke="currentColor" stroke-width="1.6"/>',
};

/**
 * Return the inner-SVG fragment string for a named icon, or null if
 * the name isn't registered. The fragment is positioned in a 24×24
 * coordinate system and uses currentColor so the caller controls tint.
 */
export function getIcon(name) {
  if (!name) return null;
  return ICONS[String(name).toLowerCase()] || null;
}

/**
 * List every registered icon name. Useful for autocompletion / docs.
 */
export function listIcons() {
  return Object.keys(ICONS).sort();
}

export default { getIcon, listIcons };
