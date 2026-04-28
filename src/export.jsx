/**
 * Export Utility - handles serialization of SVG for external use
 */

export function downloadSVG(svgElement, filename = "diagram.svg") {
  if (!svgElement) return

  // Clone to avoid mutating the live DOM
  const clone = svgElement.cloneNode(true)

  // Ensure standard namespaces
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg")
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink")

  // Add font import
  const style = document.createElement("style")
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;600&family=JetBrains+Mono:wght@400;600&display=swap');
    svg { font-family: 'Inter Tight', sans-serif; }
  `
  clone.insertBefore(style, clone.firstChild)

  // Set explicit dimensions
  const bbox = svgElement.getBBox()
  const padding = 40
  clone.setAttribute("width", bbox.width + padding * 2)
  clone.setAttribute("height", bbox.height + padding * 2)
  clone.setAttribute("viewBox", `${bbox.x - padding} ${bbox.y - padding} ${bbox.width + padding * 2} ${bbox.height + padding * 2}`)

  // Serialize to string
  const serializer = new XMLSerializer()
  let source = serializer.serializeToString(clone)

  // Add XML declaration
  if (!source.startsWith('<?xml')) {
    source = '<?xml version="1.0" standalone="no"?>\r\n' + source
  }

  // Create download link
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export default downloadSVG
