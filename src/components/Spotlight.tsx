import React, { useEffect, useRef } from 'react';

export interface SpotlightProps {
  text: string;
  className?: string;
}

const DURATION_MS = 2500;

export const Spotlight: React.FC<SpotlightProps> = ({ text, className }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const startRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = performance.now();
    const tick = (): void => {
      const elapsed = performance.now() - startRef.current;
      const period = DURATION_MS * 2;
      const t = (elapsed % period) / DURATION_MS;
      const x = t <= 1 ? t * 100 : (2 - t) * 100;
      const el = rootRef.current;
      if (el) {
        el.style.setProperty('--mask-x', `${x}%`);
        el.style.setProperty('--mask-y', '50%');
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current != null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return (
    <div ref={rootRef} className={className ? `fusioni-spotlight ${className}` : 'fusioni-spotlight'}>
      <div className="fusioni-spotlight-title">
        <span className="fusioni-spotlight-text-base">{text}</span>
        <span className="fusioni-spotlight-text-overlay" aria-hidden="true">
          {text}
        </span>
      </div>
    </div>
  );
};
