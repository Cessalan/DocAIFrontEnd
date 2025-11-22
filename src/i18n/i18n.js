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
        justAmoment: "Just a moment ...",
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
        summarydone: "I summarized {{filename}} that would have taken you {{readingTime}} min to read.\\n  You saved {{savedTime}} min",
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
        reviewQuiz:"Review quiz",
        reviewmessage: "A bit more practice will help!",
        moderatetitle: "Keep going!",
        25: "✨ You're doing great!",
        50: "💪 Halfway there! Keep it up!",
        75: "🔥 Finish strong! You can do it!",
        90: "🏁 Almost done! Keep going!",
        100: "🎉 Complete! Excellent work!"
      },

      // Quiz Sticky Progress Bar
      quizbarsticky: {
        answered: "questions answered",
        streak3msg: "🔥 On fire! 3 in a row!",
        streak5msg: "🔥🔥 Amazing! Streak of 5!",
        streak10msg: "🔥🔥🔥 LEGENDARY! Streak of 10!",
        streak3txt: "ON FIRE",
        streak5txt: "AMAZING",
        streak10txt: "LEGENDARY"
      },

      // Sidebar
      side: {
        chats: "Chats",
        newChat: "New chat",
        usage: "Analytics",
        logout: "Logout"
      },

      // Sign Up
      signup: {
        title: "Create an account",
        passwordConfirm: "Confirm your password",
        signup: "Create my account",
        signupGoogle: "Use my Google account",
        haveAccount: "Already registered?",
        login: "Sign in"
      },

      // Study Sheet
      studysheet: {
        loading: "Preparing your study sheet...",
        building: "Creating study sheet"
      },

      // Upload
      upload: {
        started: "Sending file",
        failed: "Error during file upload",
        uploaded: "File sent",
        received: "I received your file",
        question: "",
        uploading: "Uploading:"
      },

      // Quiz Navigation
      quizNavigation: {
        title: "Quiz Navigation",
        current: "Current",
        correct: "Correct",
        incorrect: "Incorrect",
        skipped: "Skipped",
        unanswered: "Unanswered",
        questionPrefix: "Q"
      },

      // Quiz Feedback
      quizFeedback: {
        title: "Quick Feedback",
        leaveFeedback: "Leave Feedback",
        submitted: "Feedback sent!",
        question: "How is your quiz experience?",
        whatWrong: "Oh no! What went wrong?",
        whatLike: "What do you like most?",
        thanks: "Thanks for your help!",
        ratingBad: "Bad",
        ratingOkay: "Okay",
        ratingGood: "Good",
        tooHard: "Too Hard",
        confusing: "Confusing",
        bugs: "Bugs",
        content: "Content",
        design: "Design",
        learning: "Learning"
      }
    }
  },

  fr: {
    translation: {
      // Chat Interface
      chat: {
        title: "NurseQuiz",
        uploadFile: "Commencez par téléverser votre contenu de cours📄",
        uploadDocument: "Téléverser",
        placeholder: "Message...",
        addFile: "Ajouter des fichiers",
        filesInMemory: "Fichiers en mémoire",
        files: "Notes",
        noFiles: "Aucun fichier téléversé",
        aiTyping: "L'IA écrit...",
        send: "Envoyer",
        studysheet: "Feuille d'étude",
        studysheetgenerated: "Voici votre feuille d'étude",
        clickToView: "Cliquez pour voir",
        filesReceived: "Fichiers reçus, quelle est la suite?",
        fileReceived: "Fichier reçu, quelle est la suite?",
        continuelearning: "Continuer l'apprentissage",
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
        description: "Ceci est une application React bilingue avec support i18next.",
        changeLanguage: "Changer de langue"
      },

      // File Actions
      file: {
        summary: "Résumé",
        quiz: "🧠 Quiz",
        scenario: "Scénario",
        summarize: "Résumer le fichier",
        generateQuiz: "Générer un quiz",
        createScenario: "Créer un scénario"
      },

      // Forms
      form: {
        name: "Nom",
        email: "Courriel",
        password: "Mot de passe",
        login: "Connexion",
        register: "S'inscrire"
      },

      // Loading States
      loading: {
        justAmoment: "Un instant...",
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
        generatingQuiz: "Génération du quiz",
        savingFile: "Sauvegarde de votre fichier",
        analyzingContent: "Analyse du contenu de votre fichier",
        writingSummary: "Rédaction d'un résumé",
        creatingSituation: "Préparation d'un scénario pour vous",
        readingDocuments: "Lecture de vos documents...",
        quiz: "Création de votre quiz",
        summary: "Résumé de votre fichier"
      },

      // Login
      login: {
        title: "Connexion à NurseQuiz",
        email: "Courriel",
        emailPlaceHolder: "Entrez votre courriel",
        password: "Mot de passe",
        passwordPlaceHolder: "Entrez votre mot de passe",
        loading: "Connexion en cours...",
        login: "Se connecter",
        google: "Continuer avec Google",
        apple: "Continuer avec Apple",
        noAccount: "Vous n'avez pas de compte?",
        signup: "S'inscrire",
        forgotPassword: "Mot de passe oublié"
      },

      // Messages & Notifications
      message: {
        success: "Opération réussie!",
        error: "Une erreur s'est produite. Veuillez réessayer.",
        confirm: "Êtes-vous sûr?",
        summary: "résumé",
        goodanswer: "Bonne réponse",
        badanswer: "Mauvaise réponse",
        explanation: "Explication",
        fileReceived: "J'ai reçu le fichier \"{{fileName}}\". Que voulez-vous en faire?",
        fileUploading: "Téléversement du fichier: {{fileName}}...",
        fileUploaded: "Fichier téléversé: {{fileName}}",
        summaryGenerated: "Nous avons résumé {{fileName}}, ce qui aurait pris environ {{readingTime}} min à lire.\\nVous avez économisé **{{savedTime}} min**. ⏱️",
        summarydone: "J'ai résumé {{filename}} qui vous aurait pris {{readingTime}} min à lire.\\n Vous avez économisé {{savedTime}} min",
        quizReady: "Voici votre quiz",
        scenarioReady: "Voici votre scénario",
        generatingQuiz: "Génération du quiz"
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
        studytitle: "Révisons ensemble!",
        studymessage: "Prenez le temps de réviser le matériel!",
        practicetitle: "Continue!",
        practicemessage: "Concentre-toi sur les explications ci-dessus!",
        reviewtitle: "Temps de révision!",
        reviewmessage: "Un peu plus de pratique t'aidera!",
        moderatetitle: "Continue!",
        25: "✨ Tu t'en sors très bien!",
        50: "💪 À mi-chemin! Ne lâche rien!",
        75: "🔥 Termine en force! Tu peux le faire!",
        90: "🏁 Presque fini! Continue jusqu'au bout!",
        100: "🎉 Terminé! Excellent travail!"
      },

      // Quiz Sticky Progress Bar
      quizbarsticky: {
        answered: "questions répondues",
        streak3msg: "🔥 En feu! 3 d'affilée!",
        streak5msg: "🔥🔥 Incroyable! Série de 5!",
        streak10msg: "🔥🔥🔥 LÉGENDAIRE! Série de 10!",
        streak3txt: "EN FEU",
        streak5txt: "INCROYABLE",
        streak10txt: "LÉGENDAIRE"
      },

      // Sidebar
      side: {
        chats: "Discussions",
        newChat: "Nouveau chat",
        usage: "Analytiques",
        logout: "Déconnexion"
      },

      // Sign Up
      signup: {
        title: "Créez un compte",
        passwordConfirm: "Confirmez votre mot de passe",
        signup: "Créer mon compte",
        signupGoogle: "Utiliser mon compte Google",
        haveAccount: "Déjà inscrit?",
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
        uploading: "Entrain d'envoyer:"
      },

      // Quiz Navigation
      quizNavigation: {
        title: "Navigation du Quiz",
        current: "Actuelle",
        correct: "Correcte",
        incorrect: "Incorrecte",
        skipped: "Passée",
        unanswered: "Non répondue",
        questionPrefix: "Q"
      },

      // Quiz Feedback
      quizFeedback: {
        title: "Commentaire rapide",
        leaveFeedback: "Laisser un commentaire",
        submitted: "Commentaire envoyé!",
        question: "Comment se passe ton quiz?",
        whatWrong: "Oh non! Qu'est-ce qui ne va pas?",
        whatLike: "Qu'est-ce que tu aimes le plus?",
        thanks: "Merci pour ton aide!",
        ratingBad: "Mauvais",
        ratingOkay: "Correct",
        ratingGood: "Bon",
        tooHard: "Trop difficile",
        confusing: "Confus",
        bugs: "Bogues",
        content: "Contenu",
        design: "Design",
        learning: "Apprentissage"
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