# Fusioni Chat SDK

A React TypeScript SDK for integrating Fusioni Chat functionality into web applications. This SDK provides a floating chat widget that can be embedded into any webpage, offering AI-powered chat capabilities with support for text, images, and audio messages.

## Features

- 🤖 **AI Chat Interface** - Modern, responsive chat UI with real-time messaging
- 🎤 **Audio Recording** - Voice message support with recording and playback
- 📁 **File Upload** - Image upload and preview functionality
- 💬 **Conversation Management** - Create, manage, and delete conversations
- 🎨 **Customizable Theming** - Light/dark theme support with custom colors
- 📱 **Responsive Design** - Works seamlessly on desktop and mobile devices
- 🔄 **Real-time Updates** - Server-sent events for live message streaming
- 🛡️ **TypeScript Support** - Full type safety and IntelliSense support

## Installation

You can use the SDK in two ways:

### As a library (npm)

```bash
npm install @fusioni/client-sdk
```

### As a script (no build step)

Add a single script tag to your page. The browser bundle is an **IIFE** (file name still `fusioni-sdk.umd.js` for CDN URLs): it assigns global `Fusioni` and includes React and styles. IIFE is used instead of classic UMD so `Fusioni` stays correct even when the host page’s bundler defines CommonJS `module`/`exports` in the same scope (plain UMD could leave `Fusioni` as `{}` in that case).

```html
<script src="https://unpkg.com/@fusioni/client-sdk/dist/fusioni-sdk.umd.js"></script>
<!-- or use your own path -->
<script src="/path/to/fusioni-sdk.umd.js"></script>
```

## Quick Start

### Basic Usage

```tsx
import React from 'react';
import { ChatWidget } from '@fusioni/client-sdk';

function App() {
  const config = {
    apiBaseUrl: 'https://your-fusioni-api.com',
    agencyId: 'your-agency-id',
    accessToken: 'your-access-token', // Optional
    theme: 'light', // 'light' | 'dark' | 'auto'
    position: 'bottom-right', // 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
    primaryColor: '#6366f1',
    showConversationList: true,
    enableAudioRecording: true,
    enableFileUpload: true,
    maxFileSize: 10, // MB
    allowedFileTypes: ['image/*']
  };

  return (
    <div className="App">
      <h1>My Website</h1>
      <ChatWidget config={config} />
    </div>
  );
}

export default App;
```

### Script-tag usage (no React app required)

When including via `<script src="...">`, the SDK exposes a global `Fusioni` object. No build step or React setup needed.

**Default placement (floating widget):**

```html
<script src="path/to/fusioni-sdk.umd.js"></script>
<script>
  Fusioni.init({
    apiBaseUrl: 'https://your-fusioni-api.com',
    agencyId: 'your-agency-id',
    accessToken: 'your-access-token',
    theme: 'light',
    position: 'bottom-right',
    primaryColor: '#6366f1',
    showConversationList: true,
    enableAudioRecording: true,
    enableFileUpload: true,
    maxFileSize: 10,
    allowedFileTypes: ['image/*']
  });
</script>
```

**Mount into a specific container:**

```html
<div id="my-chat"></div>
<script src="path/to/fusioni-sdk.umd.js"></script>
<script>
  Fusioni.mount('#my-chat', {
    apiBaseUrl: 'https://your-fusioni-api.com',
    agencyId: 'your-agency-id',
    theme: 'light',
    position: 'bottom-right',
    primaryColor: '#6366f1'
  });
  // Optional: unmount later
  // const result = Fusioni.mount('#my-chat', config);
  // result.unmount();
</script>
```

**Script API:**

| Method | Description |
|--------|-------------|
| `Fusioni.init(config)` | Mounts the chat widget with default placement (creates `#fusioni-chat-root`). Returns `{ unmount }`. |
| `Fusioni.mount(container, config)` | Mounts into `container` (CSS selector string or `HTMLElement`). Returns `{ unmount }`. |
| `Fusioni.version` | SDK version string. |

### Advanced Usage with Event Handlers

```tsx
import React from 'react';
import type { Conversation, FusioniMemoryMessage, FusioniSDKConfig } from '@fusioni/client-sdk';
import { ChatWidget } from '@fusioni/client-sdk';

function App() {
  const config: FusioniSDKConfig = {
    apiBaseUrl: 'https://your-fusioni-api.com',
    agencyId: 'your-agency-id',
    accessToken: 'your-access-token',
    theme: 'auto',
    position: 'bottom-right',
    primaryColor: '#6366f1',
    showConversationList: true,
    enableAudioRecording: true,
    enableFileUpload: true,
    maxFileSize: 10,
    allowedFileTypes: ['image/*', 'application/pdf']
  };

  const handleMessageSent = (message: FusioniMemoryMessage) => {
    console.log('Message sent:', message);
    // Track analytics, update UI, etc.
  };

  const handleMessageReceived = (message: FusioniMemoryMessage) => {
    console.log('Message received:', message);
    // Handle AI responses
  };

  const handleConversationCreated = (conversation: Conversation) => {
    console.log('New conversation:', conversation);
    // Update conversation list, analytics, etc.
  };

  const handleError = (error) => {
    console.error('Chat error:', error);
    // Handle errors, show notifications, etc.
  };

  return (
    <div className="App">
      <h1>My Website</h1>
      <ChatWidget
        config={config}
        onMessageSent={handleMessageSent}
        onMessageReceived={handleMessageReceived}
        onConversationCreated={handleConversationCreated}
        onError={handleError}
      />
    </div>
  );
}

export default App;
```

