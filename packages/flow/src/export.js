// -----------------------------------------------------------
// Export utilities — SVG download, PNG export, embed helpers.
// Zero dependencies. Works in any browser environment.
// -----------------------------------------------------------

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Caveat:wght@500;600&family=Instrument+Serif:ital@0;1&display=swap');`;

export function downloadSVG(svgElement, filename = 'diagram.svg') {
  if (!svgElement) return;

  const clone = svgElement.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  const style = document.createElement('style');
  style.textContent = FONT_IMPORT + '\nsvg { font-family: "Inter Tight", sans-serif; }';
  clone.insertBefore(style, clone.firstChild);

  try {
    const bbox = svgElement.getBBox();
    const pad  = 40;
    clone.setAttribute('width',   String(bbox.width  + pad * 2));
    clone.setAttribute('height',  String(bbox.height + pad * 2));
    clone.setAttribute('viewBox', `${bbox.x - pad} ${bbox.y - pad} ${bbox.width + pad * 2} ${bbox.height + pad * 2}`);
  } catch (_) {
    // getBBox not available (e.g. offscreen) — skip
  }

  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(clone);
  if (!source.startsWith('<?xml')) {
    source = '<?xml version="1.0" standalone="no"?>\r\n' + source;
  }

  const url  = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
  const link = document.createElement('a');
  link.href     = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function svgToString(svgElement) {
  if (!svgElement) return '';
  const clone = svgElement.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const style = document.createElement('style');
  style.textContent = FONT_IMPORT;
  clone.insertBefore(style, clone.firstChild);
  return new XMLSerializer().serializeToString(clone);
}

export function downloadPNG(svgElement, filename = 'diagram.png', scale = 2) {
  if (!svgElement) return;
  const svgStr = svgToString(svgElement);
  const blob   = new Blob([svgStr], { type: 'image/svg+xml' });
  const url    = URL.createObjectURL(blob);
  const img    = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width  = img.naturalWidth  * scale;
    canvas.height = img.naturalHeight * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    const link = document.createElement('a');
    link.href     = canvas.toDataURL('image/png');
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  img.src = url;
}

export default { downloadSVG, svgToString, downloadPNG };
