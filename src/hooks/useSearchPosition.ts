import {useLayoutEffect, useState} from 'react';
import type {CSSProperties} from 'react';

/** Keep an autocomplete overlay aligned while its input or any scroll container moves. */
export function useSearchPosition(input: HTMLInputElement | null, enabled: boolean) {
  const [position, setPosition] = useState<CSSProperties>({});
  useLayoutEffect(() => {
    const view = input?.ownerDocument.defaultView;
    if (!input || !view || !enabled) return;
    const update = () => {
      const rect = input.getBoundingClientRect();
      const width = Math.min(rect.width, Math.max(0, view.innerWidth - 16));
      setPosition({position: 'fixed', top: rect.bottom + 8, left: Math.max(8, Math.min(rect.left, view.innerWidth - width - 8)),
        width, maxHeight: Math.max(0, Math.min(400, view.innerHeight - rect.bottom - 16))});
    };
    update();
    view.addEventListener('resize', update);
    view.addEventListener('scroll', update, true);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    observer?.observe(input);
    return () => {
      view.removeEventListener('resize', update);
      view.removeEventListener('scroll', update, true);
      observer?.disconnect();
    };
  }, [enabled, input]);
  return position;
}
