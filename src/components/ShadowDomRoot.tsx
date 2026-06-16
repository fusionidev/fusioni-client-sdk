import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PortalContainerContext } from '../context/PortalContainerContext';
import styles from '../styles/index.css';

export interface ShadowDomRootProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Renders children inside an open Shadow DOM so host-page CSS cannot leak into
 * the SDK (and vice versa). Injects the SDK stylesheet into the shadow root and
 * provides a portal container for overlays (e.g. the image gallery).
 */
export const ShadowDomRoot: React.FC<ShadowDomRootProps> = ({
  children,
  className = 'fusioni-sdk-host',
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });

    if (!shadow.querySelector('style[data-fusioni-sdk]')) {
      const styleEl = document.createElement('style');
      styleEl.setAttribute('data-fusioni-sdk', '');
      styleEl.textContent = styles;
      shadow.appendChild(styleEl);
    }

    let mount = shadow.querySelector('[data-fusioni-mount]') as HTMLElement | null;
    if (!mount) {
      mount = document.createElement('div');
      mount.setAttribute('data-fusioni-mount', '');
      shadow.appendChild(mount);
    }

    setMountNode(mount);

    return () => {
      setMountNode(null);
    };
  }, []);

  return (
    <div ref={hostRef} className={className}>
      {mountNode &&
        createPortal(
          <PortalContainerContext.Provider value={mountNode}>
            {children}
          </PortalContainerContext.Provider>,
          mountNode
        )}
    </div>
  );
};
