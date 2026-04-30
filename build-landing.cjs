const fs = require('fs');
const babel = require('@babel/core');

const files = [
  'src/graph.jsx', 'src/shapes.jsx', 'src/renderers.jsx',
  'src/player.jsx', 'src/catalogs.jsx', 'src/dsl.jsx',
  'src/playground.jsx', 'src/tokens.jsx', 'src/parser.jsx',
  'src/export.jsx', 'src/mount.jsx'
];

let output = '';
files.forEach(f => {
  let code = fs.readFileSync(f, 'utf8');
  // Remove export statements that don't apply to inline script
  code = code.replace(/export const STYLES.*/, '');
  code = code.replace(/export \{.*\}.*/, '');
  
  const result = babel.transformSync(code, {
    filename: f,
    presets: [['@babel/preset-react', { runtime: 'automatic' }]],
    plugins: [],
    configFile: false,
    ast: false,
    code: true
  });
  
  output += '\n// === ' + f + ' ===\n' + result.code + '\n';
});

// Get base HTML - use original
let html = fs.readFileSync('index.html.bak4', 'utf8');
originalHtml = fs.readFileSync('reference/index.html', 'utf8');

// Replace babel script tags with compiled JS and keep HTML structure
const lines = originalHtml.split('\n');
let resultHtml = '';
let inBabelSrc = false;
for (let line of lines) {
  if (line.includes('<script src="https://unpkg.com/@babel/standalone')) {
    resultHtml += line + '\n';
    resultHtml += '<script>\n' + output + '</script>\n';
    inBabelSrc = true;
  } else if (inBabelSrc && line.includes('<script type="text/babel"')) {
    continue;
  } else if (inBabelSrc && line.includes('const btn = document.getElementById')) {
    resultHtml += '<script>\n' + line + '\n';
  } else if (inBabelSrc && line.trim().startsWith('<script>') && !line.includes('text/babel')) {
    continue;
  } else if (inBabelSrc && line.includes('</script>') && !line.includes('flow-diagram')) {
    resultHtml += line + '\n';
    inBabelSrc = false;
  } else if (inBabelSrc && line.includes('flow-diagram')) {
    resultHtml += line + '\n';
    inBabelSrc = false;
  } else if (!inBabelSrc && !line.includes('<script type="text/babel"')) {
    resultHtml += line + '\n';
  }
}

fs.writeFileSync('index.html', resultHtml);
console.log('Landing page pre-compiled');
