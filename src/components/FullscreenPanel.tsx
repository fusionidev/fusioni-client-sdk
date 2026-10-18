import React, {useContext, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {PortalContainerContext} from '../context/PortalContainerContext';

export const FullscreenPanel: React.FC<{fullscreen: boolean; label: string; onClose: () => void; children: React.ReactNode}> = ({fullscreen, label, onClose, children}) => {
  const portal = useContext(PortalContainerContext);
  const panelRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [container] = useState(() => typeof document === 'undefined' ? null : document.createElement('div'));
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // Keep the portal target stable so changing fullscreen preserves uploads and chat drafts.
  useLayoutEffect(() => {
    if (!container) return;
    (fullscreen ? portal || document.body : anchorRef.current)?.appendChild(container);
    return () => { container.remove(); };
  }, [container, fullscreen, portal]);
  useEffect(() => {
    if (!fullscreen) return;
    const active = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const panel = panelRef.current;
    panel?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
      if (event.key !== 'Tab' || !panel) return;
      const elements = Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled):not([type="file"]),textarea:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]'));
      const first = elements[0], last = elements[elements.length - 1];
      const focused = panel.getRootNode() instanceof ShadowRoot ? (panel.getRootNode() as ShadowRoot).activeElement : document.activeElement;
      if (!first) { event.preventDefault(); panel.focus(); }
      else if (event.shiftKey && (focused === first || focused === panel)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (focused === last || focused === panel)) { event.preventDefault(); first.focus(); }
    };
    panel?.addEventListener('keydown', onKey);
    return () => {
      panel?.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      if (active?.isConnected) active.focus();
    };
  }, [fullscreen]);
  if (!container) return <>{children}</>;
  return <><div ref={anchorRef} className="fusioni-action-form-anchor" />{createPortal(<div ref={panelRef} tabIndex={fullscreen ? -1 : undefined}
    role={fullscreen ? 'dialog' : undefined} aria-modal={fullscreen ? true : undefined} aria-label={fullscreen ? label : undefined}
    className={fullscreen ? 'fusioni-action-buttons fusioni-action-fullscreen' : undefined}>{children}</div>, container)}</>;
};
