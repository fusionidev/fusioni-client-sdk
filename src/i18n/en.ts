export const en = {
  // Chat Interface
  chat: {
    title: 'Fusioni AI',
    subtitle: 'AI Assistant',
    welcome: {
      title: 'Welcome to Fusioni',
      description: 'Start a new conversation to begin chatting with AI',
      startButton: 'Start New Conversation',
      creating: 'Creating...'
    },
    input: {
      placeholder: 'Type your message...',
      send: 'Send',
      upload: 'Upload',
      record: 'Record'
    },
    conversations: {
      title: 'Conversations',
      search: 'Search conversations...',
      newConversation: 'New Conversation',
      noConversations: 'No conversations yet',
      delete: 'Delete conversation',
      newIndicator: 'New conversation - will be saved when you send a message',
      deleteConfirm: {
        title: 'Delete Conversation',
        message: 'Are you sure you want to delete this conversation? This action cannot be undone.',
        confirm: 'Delete',
        cancel: 'Cancel'
      }
    },
    attachedImages: 'Images',
    attachedVideos: 'Videos',
    messages: {
      loading: 'Working on it...',
      error: 'Oops! Something went wrong. Please try again later.',
      delete: 'Delete message',
      deleteConfirm: {
        title: 'Delete Message',
        message: 'Are you sure you want to delete this message? This action cannot be undone.',
        confirm: 'Delete',
        cancel: 'Cancel'
      }
    },
    thoughts: {
      title: 'Thoughts'
    },
    connection: {
      connected: 'Real-time updates connected',
      disconnected: 'Real-time updates disconnected'
    },
    fullscreen: {
      enter: 'Enter fullscreen',
      exit: 'Exit fullscreen'
    },
    theme: {
      light: 'Switch to light theme',
      dark: 'Switch to dark theme'
    },
    emptyState: {
      title: 'How can I help today?',
      description: 'Ask a question, share a task, or describe what you need. Fusioni is ready when you are.',
      suggestionsLabel: 'Suggested actions',
      suggestionOne: 'Ask a question',
      suggestionTwo: 'Compare options',
      suggestionThree: 'Get next steps'
    },
    errors: {
      failedToCreateConversation: 'Failed to create conversation',
      failedToLoadConversation: 'Failed to load conversation',
      failedToDeleteConversation: 'Failed to delete conversation',
      failedToSendMessage: 'Failed to send message',
      failedToDeleteMessage: 'Failed to delete message',
      failedToUploadFile: 'Failed to upload file',
      failedToInitialize: 'Failed to initialize chat service',
      retry: 'Retry'
    }
  },
  
  // Language Switcher
  language: {
    english: 'English',
    greek: 'Ελληνικά',
    switchLanguage: 'Switch Language'
  },
  
  // Common
  common: {
    close: 'Close',
    open: 'Open',
    cancel: 'Cancel',
    confirm: 'Confirm',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    search: 'Search',
    clear: 'Clear',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    warning: 'Warning',
    info: 'Info',
    yes: 'Yes',
    no: 'No'
  }
} as const;
