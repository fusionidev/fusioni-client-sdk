export const en = {
  actions: {
    available: 'Available actions', loading: 'Loading actions…', empty: 'No actions found',
    loadFailed: 'Actions could not be loaded.', profileFailed: 'The conversation profile could not be loaded.',
    executionFailed: 'The action could not be completed. Please try again.', run: 'Run action', running: 'Running action',
    success: 'Success', submit: 'Run action', result: 'Action result', conversation: 'Conversation',
    fieldsPrompt: 'Complete the fields below to run this action.', required: 'Required', optional: 'Optional',
    attachFiles: 'Attach files', fieldRequired: 'This field is required.', fieldInvalid: 'Enter a valid value.',
    jsonPlaceholder: 'Enter valid JSON', listPlaceholder: 'Comma-separated values or a JSON array',
    validation: {
      equals: 'Must equal {value}.', not_equals: 'Must not equal {value}.', contains: 'Must contain {value}.',
      not_contains: 'Must not contain {value}.', greater_than: 'Must be greater than {value}.',
      greater_than_or_equal: 'Must be at least {value}.', less_than: 'Must be less than {value}.',
      less_than_or_equal: 'Must be at most {value}.', min_length: 'Must have at least {value} items or characters.',
      max_length: 'Must have at most {value} items or characters.',
    },
  },
  miniApp: {
    reload: 'Reload',
    failed: 'The mini app could not be started.',
    empty: 'This mini app has no web component bundle yet.',
    loading: 'Loading mini apps',
    loadFailed: 'Mini apps could not be loaded.',
    notFound: 'No mini apps found',
  },
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
      loading: 'Thinking...',
      newMessageReceived: 'New message received',
      error: 'Oops! Something went wrong. Please try again later.',
      delete: 'Delete message',
      agent: 'Agent',
      executionTime: 'Execution time',
      like: 'Like message',
      dislike: 'Dislike message',
      errorIndicator: 'An unexpected error occurred',
      showMoreLinks: 'Show more',
      showLessLinks: 'Show less',
      approvalReason: 'Reason',
      approvalParameters: 'Parameters',
      approve: 'Approve',
      deny: 'Deny',
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
      failedToRateMessage: 'Failed to save message feedback',
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
