import { useEffect, useState } from 'react';

/** Matches `index.css` mobile breakpoint for chat layout. */
const MOBILE_MEDIA_QUERY = '(max-width: 768px)';

export function useIsMobileLayout(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MEDIA_QUERY);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
