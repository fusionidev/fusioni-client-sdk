import React, { useState, useEffect, useRef, useCallback } from 'react';

export interface LinkPreviewData {
  url: string;
  title: string;
  description: string;
  image: string;
  domain: string;
}

export interface UrlPreviewProps {
  url: string;
  agencyId: string;
  showCloseButton?: boolean;
  compact?: boolean;
  autoFetch?: boolean;
  apiBaseUrl?: string;
  apiKey?: string;
  onClose?: () => void;
}

export const UrlPreview: React.FC<UrlPreviewProps> = ({
  url,
  agencyId,
  showCloseButton = true,
  compact = false,
  autoFetch = true,
  apiBaseUrl,
  apiKey,
  onClose
}) => {
  const [linkPreview, setLinkPreview] = useState<LinkPreviewData | null>(null);
  const [showLinkPreview, setShowLinkPreview] = useState(false);
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fetchedUrlsRef = useRef<Set<string>>(new Set());

  const extractMetaContent = (doc: Document, property: string): string | null => {
    const meta = doc.querySelector(`meta[property="${property}"], meta[name="${property}"]`);
    return meta?.getAttribute('content') || null;
  };

  const fetchLinkPreview = useCallback(async (targetUrl: string): Promise<void> => {
    // Prevent duplicate fetches for the same URL
    if (fetchedUrlsRef.current.has(targetUrl)) {
      return;
    }

    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    fetchedUrlsRef.current.add(targetUrl);

    try {
      setIsFetchingPreview(true);
      setError(null);

      // Use the Fusioni internal proxy to fetch the link metadata
      const base = apiBaseUrl ? apiBaseUrl.replace(/\/+$/, '') : '';
      const proxyUrl = base
        ? `${base}/proxy/${agencyId}/web?agency_id=${agencyId}&url=${encodeURIComponent(targetUrl)}`
        : `/api/proxy/${agencyId}/web?agency_id=${agencyId}&url=${encodeURIComponent(targetUrl)}`;
      const headers: Record<string, string> = {};
      if (apiKey) {
        headers['Authorization'] = `ApiKey ${apiKey}`;
      }
      const response = await fetch(proxyUrl, { 
        headers,
        signal: abortController.signal
      });
      
      // Check if request was aborted
      if (abortController.signal.aborted) {
        return;
      }

      const data = await response.text();
      
      // Check again if request was aborted after async operation
      if (abortController.signal.aborted) {
        return;
      }
      
      if (data) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(data, 'text/html');
        
        const title = extractMetaContent(doc, 'og:title') || 
                     extractMetaContent(doc, 'twitter:title') || 
                     doc.querySelector('title')?.textContent || 
                     'Untitled';
        
        const description = extractMetaContent(doc, 'og:description') || 
                           extractMetaContent(doc, 'twitter:description') || 
                           extractMetaContent(doc, 'description') || 
                           '';
        
        let image = extractMetaContent(doc, 'og:image') || 
                   extractMetaContent(doc, 'twitter:image') || 
                   '';
        
        // Handle relative image URLs
        if (image && !image.startsWith('http')) {
          try {
            const baseUrl = new URL(targetUrl);
            image = new URL(image, baseUrl.origin).href;
          } catch (e) {
            image = '';
          }
        }
        
        const domain = new URL(targetUrl).hostname;

        // Final check before setting state
        if (!abortController.signal.aborted) {
          setLinkPreview({
            url: targetUrl,
            title: title.trim(),
            description: description.trim(),
            image: image.trim(),
            domain
          });
          
          setShowLinkPreview(true);
        }
      } else {
        if (!abortController.signal.aborted) {
          setError('Unable to fetch link preview');
        }
      }
    } catch (error: any) {
      // Don't set error if request was aborted
      if (error.name === 'AbortError' || abortController.signal.aborted) {
        return;
      }
      console.error('Error fetching link preview:', error);
      if (!abortController.signal.aborted) {
        setError('Failed to load preview');
      }
    } finally {
      if (!abortController.signal.aborted) {
        setIsFetchingPreview(false);
      }
      // Clear the abort controller if it's the current one
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  }, [apiBaseUrl, agencyId, apiKey]);

  useEffect(() => {
    // Clear the fetched URLs cache when URL changes
    fetchedUrlsRef.current.clear();
    
    if (autoFetch && url) {
      fetchLinkPreview(url);
    }

    // Cleanup: abort any in-flight request when component unmounts or dependencies change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [url, autoFetch, fetchLinkPreview]);

  const handleImageError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.style.display = 'none';
    }
  };

  const handleCloseClick = () => {
    setLinkPreview(null);
    setShowLinkPreview(false);
    setIsFetchingPreview(false);
    setError(null);
    onClose?.();
  };

  if (!showLinkPreview && !isFetchingPreview && !error) {
    return null;
  }

  return (
    <div className={`fusioni-url-preview ${compact ? 'fusioni-url-preview-compact' : ''}`}>
      {isFetchingPreview && (
        <div className="fusioni-url-preview-loading">
          <div className="fusioni-url-preview-spinner"></div>
          <span>Loading preview...</span>
        </div>
      )}

      {error && (
        <div className="fusioni-url-preview-error">
          <span>Failed to load preview</span>
          {showCloseButton && (
            <button 
              className="fusioni-url-preview-close"
              onClick={handleCloseClick}
              aria-label="Close preview"
            >
              ×
            </button>
          )}
        </div>
      )}

      {linkPreview && (
        <div className="fusioni-url-preview-content">
          {showCloseButton && (
            <button 
              className="fusioni-url-preview-close"
              onClick={handleCloseClick}
              aria-label="Close preview"
            >
              ×
            </button>
          )}
          
          <a 
            href={linkPreview.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="fusioni-url-preview-link"
          >
            {linkPreview.image && (
              <div className="fusioni-url-preview-image">
                <img
                  src={linkPreview.image}
                  alt={linkPreview.title}
                  onError={handleImageError}
                />
              </div>
            )}
            
            <div className="fusioni-url-preview-text">
              <div className="fusioni-url-preview-title">
                {linkPreview.title}
              </div>
              
              {linkPreview.description && (
                <div className="fusioni-url-preview-description">
                  {linkPreview.description}
                </div>
              )}
              
              <div className="fusioni-url-preview-domain">
                {linkPreview.domain}
              </div>
            </div>
          </a>
        </div>
      )}
    </div>
  );
};
