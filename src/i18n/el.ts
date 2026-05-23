export const el = {
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
      send: 'Αποστολή',
      upload: 'Ανέβασμα',
      record: 'Εγγραφή'
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
      loading: 'Εργάζομαι...',
      error: 'Ουπς! Κάτι πήγε στραβά. Παρακαλώ δοκιμάστε ξανά αργότερα.',
      delete: 'Διαγραφή μηνύματος',
      deleteConfirm: {
        title: 'Διαγραφή Μηνύματος',
        message: 'Είστε σίγουροι ότι θέλετε να διαγράψετε αυτό το μήνυμα; Αυτή η ενέργεια δεν μπορεί να αναιρεθεί.',
        confirm: 'Διαγραφή',
        cancel: 'Ακύρωση'
      }
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
      suggestionOne: 'Κάντε μια ερώτηση',
      suggestionTwo: 'Συγκρίνετε επιλογές',
      suggestionThree: 'Δείτε επόμενα βήματα'
    },
    errors: {
      failedToCreateConversation: 'Αποτυχία δημιουργίας συνομιλίας',
      failedToLoadConversation: 'Αποτυχία φόρτωσης συνομιλίας',
      failedToDeleteConversation: 'Αποτυχία διαγραφής συνομιλίας',
      failedToSendMessage: 'Αποτυχία αποστολής μηνύματος',
      failedToDeleteMessage: 'Αποτυχία διαγραφής μηνύματος',
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
