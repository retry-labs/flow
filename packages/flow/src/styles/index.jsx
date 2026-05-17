import { BUILTIN_STYLES } from './renderers.jsx';

export const STYLES = { ...BUILTIN_STYLES };

const _registry = new Map(Object.entries(BUILTIN_STYLES));

export function registerStyle(name, styleModule) {
  const required = ['Node', 'Edge', 'tokens'];
  const missing = required.filter(k => !styleModule[k]);
  if (missing.length > 0) {
    throw new Error(`registerStyle("${name}"): missing required exports: ${missing.join(', ')}`);
  }
  if (_registry.has(name)) {
    console.warn(`rl-flow: style "${name}" is being overwritten`);
  }
  const entry = { ...styleModule, id: name };
  _registry.set(name, entry);
  STYLES[name] = entry;
}

export function getStyle(name) {
  return _registry.get(name) || BUILTIN_STYLES.sleek;
}

export function listStyles() {
  return Array.from(_registry.keys());
}

export default { STYLES, registerStyle, getStyle, listStyles };
