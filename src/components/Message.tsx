import React, {useEffect, useRef, useState} from 'react';
import {MessageProps} from '../types';
import {UrlPreview} from './UrlPreview';
import {Map} from './Map';
import {Spotlight} from './Spotlight';
import {FUSIONI_LOGO_BASE64} from '../assets/logo-base64';
import {useTranslation} from '../hooks/useTranslation';
import {GALLERY_STRIP_MAX_ROWS, PaginatedGalleryStrip, useGalleryStripColumns} from './PaginatedGalleryStrip';

interface DocumentImageGridProps {
    images: string[];
    onOpenGallery: (payload: { images: string[]; index: number }) => void;
    attachedImagesLabel: string;
}

const DocumentImageGrid: React.FC<DocumentImageGridProps> = ({
    images,
    onOpenGallery,
    attachedImagesLabel,
}) => {
    const cols = useGalleryStripColumns();
    const [visible, setVisible] = useState<string[]>(images);
    const [page, setPage] = useState(0);
    const pageSize = cols * GALLERY_STRIP_MAX_ROWS;
    const pageCount = visible.length > 0 ? Math.ceil(visible.length / pageSize) : 0;
    const prevPageSizeRef = useRef(pageSize);

    useEffect(() => setVisible(images), [images]);

    useEffect(() => {
        const old = prevPageSizeRef.current;
        if (old !== pageSize && old > 0 && pageSize > 0) {
            setPage((p) => {
                const firstGlobal = p * old;
                const np = Math.floor(firstGlobal / pageSize);
                const pc = visible.length > 0 ? Math.ceil(visible.length / pageSize) : 0;
                return pc <= 0 ? 0 : Math.min(Math.max(0, np), pc - 1);
            });
        }
        prevPageSizeRef.current = pageSize;
    }, [pageSize, visible.length]);

    useEffect(() => {
        setPage((p) => {
            if (pageCount <= 0) return 0;
            return Math.min(p, pageCount - 1);
        });
    }, [pageCount]);

    if (!visible.length) return null;

    return (
        <div className="fusioni-document-images">
            <div className="fusioni-document-images-header">
                <span className="fusioni-document-images-header-label">
                    <svg
                        className="fusioni-document-images-header-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                    >
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M21 15l-5-5L5 21" />
                    </svg>
                    {attachedImagesLabel}
                </span>
            </div>
            <PaginatedGalleryStrip
                variant="document"
                itemCount={visible.length}
                columns={cols}
                page={page}
                onPageChange={setPage}
                renderCell={(gi) => {
                    const img = visible[gi];
                    return (
                        <button
                            type="button"
                            className="fusioni-document-image-btn"
                            aria-label={`Preview attached image ${gi + 1}`}
                            onClick={() => onOpenGallery({images: visible, index: gi})}
                        >
                            <div className="fusioni-document-image-aspect">
                                <img
                                    src={img}
                                    alt=""
                                    loading="lazy"
                                    decoding="async"
                                    referrerPolicy="no-referrer"
                                    onError={() => setVisible((v) => v.filter((u) => u !== img))}
                                />
                            </div>
                        </button>
                    );
                }}
            />
        </div>
    );
};

// Module-level Set to track which message IDs have been animated
// This persists across component unmounts/remounts (e.g., when chat closes and reopens)
const animatedMessageIds = new Set<string>();

