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
        uploading: "Uploading",
        prepareExam: "Prepare for Exam",
        examHint: "Track your progress",
        examUploadCta: "Upload your files",
        examUploadHint: "PDFs, images, notes — we'll generate quizzes, sheets, and flashcards.",
        examPrepLead: "Drop your notes and we'll prep your study plan.",
        studyJourney: "Study Journey",
        studyJourneyHint: "Guided lessons, quizzes & flashcards",
        uploadChat: "Upload & Chat",
        uploadChatHint: "Ask questions about your documents",
        recommended: "Recommended"
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
        viewResults: "View Results",
        // Quiz Mode Selector
        modeSelector: {
          title: "Choose Quiz Type",
          context: "Generating questions about: {{topics}}",
          nclex: "NCLEX Practice",
          nclexDesc: "Clinical scenarios testing your judgment",
          knowledge: "Knowledge Test",
          knowledgeDesc: "Direct questions testing factual recall",
          advanced: "Advanced",
          recommended: "Recommended",
          hint: "Not sure? Start with Knowledge Test for basic review, then try NCLEX Practice when ready."
        }
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
        building: "Creating study sheet",
        download: "Download PDF",
        // PDF Header
        pdfTagline: "Your AI-Powered Nursing Study Companion",
        pdfSubtitle: "Comprehensive Study Guide",
        // PDF Footer
        pdfGeneratedBy: "Generated by NurseQuizAI"
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

      // Post-Upload Actions
      postUpload: {
        // Action button labels
        quizLabel: "Quiz me",
        flashcardsLabel: "Create flashcards",
        studysheetLabel: "Study sheet",
        audioLabel: "Audio summary",
        mindmapLabel: "Concept map",
        // Action prompts sent to AI (quiz prompts now handled by mode selector)
        flashcardsPrompt: "Create flashcards for: {{topics}}",
        studysheetPrompt: "Create a study sheet summarizing the uploaded documents",
        mindmapPrompt: "Create a concept map for: {{topics}}",
        // Quiz mode-specific prompts
        knowledgeQuizPrompt: "Generate a knowledge test quiz about {{topics}}. Use direct factual questions, not clinical scenarios.",
        nclexQuizPrompt: "Generate an NCLEX-style quiz about {{topics}}. Use clinical scenarios testing judgment."
      },

      // Mindmap Modal
      mindmap: {
        downloadPdf: "PDF",
        details: "Details",
        compact: "Compact",
        radial: "Radial",
        tree: "Tree",
        switchToRadial: "Switch to Radial Layout",
        switchToTree: "Switch to Tree Layout",
        close: "Close",
        footerTree: "Tree layout.",
        footerRadial: "Radial layout.",
        detailsShown: "Details shown on nodes.",
        clickForDetails: "Click a node to see details.",
        dragToRearrange: "Drag to rearrange. Scroll to zoom.",
        // Loading states
        analyzingDocument: "Analyzing document structure...",
        extractingConcepts: "Extracting concepts and relationships...",
        errorGenerating: "Could not generate mindmap. Please try again."
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
        showHint: "Show hint",
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

      // Flashcard Results
      flashcardResults: {
        // Mastery tiers
        outstandingTitle: "Outstanding Mastery!",
        outstandingMessage: "You've mastered almost all the content!",
        excellentTitle: "Excellent Progress!",
        excellentMessage: "Great work, keep it up!",
        goodTitle: "Good Progress!",
        goodMessage: "You're learning well!",
        moderateTitle: "Keep Going!",
        moderateMessage: "Keep reviewing!",
        studyTitle: "Strong Start!",
        studyMessage: "Keep reviewing these cards!",
        // Stats labels
        masteredLabel: "Mastered",
        learningLabel: "Learning",
        newLabel: "New",
        // Topic section
        performanceByTopic: "Performance by Topic",
        // Action buttons
        reviewCards: "Review Cards",
        continueLearning: "Continue Learning",
        // Motivational messages
        tipReviewRegularly: "Tip: Review regularly to improve retention!",
        almostThere: "Almost there! Keep reviewing the challenging cards.",
        amazingMastery: "Amazing! You've mastered this content!"
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

      // Progress Dashboard & Widget
      progress: {
        topicPerformance: "Topic Performance",
        overallAccuracy: "overall accuracy",
        level: "Level",
        dayStreak: "day streak",
        daysStreak: "days streak",
        questionsAnswered: "questions answered",
        dailySerum: "Daily Serum",
        moreToGo: "more to go",
        delivered: "Delivered!",
        xp: "XP",
        lvl: "Lvl",
        day: "day",
        days: "days",
        // Motivational messages
        crushingIt: "You're crushing it!",
        greatProgress: "Great progress! Keep going!",
        improving: "You're improving!",
        everyQuestion: "Every question makes you stronger!",
        startJourney: "Start your learning journey!",
        // Empty state
        emptyTitle: "Complete quizzes to track your topic performance!",
        emptyHint: "Your progress will appear here"
      },

      // Landing Page
      landing: {
        uploadNotesTitle: "Upload your study material",
        uploadNotes: "Upload Your Notes",
        // Hero transformation
        dropNotes: "Drop your lecture slides here",
        fileFormats: "PDF, PPT, Word, Images • Up to 15MB",
        featureQuiz: "Quizzes",
        featureFlashcards: "Flashcards",
        featureMindMap: "Concept Maps",
        featureAudio: "Audio",
        featureStudySheet: "Study Sheet",
        // Hero section
        sloganLine1: "Too much to study. Not enough time.",
        sloganLine2Prefix: "We fix that — by turning your notes into ",
        sloganLine2Suffix: ".",
        typewriter: {
          quiz: "quizzes",
          flashcards: "flashcards",
          mindmaps: "concept maps",
          audio: "audio",
          studysheet: "study sheets",
          success: "success 🏆"
        },
        subtitle: "Spend less time studying, more time understanding.",
        // Auth buttons
        login: "Log in",
        signup: "Sign up",
        logout: "Log out",
        // Social proof badges
        badge1: "Made with nurses",
        badge2: "Trusted across North America",
        // Footer
        footerText: "Built for Nursing exams and NCLEX",
        // Product showcase section
        showcaseTitle: "See How It Works",
        showcaseSubtitle: "From notes to knowledge in minutes",
        demoLabel: "Live Demo",
        demoUpload: "Pharmacology_Notes.pdf",
        demoGenerating: "AI generating NCLEX-style quiz...",
        demoQuestion: "Which medication class is primarily used to treat hypertension?",
        demoAnswer1: "A. Antihistamines",
        demoAnswer2: "B. ACE Inhibitors",
        demoAnswer3: "C. Antibiotics",
        demoAnswer4: "D. Antidepressants",
        demoCorrect: "Correct!",
        demoScore: "Your Score",
        phase1: "1. Upload",
        phase2: "2. Generate",
        phase3: "3. Quiz",
        phase4: "4. Learn",
        showcaseCta: "Start Learning Now",
        showcaseCtaSubtext: "Free to try • No credit card required",
        // Science section
        scienceTitle: "Backed by Science",
        scienceSubtitle: "Research-proven methods for better learning outcomes",
        stat1Title: "Score 73% Higher",
        stat1Desc: "Students using AI-powered interactive quizzes score 73% higher on exams than those using traditional study methods",
        stat1Source: "Educational Technology Research, 2024",
        stat2Title: "Remember 85% More",
        stat2Desc: "Students using active learning methods show 85% better retention compared to passive study methods",
        stat2Source: "Journal of Educational Psychology, 2023",
        stat3Title: "Save 30% Study Time",
        stat3Desc: "AI-generated study materials reduce preparation time by 30% while maintaining learning effectiveness",
        stat3Source: "Learning Technology Review, 2024",
        scienceCta: "Join the Community",
        // Login prompt modal
        loginPromptTitle: "Almost there!",
        loginPromptMessage: "Sign in to save your progress and track your learning journey.",
        fileReady: "Ready to upload",
        filesReady: "{{count}} files ready",
        fileWillBeUploaded: "Your file will be uploaded automatically after you sign in.",
        loginToUpload: "Sign in to upload your notes and start learning!",
        signupToUpload: "Create an account to upload your notes!",
        // Benefits in login prompt
        benefit1: "Save your quiz progress",
        benefit2: "Track your learning stats",
        benefit3: "Access your uploaded notes anytime",
        createAccount: "Create Free Account",
        haveAccount: "I already have an account",
        // Google sign-in in modal
        continueWithGoogle: "Continue with Google",
        signingIn: "Signing in...",
        or: "or",
        // Upload process
        generatingQuestions: "Generating NCLEX-style questions...",
        analyzingNotes: "Analyzing your notes",
        uploadError: "Failed to process your file. Please try again.",
        // File size error modal
        fileTooLargeTitle: "File too large",
        fileTooLargeMessage: "The maximum file size is {{maxSize}}MB per file.",
        fileTooLargeTips: "Try these options:",
        fileTooLargeTip1: "Compress your PDF using an online tool",
        fileTooLargeTip2: "Split large documents into smaller parts",
        fileTooLargeTip3: "Use lower resolution images"
      },

      // Common
      common: {
        close: "Close",
        understood: "Got it"
      },

      // Dashboard
      dashboard: {
        upcomingExams: {
          title: "Upcoming Exams"
        },
        examsList: {
          add: "Add"
        },
        exam: {
          study: "Study",
          today: "Today!",
          tomorrow: "Tomorrow",
          inDays: "in {{days}} days"
        },
        readiness: {
          short: "{{percent}}% ready",
          notStartedShort: "Not started"
        },
        noExam: {
          title: "No upcoming exams",
          description: "Add an exam to track your preparation progress",
          addButton: "Add an exam"
        },
        streak: {
          start: "Start your streak today!",
          first: "Great start!",
          building: "Keep it up!",
          strong: "You're on fire!",
          legend: "Legendary!",
          day: "day streak",
          days: "day streak"
        },
        daily: {
          label: "daily goal",
          complete: "Complete!"
        },
        level: {
          value: "Level {{level}}"
        },
        quickActions: {
          label: "Quick:",
          upload: "Upload",
          chat: "Chat",
          quiz: "Quiz",
          newChat: "Start a new chat"
        }
      },

      // Countdown
      countdown: {
        days: "{{days}}d",
        past: "{{days}}d ago",
        now: "Now!",
        today: "Today"
      },

      // Audio Generation
      audio: {
        readyToGenerate: "Audio Ready",
        topic: "Topic",
        duration: "Duration",
        minute: "min",
        minutes: "min",
        generate: "Generate Audio",
        generating: "Generating...",
        download: "Download",
        speed: "Speed",
        showTranscript: "Show transcript",
        hideTranscript: "Hide transcript",
        // Intent style names
        fullLesson: "Full Lesson",
        quickSummary: "Quick Summary",
        deepDive: "Deep Dive",
        simpleExplanation: "Simple Explanation",
        progressReport: "Progress Report",
        // Intent style descriptions
        fullLessonDesc: "Structured lesson with examples and clinical context",
        quickSummaryDesc: "Key points only, concise overview",
        deepDiveDesc: "Comprehensive, detailed exploration",
        simpleExplanationDesc: "Beginner-friendly, uses analogies",
        progressReportDesc: "Your stats, achievements, and recommendations",
        // Status messages
        creatingScript: "Creating script...",
        scriptReady: "Script ready, converting to speech...",
        generatingAudio: "Generating audio...",
        audioReady: "Audio ready!",
        audioError: "Failed to generate audio"
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
      },

      // Study Mode
      study: {
        // StartStudyModal
        startJourney: "Start Study Journey",
        preparingJourney: "Preparing Your Journey",
        analyzingDocs: "Analyzing your documents...",
        creatingPath: "Creating your personalized study path...",
        savingProgress: "Setting up your journey...",
        ready: "Ready to learn!",
        errorGenerating: "Failed to create study path. Please try again.",
        document: "document",
        documents: "documents",
        topicsLabel: "Your lessons will cover:",
        more: "more",
        journeyDescription: "I'll create a personalized study path based on your documents, with lessons, flashcards, quizzes, and audio to help you learn effectively.",
        featureLessons: "Bite-sized lessons",
        featureFlashcards: "Flashcards",
        featureQuizzes: "Quiz questions",
        featureAudio: "Audio lessons",
        generating: "Creating...",
        beginJourney: "Begin Journey",

        // StudyPlanOverview
        yourStudyPlan: "Your Study Plan",
        comingSoon: "Coming soon!",
        start: "START",

        // Node types
        nodeType: {
          lesson: "Lesson",
          quiz: "Quiz",
          flashcard: "Flashcard",
          audio: "Audio",
          mindmap: "Mind Map",
          review: "Review"
        },

        // StudyModeContainer & loading states
        preparing: "Preparing your {{type}}...",
        startingSession: "Starting your study session...",
        exitStudyMode: "Exit Study Mode",

        // StudyLessonCard
        lessonTitle: "Lesson",
        keyPoints: "Key Points",
        loadingLesson: "Loading lesson content...",

        // StudyQuizCard
        quickCheck: "Quick Check",
        correct: "Correct!",
        incorrect: "Incorrect",
        correctAnswer: "Correct Answer:",
        learnMore: "Learn more",
        showLess: "Show less",
        continue: "CONTINUE",
        gotIt: "GOT IT",
        reviewing: "Reviewing {{count}} question",
        reviewing_plural: "Reviewing {{count}} questions",
        excellentWork: "Excellent work! You got them all right.",
        correctCount: "{{count}} correct",

        // StudyFlashcardCard
        flashcardsTitle: "Flashcards",
        tapToFlip: "Tap to flip",
        tapToFlipBack: "Tap to flip back",
        gotItBtn: "Got it!",
        needReview: "Need review",
        nextCard: "Next Card",
        reviewingCards: "Reviewing {{count}} card",
        reviewingCards_plural: "Reviewing {{count}} cards",
        greatJob: "Great job! You've mastered all the cards.",
        masteredCount: "{{count}} mastered",

        // StudyAudioCard
        listenLearn: "Listen & Learn",
        creatingAudioLesson: "Creating your audio lesson...",
        generatingAudioProgress: "Generating audio... {{progress}}%",
        convertingToSpeech: "Converting to speech...",
        failedToGenerate: "Failed to generate audio",
        retry: "Retry",

        // Common
        continueBtn: "Continue",
        loading: "Loading..."
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
        uploading: "Téléversement",
        prepareExam: "Préparer un examen",
        examHint: "Suivre mes progrès",
        examUploadCta: "Importer tes fichiers",
        examUploadHint: "PDF, images, notes — on génère quiz, fiches et flashcards.",
        examPrepLead: "Dépose tes notes, on prépare ton plan d'étude pour l'examen.",
        studyJourney: "Parcours d'étude",
        studyJourneyHint: "Leçons guidées, quiz et flashcards",
        uploadChat: "Importer et discuter",
        uploadChatHint: "Pose des questions sur tes documents",
        recommended: "Recommandé"
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
        viewResults: "Voir les résultats",
        // Quiz Mode Selector
        modeSelector: {
          title: "Choisir le type de quiz",
          context: "Génération de questions sur : {{topics}}",
          nclex: "Pratique NCLEX",
          nclexDesc: "Scénarios cliniques testant ton jugement",
          knowledge: "Test de connaissances",
          knowledgeDesc: "Questions directes testant la mémorisation",
          advanced: "Avancé",
          recommended: "Recommandé",
          hint: "Pas sûr? Commence avec le Test de connaissances pour une révision de base, puis essaie Pratique NCLEX quand tu es prêt."
        }
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
        building: "Création de la feuille d'étude",
        download: "Télécharger PDF",
        // PDF Header
        pdfTagline: "Ton compagnon d'étude infirmier propulsé par l'IA",
        pdfSubtitle: "Guide d'étude complet",
        // PDF Footer
        pdfGeneratedBy: "Généré par NurseQuizAI"
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

      // Post-Upload Actions
      postUpload: {
        // Action button labels
        quizLabel: "Quiz",
        flashcardsLabel: "Créer des cartes mémoire",
        studysheetLabel: "Feuille d'étude",
        audioLabel: "Résumé audio",
        mindmapLabel: "Schéma conceptuel",
        // Action prompts sent to AI (quiz prompts now handled by mode selector)
        flashcardsPrompt: "Crée des cartes mémoire pour : {{topics}}",
        studysheetPrompt: "Crée une feuille d'étude résumant les documents téléversés",
        mindmapPrompt: "Crée un schéma conceptuel pour : {{topics}}",
        // Quiz mode-specific prompts
        knowledgeQuizPrompt: "Génère un quiz de connaissances sur {{topics}}. Utilise des questions factuelles directes, pas de scénarios cliniques.",
        nclexQuizPrompt: "Génère un quiz de style NCLEX sur {{topics}}. Utilise des scénarios cliniques testant le jugement."
      },

      // Mindmap Modal
      mindmap: {
        downloadPdf: "PDF",
        details: "Détails",
        compact: "Compact",
        radial: "Radial",
        tree: "Arbre",
        switchToRadial: "Passer en vue radiale",
        switchToTree: "Passer en vue arbre",
        close: "Fermer",
        footerTree: "Vue arbre.",
        footerRadial: "Vue radiale.",
        detailsShown: "Détails affichés sur les nœuds.",
        clickForDetails: "Cliquez sur un nœud pour voir les détails.",
        dragToRearrange: "Glissez pour réorganiser. Défilez pour zoomer.",
        // Loading states
        analyzingDocument: "Analyse de la structure du document...",
        extractingConcepts: "Extraction des concepts et relations...",
        errorGenerating: "Impossible de générer la carte mentale. Veuillez réessayer."
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
        showHint: "Voir l'indice",
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

      // Flashcard Results
      flashcardResults: {
        // Mastery tiers
        outstandingTitle: "Maîtrise Exceptionnelle!",
        outstandingMessage: "Tu maîtrises presque tout le contenu!",
        excellentTitle: "Excellente Progression!",
        excellentMessage: "Continue comme ça!",
        goodTitle: "Bon Progrès!",
        goodMessage: "Tu apprends bien!",
        moderateTitle: "Continue!",
        moderateMessage: "Continue de réviser!",
        studyTitle: "Bon Début!",
        studyMessage: "Continue de réviser ces cartes!",
        // Stats labels
        masteredLabel: "Maîtrisées",
        learningLabel: "En Cours",
        newLabel: "Nouvelles",
        // Topic section
        performanceByTopic: "Performance par Sujet",
        // Action buttons
        reviewCards: "Réviser",
        continueLearning: "Continuer",
        // Motivational messages
        tipReviewRegularly: "Astuce: Révise régulièrement pour mieux mémoriser!",
        almostThere: "Tu y es presque! Continue de réviser les cartes difficiles.",
        amazingMastery: "Bravo! Tu maîtrises ce contenu!"
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

      // Progress Dashboard & Widget
      progress: {
        topicPerformance: "Performance par sujet",
        overallAccuracy: "précision globale",
        level: "Niveau",
        dayStreak: "jour de série",
        daysStreak: "jours de série",
        questionsAnswered: "questions répondues",
        dailySerum: "Sérum quotidien",
        moreToGo: "encore à faire",
        delivered: "Livré!",
        xp: "XP",
        lvl: "Niv",
        day: "jour",
        days: "jours",
        // Messages de motivation
        crushingIt: "Tu déchires tout!",
        greatProgress: "Super progrès! Continue!",
        improving: "Tu t'améliores!",
        everyQuestion: "Chaque question te rend plus fort!",
        startJourney: "Commence ton parcours d'apprentissage!",
        // État vide
        emptyTitle: "Complète des quiz pour suivre ta performance par sujet!",
        emptyHint: "Ta progression apparaîtra ici"
      },

      // Landing Page
      landing: {
        uploadNotesTitle: "Téléverse tes notes de cours",
        uploadNotes: "Téléverse tes notes",
        // Hero transformation
        dropNotes: "Dépose tes notes de cours ici",
        fileFormats: "PDF, PPT, Word, Images • Jusqu'à 15Mo",
        featureQuiz: "Quiz",
        featureFlashcards: "Flashcards",
        featureMindMap: "Schéma conceptuel",
        featureAudio: "Audio",
        featureStudySheet: "Fiche d'étude",
        // Hero section
        sloganLine1: "Trop de matière à étudier. Pas assez de temps.",
        sloganLine2Prefix: "On règle ça — en transformant tes notes en ",
        sloganLine2Suffix: ".",
        typewriter: {
          quiz: "quiz",
          flashcards: "flashcards",
          mindmaps: "schémas conceptuels",
          audio: "audio",
          studysheet: "fiches d'étude",
          success: "succès 🏆"
        },
        subtitle: "Étudie moins longtemps, comprends mieux.",
        // Auth buttons
        login: "Connexion",
        signup: "S'inscrire",
        logout: "Déconnexion",
        // Social proof badges
        badge1: "Créé avec des infirmières",
        badge2: "Utilisé partout en Amérique du Nord",
        // Footer
        footerText: "Conçu pour les examens en soins infirmiers et le NCLEX",
        // Product showcase section
        showcaseTitle: "Comment ça fonctionne",
        showcaseSubtitle: "Des notes aux connaissances en quelques minutes",
        demoLabel: "Démo en direct",
        demoUpload: "Notes_Pharmacologie.pdf",
        demoGenerating: "L'IA génère un quiz style NCLEX...",
        demoQuestion: "Quelle classe de médicaments est principalement utilisée pour traiter l'hypertension?",
        demoAnswer1: "A. Antihistaminiques",
        demoAnswer2: "B. Inhibiteurs de l'ECA",
        demoAnswer3: "C. Antibiotiques",
        demoAnswer4: "D. Antidépresseurs",
        demoCorrect: "Correct!",
        demoScore: "Ton score",
        phase1: "1. Téléverser",
        phase2: "2. Générer",
        phase3: "3. Quiz",
        phase4: "4. Apprendre",
        showcaseCta: "Commencer maintenant",
        showcaseCtaSubtext: "Gratuit à essayer • Aucune carte de crédit requise",
        // Science section
        scienceTitle: "Basé sur la science",
        scienceSubtitle: "Méthodes prouvées par la recherche pour de meilleurs résultats",
        stat1Title: "Score 73% plus élevé",
        stat1Desc: "Les étudiants utilisant des quiz interactifs propulsés par l'IA obtiennent 73% de plus aux examens que ceux utilisant des méthodes traditionnelles",
        stat1Source: "Recherche en technologie éducative, 2024",
        stat2Title: "Retiens 85% de plus",
        stat2Desc: "Les étudiants utilisant des méthodes d'apprentissage actif montrent 85% de meilleure rétention comparé aux méthodes passives",
        stat2Source: "Journal of Educational Psychology, 2023",
        stat3Title: "Économise 30% de temps",
        stat3Desc: "Les matériels d'étude générés par l'IA réduisent le temps de préparation de 30% tout en maintenant l'efficacité",
        stat3Source: "Learning Technology Review, 2024",
        scienceCta: "Rejoins la communauté",
        // Login prompt modal
        loginPromptTitle: "Presque terminé!",
        loginPromptMessage: "Connecte-toi pour sauvegarder ta progression et suivre ton apprentissage.",
        fileReady: "Prêt à téléverser",
        filesReady: "{{count}} fichiers prêts",
        fileWillBeUploaded: "Ton fichier sera téléversé automatiquement après ta connexion.",
        loginToUpload: "Connecte-toi pour téléverser tes notes et commencer!",
        signupToUpload: "Crée un compte pour téléverser tes notes!",
        // Benefits in login prompt
        benefit1: "Sauvegarde ta progression de quiz",
        benefit2: "Suis tes statistiques d'apprentissage",
        benefit3: "Accède à tes notes téléversées n'importe quand",
        createAccount: "Créer un compte gratuit",
        haveAccount: "J'ai déjà un compte",
        // Google sign-in in modal
        continueWithGoogle: "Continuer avec Google",
        signingIn: "Connexion...",
        or: "ou",
        // Upload process
        generatingQuestions: "Génération des questions NCLEX...",
        analyzingNotes: "Analyse de tes notes",
        uploadError: "Échec du traitement de ton fichier. Réessaie.",
        // File size error modal
        fileTooLargeTitle: "Fichier trop volumineux",
        fileTooLargeMessage: "La taille maximale est de {{maxSize}}Mo par fichier.",
        fileTooLargeTips: "Essaie ces options :",
        fileTooLargeTip1: "Compresse ton PDF avec un outil en ligne",
        fileTooLargeTip2: "Divise les gros documents en plusieurs parties",
        fileTooLargeTip3: "Utilise des images de résolution plus basse"
      },

      // Common
      common: {
        close: "Fermer",
        understood: "Compris"
      },

      // Dashboard
      dashboard: {
        upcomingExams: {
          title: "Examens à venir"
        },
        examsList: {
          add: "Ajouter"
        },
        exam: {
          study: "Étudier",
          today: "Aujourd'hui!",
          tomorrow: "Demain",
          inDays: "dans {{days}} jours"
        },
        readiness: {
          short: "{{percent}}% prêt",
          notStartedShort: "Pas commencé"
        },
        noExam: {
          title: "Aucun examen à venir",
          description: "Ajoute un examen pour suivre ta préparation",
          addButton: "Ajouter un examen"
        },
        streak: {
          start: "Commence ta série aujourd'hui!",
          first: "Bon début!",
          building: "Continue comme ça!",
          strong: "Tu es en feu!",
          legend: "Légendaire!",
          day: "jour de série",
          days: "jours de série"
        },
        daily: {
          label: "objectif quotidien",
          complete: "Complété!"
        },
        level: {
          value: "Niveau {{level}}"
        },
        quickActions: {
          label: "Rapide:",
          upload: "Téléverser",
          chat: "Discussion",
          quiz: "Quiz",
          newChat: "Commencer une discussion"
        }
      },

      // Countdown
      countdown: {
        days: "{{days}}j",
        past: "il y a {{days}}j",
        now: "Maintenant!",
        today: "Aujourd'hui"
      },

      // Audio Generation
      audio: {
        readyToGenerate: "Audio prêt",
        topic: "Sujet",
        duration: "Durée",
        minute: "min",
        minutes: "min",
        generate: "Générer l'audio",
        generating: "Génération...",
        download: "Télécharger",
        speed: "Vitesse",
        showTranscript: "Afficher la transcription",
        hideTranscript: "Masquer la transcription",
        // Intent style names
        fullLesson: "Leçon complète",
        quickSummary: "Résumé rapide",
        deepDive: "Exploration approfondie",
        simpleExplanation: "Explication simple",
        progressReport: "Rapport de progression",
        // Intent style descriptions
        fullLessonDesc: "Leçon structurée avec exemples et contexte clinique",
        quickSummaryDesc: "Points clés uniquement, aperçu concis",
        deepDiveDesc: "Exploration complète et détaillée",
        simpleExplanationDesc: "Adapté aux débutants, utilise des analogies",
        progressReportDesc: "Tes statistiques, réalisations et recommandations",
        // Status messages
        creatingScript: "Création du script...",
        scriptReady: "Script prêt, conversion en audio...",
        generatingAudio: "Génération de l'audio...",
        audioReady: "Audio prêt!",
        audioError: "Échec de la génération audio"
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
      },

      // Study Mode
      study: {
        // StartStudyModal
        startJourney: "Commencer le parcours d'étude",
        preparingJourney: "Préparation de ton parcours",
        analyzingDocs: "Analyse de tes documents...",
        creatingPath: "Création de ton parcours d'étude personnalisé...",
        savingProgress: "Mise en place de ton parcours...",
        ready: "Prêt à apprendre!",
        errorGenerating: "Échec de la création du parcours. Réessaie.",
        document: "document",
        documents: "documents",
        topicsLabel: "Tes leçons couvriront:",
        more: "de plus",
        journeyDescription: "Je vais créer un parcours d'étude personnalisé basé sur tes documents, avec des leçons, des flashcards, des quiz et de l'audio pour t'aider à apprendre efficacement.",
        featureLessons: "Leçons courtes",
        featureFlashcards: "Flashcards",
        featureQuizzes: "Questions de quiz",
        featureAudio: "Leçons audio",
        generating: "Création...",
        beginJourney: "Commencer",

        // StudyPlanOverview
        yourStudyPlan: "Ton plan d'étude",
        comingSoon: "Bientôt disponible!",
        start: "COMMENCER",

        // Node types
        nodeType: {
          lesson: "Leçon",
          quiz: "Quiz",
          flashcard: "Flashcard",
          audio: "Audio",
          mindmap: "Carte mentale",
          review: "Révision"
        },

        // StudyModeContainer & loading states
        preparing: "Préparation de ta {{type}}...",
        startingSession: "Démarrage de ta session d'étude...",
        exitStudyMode: "Quitter le mode étude",

        // StudyLessonCard
        lessonTitle: "Leçon",
        keyPoints: "Points clés",
        loadingLesson: "Chargement du contenu de la leçon...",

        // StudyQuizCard
        quickCheck: "Vérification rapide",
        correct: "Correct!",
        incorrect: "Incorrect",
        correctAnswer: "Bonne réponse:",
        learnMore: "En savoir plus",
        showLess: "Réduire",
        continue: "CONTINUER",
        gotIt: "COMPRIS",
        reviewing: "Révision de {{count}} question",
        reviewing_plural: "Révision de {{count}} questions",
        excellentWork: "Excellent travail! Tu as tout bon.",
        correctCount: "{{count}} correct",

        // StudyFlashcardCard
        flashcardsTitle: "Flashcards",
        tapToFlip: "Appuie pour retourner",
        tapToFlipBack: "Appuie pour revenir",
        gotItBtn: "Je sais!",
        needReview: "À revoir",
        nextCard: "Carte suivante",
        reviewingCards: "Révision de {{count}} carte",
        reviewingCards_plural: "Révision de {{count}} cartes",
        greatJob: "Bravo! Tu as maîtrisé toutes les cartes.",
        masteredCount: "{{count}} maîtrisée",

        // StudyAudioCard
        listenLearn: "Écoute et apprends",
        creatingAudioLesson: "Création de ta leçon audio...",
        generatingAudioProgress: "Génération audio... {{progress}}%",
        convertingToSpeech: "Conversion en parole...",
        failedToGenerate: "Échec de la génération audio",
        retry: "Réessayer",

        // Common
        continueBtn: "Continuer",
        loading: "Chargement..."
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
