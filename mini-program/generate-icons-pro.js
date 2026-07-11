/**
 * Generate professional 81x81 PNG tabbar icons from SVG vectors.
 * Uses @resvg/resvg-js for high-quality rendering.
 */
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

// Icon SVG definitions (24x24 viewBox, stroke-based, 2px stroke width)
// Style: Tabler Icons / Lucide inspired - clean, modern, professional
const ICONS = {
  home: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="{COLOR}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 12l9-9 9 9"/>
    <path d="M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10"/>
    <path d="M9 21v-6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6"/>
  </svg>`,

  workhours: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="{COLOR}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="9"/>
    <polyline points="12 7 12 12 15 14"/>
  </svg>`,

  salary: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="{COLOR}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="2"/>
    <circle cx="12" cy="12" r="2.5"/>
    <path d="M6 12h.01M18 12h.01"/>
  </svg>`,

  community: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="{COLOR}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>`,

  profile: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="{COLOR}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>`
};

const INACTIVE = '#9CA3AF';
const ACTIVE = '#2864AC';
const SIZE = 81; // WeChat tabbar standard size

function renderPng(svgTemplate, color) {
  const svg = svgTemplate.replace(/\{COLOR\}/g, color);
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: SIZE },
    background: 'rgba(0,0,0,0)'
  });
  const pngBuffer = resvg.render().asPng();
  return pngBuffer;
}

const outDir = path.join(__dirname, 'images', 'tabbar');
fs.mkdirSync(outDir, { recursive: true });

const configs = [
  { name: 'home', svg: ICONS.home },
  { name: 'workhours', svg: ICONS.workhours },
  { name: 'salary', svg: ICONS.salary },
  { name: 'community', svg: ICONS.community },
  { name: 'profile', svg: ICONS.profile }
];

const generated = [];
for (const cfg of configs) {
  // Inactive (gray)
  const inactivePng = renderPng(cfg.svg, INACTIVE);
  fs.writeFileSync(path.join(outDir, cfg.name + '.png'), inactivePng);
  // Active (primary blue)
  const activePng = renderPng(cfg.svg, ACTIVE);
  fs.writeFileSync(path.join(outDir, cfg.name + '-active.png'), activePng);
  generated.push(cfg.name + '.png', cfg.name + '-active.png');
}

console.log('Generated ' + generated.length + ' professional icons:');
generated.forEach(f => console.log(' - ' + f));
console.log('Size: ' + SIZE + 'x' + SIZE + 'px (PNG, transparent background)');
console.log('Style: Tabler Icons inspired (2px stroke, rounded)');
console.log('Colors: inactive=' + INACTIVE + ', active=' + ACTIVE);
