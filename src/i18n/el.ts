export const el = {
  search: {
    label: 'Αναζήτηση', placeholder: 'Αναζήτηση…', submit: 'Αναζήτηση', results: 'Αποτελέσματα αναζήτησης',
    loading: 'Αναζήτηση…', empty: 'Δεν βρέθηκαν αποτελέσματα.', failed: 'Η αναζήτηση δεν ολοκληρώθηκε.', retry: 'Δοκιμάστε ξανά',
    untitled: 'Αποτέλεσμα χωρίς τίτλο', count: '{count} αποτελέσματα', page: 'Σελίδα {page}',
    pagination: 'Σελίδες αποτελεσμάτων αναζήτησης', previous: 'Προηγούμενη', next: 'Επόμενη',
  },
  actions: {
    available: 'Διαθέσιμες ενέργειες', loading: 'Φόρτωση ενεργειών…', empty: 'Δεν βρέθηκαν ενέργειες',
    loadFailed: 'Δεν ήταν δυνατή η φόρτωση των ενεργειών.', profileFailed: 'Δεν ήταν δυνατή η φόρτωση του προφίλ συνομιλίας.',
    executionFailed: 'Η ενέργεια δεν ολοκληρώθηκε. Δοκιμάστε ξανά.', run: 'Εκτέλεση ενέργειας', running: 'Εκτέλεση ενέργειας',
    success: 'Επιτυχία', submit: 'Εκτέλεση ενέργειας', result: 'Αποτέλεσμα ενέργειας', conversation: 'Συνομιλία',
    fieldsPrompt: 'Συμπληρώστε τα παρακάτω πεδία για να εκτελέσετε την ενέργεια.', required: 'Υποχρεωτικό', optional: 'Προαιρετικό',
    attachFiles: 'Επισύναψη αρχείων', fieldRequired: 'Το πεδίο είναι υποχρεωτικό.', fieldInvalid: 'Εισαγάγετε μια έγκυρη τιμή.',
    jsonPlaceholder: 'Εισαγάγετε έγκυρο JSON', listPlaceholder: 'Τιμές χωρισμένες με κόμμα ή πίνακας JSON',
    validation: {
      equals: 'Πρέπει να ισούται με {value}.', not_equals: 'Δεν πρέπει να ισούται με {value}.', contains: 'Πρέπει να περιέχει {value}.',
      not_contains: 'Δεν πρέπει να περιέχει {value}.', greater_than: 'Πρέπει να είναι μεγαλύτερο από {value}.',
      greater_than_or_equal: 'Πρέπει να είναι τουλάχιστον {value}.', less_than: 'Πρέπει να είναι μικρότερο από {value}.',
      less_than_or_equal: 'Πρέπει να είναι το πολύ {value}.', min_length: 'Απαιτούνται τουλάχιστον {value} στοιχεία ή χαρακτήρες.',
      max_length: 'Επιτρέπονται το πολύ {value} στοιχεία ή χαρακτήρες.',
    },
  },
  miniApp: {
    reload: 'Επαναφόρτωση',
    failed: 'Η mini app δεν ήταν δυνατό να ξεκινήσει.',
    empty: 'Αυτή η mini app δεν έχει ακόμη πακέτο web component.',
    loading: 'Φόρτωση mini apps',
    loadFailed: 'Δεν ήταν δυνατή η φόρτωση των mini apps.',
    notFound: 'Δεν βρέθηκαν mini apps',
  },
  // Chat Interface
  chat: {
    title: 'Fusioni AI',
    subtitle: 'AI Βοηθός',
    welcome: {
      title: 'Καλώς ήρθατε στο Fusioni AI',
      description: 'Ξεκινήστε μια νέα συνομιλία για να αρχίσετε να συνομιλείτε με AI',
      startButton: 'Ξεκινήστε Νέα Συνομιλία',
      creating: 'Δημιουργία...'
    },
    input: {
      placeholder: 'Πληκτρολογήστε το μήνυμά σας...',
      newLineHint: 'Shift + Enter για νέα γραμμή',
      send: 'Αποστολή',
      stopResponse: 'Διακοπή απάντησης',
      stoppingResponse: 'Γίνεται διακοπή…',
      upload: 'Ανέβασμα',
      record: 'Εγγραφή'
    },
    contextUsage: {
      title: 'Παράθυρο context',
      tokens: 'tokens',
      windowUnavailable: 'Το μέγεθος του παραθύρου context δεν είναι διαθέσιμο.',
      estimated: 'Εκτίμηση χρήσης. Ο πάροχος δεν ανέφερε αριθμό tokens.',
      droppedOne: '1 παλαιότερο μήνυμα δεν αποστέλλεται πλέον στο μοντέλο.',
      droppedMany: '{count} παλαιότερα μηνύματα δεν αποστέλλονται πλέον στο μοντέλο.',
      footnote: 'Η μέτρηση αφορά την τελευταία απάντηση κάθε agent και περιλαμβάνει οδηγίες, ιστορικό και δεδομένα context.'
    },
    conversations: {
      title: 'Συνομιλίες',
      search: 'Αναζήτηση συνομιλιών...',
      newConversation: 'Νέα Συνομιλία',
      noConversations: 'Δεν υπάρχουν συνομιλίες ακόμα',
      delete: 'Διαγραφή συνομιλίας',
      newIndicator: 'Νέα συνομιλία - θα αποθηκευτεί όταν στείλετε μήνυμα',
      deleteConfirm: {
        title: 'Διαγραφή Συνομιλίας',
        message: 'Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή τη συνομιλία; Αυτή η ενέργεια δεν μπορεί να αναιρεθεί.',
        confirm: 'Διαγραφή',
        cancel: 'Ακύρωση'
      }
    },
    attachedImages: 'Εικόνες',
    attachedVideos: 'Βίντεο',
    messages: {
      loading: 'Thinking...',
      newMessageReceived: 'Λήφθηκε νέο μήνυμα',
      error: 'Ουπς! Κάτι πήγε στραβά. Παρακαλώ δοκιμάστε ξανά αργότερα.',
      delete: 'Διαγραφή μηνύματος',
      forkConversation: 'Διακλάδωση συνομιλίας',
      forkingConversation: 'Δημιουργία διακλάδωσης συνομιλίας…',
      agent: 'Agent',
      executionTime: 'Χρόνος εκτέλεσης',
      like: 'Μου αρέσει',
      dislike: 'Δεν μου αρέσει',
      errorIndicator: 'Παρουσιάστηκε ένα μη αναμενόμενο σφάλμα',
      showMoreLinks: 'Περισσότερα',
      showLessLinks: 'Λιγότερα',
      approvalReason: 'Αιτιολογία',
      approvalParameters: 'Παράμετροι',
      approve: 'Έγκριση',
      deny: 'Απόρριψη',
      deleteConfirm: {
        title: 'Διαγραφή Μηνύματος',
        message: 'Είστε σίγουροι ότι θέλετε να διαγράψετε αυτό το μήνυμα; Αυτή η ενέργεια δεν μπορεί να αναιρεθεί.',
        confirm: 'Διαγραφή',
        cancel: 'Ακύρωση'
      }
    },
    thoughts: {
      title: 'Σκέψεις'
    },
    connection: {
      connected: 'Συνδεδεμένο για ενημερώσεις σε πραγματικό χρόνο',
      disconnected: 'Αποσυνδεδεμένο από ενημερώσεις σε πραγματικό χρόνο'
    },
    fullscreen: {
      enter: 'Πλήρης οθόνη',
      exit: 'Έξοδος από πλήρη οθόνη'
    },
    theme: {
      light: 'Εναλλαγή σε φωτεινό θέμα',
      dark: 'Εναλλαγή σε σκοτεινό θέμα'
    },
    emptyState: {
      title: 'Πώς μπορώ να βοηθήσω σήμερα;',
      description: 'Κάντε μια ερώτηση, μοιραστείτε μια εργασία ή περιγράψτε τι χρειάζεστε. Το Fusioni είναι έτοιμο όταν είστε κι εσείς.',
      suggestionsLabel: 'Προτεινόμενες ενέργειες',
      suggestionOne: 'Κάντε μια ερώτηση',
      suggestionTwo: 'Συγκρίνετε επιλογές',
      suggestionThree: 'Δείτε επόμενα βήματα'
    },
    errors: {
      failedToCreateConversation: 'Αποτυχία δημιουργίας συνομιλίας',
      failedToForkConversation: 'Δεν ήταν δυνατή η διακλάδωση της συνομιλίας. Δοκιμάστε ξανά.',
      failedToLoadConversation: 'Αποτυχία φόρτωσης συνομιλίας',
      failedToDeleteConversation: 'Αποτυχία διαγραφής συνομιλίας',
      failedToSendMessage: 'Αποτυχία αποστολής μηνύματος',
      failedToStopResponse: 'Δεν ήταν δυνατή η διακοπή της απάντησης. Δοκιμάστε ξανά.',
      failedToDeleteMessage: 'Αποτυχία διαγραφής μηνύματος',
      failedToRateMessage: 'Αποτυχία αποθήκευσης αξιολόγησης μηνύματος',
      failedToUploadFile: 'Αποτυχία ανεβάσματος αρχείου',
      failedToInitialize: 'Αποτυχία αρχικοποίησης υπηρεσίας συνομιλίας',
      retry: 'Επανάληψη'
    }
  },
  
  // Language Switcher
  language: {
    english: 'English',
    greek: 'Ελληνικά',
    switchLanguage: 'Αλλαγή Γλώσσας'
  },
  
  // Common
  common: {
    close: 'Κλείσιμο',
    open: 'Άνοιγμα',
    cancel: 'Ακύρωση',
    confirm: 'Επιβεβαίωση',
    save: 'Αποθήκευση',
    delete: 'Διαγραφή',
    edit: 'Επεξεργασία',
    search: 'Αναζήτηση',
    clear: 'Εκκαθάριση',
    loading: 'Φόρτωση...',
    error: 'Σφάλμα',
    success: 'Επιτυχία',
    warning: 'Προειδοποίηση',
    info: 'Πληροφορία',
    yes: 'Ναι',
    no: 'Όχι'
  }
} as const;
