// src/i18n/i18n.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      // Chat Interface
      chat: {
        title: "NurseQuiz",
        uploadFile: "Start by uploading your course content📄",
        uploadDocument: "Upload",
        placeholder: "Message...",
        addFile: "Add files",
        filesInMemory: "Files in memory",
        files: "Notes",
        noFiles: "No files uploaded",
        aiTyping: "AI is typing...",
        send: "Send",
        studysheet: "Study Sheet",
        studysheetgenerated: "Here is your study sheet",
        clickToView: "Click to view",
        filesReceived: "Files received, what's next?",
        fileReceived: "File received, what's next?",
        continuelearning: "Continue learning",
        uploading: "Uploading"
      },

      // Common UI Elements
      common: {
        loading: "Loading...",
        save: "Save",
        cancel: "Cancel",
        submit: "Submit",
        search: "Search",
        welcome: "Welcome"
      },

      // Content/Landing
      content: {
        title: "Welcome to Our App",
        description: "This is a bilingual React application with i18next support.",
        changeLanguage: "Change Language"
      },

      // File Actions
      file: {
        summary: "Summary",
        quiz: "🧠 Quiz",
        scenario: "Scenario",
        summarize: "Summarize file",
        generateQuiz: "Generate quiz",
        createScenario: "Create scenario"
      },

      // Forms
      form: {
        name: "Name",
        email: "Email",
        password: "Password",
        login: "Login",
        register: "Register"
      },

      // Loading States
      loading: {
        justAmoment:"Just a moment ...",
        analyzing: "Analyzing documents...",
        finishingUp: "Finishing up...",
        complete: "Analysis complete",
        documentUploaded: "Document uploaded",
        documentsUploaded: "Documents uploaded",
        file: "file",
        files: "files",
        filesProcessed: "files processed",
        fileProcessed: "file processed",
        topicsFound: "topics identified",
        conceptsFound: "concepts extracted",
        generatingQuiz: "Generating quiz",
        savingFile: "Saving your file",
        analyzingContent: "Analyzing your file content",
        writingSummary: "Writing you a summary",
        creatingSituation: "Cooking up a scenario for you",
        readingDocuments: "Reading your documents...",
        quiz: "Creating your quiz",
        summary: "Summarizing your file"
      },

      // Login
      login: {
        title: "Login to NurseQuiz",
        email: "Email",
        emailPlaceHolder: "Enter your email",
        password: "Password",
        passwordPlaceHolder: "Enter your password",
        loading: "Logging in...",
        login: "Login",
        google: "Continue with Google",
        apple: "Continue with Apple",
        noAccount: "Don't have an account?",
        signup: "Sign Up",
        forgotPassword: "Forgot password"
      },

      // Messages & Notifications
      message: {
        success: "Operation successful!",
        error: "An error occurred. Please try again.",
        confirm: "Are you sure?",
        summary: "summary",
        goodanswer: "Right Answer",
        badanswer: "Wrong answer",
        explanation: "Explanation",
        fileReceived: "I received the file \"{{fileName}}\". What do you want to do with it?",
        fileUploading: "Uploading file: {{fileName}}...",
        fileUploaded: "File uploaded: {{fileName}}",
        summaryGenerated: "We summarized {{fileName}}, which would have taken about {{readingTime}} min to read.\\nYou saved **{{savedTime}} min**. ⏱️",
        summarydone: "I summarized {{filename}} that would have taken you {{readingTime}} min to read.\n  You saved {{savedTime}} min",
        quizReady: "Here is your quiz",
        scenarioReady: "Here is your scenario",
        generatingQuiz: "Generating the quiz"
      },

      // Navigation
      nav: {
        home: "Home",
        about: "About",
        contact: "Contact",
        services: "Services"
      },

      // Quiz Interface
      quiz: {
        studytitle: "Let's review!",
        studymessage: "Take time to review the material!",
        practicetitle: "Keep trying!",
        practicemessage: "Focus on the explanations above!",
        reviewtitle: "Review time!",
        reviewmessage: "A bit more practice will help!",
        moderatetitle: "Keep going!",
        moderatemessage: "You're getting there!",
        goodtitle: "Well done!",
        goodmessage: "You're making good progress!",
        excellenttitle: "Excellent!",
        excellentmessage: "Great work, keep it up!",
        outstandingtitle: "Outstanding!",
        outstandingmessage: "You're mastering this material!"
      },

      // Quiz Progress Bar
      quizbar: {
        progress: "Progress",
        start: "🚀 Great start! Keep going!",
        25: "✨ You're doing great!",
        50: "💪 Halfway there! Keep going!",
        75: "🔥 Finish strong! You got this!",
        90: "🏁 Almost done! Don't stop!",
        100: "🎉 Complete! Great job!"
      },

      // Quiz Sticky Progress Bar
      quizbarsticky: {
        answered: "answered",
        streak3msg: " 🔥 On Fire! 3 in a row!",
        streak5msg: " 🔥🔥 Unstoppable! 5 streak!",
        streak10msg: " 🔥🔥🔥 LEGENDARY! 10 streak!",
        streak3txt: "ON FIRE",
        streak5txt: "UNSTOPPABLE",
        streak10txt: "LEGENDARY"
      },

      // Sidebar
      side: {
        chats: "Chats",
        newChat: "New chat",
        usage: "Usage",
        logout: "Logout"
      },

      // Sign Up
      signup: {
        title: "Create an account",
        signup: "Sign up",
        signupGoogle: "Continue with Google",
        haveAccount: "You already have an account?",
        login: "Log in"
      },

      // Study Sheet
      studysheet: {
        loading: "Preparing your study sheet...",
        building: "Building Study Sheet"
      },

      // Upload
      upload: {
        started: "File upload has started",
        failed: "File upload failed",
        uploaded: "File uploaded",
        received: "I received your file",
        question: "What do you want to do?",
        uploading: "Sending"
      }
    }
  },

  fr: {
    translation: {
      // Chat Interface
      chat: {
        title: "NurseQuiz",
        uploadFile: "Commencez par téléverser le cotenu de votre cours 📄",
        uploadDocument: "Téléverser",
        placeholder: "Message...",
        addFile: "Ajouter des fichiers",
        filesInMemory: "Fichiers en mémoire",
        files: "Notes de cours",
        noFiles: "Aucun fichier téléversé",
        aiTyping: "L'IA tape...",
        send: "Envoyer",
        studysheet: "Fiche d'étude",
        studysheetgenerated: "Voici ta fiche d'étude",
        clickToView: "Cliques pour voir",
        filesReceived: "Tes fichiers ont été bien reçus, que veux-tu faire?",
        fileReceived: "Ton fichier a été bien reçu, que veux-tu faire?",
        continuelearning: "En savoir plus",
        uploading: "Téléversement"
      },

      // Common UI Elements
      common: {
        loading: "Chargement...",
        save: "Enregistrer",
        cancel: "Annuler",
        submit: "Soumettre",
        search: "Rechercher",
        welcome: "Bienvenue"
      },

      // Content/Landing
      content: {
        title: "Bienvenue dans notre application",
        description: "Il s'agit d'une application React bilingue avec support i18next.",
        changeLanguage: "Changer de langue"
      },

      // File Actions
      file: {
        summary: " Résumé",
        quiz: " Quiz",
        scenario: "Mise en situation",
        summarize: "Résumer le fichier",
        generateQuiz: "Générer un quiz",
        createScenario: "Créer une mise en situation"
      },

      // Forms
      form: {
        name: "Nom",
        email: "Email",
        password: "Mot de passe",
        login: "Connexion",
        register: "S'inscrire"
      },

      // Loading States
      loading: {
        justAmoment:"Juste un moment ...",
        analyzing: "Analyse des documents...",
        finishingUp: "Finalisation...",
        complete: "Analyse terminée",
        documentUploaded: "Document téléversé",
        documentsUploaded: "Documents téléversés",
        file: "fichier",
        files: "fichiers",
        filesProcessed: "fichiers traités",
        fileProcessed: "fichier traité",
        topicsFound: "sujets identifiés",
        conceptsFound: "concepts extraits",
        generatingQuiz: "Entrain de générer un quiz",
        savingFile: "Entrain d'enregistrer ton fichier",
        analyzingContent: "Entrain d'analyser le contenu de ton fichier",
        writingSummary: "Entrain de t'écrire un résumé",
        creatingSituation: "Entrain de te concocter une mise en situation",
        readingDocuments: "Entrain de lire tes documents...",
        quiz: "Création de ton quiz",
        summary: "Résumé de ton fichier"
      },

      // Login
      login: {
        title: "Se connecter à NurseQuiz",
        email: "Email",
        emailPlaceHolder: "Entrez votre email",
        password: "Mot de passe",
        passwordPlaceHolder: "Entrez votre mot de passe",
        loading: "Connexion en cours...",
        login: "Se connecter",
        google: "Continuer avec Google",
        apple: "Continuer avec Apple",
        noAccount: "Pas de compte?",
        signup: "Créer un compte",
        forgotPassword: "Mot de passe oublié?"
      },

      // Messages & Notifications
      message: {
        success: "Opération réussie !",
        error: "Une erreur est survenue. Veuillez réessayer.",
        confirm: "Êtes-vous sûr ?",
        summary: "Résumé",
        goodanswer: "Bonne réponse",
        badanswer: "Mauvaise réponse",
        explanation: "Explication",
        fileReceived: "J'ai bien reçu le fichier \"{{fileName}}\". Que veux-tu faire avec?",
        fileUploading: "Envoi du fichier: {{fileName}}...",
        fileUploaded: "Fichier téléversé: {{fileName}}",
        summaryGenerated: "Nous avons résumé {{fileName}}, qui aurait pris environ {{readingTime}} min à lire.\\nVous avez sauvé **{{savedTime}} min**. ⏱️",
        summarydone: "J'ai résumé {{filename}} qui t'aurait pris environ {{readingTime}} min à lire.\n Tu as avez sauvé {{savedTime}} min",
        quizReady: "Voici votre quiz",
        scenarioReady: "Voici votre mise en situation",
        generatingQuiz: "Entrain de générer le quiz"
      },

      // Navigation
      nav: {
        home: "Accueil",
        about: "À propos",
        contact: "Contact",
        services: "Services"
      },

      // Quiz Interface
      quiz: {
        studytitle: "Révisons ensemble !",
        studymessage: "Prends le temps de revoir la matière !",
        practicetitle: "Continue d'essayer !",
        practicemessage: "Concentre-toi sur les explications ci-dessus !",
        reviewtitle: "C'est l'heure de la révision !",
        reviewmessage: "Un peu plus de pratique t'aidera !",
        moderatetitle: "Continue comme ça !",
        moderatemessage: "Tu es sur la bonne voie !",
        goodtitle: "Bien joué !",
        goodmessage: "Tu fais de beaux progrès !",
        excellenttitle: "Excellent !",
        excellentmessage: "Super travail, continue ainsi !",
        outstandingtitle: "Remarquable !",
        outstandingmessage: "Tu maîtrises vraiment la matière !"
      },

      // Quiz Progress Bar
      quizbar: {
        progress: "Progression",
        start: "🚀 Super début ! Continue comme ça !",
        25: "✨ Tu t'en sors très bien !",
        50: "💪 À mi-chemin ! Ne lâche rien !",
        75: "🔥 Termine en force ! Tu peux le faire !",
        90: "🏁 Presque fini ! Continue jusqu'au bout !",
        100: "🎉 Terminé ! Excellent travail !"
      },

      // Quiz Sticky Progress Bar
      quizbarsticky: {
        answered: "questions de répondus",
        streak3msg: "🔥 En feu ! 3 d'affilée !",
        streak5msg: "🔥🔥 Incroyable ! Série de 5 !",
        streak10msg: "🔥🔥🔥 LÉGENDAIRE ! Série de 10 !",
        streak3txt: "EN FEU",
        streak5txt: "IINCROYABLE",
        streak10txt: "LÉGENDAIRE"
      },

      // Sidebar
      side: {
        chats: "Discussions",
        newChat: "nouveau chat",
        usage: "Analytiques",
        logout: "Déconnexion"
      },

      // Sign Up
      signup: {
        title: "Créez un compte",
        passwordConfirm: "Confirmez votre mot de passe",
        signup: "Créer mon compte",
        signupGoogle: "Utiliser mon compte google",
        haveAccount: "Déjà inscris?",
        login: "Se connecter"
      },

      // Study Sheet
      studysheet: {
        loading: "Entrain de préparer ta feuille d'étude...",
        building: "Création de la feuille d'étude"
      },

      // Upload
      upload: {
        started: "Envoi du fichier",
        failed: "Erreur durant le téléversement du fichier",
        uploaded: "Fichier envoyé",
        received: "J'ai reçu ton fichier",
        question: "",
        uploading: "Entrain d'envoyer :"
      }
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    load: 'languageOnly',
    debug: process.env.NODE_ENV === 'development',
    
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    
    interpolation: {
      escapeValue: false,
    },
    
    ns: ['translation'],
    defaultNS: 'translation',
  });

export default i18n;