import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ChatInputProps} from '../types';
import {AudioRecorder} from './AudioRecorder';
import {useTranslation} from '../hooks/useTranslation';

const ChatInput: React.FC<ChatInputProps> = ({
                                                 onSendMessage,
                                                 onFileUpload,
                                                 disabled = false,
                                                 placeholder,
                                                 enableAudioRecording = true,
                                                 enableFileUpload = true,
                                                 maxFileSize = 10,
                                                 allowedFileTypes = ['image/*'],
                                                 currentLanguage = 'en',
                                                 value, onValueChange, clearOnSend = true,
                                                 inputId, ariaLabel, ariaInvalid, ariaDescribedBy,
                                                 maxAttachments = 1, onAttachmentsChange, onUploadingChange
                                             }) => {
    const {t} = useTranslation(currentLanguage);
    const [draft, setDraft] = useState('');
    const message = value ?? draft;
    const [audioPreview, setAudioPreview] = useState<string | null>(null);
    const [showAudioPreview, setShowAudioPreview] = useState(false);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const imagesRef = useRef(imagePreviews);
    imagesRef.current = imagePreviews;
    const uploadIdRef = useRef(0);
    const attachmentLimit = Number.isFinite(maxAttachments) ? Math.max(1, Math.floor(maxAttachments)) : 1;
    const [isUploading, setIsUploading] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const setMessage = useCallback((text: string) => {
        setDraft(text);
        onValueChange?.(text);
    }, [onValueChange]);

    const setImages = useCallback((images: string[]) => {
        imagesRef.current = images;
        setImagePreviews(images);
        onAttachmentsChange?.(images);
    }, [onAttachmentsChange]);

    useEffect(() => () => { uploadIdRef.current += 1; }, []);

    const adjustTextareaHeight = useCallback(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 128) + 'px';
        }
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMessage(e.target.value);
        adjustTextareaHeight();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleSendMessage = useCallback(() => {
        if (disabled || isUploading || (!message.trim() && !audioPreview)) return;

        const content = message.trim();
        onSendMessage(content, imagePreviews[0] || undefined, audioPreview || undefined);

        if (!clearOnSend) return;

        // Reset state
        setMessage('');
        setAudioPreview(null);
        setShowAudioPreview(false);
        setImages([]);

        // Reset textarea height
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    }, [message, audioPreview, imagePreviews, disabled, isUploading, onSendMessage, clearOnSend, setMessage, setImages]);

    const handleFileSelect = useCallback(async (files: File[]) => {
        if (!enableFileUpload || disabled || isUploading) return;
        const accepted = files.slice(0, attachmentLimit === 1 ? 1 : attachmentLimit - imagesRef.current.length);
        if (!accepted.length) return;
        const uploadId = ++uploadIdRef.current;

        try {
            setIsUploading(true);
            onUploadingChange?.(true);

            for (const file of accepted) {

            // Validate file size
            // TODO handle this without throwing an error
            if (file.size > maxFileSize * 1024 * 1024) {
                throw new Error(`File size must be less than ${maxFileSize}MB`);
            }

            // Validate file type
            const isValidType = allowedFileTypes.some(type => {
                if (type.endsWith('/*')) {
                    const category = type.split('/')[0];
                    return file.type.startsWith(category + '/');
                }
                return file.type === type;
            });

            // TODO handle this without throwing an error
            if (!isValidType) {
                throw new Error(`File type not allowed. Allowed types: ${allowedFileTypes.join(', ')}`);
            }
            }

            // Convert file to base64 (onFileUpload now returns base64 directly)
            const images = await Promise.all(accepted.map(file => onFileUpload(file)));

            // Set preview
            if (uploadId === uploadIdRef.current) {
                setImages(attachmentLimit === 1 ? images : [...imagesRef.current, ...images].slice(0, attachmentLimit));
            }
        } catch (error) {
            if (uploadId !== uploadIdRef.current) return;
            console.error('File upload error:', error);
            alert(error instanceof Error ? error.message : 'Failed to upload file');
        } finally {
            if (uploadId === uploadIdRef.current) {
                setIsUploading(false);
                onUploadingChange?.(false);
            }
        }
    }, [enableFileUpload, disabled, isUploading, maxFileSize, allowedFileTypes, onFileUpload, attachmentLimit, setImages, onUploadingChange]);

    const handleAudioRecorded = useCallback((audioBlob: Blob, _duration: number) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64Audio = reader.result as string;
            setAudioPreview(base64Audio);
            setShowAudioPreview(true);
        };
        reader.readAsDataURL(audioBlob);
    }, []);

    const handleClearAudioPreview = useCallback(() => {
        setAudioPreview(null);
        setShowAudioPreview(false);
    }, []);

    const handleClearImagePreview = useCallback((index: number) => {
        setImages(imagesRef.current.filter((_, itemIndex) => itemIndex !== index));
    }, [setImages]);

    const handleFileInputClick = () => {
        if (enableFileUpload && fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    // Auto-adjust textarea height on mount
    useEffect(() => {
        adjustTextareaHeight();
    }, [adjustTextareaHeight]);

    return (
        <div className="fusioni-chat-input">
            {/* Image Preview */}
            {imagePreviews.map((imagePreview, index) => (
                <div className="fusioni-image-preview" key={`${index}:${imagePreview}`}>
                    <div className="fusioni-image-preview-content">
                        <img src={imagePreview} alt="Preview" className="fusioni-preview-image"/>
                        <button
                            type="button"
                            onClick={() => handleClearImagePreview(index)}
                            className="fusioni-btn fusioni-btn-icon fusioni-btn-danger"
                            title="Remove image"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <path
                                    d="M18 6L6 18M6 6L18 18"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </button>
                    </div>
                </div>
            ))}

            {/* Audio Preview */}
            {showAudioPreview && audioPreview && (
                <div className="fusioni-audio-preview">
                    <div className="fusioni-audio-preview-content">
                        <div className="fusioni-audio-preview-header">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <path
                                    d="M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1Z"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                            <span>Audio Preview</span>
                            <button
                                type="button"
                                onClick={handleClearAudioPreview}
                                className="fusioni-btn fusioni-btn-icon fusioni-btn-danger"
                                title="Remove audio"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                    <path
                                        d="M18 6L6 18M6 6L18 18"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </button>
                        </div>
                        <audio
                            src={audioPreview}
                            controls
                            className="fusioni-audio-preview-player"
                            preload="metadata"
                        >
                            Your browser does not support the audio element.
                        </audio>
                        <p className="fusioni-audio-preview-text">
                            Click send to send this audio message
                        </p>
                    </div>
                </div>
            )}

            {/* Main Input */}
            <div className="fusioni-input-container">
                <div className="fusioni-input-wrapper">
          <textarea
              id={inputId}
              aria-label={ariaLabel || t('chat.input.placeholder')}
              aria-invalid={ariaInvalid}
              aria-describedby={ariaDescribedBy}
              ref={textareaRef}
              value={message}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              className="fusioni-textarea"
              rows={1}
          />

                    <div className="fusioni-input-actions">
                        {/* File Upload */}
                        {enableFileUpload && (
                            <button
                                type="button"
                                onClick={handleFileInputClick}
                                disabled={disabled || isUploading || (attachmentLimit > 1 && imagePreviews.length >= attachmentLimit)}
                                className="fusioni-btn fusioni-btn-icon"
                                title="Upload file"
                            >
                                {isUploading ? (
                                    <div className="fusioni-spinner"/>
                                ) : (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                        <path
                                            d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                        <polyline
                                            points="7,10 12,15 17,10"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                        <line
                                            x1="12"
                                            y1="15"
                                            x2="12"
                                            y2="3"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                )}
                            </button>
                        )}

                        {/* Audio Recording */}
                        {enableAudioRecording && (
                            <AudioRecorder
                                onRecordingComplete={handleAudioRecorded}
                                disabled={disabled}
                            />
                        )}

                        {/* Send Button */}
                        <button
                            type="button"
                            onClick={handleSendMessage}
                            disabled={disabled || isUploading || (!message.trim() && !audioPreview)}
                            className={`fusioni-btn fusioni-btn-icon fusioni-btn-send ${
                                audioPreview ? 'fusioni-btn-send-audio' : ''
                            }`}
                            title={audioPreview ? 'Send audio message' : 'Send message'}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <path
                                    d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                multiple={attachmentLimit > 1}
                disabled={disabled || isUploading}
                accept={allowedFileTypes.join(',')}
                onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length) void handleFileSelect(files);
                    e.target.value = '';
                }}
                style={{display: 'none'}}
            />
        </div>
    );
};
export { ChatInput };
export default ChatInput;
