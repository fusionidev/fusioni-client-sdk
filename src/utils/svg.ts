const tags = new Set([
  'svg', 'g', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'title', 'desc',
  'defs', 'lineargradient', 'radialgradient', 'stop', 'clippath', 'mask',
]);
const attributes = new Set([
  'id', 'viewbox', 'preserveaspectratio', 'd', 'fill', 'fill-opacity', 'fill-rule',
  'stroke', 'stroke-opacity', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
  'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'clip-path', 'clip-rule',
  'mask', 'maskunits', 'maskcontentunits', 'clippathunits', 'cx', 'cy', 'r', 'rx', 'ry',
  'fx', 'fy', 'fr', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'points',
  'transform', 'opacity', 'gradientunits', 'gradienttransform', 'spreadmethod',
  'offset', 'stop-color', 'stop-opacity', 'href', 'xlink:href',
]);
const presentationStyles = [
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-opacity', 'stroke-width',
  'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray',
  'stroke-dashoffset', 'clip-path', 'clip-rule', 'mask', 'opacity', 'stop-color', 'stop-opacity',
];
const referenceAttributes = new Set(['fill', 'stroke', 'clip-path', 'mask']);
let nextSvgId = 0;

/** Preserve SVG artwork and shading, allowing references only within this icon. */
export function safeSvg(source?: string | null, useCurrentColor = false): string | null {
  if (!source || !/<svg\b/i.test(source) || typeof DOMParser === 'undefined') return null;
  const doc = new DOMParser().parseFromString(source.replace(/^```(?:svg)?\s*/i, '').replace(/\s*```$/, ''), 'text/html');
  const svg = doc.querySelector('svg');
  if (!svg) return null;

  for (const el of Array.from(svg.querySelectorAll('*'))) {
    if (!tags.has(el.tagName.toLowerCase())) el.remove();
  }
  const elements = [svg, ...Array.from(svg.querySelectorAll('*'))];
  const prefix = `fusioni-icon-${++nextSvgId}`;
  const ids = new Map<string, string>();
  for (const el of elements) {
    const id = el.getAttribute('id');
    if (id && /^[\w:.-]+$/.test(id) && !ids.has(id)) ids.set(id, `${prefix}-${ids.size}`);
  }

  for (const el of elements) {
    // Retain only graphical inline styles; discard CSS that could affect the host page.
    for (const property of presentationStyles) {
      const value = (el as SVGElement).style.getPropertyValue(property).trim();
      if (value) el.setAttribute(property, value);
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (!attributes.has(name)) {
        el.removeAttribute(attr.name);
      } else if (name === 'id') {
        const id = ids.get(attr.value);
        if (id) el.setAttribute(attr.name, id);
        else el.removeAttribute(attr.name);
      } else if (name === 'href' || name === 'xlink:href') {
        const id = attr.value.startsWith('#') ? ids.get(attr.value.slice(1)) : undefined;
        if (id) el.setAttribute(attr.name, `#${id}`);
        else el.removeAttribute(attr.name);
      } else if (attr.value.includes('\\') || /url\s*\(/i.test(attr.value)) {
        const reference = attr.value.match(/^url\(\s*(['"]?)#([\w:.-]+)\1\s*\)$/i);
        const id = reference && referenceAttributes.has(name) ? ids.get(reference[2]) : undefined;
        if (id) el.setAttribute(attr.name, `url(#${id})`);
        else el.removeAttribute(attr.name);
      }
    }
  }
  // Color unpainted solid icons while respecting explicit accent colors and shading.
  if (useCurrentColor && !svg.hasAttribute('fill')) svg.setAttribute('fill', 'currentColor');
  return svg.outerHTML;
}
