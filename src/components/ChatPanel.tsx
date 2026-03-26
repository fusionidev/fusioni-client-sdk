import React, { useRef } from 'react';
import { Position } from '../types';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  position?: Position;
  isFullscreen?: boolean;
  floatingButtonRef?: React.RefObject<HTMLButtonElement>;
  children: React.ReactNode;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  isOpen,
  onClose,
  position = 'bottom-right',
  isFullscreen = false,
  floatingButtonRef,
  children
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  const getPositionClasses = () => {
    switch (position) {
      case 'bottom-left':
        return 'fusioni-chat-panel-bottom-left';
      case 'top-right':
        return 'fusioni-chat-panel-top-right';
      case 'top-left':
        return 'fusioni-chat-panel-top-left';
      default:
        return 'fusioni-chat-panel-bottom-right';
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fusioni-chat-backdrop" />
      
      {/* Panel */}
      <div
        ref={panelRef}
        className={`fusioni-chat-panel ${getPositionClasses()} ${isFullscreen ? 'fusioni-chat-panel-fullscreen' : ''}`}
      >
        <div className="fusioni-chat-panel-content">
          {children}
        </div>
      </div>
    </>
  );
};