export const Message: React.FC<MessageProps> = ({
                                                    message,
                                                    showThoughts = false,
                                                    fontSize = 'text-sm',
                                                    onDelete,
                                                    onConfirmation,
                                                    enableButtons = true,
                                                    streamMessages = [],
                                                    apiBaseUrl,
                                                    apiKey,
                                                    agencyId,
                                                    currentLanguage = 'en',
                                                    onOpenGallery
                                                }) => {
    const {t} = useTranslation(currentLanguage);
    const [displayedContent, setDisplayedContent] = useState<string>('');
    const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const typingSpeed = 15; // milliseconds per character

    const enhanceMessageContent = (content: string): string => {
        if (!content) return content;

        // Check if content contains <pre> <code> blocks with escaped HTML
        const preCodeRegex = /<pre><code>([\s\S]*?)<\/code><\/pre>/gi;

        // Use replace it with a callback to handle all matches
        return content.replace(preCodeRegex, (match, escapedHtml) => {
            // Decode HTML entities: decode &amp; last to avoid interfering with other entities
            // &lt; -> <, &gt; -> >, &quot; -> ", &#39; -> ', &amp; -> &
            // Replace the <pre> <code> block with the decoded HTML
            return escapedHtml
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&amp;/g, '&');
        });

    };

    const extractUrlsFromContent = (content: string): string[] => {
        if (!content) return [];

        // URL regex pattern that matches http/https URLs
        const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi;
        const urls = content.match(urlRegex) || [];

        // Remove duplicates and return
        return [...new Set(urls)];
    };

    const renderImage = (imageUrl: string) => {
        if (!imageUrl) return null;
        const imgEl = (
            <img
                src={imageUrl}
                alt="Uploaded image"
                className={`fusioni-image${onOpenGallery ? ' fusioni-image-clickable' : ''}`}
                onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                }}
            />
        );
        return (
            <div className="fusioni-message-image">
                {onOpenGallery ? (
                    <button
                        type="button"
                        className="fusioni-image-clickable-wrap"
                        aria-label="Open image in gallery"
                        onClick={() => onOpenGallery({images: [imageUrl], index: 0})}
                    >
                        {imgEl}
                    </button>
                ) : (
                    imgEl
                )}
            </div>
        );
    };

    const renderAudio = (audioRef: string, duration?: number) => {
        return (
            <div className="fusioni-message-audio">
                <div className="fusioni-audio-header">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path
                            d="M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1Z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        <path
                            d="M19 10V12C19 15.87 15.87 19 12 19C8.13 19 5 15.87 5 12V10"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        <line
                            x1="12"
                            y1="19"
                            x2="12"
                            y2="23"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        <line
                            x1="8"
                            y1="23"
                            x2="16"
                            y2="23"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                    <span>Audio Message</span>
                    {duration && <span className="fusioni-audio-duration">({duration}s)</span>}
                </div>
                <audio
                    src={audioRef}
                    controls
                    className="fusioni-audio-player"
                    preload="metadata"
                >
                    Your browser does not support the audio element.
                </audio>
            </div>
        );
    };

    const renderMap = (coordinates: { lat: number; lon: number; zoom?: number }) => {
        // For now, we'll show coordinates. In a real implementation, you'd integrate with a map service
        return (
            <div className="fusioni-message-map">
                <div className="fusioni-map-placeholder">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path
                            d="M21 10C21 17 12 23 12 23S3 17 3 10C3 7.61305 3.94821 5.32387 5.63604 3.63604C7.32387 1.94821 9.61305 1 12 1C14.3869 1 16.6761 1.94821 18.3639 3.63604C20.0518 5.32387 21 7.61305 21 10Z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        <circle
                            cx="12"
                            cy="10"
                            r="3"
                            stroke="currentColor"
                            strokeWidth="2"
                        />
                    </svg>
                    <p>Location: {coordinates.lat.toFixed(4)}, {coordinates.lon.toFixed(4)}</p>
                </div>
            </div>
        );
    };

    const getMessageClasses = () => {
        const baseClasses = `fusioni-message-bubble ${fontSize}`;
        const roleClasses = message.role === 'user'
            ? 'fusioni-message-user'
            : 'fusioni-message-assistant';
        const errorClasses = message.has_error ? 'fusioni-message-error' : '';

        return `${baseClasses} ${roleClasses} ${errorClasses}`.trim();
    };

    const sendConfirmation = (confirmed: 'Confirmed' | 'NotConfirmed', key?: string) => {
        if (onConfirmation && key) {
            onConfirmation({
                confirmed,
                key
            });
        }
    };

    // Typing effect implementation
    useEffect(() => {
        // Clear any existing typing animation
        if (typingIntervalRef.current) {
            clearTimeout(typingIntervalRef.current);
        }

        // Safety check: ensure message exists
        if (!message) {
            setDisplayedContent('');
            return;
        }

        // If a message is loading or has no content, reset displayed content
        if (message.loading || !message.content) {
            setDisplayedContent('');
            return;
        }

        // Check if this message has already been animated
        const messageId = message.id || '';
        
        // Only animate if shouldAnimate flag is set AND we haven't animated this message yet
        // This prevents re-animation when chat is closed and reopened
        // The animatedMessageIds Set persists across component unmounts/remounts
        if (!message.shouldAnimate || animatedMessageIds.has(messageId)) {
            setDisplayedContent(message.content);
            return;
        }

        // Reset displayed content
        setDisplayedContent('');
        const fullContent = message.content;

        // Parse content into segments: text segments and HTML tag segments
        const segments: Array<{ type: 'text' | 'tag'; content: string }> = [];
        let currentIndex = 0;

        while (currentIndex < fullContent.length) {
            const remainingContent = fullContent.substring(currentIndex);
            const tagMatch = remainingContent.match(/^<[^>]*>/);

            if (tagMatch) {
                // Found an HTML tag - add it as a complete segment
                segments.push({type: 'tag', content: tagMatch[0]});
                currentIndex += tagMatch[0].length;
            } else {
                // Find the next HTML tag or end of string
                const nextTagIndex = remainingContent.indexOf('<');
                if (nextTagIndex === -1) {
                    // No more tags, add remaining text
                    segments.push({type: 'text', content: remainingContent});
                    break;
                } else {
                    // Add text up to the next tag
                    segments.push({type: 'text', content: remainingContent.substring(0, nextTagIndex)});
                    currentIndex += nextTagIndex;
                }
            }
        }

        // Now animate through segments
        let segmentIndex = 0;
        let textIndex = 0;

        const typeNextChar = () => {
            if (segmentIndex >= segments.length) {
                // Typing complete - mark this message as animated in the persistent Set
                setDisplayedContent(fullContent);
                animatedMessageIds.add(messageId);
                return;
            }

            const segment = segments[segmentIndex];

            if (segment.type === 'tag') {
                // HTML tags are added immediately without animation
                // Build content up to and including this tag
                let content = '';
                for (let i = 0; i <= segmentIndex; i++) {
                    content += segments[i].content;
                }
                setDisplayedContent(content);
                segmentIndex++;
                textIndex = 0;
                // Continue immediately for tags (no delay)
                typingIntervalRef.current = setTimeout(typeNextChar, 0);
            } else {
                // Text segments are typed character by character
                if (textIndex < segment.content.length) {
                    // Build content: all previous segments + current segment up to textIndex
                    let content = '';
                    for (let i = 0; i < segmentIndex; i++) {
                        content += segments[i].content;
                    }
                    content += segment.content.substring(0, textIndex + 1);
                    setDisplayedContent(content);
                    textIndex++;
                    typingIntervalRef.current = setTimeout(typeNextChar, typingSpeed);
                } else {
                    // Current text segment is complete, move to next segment
                    segmentIndex++;
                    textIndex = 0;
                    typingIntervalRef.current = setTimeout(typeNextChar, 0);
                }
            }
        };

        // Start typing
        typeNextChar();

        // Cleanup function
        return () => {
            if (typingIntervalRef.current) {
                clearTimeout(typingIntervalRef.current);
            }
        };
    }, [message?.content, message?.shouldAnimate, message?.loading, typingSpeed]);

    // Determine which content to display
    // If animating, use displayedContent (which starts empty and fills up)
    // If not animating, always use message.content directly
    const contentToDisplay = message.shouldAnimate
        ? displayedContent
        : message.content;

    return (
        <div className={getMessageClasses()}>
            {/* Main content — hidden while loading (parity with Angular assistant bubble) */}
            {message.content && !message.loading && (
                <div
                    className="fusioni-message-text"
                    dangerouslySetInnerHTML={{
                        __html: enhanceMessageContent(contentToDisplay)
                    }}
                />
            )}

            {/* Logo + Spotlight: SSE stream lines, or loading label until first stream event */}
            {message.loading && (
                <div className="fusioni-stream-messages">
                    {(streamMessages.length > 0 ? streamMessages : [t('chat.messages.loading')]).map(
                        (line, index) => (
                            <div
                                key={streamMessages.length > 0 ? `${index}-${line}` : 'loading-placeholder'}
                                className="fusioni-stream-message-item"
                            >
                                <div className="fusioni-stream-message-logo-wrap">
                                    <div className="fusioni-stream-message-logo-frame">
                                        <img
                                            className="fusioni-stream-message-logo-img"
                                            src={FUSIONI_LOGO_BASE64}
                                            alt=""
                                            width={32}
                                            height={32}
                                        />
                                    </div>
                                </div>
                                <Spotlight className="fusioni-stream-message-spotlight" text={line} />
                            </div>
                        )
                    )}
                </div>
            )}

            {/* URL Previews for message content */}
            {!message.loading && extractUrlsFromContent(message.content).length > 0 && message.role !== 'user' && (
                <div className="fusioni-message-url-previews">
                    {extractUrlsFromContent(message.content).map((url, index) => (
                        <UrlPreview
                            key={`${url}-${index}`}
                            url={url}
                            agencyId={agencyId}
                            showCloseButton={false}
                            compact={true}
                            autoFetch={true}
                            apiBaseUrl={apiBaseUrl}
                            apiKey={apiKey}
                        />
                    ))}
                </div>
            )}

            {/* Extra data rendering */}
            {message.extra_data && (
                <div className="fusioni-message-extra m2">
                    {message.extra_data.document_images &&
                        message.extra_data.document_images.length > 0 &&
                        onOpenGallery && (
                            <DocumentImageGrid
                                images={message.extra_data.document_images}
                                onOpenGallery={onOpenGallery}
                                attachedImagesLabel={t('chat.attachedImages')}
                            />
                        )}

                    {message.extra_data.image && renderImage(message.extra_data.image)}

                    {message.extra_data.image_ref && renderImage(message.extra_data.image_ref)}

                    {message.extra_data.audio_ref && renderAudio(
                        message.extra_data.audio_ref,
                        message.extra_data.duration
                    )}

                    {message.extra_data.coordinates && renderMap(message.extra_data.coordinates)}

                    {message.extra_data.map && (
                        <div className="fusioni-message-map">
                            <Map
                                lat={message.extra_data.map.lat}
                                lng={message.extra_data.map.lng}
                                zoom={message.extra_data.map.zoom}
                                staticMap={true}
                                width={600}
                                height={400}
                                apiBaseUrl={apiBaseUrl}
                                apiKey={apiKey}
                                agencyId={agencyId}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Confirmation Widget */}
            {message.extra_data?.widget === 'Confirmation' && (
                <div className="fusioni-confirmation-widget">
                    <button
                        type="button"
                        disabled={!enableButtons}
                        onClick={() => sendConfirmation('Confirmed', message.extra_data?.key)}
                        className="fusioni-btn fusioni-btn-primary fusioni-btn-confirm"
                    >
                        {t('common.yes')}
                    </button>
                    <button
                        type="button"
                        disabled={!enableButtons}
                        onClick={() => sendConfirmation('NotConfirmed', message.extra_data?.key)}
                        className="fusioni-btn fusioni-btn-secondary fusioni-btn-cancel"
                    >
                        {t('common.no')}
                    </button>
                </div>
            )}

            {/* Thoughts (if enabled) */}
            {showThoughts && message.thoughts && (
                <div className="fusioni-message-thoughts">
                    <details>
                        <summary>AI Thoughts</summary>
                        <p>{message.thoughts}</p>
                    </details>
                </div>
            )}

            {/* Error state */}
            {message.has_error && (
                <div className="fusioni-message-error-indicator">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <circle
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="2"
                        />
                        <line
                            x1="15"
                            y1="9"
                            x2="9"
                            y2="15"
                            stroke="currentColor"
                            strokeWidth="2"
                        />
                        <line
                            x1="9"
                            y1="9"
                            x2="15"
                            y2="15"
                            stroke="currentColor"
                            strokeWidth="2"
                        />
                    </svg>
                    <span>Error occurred</span>
                </div>
            )}
        </div>
    );
};
