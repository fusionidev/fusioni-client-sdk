import React, {useMemo} from 'react';
import type {ActionExecutionState} from '../types/actionButtons';

const colors: Record<string, string> = {
  'text-blue-500': '#3b82f6', 'text-emerald-500': '#10b981', 'text-amber-500': '#f59e0b',
  'text-purple-500': '#a855f7', 'text-cyan-500': '#06b6d4', 'text-orange-500': '#f97316',
  'text-rose-500': '#f43f5e', 'text-pink-500': '#ec4899', 'text-indigo-500': '#6366f1',
  'text-red-500': '#ef4444', 'text-lime-500': '#84cc16', 'text-slate-500': '#64748b',
};
const paths: Record<string, string> = {
  iconoirMessage: 'M21 11a8 8 0 0 1-8 8H3l2-5a8 8 0 1 1 16-3Z',
  iconoirHeadset: 'M4 13v-2a8 8 0 0 1 16 0v2M4 13h3v6H4ZM17 13h3v6h-3ZM20 19v2h-6',
  iconoirSparks: 'm12 3 2 6 6 2-6 2-2 6-2-6-6-2 6-2ZM20 2v4M18 4h4',
  iconoirBrain: 'M12 5v15M12 5C7 0 3 5 5 9c-5 3-2 9 1 9 0 4 6 4 6 0M12 5c5-5 9 0 7 4 5 3 2 9-1 9 0 4-6 4-6 0',
  iconoirGlobe: 'M3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18ZM12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
  iconoirWrench: 'M15 3a6 6 0 0 0-6 8l-6 6a3 3 0 0 0 4 4l6-6a6 6 0 0 0 8-6l-4 4-4-4 4-4Z',
  iconoirPlus: 'M12 4v16M4 12h16', iconoirCheckCircle: 'M8 12l3 3 5-6M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
  iconoirUser: 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 21v-2a8 8 0 0 1 16 0v2',
  iconoirDatabase: 'M4 6c0-4 16-4 16 0s-16 4-16 0ZM4 6v12c0 4 16 4 16 0V6M4 12c0 4 16 4 16 0',
  iconoirSettings: 'm12 3 2 3 4-1 1 4 3 3-3 2 1 4-4 1-2 3-2-3-4 1-1-4-3-2 3-3-1-4 4 1ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  iconoirActivity: 'M2 12h5l3-8 4 16 3-8h5', iconoirCalendar: 'M4 5h16v16H4ZM8 2v6M16 2v6M4 10h16',
  iconoirCart: 'M2 3h3l3 13h11l3-10H6M9 19v2M18 19v2',
  iconoirBell: 'M5 17h14l-2-3V9a5 5 0 0 0-10 0v5ZM10 21h4',
  iconoirCamera: 'M3 6h5l2-3h4l2 3h5v14H3ZM12 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  iconoirCloud: 'M6 19h12a4 4 0 0 0 1-8 7 7 0 0 0-13-2 5 5 0 0 0 0 10Z',
  iconoirHome: 'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9', iconoirMail: 'M3 5h18v14H3ZM3 5l9 7 9-7',
  iconoirMap: 'm3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2ZM9 3v16M15 5v16',
  iconoirPhone: 'M5 3h4l2 5-3 2c1 3 3 5 6 6l2-3 5 2v4c-8 5-21-8-16-16Z',
  iconoirStar: 'm12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z',
  iconoirMediaImage: 'M3 3h18v18H3ZM3 17l5-5 4 4 4-6 5 7M7 7h1',
  iconoirVideoCamera: 'M3 6h12v12H3ZM15 10l6-4v12l-6-4',
  iconoirPlay: 'm8 4 12 8-12 8Z', iconoirPause: 'M7 4v16M17 4v16', iconoirSquare: 'M4 4h16v16H4Z',
};

function safeSvg(source?: string | null): string | null {
  if (!source?.includes('<svg') || typeof DOMParser === 'undefined') return null;
  const doc = new DOMParser().parseFromString(source.replace(/^```(?:svg)?\s*/i, '').replace(/\s*```$/, ''), 'text/html');
  const svg = doc.querySelector('svg');
  if (!svg) return null;
  const tags = new Set(['svg', 'g', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'title']);
  const attributes = new Set(['viewbox', 'd', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'points', 'transform', 'opacity']);
  for (const el of [svg, ...Array.from(svg.querySelectorAll('*'))]) {
    if (!tags.has(el.tagName.toLowerCase())) { el.remove(); continue; }
    for (const attr of Array.from(el.attributes)) {
      if (!attributes.has(attr.name.toLowerCase()) || /url\s*\(/i.test(attr.value)) el.removeAttribute(attr.name);
    }
  }
  return svg.outerHTML;
}

export const ActionIcon: React.FC<{icon?: string | null; color?: string | null; state: ActionExecutionState}> = ({icon, color, state}) => {
  const svg = useMemo(() => safeSvg(icon), [icon]);
  if (state === 'loading') return <span className="fusioni-spinner" aria-hidden="true" />;
  if (state === 'idle' && svg) return <span className="fusioni-action-custom-icon" aria-hidden="true" style={{color: colors[color || ''] || colors['text-blue-500']}} dangerouslySetInnerHTML={{__html: svg}} />;
  const path = state === 'success' ? 'm5 12 4 4L19 6' : state === 'error' ? 'm6 6 12 12M18 6 6 18' : paths[icon || ''] || paths.iconoirMessage;
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={state === 'idle' ? colors[color || ''] || colors['text-blue-500'] : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>;
};
