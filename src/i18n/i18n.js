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
        reviewQuiz: "Review quiz",
        reviewmessage: "A bit more practice will help!",
        moderatetitle: "Keep going!",
        25: "✨ You're doing great!",
        50: "💪 Halfway there! Keep it up!",
        75: "🔥 Finish strong! You can do it!",
        90: "🏁 Almost done! Keep going!",
        100: "🎉 Complete! Excellent work!",
        question: "Question",
        of: "of",
        review: "Review",
        correct: "correct",
        correctAnswer: "Correct answer:",
        yourAnswer: "Your answer:",
        answerReview: "Answer Review",
        thatsRight: "That's right!",
        notQuite: "Not quite",
        skipQuestion: "Skip Question",
        nextQuestion: "Next Question",
        viewResults: "View Results"
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
        expandSidebar: "Expand sidebar",
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
      },

      // Quiz Results Analytics
      quizAnalytics: {
        perfect: "Perfect Score!",
        perfectMsg: "Flawless! Ready for a bigger challenge?",
        outstanding: "Outstanding!",
        outstandingMsg: "You're mastering this material!",
        excellent: "Excellent!",
        excellentMsg: "Great work, keep it up!",
        wellDone: "Well done!",
        wellDoneMsg: "You're making good progress!",
        keepGoing: "Keep going!",
        keepGoingMsg: "You're getting there!",
        reviewTime: "Review time!",
        reviewTimeMsg: "A bit more practice will help!",
        letsReview: "Let's review!",
        letsReviewMsg: "Take time to review the material!",
        correct: "Correct",
        incorrect: "Incorrect",
        bestStreak: "Best Streak",
        topics: "Topics",
        performanceByTopic: "Performance by Topic",
        insights: "Insights",
        strongAreas: "Strong Areas",
        needsImprovement: "Needs Improvement",
        practiceWeakTopics: "Practice Weak Topics",
        challengeMore: "Challenge Me More",
        tryAgain: "Try Again",
        reviewQuiz: "Review Quiz",
        of: "of",
        aiAdapts: "AI adapts to your needs and creates personalized quizzes",
        generalTopic: "General",
        practiceWeakPrompt: "Create a 5-question practice quiz on my weak areas: {{topics}}",
        challengePrompt: "Create a 5-question quiz with harder questions to challenge me more"
      },

      // Flashcard Interface
      flashcard: {
        title: "Flashcards",
        loading: "Loading flashcard...",
        question: "Question",
        answer: "Answer",
        tapToFlip: "Tap to flip",
        tapToFlipBack: "Tap to flip back",
        hint: "Hint",
        howWellKnow: "How well did you know this?",
        again: "Again",
        knowIt: "Know it",
        greatKeepUp: "Great! Keep it up!",
        noWorriesNextTime: "No worries, you'll get it next time!",
        skipForNow: "Skip for now",
        nextCard: "Next Card",
        viewResults: "View Results",
        mastered: "mastered",
        generatingFlashcards: "Generating flashcards...",
        expandToFullscreen: "Expand to fullscreen",
        closeFullscreen: "Close fullscreen"
      },

      // Flashcard Navigation
      flashcardNavigation: {
        cards: "Cards",
        status: "Status:",
        new: "New",
        learning: "Learning",
        mastered: "Mastered"
      },

      // Flashcard Feedback
      flashcardFeedback: {
        title: "Quick Feedback",
        leaveFeedback: "Leave Feedback",
        submitted: "Feedback sent!",
        question: "How is your flashcard experience?",
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
      },

      // Onboarding
      onboarding: {
        intro: "To better understand your needs, please answer these quick questions ✨",
        step1Title: "What is your main goal today?",
        step2Title: "How do you use the questions?",
        loading: "Setting up your profile...",
        options: {
          nclex: "NCLEX Prep 🏥",
          courseExam: "Course Exam 📚",
          generalReview: "General Review 💡",
          flashcards: "Export to Flashcards (Anki/Quizlet) 🗂️",
          trackProgress: "Track Progress Here 📈",
          manual: "Print / Manual Copy 📝"
        },
        tracker: "Question {{current}} of {{total}}",
        processing: {
          analyzing: "Analyzing your preferences...",
          personalizing: "Personalizing your experience..."
        },
        success: {
          title: "All set! 🚀",
          message: "Thanks for setting up your profile. You're ready to start learning!",
          button: "Start Learning"
        }
      },

      // Feedback
      feedback: {
        buttonText: "Share Feedback",
        modalTitle: "We'd love to hear from you!",
        typeLabel: "What's this about?",
        typeGeneral: "General",
        typeBug: "Bug Report",
        typeFeature: "Feature Request",
        typeOther: "Other",
        messageLabel: "Your message",
        placeholder: "Share your thoughts, suggestions, or report an issue...",
        submit: "Send Feedback",
        submitting: "Sending...",
        submitError: "Failed to submit feedback. Please try again.",
        successTitle: "Thank you!",
        successMessage: "Your feedback helps us improve. We appreciate you taking the time!"
      },

      // SATA (Select All That Apply) Questions
      sata: {
        instructions: "Select all that apply",
        submitAnswer: "Submit Answer",
        selectAtLeast: "Select at least one option",
        selected: "selected",
        correctlySelected: "Correctly selected",
        incorrectlySelected: "Incorrectly selected",
        shouldHaveSelected: "Should have selected",
        partialCredit: "Partial Credit",
        score: "Score",
        outOf: "out of",
        perfect: "Perfect!",
        // Feedback messages based on score percentage
        feedback100: "Excellent! You identified all correct options!",
        feedback80: "Great job! You got most of them right.",
        feedback60: "Good effort! Review the missed options.",
        feedback40: "Keep practicing! Focus on the rationale.",
        feedback0: "Review the material and try again."
      },

      // Quiz Sharing
      quizShare: {
        buttonText: "Share Quiz",
        creatingLink: "Creating link...",
        modalTitle: "Share Quiz",
        challengeMessage: "Challenge Message",
        messagePlaceholder: "Add a personal message...",
        copyMessage: "Copy Message",
        copyLink: "Copy Link",
        copied: "Copied!",
        shareVia: "Share via",
        socialTwitter: "Twitter",
        socialFacebook: "Facebook",
        socialWhatsApp: "WhatsApp",
        socialEmail: "Email",
        socialInstagram: "Instagram",
        socialTikTok: "TikTok",
        instagramMessage: "Link copied to clipboard! Instagram app will open. Paste the link in your story or post.\n\nClick OK to continue to Instagram, or Cancel to stay here.",
        tiktokMessage: "Link copied to clipboard! TikTok app will open. Paste the link in your video description.\n\nClick OK to continue to TikTok, or Cancel to stay here.",
        viralMessage90: "🏆 I just scored {{percentage}}% on this {{topic}}! Think you can beat my score? 💪",
        viralMessage80: "🌟 I got {{percentage}}% on this {{topic}}! Can you do better? Try it out! 🎯",
        viralMessage70: "📚 I scored {{percentage}}% on this {{topic}}. Challenge yourself and see how you do! 🚀",
        viralMessageDefault: "💪 I'm practicing {{topic}} and got {{percentage}}%. Join me and let's improve together! 📖",
        viralMessageTopics: "Check out this quiz on {{topic}}! It covers {{count}} topic including {{topicList}}. Can you beat it?",
        viralMessageTopics_plural: "Check out this quiz on {{topic}}! It covers {{count}} topics including {{topicList}}. Can you beat it?",
        viralMessageNoTopics: "I found this amazing {{topic}} quiz with {{totalQuestions}} questions! Think you can ace it?",
        defaultQuizName: "Nursing Quiz",
        defaultMessage: "Check out this nursing quiz!"
      }
    }
  },

  fr: {
    translation: {
      // Chat Interface
      chat: {
        title: "NurseQuiz",
        uploadFile: "Commences par téléverser le contenu de ton cours📄",
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
        reviewQuiz: "Revoir le quiz",
        reviewmessage: "Un peu plus de pratique t'aidera!",
        moderatetitle: "Continue!",
        25: "✨ Tu t'en sors très bien!",
        50: "💪 À mi-chemin! Ne lâche rien!",
        75: "🔥 Termine en force! Tu peux le faire!",
        90: "🏁 Presque fini! Continue!",
        100: "🎉 Terminé! Excellent travail!",
        question: "Question",
        of: "sur",
        review: "Révision",
        correct: "correct",
        correctAnswer: "Bonne réponse:",
        yourAnswer: "Votre réponse:",
        answerReview: "Révision des réponses",
        thatsRight: "Bonne réponse!",
        notQuite: "Pas tout à fait",
        skipQuestion: "Passer la question",
        nextQuestion: "Question suivante",
        viewResults: "Voir les résultats"
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
        expandSidebar: "Ouvrir le menu",
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
      },

      // Quiz Results Analytics
      quizAnalytics: {
        perfect: "Score parfait!",
        perfectMsg: "Impeccable! Prêt pour un plus grand défi?",
        outstanding: "Exceptionnel!",
        outstandingMsg: "Tu maîtrises cette matière!",
        excellent: "Excellent!",
        excellentMsg: "Continue comme ça!",
        wellDone: "Bien joué!",
        wellDoneMsg: "Tu progresses bien!",
        keepGoing: "Continue!",
        keepGoingMsg: "Tu y arrives!",
        reviewTime: "À réviser!",
        reviewTimeMsg: "Un peu plus de pratique t'aidera!",
        letsReview: "À réviser!",
        letsReviewMsg: "Prends le temps de revoir la matière!",
        correct: "Correct",
        incorrect: "Incorrect",
        bestStreak: "Meilleure série",
        topics: "Sujets",
        performanceByTopic: "Performance par sujet",
        insights: "Analyse",
        strongAreas: "Points forts",
        needsImprovement: "À améliorer",
        practiceWeakTopics: "Pratiquer les points faibles",
        challengeMore: "Me challenger davantage",
        tryAgain: "Recommencer",
        reviewQuiz: "Revoir le quiz",
        of: "sur",
        aiAdapts: "L'IA s'adapte à tes besoins et crée des quiz personnalisés",
        generalTopic: "Général",
        practiceWeakPrompt: "Crée un quiz de pratique de 5 questions sur mes points faibles : {{topics}}",
        challengePrompt: "Crée un quiz de 5 questions plus difficiles pour me challenger davantage"
      },

      // Flashcard Interface
      flashcard: {
        title: "Cartes mémoire",
        loading: "Chargement de la carte mémoire...",
        question: "Question",
        answer: "Réponse",
        tapToFlip: "Toucher pour retourner",
        tapToFlipBack: "Toucher pour retourner",
        hint: "Indice",
        howWellKnow: "À quel point connaissiez-vous cela?",
        again: "À revoir",
        knowIt: "Je le sais",
        greatKeepUp: "Super! Continue comme ça!",
        noWorriesNextTime: "Pas de souci, tu réussiras la prochaine fois!",
        skipForNow: "Passer pour l'instant",
        nextCard: "Carte suivante",
        viewResults: "Voir les résultats",
        mastered: "maîtrisé",
        generatingFlashcards: "Génération des cartes mémoire...",
        expandToFullscreen: "Agrandir en plein écran",
        closeFullscreen: "Fermer le plein écran"
      },

      // Flashcard Navigation
      flashcardNavigation: {
        cards: "Cartes",
        status: "Statut:",
        new: "Nouveau",
        learning: "En apprentissage",
        mastered: "Maîtrisé"
      },

      // Flashcard Feedback
      flashcardFeedback: {
        title: "Commentaire rapide",
        leaveFeedback: "Laisser un commentaire",
        submitted: "Commentaire envoyé!",
        question: "Comment se passent tes cartes mémoire?",
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
      },

      // Onboarding
      onboarding: {
        intro: "Pour mieux comprendre vos besoins, veuillez répondre à ces questions rapides ✨",
        step1Title: "Quel est votre objectif aujourd'hui?",
        step2Title: "Comment utilisez-vous les questions?",
        loading: "Configuration de votre profil...",
        options: {
          nclex: "Préparation NCLEX 🏥",
          courseExam: "Examen de cours 📚",
          generalReview: "Révision générale 💡",
          flashcards: "Exporter vers Flashcards (Anki/Quizlet) 🗂️",
          trackProgress: "Suivre les progrès ici 📈",
          manual: "Imprimer / Copie manuelle 📝"
        },
        tracker: "Question {{current}} sur {{total}}",
        processing: {
          analyzing: "Analyse de vos préférences...",
          personalizing: "Personnalisation de votre expérience..."
        },
        success: {
          title: "C'est tout bon! 🚀",
          message: "Merci d'avoir configuré votre profil. Vous êtes prêt à apprendre!",
          button: "Commencer l'apprentissage"
        }
      },

      // Feedback
      feedback: {
        buttonText: "Partager un retour",
        modalTitle: "Votre avis nous intéresse!",
        typeLabel: "De quoi s'agit-il?",
        typeGeneral: "Général",
        typeBug: "Signaler un bug",
        typeFeature: "Suggestion",
        typeOther: "Autre",
        messageLabel: "Votre message",
        placeholder: "Partagez vos pensées, suggestions, ou signalez un problème...",
        submit: "Envoyer le retour",
        submitting: "Envoi en cours...",
        submitError: "Échec de l'envoi. Veuillez réessayer.",
        successTitle: "Merci!",
        successMessage: "Votre retour nous aide à améliorer l'application. Nous apprécions votre temps!"
      },

      // SATA (Select All That Apply) Questions
      sata: {
        instructions: "Sélectionnez toutes les réponses applicables",
        submitAnswer: "Soumettre la réponse",
        selectAtLeast: "Sélectionnez au moins une option",
        selected: "sélectionné(s)",
        correctlySelected: "Correctement sélectionné",
        incorrectlySelected: "Sélection incorrecte",
        shouldHaveSelected: "Aurait dû être sélectionné",
        partialCredit: "Crédit partiel",
        score: "Score",
        outOf: "sur",
        perfect: "Parfait!",
        // Messages de rétroaction basés sur le pourcentage
        feedback100: "Excellent! Tu as identifié toutes les bonnes options!",
        feedback80: "Très bien! Tu as eu la plupart des bonnes réponses.",
        feedback60: "Bon effort! Revois les options manquées.",
        feedback40: "Continue à pratiquer! Concentre-toi sur les explications.",
        feedback0: "Revois la matière et réessaie."
      },

      // Quiz Sharing
      quizShare: {
        buttonText: "Partager le quiz",
        creatingLink: "Création du lien...",
        modalTitle: "Partager le quiz",
        challengeMessage: "Message de défi",
        messagePlaceholder: "Ajouter un message personnel...",
        copyMessage: "Copier le message",
        copyLink: "Copier le lien",
        copied: "Copié!",
        shareVia: "Partager via",
        socialTwitter: "Twitter",
        socialFacebook: "Facebook",
        socialWhatsApp: "WhatsApp",
        socialEmail: "Courriel",
        socialInstagram: "Instagram",
        socialTikTok: "TikTok",
        instagramMessage: "Lien copié dans le presse-papiers! L'application Instagram va s'ouvrir. Colle le lien dans ta story ou publication.\n\nClique OK pour continuer vers Instagram, ou Annuler pour rester ici.",
        tiktokMessage: "Lien copié dans le presse-papiers! L'application TikTok va s'ouvrir. Colle le lien dans la description de ta vidéo.\n\nClique OK pour continuer vers TikTok, ou Annuler pour rester ici.",
        viralMessage90: "🏆 Je viens de marquer {{percentage}}% sur ce {{topic}}! Penses-tu pouvoir battre mon score? 💪",
        viralMessage80: "🌟 J'ai obtenu {{percentage}}% sur ce {{topic}}! Peux-tu faire mieux? Essaie-le! 🎯",
        viralMessage70: "📚 J'ai marqué {{percentage}}% sur ce {{topic}}. Lance-toi le défi et vois comment tu t'en sors! 🚀",
        viralMessageDefault: "💪 Je pratique {{topic}} et j'ai obtenu {{percentage}}%. Rejoins-moi et améliorons-nous ensemble! 📖",
        viralMessageTopics: "Découvre ce quiz sur {{topic}}! Il couvre {{count}} sujet incluant {{topicList}}. Peux-tu le réussir?",
        viralMessageTopics_plural: "Découvre ce quiz sur {{topic}}! Il couvre {{count}} sujets incluant {{topicList}}. Peux-tu le réussir?",
        viralMessageNoTopics: "J'ai trouvé cet incroyable quiz {{topic}} avec {{totalQuestions}} questions! Penses-tu pouvoir le réussir?",
        defaultQuizName: "Quiz d'infirmière",
        defaultMessage: "Découvre ce quiz d'infirmière!"
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