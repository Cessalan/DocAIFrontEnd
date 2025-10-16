// 1. Create src/i18n/i18n.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Translation files
const resources = {
  en: {
    translation: {
      // Navigation
      "nav.home": "Home",
      "nav.about": "About",
      "nav.contact": "Contact",
      "nav.services": "Services",
      
      // Common
      "common.loading": "Loading...",
      "common.save": "Save",
      "common.cancel": "Cancel",
      "common.submit": "Submit",
      "common.search": "Search",
      "common.welcome": "Welcome",
      
      // Messages
      "message.success": "Operation successful!",
      "message.error": "Something went wrong",
      "message.confirm": "Are you sure?",
      
      // Forms
      "form.name": "Name",
      "form.email": "Email",
      "form.password": "Password",
      "form.login": "Login",
      "form.register": "Register",
      
      // Content
      "content.title": "Welcome to Our App",
      "content.description": "This is a bilingual React application with i18next support.",
      "content.changeLanguage": "Change Language",
      
      // Chat Interface
      "chat.title": "NurseQuiz",
      "chat.uploadFile": "Start by uploading your course content📄",
      "chat.uploadDocument": "Upload",
      "chat.message.placeholder": "Message...",
      "chat.addFile": "Add a file",
      "chat.filesInMemory": "Files in memory",
      "chat.files": "Notes",
      "chat.noFiles": "No files uploaded",
      "chat.aiTyping": "AI is typing...",
      "chat.send":"Send", 
      "chat.studysheet":"Study Sheet",
      "chat.studysheetgenerated":"Here is your study sheet",
      'chat.clickToView':"Click to view",

      //sidebar
      "side.chats":"Chats",
      "side.newChat":"New chat", 
      "side.usage":"Usage",
      "side.logout":"Logout",
      
      // File actions
      "file.summary": "Summary",
      "file.quiz": "🧠 Quiz", 
      "file.scenario": "Scenario",
      "file.summarize": "Summarize file",
      "file.generateQuiz": "Generate quiz",
      "file.createScenario": "Create scenario",
      
      // Loading messages
      "loading.generatingQuiz": "Generating quiz",
      "loading.savingFile": "Saving your file",
      "loading.analyzingContent": "Analyzing your file content",
      "loading.writingSummary": "Writing you a summary", 
      "loading.creatingSituation": "Cooking up a scenario for you",
      "loading.readingDocuments": "Reading your documents...",
      
      // Messages
      "message.fileReceived": "I received the file \"{{fileName}}\". What do you want to do with it?",
      "message.fileUploading": "Uploading file: {{fileName}}...",
      "message.fileUploaded": "File uploaded: {{fileName}}",
      "message.summaryGenerated": "We summarized {{fileName}}, which would have taken about {{readingTime}} min to read.\\nYou saved **{{savedTime}} min**. ⏱️",
      "message.quizReady": "Here is your quiz",
      "message.scenarioReady": "Here is your scenario",
      "message.error": "An error occurred. Please try again.",
      "message.summary":"summary",
      "message.goodanswer":"Right Answer",
      "message.badanswer": "Wrong answer",
      "message.explanation":"Explanation",
      "message":
       {
          "summarydone":"I summarized {{filename}} that would have taken you {{readingTime}} min to read.\n  You saved {{savedTime}} min"
       },
        "message.generatingQuiz":"Generating the quiz",

      "upload.started":"File upload has started",
      "upload.failed":"File upload failed",
      "upload.uploaded":"File uploaded",
      "upload.received":"I received your file",
      "upload.question":"What do you want to do?",

      "loading":{
        "quiz":"Creating your quiz",
        "summary":"Summarizing your file"
      },

      // Login
      "login.title":"Login to NurseQuiz",
      "login.email":"Email",
      "login.emailPlaceHolder":"Enter your email",
      "login.password":"Password",
      "login.passwordPlaceHolder":"Enter your password",
      "login.loading":"Logging in...",
      "login.login":"Login",
      "login.google":"Continue with Google",
      "login.apple":"Continue with Apple",
      "login.noAccount":"Don't have an account?",
      "login.signup":"Sign Up",
      "login.forgotPassword":"Forgot password",
      "signup.title":"Create an account",
      "signup.signup":"Sign up",
      "signup.signupGoogle":"Continue with Google",
      "signup.haveAccount":"You already have an account?",
      "signup.login":"Log in",
    }
  },
  fr: {
    translation: {
      // Navigation
      "nav.home": "Accueil",
      "nav.about": "À propos",
      "nav.contact": "Contact",
      "nav.services": "Services",
      
      // Common
      "common.loading": "Chargement...",
      "common.save": "Enregistrer",
      "common.cancel": "Annuler",
      "common.submit": "Soumettre",
      "common.search": "Rechercher",
      "common.welcome": "Bienvenue",
      
      // Messages
      "message.success": "Opération réussie !",
      "message.error": "Quelque chose s'est mal passé",
      "message.confirm": "Êtes-vous sûr ?",
      "message.summary":"Résumé",
      "message.goodanswer":"Bonne réponse",
      "message.badanswer": "Mauvaise réponse",
      "message.explanation":"Explication",
      "message.summarydone":"J'ai résumé {{filename}} qui t'aurait pris environ {{readingTime}} min à lire.\n Tu as avez sauvé {{savedTime}} min",
      
      // Forms
      "form.name": "Nom",
      "form.email": "Email",
      "form.password": "Mot de passe",
      "form.login": "Connexion",
      "form.register": "S'inscrire",
      
      // Content
      "content.title": "Bienvenue dans notre application",
      "content.description": "Il s'agit d'une application React bilingue avec support i18next.",
      "content.changeLanguage": "Changer de langue",
      
      // Chat Interface
      "chat.title": "NurseQuiz",
      "chat.uploadFile": "Commencez par téléverser le cotenu de votre cours 📄",
      "chat.uploadDocument": "Téléverser",
      "chat.message.placeholder": "Message...",
      "chat.addFile": "Ajouter un fichier",
      "chat.filesInMemory": "Fichiers en mémoire", 
      "chat.files": "Notes de cours",
      "chat.noFiles": "Aucun fichier téléversé",
      "chat.aiTyping": "L'IA tape...",
      "chat.send":"Envoyer", 
      "chat.studysheet":"Fiche d'étude",
      "chat.studysheetgenerated":"Voici ta fiche d'étude",
      'chat.clickToView':"Cliques pour voir",
      
      // Side bar
      //sidebar
      "side.newChat":"nouveau chat",
      "side.usage":"Analytiques",
      "side.logout":"Déconnexion",


      // File actions
      "file.summary": " Résumé",
      "file.quiz": " Quiz",
      "file.scenario": "Mise en situation", 
      "file.summarize": "Résumer le fichier",
      "file.generateQuiz": "Générer un quiz",
      "file.createScenario": "Créer une mise en situation",
      
      // Loading messages
      "loading.generatingQuiz": "Entrain de générer un quiz",
      "loading.savingFile": "Entrain d'enregistrer ton fichier", 
      "loading.analyzingContent": "Entrain d'analyser le contenu de ton fichier",
      "loading.writingSummary": "Entrain de t'écrire un résumé",
      "loading.creatingSituation": "Entrain de te concocter une mise en situation",
      "loading.readingDocuments": "Entrain de lire tes documents...",
      
      // Messages
      "message.fileReceived": "J'ai bien reçu le fichier \"{{fileName}}\". Que veux-tu faire avec?",
      "message.fileUploading": "Envoi du fichier: {{fileName}}...",
      "message.fileUploaded": "Fichier téléversé: {{fileName}}",
      "message.summaryGenerated": "Nous avons résumé {{fileName}}, qui aurait pris environ {{readingTime}} min à lire.\\nVous avez sauvé **{{savedTime}} min**. ⏱️",
      "message.quizReady": "Voici votre quiz",
      "message.scenarioReady": "Voici votre mise en situation", 
      "message.error": "Une erreur est survenue. Veuillez réessayer.",
      "message.generatingQuiz":"Entrain de générer le quiz",

      // upload
      "upload.started":"Envoi du fichier",
      "upload.failed":"Erreur durant le téléversement du fichier",
      "upload.uploaded":"Fichier envoyé",
      "upload.received":"J'ai reçu ton fichier",
      "upload.question":"",

      // Login
      "login.title":"Se connecter à NurseQuiz",
      "login.email":"Email",
      "login.emailPlaceHolder":"Entrez votre email",
      "login.password":"Mot de passe",
      "login.passwordPlaceHolder":"Entrez votre mot de passe",
      "login.loading":"Connexion en cours...",
      "login.login":"Se connecter",
      "login.google":"Continuer avec Google",
      "login.noAccount":"Pas de compte?",
      "login.signup":"Créer un compte",
      "login.forgotPassword":"Mot de passe oublié?",
      "login.apple":"Continuer avec Apple",

      "signup.title":"Créez un compte",
      "signup.passwordConfirm":"Confirmez votre mot de passe",
      "signup.signup":"Créer mon compte",
      "signup.signupGoogle":"Utiliser mon compte google",
      "signup.haveAccount":"Déjà inscris?",
      "signup.login":"Se connecter"
      
    }
  }
};

i18n
  // Detect user language
  .use(LanguageDetector)
  // Pass the i18n instance to react-i18next
  .use(initReactI18next)
  // Initialize i18next
  .init({
    resources, 
    // Language to use if no language is detected
    fallbackLng: 'en',
    
    load: 'languageOnly', 

    // Debug mode (set to false in production)
    debug: process.env.NODE_ENV === 'development',
    
    // Options for language detector
    detection: {
      // Order of language detection
      order: ['localStorage', 'navigator', 'htmlTag'],
      
      // Cache user language
      caches: ['localStorage'],
      
      // Keys to lookup language from
      lookupLocalStorage: 'i18nextLng',
    },
    
    interpolation: {
      // React already escapes values to prevent XSS
      escapeValue: false,
    },
    
    // Namespace settings
    ns: ['translation'],
    defaultNS: 'translation',
  });

export default i18n;