## Configuration Options

### FusioniSDKConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiBaseUrl` | `string` | **Required** | Base URL of your Fusioni API |
| `agencyId` | `string` | **Required** | Your agency ID |
| `accessToken` | `string` | `undefined` | Optional access token for authentication |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'light'` | UI theme preference |
| `position` | `'bottom-right' \| 'bottom-left' \| 'top-right' \| 'top-left'` | `'bottom-right'` | Position of the floating button |
| `primaryColor` | `string` | `'#6366f1'` | Primary color for the UI |
| `showConversationList` | `boolean` | `true` | Whether to show the conversation sidebar |
| `enableAudioRecording` | `boolean` | `true` | Enable voice message recording |
| `enableFileUpload` | `boolean` | `true` | Enable file upload functionality |
| `maxFileSize` | `number` | `10` | Maximum file size in MB |
| `allowedFileTypes` | `string[]` | `['image/*']` | Allowed MIME types for uploads |

## Event Handlers

### ChatWidgetProps

| Handler | Type | Description |
|---------|------|-------------|
| `onMessageSent` | `(message: FusioniMemoryMessage) => void` | Called when a user sends a message |
| `onMessageReceived` | `(message: FusioniMemoryMessage) => void` | Called when an AI response is received |
| `onConversationCreated` | `(conversation: Conversation) => void` | Called when a new conversation is created |
| `onConversationDeleted` | `(conversationId: string) => void` | Called when a conversation is deleted |
| `onError` | `(error: Error) => void` | Called when an error occurs |

## API Integration

The SDK automatically handles communication with your Fusioni API endpoints:

- **Conversations**: `/api/conversation`
- **Messages**: `/api/mem`
- **Pipeline**: `/api/pipeline/exec`
- **File Upload**: `/api/upload`
- **Server-Sent Events**: `/api/sse/connect`

## Styling

The SDK includes comprehensive CSS styles that can be customized using CSS variables:

```css
:root {
  --fusioni-primary: #6366f1;
  --fusioni-primary-light: #818cf8;
  --fusioni-primary-dark: #4f46e5;
  --fusioni-bg-primary: #ffffff;
  --fusioni-text-primary: #1e293b;
  /* ... more variables */
}
```

### Dark Theme

The SDK automatically applies dark theme styles when `theme: 'dark'` or `theme: 'auto'` (with system preference) is set.

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

### Audio Recording Requirements

- HTTPS or localhost (secure context)
- Microphone permissions
- Modern browser with MediaRecorder API support

## Development

### Building the SDK

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

## Examples

### Custom Styling

```tsx
import React from 'react';
import { ChatWidget } from '@fusioni/client-sdk';
import './custom-chat-styles.css';

function App() {
  const config = {
    apiBaseUrl: 'https://your-fusioni-api.com',
    agencyId: 'your-agency-id',
    theme: 'light',
    position: 'bottom-right',
    primaryColor: '#6366f1'
  };

  return (
    <div>
      <ChatWidget config={config} />
    </div>
  );
}
```

```css
/* custom-chat-styles.css */
.fusioni-chat-widget {
  --fusioni-primary: #your-brand-color;
  --fusioni-bg-primary: #your-background-color;
}

.fusioni-floating-button {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}
```

### Conditional Rendering

```tsx
import React, { useState } from 'react';
import { ChatWidget } from '@fusioni/client-sdk';

function App() {
  const [showChat, setShowChat] = useState(false);

  const config = {
    apiBaseUrl: 'https://your-fusioni-api.com',
    agencyId: 'your-agency-id',
    theme: 'light',
    position: 'bottom-right',
    primaryColor: '#6366f1'
  };
  
  return (
    <div>
      <button onClick={() => setShowChat(!showChat)}>
        Toggle Chat
      </button>
      {showChat && <ChatWidget config={config} />}
    </div>
  );
}
```

## Troubleshooting

### Common Issues

1. **Audio recording not working**
   - Ensure you're on HTTPS or localhost
   - Check microphone permissions
   - Verify browser support for MediaRecorder API

2. **File uploads failing**
   - Check file size limits
   - Verify allowed file types
   - Ensure proper API endpoint configuration

3. **Messages not appearing**
   - Verify API base URL and agency ID
   - Check network connectivity
   - Review browser console for errors

### Debug Mode

The SDK uses `accessToken` for authenticated requests to your Fusioni API. (Logging, if present, is controlled by your app/build environment rather than by the token value.)

```tsx
const config = {
  // ... other config
  accessToken: 'your-access-token',
};
```

## License

MIT License - see LICENSE file for details.

## Support

For support and questions:
- Create an issue on GitHub
- Contact the Fusioni team

## Linking npm

./fusioni-client-sdk && npm run build && npm link

./usion-client-sdk-example && npm link @fusioni/client-sdk