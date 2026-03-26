import React from 'react';

export const ChatLoader: React.FC = () => {
  return (
    <div className="fusioni-chat-loader">
      <div className="fusioni-loader-content">
        <div className="fusioni-loader-dots">
          <div className="fusioni-loader-dot" />
          <div className="fusioni-loader-dot" />
          <div className="fusioni-loader-dot" />
        </div>
        <span className="fusioni-loader-text">AI is thinking...</span>
      </div>
    </div>
  );
};
