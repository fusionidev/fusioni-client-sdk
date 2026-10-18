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
- **Mini Apps** - Mount trusted web-component bundles or collections selected by position or tags

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
    showThoughts: false,
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
  // Optional: unmount or change language/theme later
  // const result = Fusioni.mount('#my-chat', config);
  // result.unmount();
  // result.setLanguage('el');
  // result.setTheme('auto');
</script>
```

**Script API:**

| Method | Description |
|--------|-------------|
| `Fusioni.init(config)` | Mounts the chat widget with default placement (creates `#fusioni-chat-root`). Returns [`FusioniMountResult`](#changing-language-and-theme-after-init). |
| `Fusioni.mount(container, config)` | Mounts into `container` (CSS selector string or `HTMLElement`). Returns [`FusioniMountResult`](#changing-language-and-theme-after-init). |
| `Fusioni.version` | SDK version string. |

### Changing language and theme after init

`Fusioni.init` and `Fusioni.mount` return the same handle (in TypeScript: `FusioniMountResult`), which includes **`setLanguage`** and **`setTheme`** so you can switch locale or appearance without remounting.

| Property / method | Description |
|-------------------|-------------|
| `unmount()` | Removes the widget and cleans up the React root. |
| `setLanguage(language)` | Sets UI language to `'en'` or `'el'`. Invalid values are ignored. |
| `setTheme(theme)` | Sets appearance to `'light'`, `'dark'`, or `'auto'` (follows system preference). Persists like the in-widget theme control. |

**Script example:**

```html
<script src="path/to/fusioni-sdk.umd.js"></script>
<script>
  const chat = Fusioni.init({
    apiBaseUrl: 'https://your-fusioni-api.com',
    agencyId: 'your-agency-id',
    theme: 'light',
    language: 'en'
  });

  document.getElementById('locale-el').addEventListener('click', () => {
    chat.setLanguage('el');
  });
  document.getElementById('theme-dark').addEventListener('click', () => {
    chat.setTheme('dark');
  });
</script>
```

**React (npm) example:** pass a ref to `ChatWidget` and call the same methods (type: `FusioniChatWidgetHandle`).

```tsx
import { useRef } from 'react';
import { ChatWidget, type FusioniChatWidgetHandle, type FusioniSDKConfig } from '@fusioni/client-sdk';

function App() {
  const chatRef = useRef<FusioniChatWidgetHandle>(null);
  const config: FusioniSDKConfig = {
    apiBaseUrl: 'https://your-fusioni-api.com',
    agencyId: 'your-agency-id',
  };

  return (
    <>
      <button type="button" onClick={() => chatRef.current?.setLanguage('el')}>
        Greek
      </button>
      <button type="button" onClick={() => chatRef.current?.setTheme('dark')}>
        Dark mode
      </button>
      <ChatWidget ref={chatRef} config={config} />
    </>
  );
}
```

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

## Mini App Rendering

`MiniAppRenderer` is the React equivalent of Fusion Web's Angular mini-app renderer. It imports a snapshot's web-component bundle and mounts the custom element registered by its entry ES module.

```tsx
import {MiniAppRenderer} from '@fusioni/client-sdk';
import '@fusioni/client-sdk/dist/index.css';

function Dashboard() {
  return (
    <MiniAppRenderer
      apiBaseUrl="https://your-fusioni-api.com/api"
      accessToken="your-access-token"
      agencyId="your-agency-id"
      position="dashboard"
      columns={2}
      options={{title: 'Dashboard', rows: 25}}
      onReady={element => console.log('Mini App mounted', element)}
      onFailed={error => console.error(error)}
    />
  );
}
```

Use `miniApp={snapshot}` for one app or `miniApps={snapshots}` for a supplied collection. Each snapshot needs a `bundle` with `element`, `entry`, and file metadata:

```ts
const snapshot = {
  id: 'your-mini-app-id',
  name: 'Reports',
  bundle: {
    element: 'fusion-reports',
    entry: 'frontend/index.js',
    files: [{path: 'frontend/index.js', sha256: 'file-content-hash', size: 1024}],
  },
};
```

The files live in the Mini App runtime. The entry must call `customElements.define('fusion-reports', …)` at module top level; exporting a class or waiting for `DOMContentLoaded` is insufficient. The browser loads relative imports and `new URL(path, import.meta.url)` assets from the signed runtime URL.

To load installed apps by tags, use `agencyId` and `tags={['billing', 'reports']}`. Selection precedence is **position → tags → miniApps → miniApp**. Position and tag lookups require an agency; mounting a bundle also needs an agency, either from the prop or an explicit runtime context. A single result can render into an external `element`; multiple results each receive their own container. Collections use one column on mobile and `columns` at widths of 768px and above.

| Prop | Default | Purpose |
|------|---------|---------|
| `miniApp` | — | Snapshot containing the custom element's bundle |
| `miniApps` | — | Snapshots to render together |
| `agencyId`, `position`, `tags` | — | Select apps from the API |
| `element` | Own container | External container to mount the custom element into |
| `columns` | `1` | Positive whole number of desktop columns |
| `options`, `context` | `{}` | Custom-element configuration and host services, assigned before connection |
| `reloadable`, `showStatus` | `true` | Show reload controls and empty-state messages |
| `currentLanguage` | `'en'` | Control/status language (`'en'` or `'el'`) |
| `apiBaseUrl`, `accessToken` | Initialized SDK client | Independent connection for queries and backend calls; base URL includes `/api` |
| `apiClient` | — | Explicit `ApiClient`, taking precedence over the URL/token |
| `onReady`, `onFailed` | — | Receive the mounted custom element or a file/module/registration failure |
| `className`, `style` | — | Style the outer wrapper |

Changing `options`, `context`, callbacks, or `columns` does not restart elements. Use a `ref` typed as `MiniAppRendererHandle` and call `ref.current.run()` to remount with current options/context. Its `api` getter exposes the mounted `MiniAppElement` for a single app, or `null` for a collection. `loadMiniApps()` retries the current server query. Replacement, reload, and unmount remove the element, invoking its native `disconnectedCallback()` when connected.

For a snapshot, `element.context.backend.request(path, request?)` automatically calls `/api/mini-app-runtime/{miniAppId}{path}` with the agency and SDK authentication. Request options include `method`, `query`, `headers`, `body`, and `responseType` (`'json'` or `'text'`). A supplied `context.backend` takes precedence; `MiniAppBackendService.createBuilderContext()` selects the builder runtime for both files and backend calls. `element.context.lifecycle.signal` and backend request signals are aborted on reload or unmount. Use that signal to cancel asynchronous work and `disconnectedCallback()` to remove listeners/timers.

The frozen `element.context.files` provides `base` (the signed file base URL) and `url(path)` for resolving bundle assets. File grants use `/api/mini-app-files/{installed|builder}/{miniAppId}` and are cached by connection, runtime, app, agency, and bundle version so the same module keeps the same URL across remounts. Failed grants can be retried. A browser cannot redefine a custom element: a different bundle version using an already registered name requires a page reload. Names already registered by unrelated host code are rejected.

The script bundle provides the same renderer with SDK styles in a Shadow DOM:

```html
<div id="mini-apps"></div>
<script src="path/to/fusioni-sdk.umd.js"></script>
<script>
  const apps = Fusioni.mountMiniApp('#mini-apps', {
    apiBaseUrl: 'https://your-fusioni-api.com/api',
    accessToken: 'your-access-token',
    agencyId: 'your-agency-id',
    position: 'dashboard',
    columns: 2,
    reloadable: false
  });
  // apps.run(); apps.loadMiniApps(); apps.unmount();
</script>
```

Bundles execute with the privileges of the host page and are not sandboxed. Render only trusted Mini App snapshots. Content Security Policy must allow the runtime module and asset origins; `unsafe-eval` is no longer required by this renderer.

## Action Buttons

`ActionButtons` is the React equivalent of Fusion Web's action-buttons component. It loads enabled actions by group tags and executes them with their conversation profile fields.

```tsx
import { useRef } from 'react';
import { ActionButtons, type ActionButtonsHandle } from '@fusioni/client-sdk';
import '@fusioni/client-sdk/dist/index.css';

function Tools() {
  const actions = useRef<ActionButtonsHandle>(null);
  return (
    <ActionButtons
      ref={actions}
      agencyId="your-agency-id"
      tags={['tools']}
      apiBaseUrl="https://your-fusioni-api.com/api"
      accessToken="your-access-token"
      currentLanguage="en"
      showButtonsPanel
      actionInputFieldValues={{ '*': { customer_id: '123' }, report: { format: 'pdf' } }}
      actionEnabledStates={{ report: true }}
      onResponse={results => console.log(results)}
      onError={error => console.error(error)}
    />
  );
}
```

You can supply an `apiClient` instead of URL/token props, or use the SDK's initialized client. Tags are trimmed and deduplicated; both an agency and nonempty tags are needed to load actions. Shared values under `'*'` are overridden by the action's `key`. Only declared fields are sent. Supplied values hide their controls and must pass validation. `actionEnabledStates` disables actions only when their **key** maps to `false`.

Profile forms support text, number, boolean, date, JSON, list, file, prompt and embedded chat fields, including defaults, localized labels and validation rules. Required fields are included even when the action selects a subset of the profile. File fields accept up to eight files and send data URLs through the execution request's `image` channel. Prompt fields reuse `ChatInput`, retain drafts after validation failure, and submit with Enter or Send. Embedded chat fields create a profile-linked conversation and reuse the SDK's chat input, messages, image gallery, journey execution and streaming progress.

Maintained actions have independent conversation histories and session-stored IDs scoped by page route and agency. `conversationStorageKey` customizes the storage prefix; the agency is always appended. History restoration emits no response event, and unavailable storage falls back to memory. `results_sort` controls turn ordering. Results include sanitized HTML, images with gallery previews, document links, execution time and output variables. `onResponse` receives accumulated results for actions with `show_results`, and the current execution's results otherwise.

| Prop | Default | Purpose |
| --- | --- | --- |
| `showRunButton` | `true` | Show the form's submit button; prompt Send still submits |
| `showLoadingPanel` | `true` | Show execution progress |
| `showActionResult` | `true` | Display and restore results; callbacks still fire when hidden |
| `showButtonsPanel` | `false` | Add a container around the action cards |
| `fullscreen` | `false` | Open profile forms fullscreen |
| `onFullscreenChange` | — | Receive fullscreen toggles, including Escape |
| `sidePanel` / `children` | — | Show content beside the form in fullscreen |

The ref exposes `executeAction(actionOrIdOrKey)`, `submitFields()`, `cancelFields()`, `startNewConversation(actionOrIdOrKey?)`, `loadActions()`, and getters for `selectedAction`, `results`, and `conversationMessages`. Executing an action opens its form if input is needed. Changing agency or tags cancels pending requests and resets the view. Unmounting also cancels requests and timers.

For script-tag integrations, use the same props with isolated Shadow DOM styles:

```js
const actions = Fusioni.mountActionButtons('#actions', {
  agencyId: 'your-agency-id',
  tags: ['tools'],
  apiBaseUrl: 'https://your-fusioni-api.com/api',
  accessToken: 'your-access-token',
  onResponse: results => console.log(results),
});
// actions.executeAction('report'); // call after actions have loaded
// actions.startNewConversation();
// actions.unmount();
```

## Configuration Options

### FusioniSDKConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiBaseUrl` | `string` | **Required** | Base URL of your Fusioni API |
| `agencyId` | `string` | **Required** | Your agency ID |
| `accessToken` | `string` | `undefined` | Optional access token for authentication |
| `ownerId` | `string` | SDK client ID or JWT `oid` | Current sender's Fusion owner ID. Normally resolved automatically from the SDK client configuration or a JWT access token |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'light'` | UI theme preference (can be changed later via [`setTheme`](#changing-language-and-theme-after-init)) |
| `language` | `'en' \| 'el'` | `'en'` | UI copy language (can be changed later via [`setLanguage`](#changing-language-and-theme-after-init)) |
| `showThemeToggle` | `boolean` | `true` | Show/hide the theme toggle button in the chat header |
| `showFullscreenToggle` | `boolean` | `true` | Show/hide the fullscreen toggle button in the chat header |
| `showLanguageSwitcher` | `boolean` | `true` | Show/hide the language switcher in the chat header |
| `showThoughts` | `boolean` | `false` | Show each message's `thoughts` field in a collapsible panel |
| `position` | `'bottom-right' \| 'bottom-left' \| 'top-right' \| 'top-left'` | `'bottom-right'` | Position of the floating button |
| `primaryColor` | `string` | `'#6366f1'` | Primary color for the UI |
| `showConversationList` | `boolean` | `true` | Whether to show the conversation sidebar |
| `enableAudioRecording` | `boolean` | `true` | Enable voice message recording |
| `enableFileUpload` | `boolean` | `true` | Enable file upload functionality |
| `maxFileSize` | `number` | `10` | Maximum file size in MB |
| `allowedFileTypes` | `string[]` | `['image/*']` | Allowed MIME types for uploads |
| `buttonVariant` | `'minimal' \| 'glass' \| 'solid'` | `'glass'` | Floating launcher button style |

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
- **Journey execution**: `/api/journey/exec_async` (acknowledgement)
- **File Upload**: `/api/upload`
- **Server-Sent Events**: `/api/sse/connect` (`chat_stream` progress and `message_stream` responses)

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

### Tests

```bash
npm test -- --runInBand
```

Mini App tests cover rendering, asynchronous lifecycle cleanup, catalog queries, backend transport, and script-tag mounting.

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

./fusion-client-sdk-example && npm link @fusioni/client-sdk
