import React, { useEffect, useState } from 'react';

export const GALLERY_STRIP_MAX_ROWS = 2;

export interface PaginatedGalleryStripProps {
  itemCount: number;
  columns: number;
  page: number;
  onPageChange: (page: number) => void;
  /** Render one cell for global index `globalIndex` (0 .. itemCount-1) */
  renderCell: (globalIndex: number) => React.ReactNode;
  /** BEM-style modifier: "document" | "lightbox" for theme-specific dots/buttons */
  variant: 'document' | 'lightbox';
}

/**
 * Horizontal slide of pages, each a grid with `columns` × {@link GALLERY_STRIP_MAX_ROWS} cells.
 * Dot indicators when there is more than one page (fusioni-web assistant bubble pattern).
 */
export const PaginatedGalleryStrip: React.FC<PaginatedGalleryStripProps> = ({
  itemCount,
  columns,
  page,
  onPageChange,
  renderCell,
  variant,
}) => {
  const pageSize = columns * GALLERY_STRIP_MAX_ROWS;
  const pageCount = itemCount > 0 ? Math.ceil(itemCount / pageSize) : 0;

  if (pageCount === 0) return null;

  const pageIndexes = Array.from({ length: pageCount }, (_, pi) => {
    const start = pi * pageSize;
    const len = Math.min(pageSize, itemCount - start);
    return Array.from({ length: len }, (_, j) => start + j);
  });

  const rootMod = `fusioni-gallery-strip--${variant}`;

  return (
    <div className={`fusioni-gallery-strip ${rootMod}`}>
      <div className="fusioni-gallery-strip-viewport">
        <div
          className="fusioni-gallery-strip-track"
          style={{ marginLeft: `-${page * 100}%` }}
        >
          {pageIndexes.map((globalIndices, pi) => (
            <div key={pi} className="fusioni-gallery-strip-page">
              <div
                className="fusioni-gallery-strip-grid"
                style={{
                  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                }}
              >
                {globalIndices.map((gi) => (
                  <div key={gi} className="fusioni-gallery-strip-cell">
                    {renderCell(gi)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      {pageCount > 1 && (
        <div className="fusioni-gallery-strip-dots" role="tablist" aria-label="Image pages">
          {Array.from({ length: pageCount }, (_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === page}
              aria-label={`Go to page ${i + 1} of ${pageCount}`}
              className={`fusioni-gallery-strip-dot ${i === page ? 'fusioni-gallery-strip-dot-active' : ''}`}
              onClick={() => onPageChange(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/** Match fusioni-web / Tailwind `sm`: 2 columns below 640px, 3 at 640px+. */
export function useGalleryStripColumns(): 2 | 3 {
  const [cols, setCols] = useState<2 | 3>(2);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const update = () => setCols(mq.matches ? 3 : 2);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return cols;
}
