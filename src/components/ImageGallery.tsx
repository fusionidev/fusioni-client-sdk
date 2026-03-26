import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GALLERY_STRIP_MAX_ROWS, PaginatedGalleryStrip, useGalleryStripColumns } from './PaginatedGalleryStrip';

export interface ImageGalleryProps {
  images: string[];
  initialIndex?: number;
  onClose: () => void;
  /** Used for overlay gradient when rendered outside `.fusioni-chat-widget` (e.g. portal). */
  theme?: 'light' | 'dark';
}

/**
 * Full-screen image lightbox: main image + prev/next, keyboard nav,
 * and a two-row thumbnail strip with horizontal pages and dot indicators (fusioni-web parity).
 */
export const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  initialIndex = 0,
  onClose,
  theme = 'light',
}) => {
  const cols = useGalleryStripColumns();
  const pageSize = cols * GALLERY_STRIP_MAX_ROWS;

  const [currentIndex, setCurrentIndex] = useState(() => {
    if (!images?.length) return 0;
    return Math.max(0, Math.min(initialIndex, images.length - 1));
  });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const galleryStateRef = useRef({ index: currentIndex, images });
  galleryStateRef.current = { index: currentIndex, images };

  const pageCount = useMemo(
    () => (images.length > 0 ? Math.ceil(images.length / pageSize) : 0),
    [images.length, pageSize]
  );

  const thumbPage =
    pageCount > 0 ? Math.min(Math.floor(currentIndex / pageSize), pageCount - 1) : 0;

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const currentImage =
    images?.length && currentIndex >= 0 && currentIndex < images.length
      ? images[currentIndex]
      : null;

  const hasPrevious = (images?.length ?? 0) > 1 && currentIndex > 0;
  const hasNext = (images?.length ?? 0) > 1 && currentIndex < images.length - 1;
  const counterText =
    images?.length ? `${currentIndex + 1} / ${images.length}` : '';

  const resetTransitionFlag = useCallback(() => {
    window.setTimeout(() => setIsTransitioning(false), 300);
  }, []);

  const goPrevious = useCallback(() => {
    if (!hasPrevious || isTransitioning) return;
    setIsTransitioning(true);
    setCurrentIndex((i) => i - 1);
    resetTransitionFlag();
  }, [hasPrevious, isTransitioning, resetTransitionFlag]);

  const goNext = useCallback(() => {
    if (!hasNext || isTransitioning) return;
    setIsTransitioning(true);
    setCurrentIndex((i) => i + 1);
    resetTransitionFlag();
  }, [hasNext, isTransitioning, resetTransitionFlag]);

  const close = useCallback(() => {
    onClose();
  }, [onClose]);

  const onBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).hasAttribute('data-gallery-backdrop')) {
      close();
    }
  };

  const onImageError = useCallback(() => {
    const { index: idx, images: imgs } = galleryStateRef.current;
    const len = imgs.length;
    if (len > 1 && idx < len - 1) {
      setIsTransitioning(true);
      setCurrentIndex(idx + 1);
      resetTransitionFlag();
    } else if (len > 1 && idx > 0) {
      setIsTransitioning(true);
      setCurrentIndex(idx - 1);
      resetTransitionFlag();
    } else {
      close();
    }
  }, [close, resetTransitionFlag]);

  useEffect(() => {
    const onKeydown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'Escape':
          close();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          goPrevious();
          break;
        case 'ArrowRight':
          event.preventDefault();
          goNext();
          break;
        default:
          break;
      }
    };
    document.addEventListener('keydown', onKeydown);
    return () => document.removeEventListener('keydown', onKeydown);
  }, [close, goPrevious, goNext]);

  const showThumbStrip = (images?.length ?? 0) > 1;

  if (!images?.length || !currentImage) {
    return null;
  }

  return (
    <div
      data-gallery-backdrop
      role="dialog"
      aria-modal="true"
      aria-label="Image gallery"
      className={`fusioni-image-gallery-overlay fusioni-image-gallery-theme-${theme} ${
        showThumbStrip ? 'fusioni-image-gallery-has-thumbs' : ''
      }`}
      onClick={onBackdropClick}
    >
      <div className="fusioni-image-gallery-topbar">
        <div className="fusioni-image-gallery-topbar-spacer" aria-hidden="true" />
        <span className="fusioni-image-gallery-counter">{counterText}</span>
        <button
          type="button"
          className="fusioni-image-gallery-close"
          onClick={close}
          aria-label="Close gallery"
        >
          <svg className="fusioni-image-gallery-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="fusioni-image-gallery-body">
        <div className="fusioni-image-gallery-stage">
          {hasPrevious && (
            <button
              type="button"
              className="fusioni-image-gallery-nav fusioni-image-gallery-nav-prev"
              onClick={(e) => {
                e.stopPropagation();
                goPrevious();
              }}
              aria-label="Previous image"
            >
              <svg className="fusioni-image-gallery-icon-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          <div className="fusioni-image-gallery-content" onClick={(e) => e.stopPropagation()} role="presentation">
            <img
              src={currentImage}
              alt={`Gallery image ${currentIndex + 1} of ${images.length}`}
              className="fusioni-image-gallery-img"
              referrerPolicy="no-referrer"
              onError={onImageError}
            />
          </div>

          {hasNext && (
            <button
              type="button"
              className="fusioni-image-gallery-nav fusioni-image-gallery-nav-next"
              onClick={(e) => {
                e.stopPropagation();
                goNext();
              }}
              aria-label="Next image"
            >
              <svg className="fusioni-image-gallery-icon-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>

        {showThumbStrip && (
          <div
            className="fusioni-image-gallery-thumbs-wrap"
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <PaginatedGalleryStrip
              variant="lightbox"
              itemCount={images.length}
              columns={cols}
              page={thumbPage}
              onPageChange={(p) => {
                setIsTransitioning(true);
                setCurrentIndex(p * pageSize);
                resetTransitionFlag();
              }}
              renderCell={(gi) => (
                <button
                  type="button"
                  className={`fusioni-image-gallery-thumb ${
                    gi === currentIndex ? 'fusioni-image-gallery-thumb-selected' : ''
                  }`}
                  aria-label={`Show image ${gi + 1}`}
                  aria-current={gi === currentIndex ? 'true' : undefined}
                  onClick={() => {
                    if (gi === currentIndex) return;
                    setIsTransitioning(true);
                    setCurrentIndex(gi);
                    resetTransitionFlag();
                  }}
                >
                  <img src={images[gi]} alt="" loading="lazy" referrerPolicy="no-referrer" />
                </button>
              )}
            />
          </div>
        )}
      </div>
    </div>
  );
};
