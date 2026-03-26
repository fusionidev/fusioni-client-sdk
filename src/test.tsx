// Simple test file to verify the SDK builds correctly
import React from 'react';
import { ChatWidget } from './components/ChatWidget';
import { FusioniSDKConfig } from './types';

const testConfig: FusioniSDKConfig = {
  apiBaseUrl: 'https://api.example.com',
  agencyId: 'test-agency-id',
  accessToken: 'test-token',
  theme: 'light',
  position: 'bottom-right',
  primaryColor: '#6366f1',
  showConversationList: true,
  enableAudioRecording: true,
  enableFileUpload: true,
  maxFileSize: 10,
  allowedFileTypes: ['image/*']
};

export const TestComponent: React.FC = () => {
  return (
    <div>
      <h1>Test Component</h1>
      <ChatWidget 
        config={testConfig}
        onMessageSent={(message) => console.log('Message sent:', message)}
        onMessageReceived={(message) => console.log('Message received:', message)}
        onError={(error) => console.error('Error:', error)}
      />
    </div>
  );
};

export default TestComponent;
