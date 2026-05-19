import React, { useEffect, useState } from 'react';
import { Position } from '../types';

interface FloatingButtonProps {
  isOpen: boolean;
  onClick: () => void;
  position?: Position;
  primaryColor?: string;
  buttonRef?: React.RefObject<HTMLButtonElement>;
  showNotification?: boolean;
  notificationCount?: number;
  variant?: 'minimal' | 'glass' | 'solid';
  shouldDisplay?: boolean;
}

export const FloatingButton: React.FC<FloatingButtonProps> = ({
  isOpen,
  onClick,
  position = 'bottom-right',
  primaryColor = '#6366f1',
  buttonRef,
  showNotification = false,
  notificationCount = 0,
  variant = 'glass',
  shouldDisplay = true
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showAttentionSequence, setShowAttentionSequence] = useState(false);
  const [isAttentionActive, setIsAttentionActive] = useState(false);

  useEffect(() => {
    const entranceTimer = setTimeout(() => {
      setIsVisible(true);
    }, 200);

    const attentionInterval = setInterval(() => {
      if (!isHovered && !isOpen) {
        setShowAttentionSequence(true);
        setIsAttentionActive(true);

        setTimeout(() => {
          setShowAttentionSequence(false);
          setIsAttentionActive(false);
        }, 3000);
      }
    }, 15000);

    return () => {
      clearTimeout(entranceTimer);
      clearInterval(attentionInterval);
    };
  }, [isHovered, isOpen]);

  const getPositionClasses = () => {
    switch (position) {
      case 'bottom-left':
        return 'fusioni-floating-button-bottom-left';
      case 'top-right':
        return 'fusioni-floating-button-top-right';
      case 'top-left':
        return 'fusioni-floating-button-top-left';
      default:
        return 'fusioni-floating-button-bottom-right';
    }
  };

  if (!shouldDisplay) {
    return null;
  }

  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`fusioni-floating-button fusioni-floating-button-${variant} ${getPositionClasses()} ${isVisible ? 'fusioni-floating-button-visible fusioni-floating-button-entering' : ''} ${showNotification ? 'fusioni-floating-button-notification' : ''} ${isHovered ? 'fusioni-floating-button-hovered' : ''} ${isAttentionActive ? 'fusioni-floating-button-attention-active' : ''}`}
      style={{ '--primary-color': primaryColor } as React.CSSProperties}
      aria-label={isOpen ? 'Close chat' : 'Open chat'}
    >
      <div className="fusioni-floating-button-attention-ring"></div>
      <div className="fusioni-floating-button-attention-ring-2"></div>
      <div className="fusioni-floating-button-attention-ring-3"></div>

      <div className="fusioni-floating-button-neural-particles">
        <div className="fusioni-neural-particle"></div>
        <div className="fusioni-neural-particle"></div>
        <div className="fusioni-neural-particle"></div>
        <div className="fusioni-neural-particle"></div>
        <div className="fusioni-neural-particle"></div>
        <div className="fusioni-neural-particle"></div>
      </div>

      <div className="fusioni-floating-button-brain-activity"></div>

      {showAttentionSequence && (
        <div className="fusioni-floating-button-attention-sequence">
          <div className="fusioni-attention-wave"></div>
          <div className="fusioni-attention-wave"></div>
          <div className="fusioni-attention-wave"></div>
        </div>
      )}

      <div className="fusioni-floating-button-periodic-pulse"></div>
      <div className="fusioni-floating-button-glow"></div>
      <div className="fusioni-floating-button-magnetic-field"></div>

      {showNotification && (
        <div className="fusioni-floating-button-indicator">
          <div className="fusioni-floating-button-indicator-dot"></div>
        </div>
      )}

      <div className="fusioni-floating-button-content">
        {isOpen ? (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="fusioni-floating-button-icon"
          >
            <path
              d="M18 6L6 18M6 6L18 18"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="fusioni-floating-button-icon"
          >
            <path
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
    </button>
  );
};
