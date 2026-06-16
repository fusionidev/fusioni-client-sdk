import { createContext } from 'react';

/**
 * Provides the DOM node that portaled UI (e.g. the image gallery overlay) should
 * render into. When the widget is mounted inside a shadow root (script-tag build),
 * this is a node inside that shadow tree so portaled content stays styled and
 * isolated. When `null` (default / npm React consumers), portals fall back to
 * `document.body`, preserving prior behavior.
 */
export const PortalContainerContext = createContext<HTMLElement | null>(null);
