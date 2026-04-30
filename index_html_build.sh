#!/bin/bash
# Build landing page without inline JSX

# Use the UMD bundle
BUNDLE="dist/flow-diagram.umd.js"

# Get the style definitions from renderers
STYLES_DEF=$(cat <<'STYLES_EOF'
window.Flow = window.Flow || {};
const sleekTokens = {bg:"#faf7ef",grid:"#1a18140f",nodeBg:"#ffffff",nodeBorder:"#d9d3c6",nodeInk:"#1a1814",nodeSub:"#8f8779",edge:"#8f8779",edgeActive:"#f5c518",edgeLabel:"#6b6459",accent:"#f5c518"};
const sketchTokens = {bg:"#f8f6f2",grid:"#1a181410",nodeBg:"#fffdf9",nodeBorder:"#e8e0d4",nodeInk:"#2d2922",nodeSub:"#9a9287",edge:"#a0988f",edgeActive:"#e5a25a",edgeLabel:"#7a7266",accent:"#e5a25a"};
const isoTokens = {bg:"#0f1720",grid:"#ffffff0a",nodeBg:"#1a2433",nodeBorder:"#2d3a4d",nodeInk:"#e4eaf0",nodeSub:"#7a8ba3",edge:"#3a4a5c",edgeActive:"#f0b429",edgeLabel:"#5a6a7c",accent:"#f0b429"};
const blueprintTokens = {bg:"#050b14",grid:"#00a8ff15",nodeBg:"#001828",nodeBorder:"#004466",nodeInk:"#c8e8ff",nodeSub:"#5aa8cc",edge:"#006688",edgeActive:"#00d4ff",edgeLabel:"#0099bb",accent:"#00d4ff"};
const cityTokens = {bg:"#F9FAFB",ink:"#0f172a",muted:"#64748b",accent:"#007AFF",line:"#D1D5DB"};
window.Flow.STYLES = {
  sleek:{id:"sleek",name:"Sleek",tagline:"Modern and clean",tokens:sleekTokens,isIsometric:false},
  sketch:{id:"sketch",name:"Sketch",tagline:"Hand-drawn feel",tokens:sketchTokens,isIsometric:false},
  iso:{id:"iso",name:"Iso",tagline:"3D isometric",tokens:isoTokens,isIsometric:true},
  city:{id:"city",name:"City",tagline:"True 3D Map",tokens:cityTokens,isIsometric:true},
  blueprint:{id:"blueprint",name:"Blueprint",tagline:"Technical drawing",tokens:blueprintTokens,isIsometric:false}
};
STYLES_EOF
echo "$STYLES_DEF"
