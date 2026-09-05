// src/i18n/i18n.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      // Upgrade / monetization modal
      upgrade: {
        title: "Study without limits",
        titleNclex: "Pass your NCLEX with room to spare",
        titleCourse: "Ace your course exam",
        titleBlocked: "Don't stop now. 🔥",
        titlePlanBlocked: "You've got more exams to prepare for.",
        body: "Master every topic, find your weak spots faster, and walk into your exam ready.",
        bodyBlocked: "You've reached your free practice limit. Upgrade to Pro and keep preparing for your exam.",
        bodyExam: "Your exam is {{when}} — don't let a question limit slow your final push.",
        bodyBlockedExam: "You've reached your free practice limit — and your exam is {{when}}. Upgrade to Pro and keep preparing.",
        examToday: "today",
        examTomorrow: "tomorrow",
        examInDays: "in {{days}} days",
        examIs: "Your exam is {{when}}",
        nextBatchInline: "Continue free in {{time}} (next batch)",
        nextPlanInline: "Continue free in {{time}} (next plan)",
        bodyPlan: "Pro gives every course you're taking its own plan — not just the first few.",
        bodyPlanBlocked: "You've already started {{count}} study plans this month. Give every course its own personalized plan with Pro.",
        bodyPlanBlockedExam: "You've already started {{count}} study plans this month — and your exam is {{when}}. Give every course its own personalized plan with Pro.",
        // Context + momentum
        wereStudying: "You were practicing",
        questionsDone: "questions completed",
        momentumNudge: "Keep your momentum going!",
        // The offer
        proBadge: "PRO",
        excelTitle: "Study to excel, not just to pass.",
        out: {
          practice: "Practice until it clicks",
          practiceSub: "No limits, no waiting",
          plans: "A plan for every exam",
          plansSub: "Built around your exam date",
          uploads: "Your notes become questions",
          uploadsSub: "Study what's actually on your test",
          faster: "Get exam-ready sooner",
          fasterSub: "Practice what you're weakest at",
          weakSpots: "Turn weak spots into strengths",
          weakSpotsSub: "We track them so you don't have to",
          nextStep: "Know what to study next",
          nextStepSub: "Never waste a study session"
        },
        // Price + CTA
        perMonth: "/ month",
        cancelAnytime: "Cancel anytime. No commitments.",
        billedYearly: "Billed {{symbol}}{{amount}} yearly. Cancel anytime.",
        savePct: "Save {{pct}}%",
        withAnnual: "with annual",
        switchMonthly: "Switch to monthly",
        ctaContinue: "Continue studying with Pro",
        ctaPlans: "Unlock every plan with Pro",
        or: "or",
        notNow: "Not now",
        // Already-Pro branch
        proTitle: "You're on Pro",
        proBody: "Unlimited practice, uploads, and weak-spot reviews — you have it all. Manage your plan, update payment details, or cancel anytime.",
        manage: "Manage subscription",
        manageSub: "Change plan, update card, or cancel",
        portalOpening: "Opening…",
        close: "Close"
      },
      usageBadge: {
        title: "Questions left — refills every week",
        blockedTitle: "Out of questions — resets soon, or upgrade to skip the wait",
        resetsIn: "Resets in {{time}}",
        remaining: "{{remaining}}/{{limit}} questions"
      },
      usagePanel: {
        tooltip: "Questions used — refills every week",
        upgradeTitle: "Upgrade to Pro",
        upgrade: "Upgrade",
        proUnlimited: "Pro · Unlimited",
        manage: "Manage",
        manageTitle: "Manage or cancel your subscription"
      },
      account: {
        title: "Account",
        close: "Close",
        rowTitle: "Account & subscription",
        noEmail: "Signed in",
        planPro: "Pro",
        planFree: "Free plan",
        planFreeShort: "Free",
        subscribed: "Subscribed",
        notSubscribed: "Not subscribed",
        proDetail: "Unlimited questions, uploads, and reviews.",
        freeDetail: "{{used}} of {{limit}} questions used this week.",
        freeBlocked: "Out of questions — next batch in {{time}}.",
        upgrade: "Upgrade to Pro",
        upgradeShort: "Upgrade",
        manage: "Manage subscription",
        manageHint: "Change plan, update your card, or cancel — opens Stripe's secure portal.",
        portalOpening: "Opening…",
        signOut: "Sign out"
      },
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
        recommended: "Recommended",
        studyPlanStartsHere: "Prepare for your exam",
        uploadWeHandle: "Upload your notes and we'll build your personalized study plan.",
        uploadOrPaste: "Upload or paste your notes. We'll take care of the rest.",
        uploadMyNotes: "Upload my notes",
        pasteMyNotes: "Paste my notes",
        // Empty-state CTA card (multi-step "Prepare for exam")
        prepareForExam: "Study for exam",
        // Exam Drill — the second door out of the empty state.
        drillTagline: "Already studied? Skip the plan and find your gaps.",
        drillCta: "Drill me on my notes",
        // Path chooser — the plan and the drill offered as peers.
        pathTitle: "What do you want to focus on today?",
        pathSub: "Choose your path. We'll meet you where you are.",
        planCardTitle: "Follow your study plan",
        planCardDesc: "A personalized, step-by-step plan built from your notes to help you master the material.",
        planCardNote: "Best for building knowledge and long-term retention",
        drillCardTitle: "Find my weak spots",
        drillCardDesc: "Get challenged with difficult questions from your notes and see what you need to work on.",
        drillCardCta: "Test my exam readiness",
        drillCardNote: "Best for quick assessment and exam readiness",
        newBadge: "New",
        prepareTagline: "A personalized study plan built from your notes",
        howToAddNotes: "How would you like to add your notes?",
        uploadShort: "Upload notes",
        pasteShort: "Paste notes",
        back: "Back",
        // Input-row button tooltips
        tooltipAttachFile: "Attach study material — PDFs, slides, photos",
        tooltipFilesEmpty: "No files yet — your uploads will appear here",
        tooltipFilesCount_one: "{{count}} file in this chat — open library",
        tooltipFilesCount_other: "{{count}} files in this chat — open library",
        tooltipVoiceDictate: "Dictate your message instead of typing",
        tooltipVoiceStop: "Stop and transcribe",
        tooltipVoiceTranscribing: "Transcribing…",
        examPasteCta: "Paste your notes",
        pasteNotesTitle: "Paste your notes",
        pasteNotesSubtitle: "Copy and paste your study material below",
        pasteNotesPlaceholder: "Paste or type your notes here...",
        startStudying: "Start studying",
        characters: "characters",
        progressSaved: "progress saved",
        copy: "Copy",
        copied: "Copied",
        streamError: "Something went wrong and no response was received.",
        timeoutError: "That one didn't come back. Nothing was lost — tap retry.",
        retry: "Retry",
        copyMessageAria: "Copy message",
        copyTooltip: "Copy",
        rewrite: "Rewrite",
        rewriting: "Rewriting…",
        rewriteAria: "Rewrite message",
        rewritingAria: "Rewriting",
        rewriteTooltip: "Rewrite in a more natural style",
        rewritingTooltip: "Rewriting…",
        rewritten: "Rewritten",
        rewrittenAria: "Rewritten version",
        copyRewrite: "Copy rewrite",
        discardRewrite: "Discard",
        discardRewriteAria: "Discard rewrite",
        rewriteFailed: "Rewrite failed. Please try again.",
        ratingGroupAria: "Rate this answer",
        ratingHelpful: "Helpful",
        ratingHelpfulAria: "Mark this answer helpful",
        ratingNotHelpful: "Not helpful",
        ratingNotHelpfulAria: "Mark this answer not helpful",
        ratingThanks: "Thanks — noted",
        ratingReasonIncorrect: "Incorrect or incomplete",
        ratingReasonNotAsked: "Not what I asked for",
        ratingReasonConfusing: "Confusing explanation",
        ratingReasonNotExamStyle: "Not exam-style",
        ratingReasonTooLong: "Too long",
        ratingReasonSlowBuggy: "Slow or buggy",
        ratingReasonOther: "Other",
        shareFeedbackTitle: "Share feedback",
        shareFeedbackClose: "Close",
        shareFeedbackReasonsAria: "What went wrong?",
        shareFeedbackDetailsAria: "Details",
        shareFeedbackPlaceholder: "Tell us what you needed instead (optional)",
        shareFeedbackPrivacy: "This conversation will be sent with your feedback so we can improve the tutor.",
        shareFeedbackSubmit: "Submit",
        edit: "Edit",
        editMessage: "Edit message",
        editCancel: "Cancel",
        editSave: "Save",
        editPlaceholder: "Edit your message…"
      },

      // Common UI Elements
      common: {
        loading: "Loading...",
        save: "Save",
        cancel: "Cancel",
        submit: "Submit",
        search: "Search",
        welcome: "Welcome",
        close: "Close"
      },

      // Selection action bar + explain popover
      selection: {
        toolbar: "Selection actions",
        copy: "Copy",
        copied: "Copied",
        explain: "Explain",
        explainTitle: "Explanation",
        keyPoints: "Key points",
        explainAria: "Explanation of selection",
        explainError: "Couldn't load that one. Try again in a moment.",
        explainEmpty: "No clinical explanation for that selection."
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
        uploadFailed: "Upload failed",
        uploadFailedHint: "Something went wrong while uploading your file. Please check your connection and try again.",
        uploadOverloaded: "We're experiencing high demand",
        uploadOverloadedHint: "Too many students are using NurseQuizAI right now and we couldn't complete your request. Please try again in a few minutes.",
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

      // Case Study / NGN Questions
      caseStudy: {
        badge: "Case Study",
        nursesNotes: "Nurses' Notes",
        vitalSigns: "Vital Signs",
        labResults: "Laboratory Results",
        noData: "No data available for this tab.",
        dragHint: "Drag and drop to arrange in the correct order",
        submitOrder: "Submit Order",
        partialCredit: "Partial Credit",
        correctOrder: "Correct Order:"
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
        // Exam timing beside each chat's date, so the list reads for urgency
        // and not only for recency. Past exams are shown deliberately.
        drillSession: "Exam drill",
        examToday: "Exam today",
        examTomorrow: "Exam tomorrow",
        examInDays: "Exam in {{count}} days",
        examYesterday: "Exam yesterday",
        examDaysAgo: "Exam {{count}} days ago",
        chats: "Chats",
        newChat: "New chat",
        expandSidebar: "Expand sidebar",
        usage: "Analytics",
        logout: "Logout",
        studySession: "Study Session",
        rename: "Rename",
        delete: "Delete",
        deleteTitle: "Delete chat?",
        deleteBody: "This will permanently delete all messages, uploaded files, and study data associated with this chat.",
        deleteCancel: "Cancel",
        deleteConfirm: "Delete"
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
      // "Check my understanding" session card (stands in for the raw prompt)
      checkme: {
        title: "Checking your understanding",
        stepOf: "Concept {{current}} of {{total}}",
        allCovered: "All {{total}} covered"
      },

      postUpload: {
        // Action button labels
        checkmeLabel: "Check my understanding",
        quizLabel: "Quiz me",
        flashcardsLabel: "Create flashcards",
        studysheetLabel: "Study sheet",
        audioLabel: "Audio summary",
        mindmapLabel: "Concept map",
        // Action prompts sent to AI (quiz prompts now handled by mode selector)
        // "in my own words" is load-bearing: it matches TEACH_PATTERNS in the
        // backend orchestrator, which routes this to a direct written answer
        // instead of a generated artifact. Don't drop that phrase.
        checkmePrompt: "Ask me to explain {{topics}} in my own words, one concept at a time, and correct me whenever I get something wrong.",
        flashcardsPrompt: "Create flashcards for: {{topics}}",
        studysheetPrompt: "Create a study sheet summarizing the uploaded documents",
        mindmapPrompt: "Create a concept map for: {{topics}}",
        // Quiz mode-specific prompts
        knowledgeQuizPrompt: "Generate a knowledge test quiz about {{topics}}. Use direct factual questions, not clinical scenarios.",
        nclexQuizPrompt: "Generate an NCLEX-style quiz about {{topics}}. Use multiple choice questions (MCQ format) with clinical scenarios testing judgment. Do not use case study format."
      },

      // Plan Onboarding (3-question gate before study plan generation,
      // shown only on first upload for exam-prep students)
      planOnboarding: {
        eyebrow: "Personalized plan",
        hookHeadline_one: "I've read your file on {{topics}}.",
        hookHeadline_other: "I've read your {{count}} files on {{topics}}.",
        hookFallbackTopic: "your study material",
        back: "Back",
        continue: "Continue",
        // Q1 helper line — special-cased for "today"; otherwise uses count plural
        daysHelperToday: "Today — let's prioritize",
        daysHelper_one: "1 day from today — tight, but doable",
        daysHelper_other: "{{count}} days from today",
        // Confirmation summary date label
        examToday: "Exam today",
        examInDays_one: "Exam in 1 day",
        examInDays_other: "Exam in {{count}} days",
        q1: {
          title: "When's the exam?",
          subtitle: "I'll size the plan to fit.",
          options: {
            today: "Today",
            tomorrow: "Tomorrow",
            this_week: "This week",
            next_week: "Next week",
            two_plus_weeks: "2+ weeks"
          },
          pickDate: "Pick a date"
        },
        q2: {
          title: "Which feels hardest right now?",
          subtitle: "Pick up to 2 — I'll lead the plan there.",
          counter_one: "{{count}}/2 selected",
          counter_other: "{{count}}/2 selected",
          noTopics: "No topics extracted yet — continue and we'll figure it out together."
        },
        q3: {
          title: "And where are you in your prep?"
        },
        prepOptions: {
          not_started: "Haven't started yet",
          just_started: "Just getting started",
          making_progress: "Making progress",
          cramming: "Cramming"
        },
        confirm: {
          title: "Here's what I'll build for you.",
          summaryAria: "Plan summary",
          focusPrefix: "Focus:",
          topicJoiner: ", ",
          cta: "Build my plan",
          edit: "Edit answers"
        }
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
        errorGenerating: "Could not generate mindmap. Please try again.",
        // Diagrams drawn from an ASCII sketch inside a chat answer
        conceptMapBadge: "Concept map",
        viewAsText: "View as text",
        viewAsDiagram: "View as diagram",
        buildingDiagram: "Drawing your concept map..."
      },

      // Post-exam debrief — the one-time "how did it actually go?" conversation.
      // The tutor writes its own follow-ups; only the opener, the composer and the
      // fallback closing line are fixed copy.
      examDebrief: {
        heading: "How was your exam?",
        headingNamed: "How was your {{exam}} exam?",
        opener: "Hey! Welcome back \ud83d\udc4b You had your exam recently. How did it go?",
        openerNamed: "Hey! Welcome back \ud83d\udc4b You had your {{exam}} exam recently. How did it go?",
        suggestWell: "It went well",
        suggestHarder: "Harder than I expected",
        suggestRough: "It was rough",
        placeholder: "Tell us how it went\u2026",
        typing: "Typing",
        send: "Send",
        done: "Close",
        close: "Close",
        closing: "Thank you \u2014 this is genuinely helpful. Feedback like this helps us improve the preparation for your next exam and for other students too."
      },

      // Post-content satisfaction rating (ContentRating). Replaced the
      // QuizFeedback popover, whose three emoji and single reason wrote to a
      // field nothing read. Prompts and chips are picked by surface.
      contentRating: {
        promptQuiz: "Was this quiz useful?",
        promptFlashcard: "Were these cards useful?",
        promptBlock: "Was this useful?",
        thanks: "Thanks \u2014 noted",
        groupAria: "Rate this content",
        helpful: "Useful",
        helpfulAria: "This was useful",
        notHelpful: "Not useful",
        notHelpfulAria: "This was not useful",
        modalTitleQuiz: "What was wrong with this quiz?",
        modalTitleFlashcard: "What was wrong with these cards?",
        modalTitleBlock: "What was wrong with this?",
        reasonWrongAnswer: "Wrong answer marked correct",
        reasonNotInMaterial: "Not from my material",
        reasonBadExplanation: "Explanation didn't help",
        reasonConfusingWording: "Confusing wording",
        reasonTooHard: "Too hard",
        reasonTooEasy: "Too easy",
        reasonNotExamStyle: "Not NCLEX-style",
        reasonCardWrong: "The answer looks wrong",
        reasonCardWordy: "Too much text on the card",
        reasonRepetitive: "Repetitive cards",
        reasonNothingNew: "Didn't teach me anything new",
        reasonTooShallow: "Too shallow",
        reasonTooLong: "Too long",
        reasonOther: "Other"
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

      // Onboarding
      onboarding: {
        intro: "To better understand your needs, please answer these quick questions ✨",
        step1Title: "What is your main goal today?",
        step2Title: "Where are you in your journey?",
        step3Title: "How do you learn best?",
        step4Title: "What are you hoping NurseQuizAI helps you achieve?",
        loading: "Setting up your profile...",
        tracker: "Question {{current}} of {{total}}",
        processing: {
          analyzing: "Analyzing your preferences...",
          personalizing: "Personalizing your experience..."
        },
        options: {
          nclex: "NCLEX Prep",
          courseExam: "Course Exam",
          generalReview: "General Review",
          stage1: "Pre-Nursing / Semester 1",
          stage2: "Semester 2-3",
          stage3: "Final Semester / NCLEX Prep",
          formatPractice: "Practice Questions",
          formatFlashcards: "Flashcards",
          formatConcept: "Visual Concept Maps",
          formatAudio: "Audio Summaries",
          skipText: "Skip",
          submitText: "Submit"
        },
        expectationPlaceholder: "I struggle with remembering pharmacology...",
        success: {
          title: "All set! 🚀",
          message: "Thanks for setting up your profile. You're ready to start learning!",
          button: "Start Learning"
        },
        recommendation: {
          studyjourney: "Your profile is set up. Ready to generate a custom session for a student?",
          flashcards: "Your profile is set up. Ready to generate custom flashcards?",
          studysheet: "Your profile is set up. Ready to generate a custom study sheet?",
          default: "Your profile is set up. Ready to generate a custom {{reviewFormat}} session for a {{userStage}} student?"
        },
        successButtons: {
          startSession: "Start My First Session"
        }
      },

      // First Upload "Wow Effect" - Personalized messages based on onboarding choices
      wowEffect: {
        flashcards: "I see you're preparing for {{goal}} and want to use flashcard apps. Let me create flashcards from {{topics}} that you can export!",
        studyjourney: "I see you're preparing for {{goal}} and want to track your progress. Let's begin your personalized study journey through {{topics}}!",
        studysheet: "I see you're preparing for {{goal}} and want printable content. Let me create a study sheet from {{topics}}!",
        default: "Great! I've analyzed {{topics}}. Let's get started!",
        defaultTopics: "your material",
        defaultGoal: "your studies",
        cta: {
          flashcards: "Create My Flashcards",
          studyjourney: "Begin My Study Journey",
          studysheet: "Create My Study Sheet",
          default: "Get Started"
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
        noSetup: "No setup. We guide you step by step.",
        fileFormats: "PDF, PPT, Word, Images • Up to 15MB",
        featureQuiz: "Quizzes",
        featureFlashcards: "Flashcards",
        featureMindMap: "Concept Maps",
        featureAudio: "Audio",
        featureStudySheet: "Study Sheet",
        // Hero section — v3 conversion-focused copy
        // The typewriter now cycles QUESTION TYPES (the v3 promise) instead of output formats.
        // Key names (quiz/flashcards/etc.) are legacy; values reflect the new content.
        sloganLine1: "You know the material. The questions trap you.",
        sloganLine2Prefix: "We rebuild your notes into ",
        sloganLine2Suffix: ".",
        typewriter: {
          quiz: "SATA questions.",
          flashcards: "prioritization.",
          mindmaps: "clinical scenarios.",
          audio: "exam-format practice.",
          studysheet: "what your prof asks.",
          success: "exam-day wins."
        },
        subtitle: "Upload your notes. First quiz in under 2 minutes.",
        // Auth buttons
        login: "Log in",
        signup: "Sign up",
        logout: "Log out",
        // Social proof badges
        badge1: "Made with nurses",
        badge2: "Used by 1,000+ nursing students",
        badge2Countries: "Students in the United States, Canada, the Philippines, Australia and South Africa",
        // Footer
        footerText: "Built for nursing students. Med-Surg, Pharm, Patho — not just NCLEX.",
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
        unsupportedFileType: "Unsupported file type: {{files}}. Only PDF, Word, PowerPoint, Excel, and text files are supported.",
        unsupportedFileTypePartial: "Some files were skipped (unsupported type): {{files}}. Processing the rest.",
        supportedFormats: "Supported formats: PDF, Word, PowerPoint, Excel, Text",
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
        today: "Today",
        // Readiness-card countdown banner
        eyebrowUntil: "Exam in",
        eyebrowToday: "Test day",
        eyebrowPast: "Exam passed",
        unitDays_one: "day",
        unitDays_other: "days",
        unitHours_one: "hour",
        unitHours_other: "hours",
        unitMinutes_one: "minute",
        unitMinutes_other: "minutes",
        unitSeconds_one: "second",
        unitSeconds_other: "seconds",
        almostThere: "Almost there",
        // Past-exam phrasing — single localized sentence so EN ("5 days ago")
        // and FR ("il y a 5 jours") both read naturally
        daysAgo_one: "1 day ago",
        daysAgo_other: "{{count}} days ago",
        earlierToday: "Earlier today",
        aria: "Time until exam"
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
      history: {
        fixedConcept: "You were getting {{concept}} wrong earlier. You’ve had it right {{count}} times since.",
        topicClimb: "First time on {{topic}} you got {{firstCorrect}} of {{firstTotal}}. This time, {{latestCorrect}} of {{latestTotal}}.",
        persistentConcept: "{{concept}} has caught you {{count}} times now. That’s the one worth slowing down on."
      },
      narration: {
        ack: "Okay \u2014 that tells me a lot.",
        strongOne: "You\u2019re in better shape than you might think. This one\u2019s already yours:",
        strongMany: "You\u2019re in better shape than you might think. These are already yours:",
        contradiction: "And here\u2019s the thing \u2014 you told me {{feared}} was your hardest. It isn\u2019t. You\u2019ve got that one.",
        work: "Where it gets shaky is here:",
        workAfterTwist: "What actually needs your time is this:"
      },
      coach: {
        steady: "Your exam is {{count}} days away \u2014 we\u2019ve got time.",
        focus: "Your exam is {{count}} days away. Enough time to fix real gaps \u2014 not enough to redo everything.",
        twoDays: "Two days out. That\u2019s tight.",
        tomorrow: "Your exam is tomorrow. That\u2019s not much time.",
        examDay: "Your exam is today.",
        past: "That exam date has already gone by.",
        undated: "No exam date set, so we\u2019ll go at a steady pace.",
        planSteady: "Here\u2019s the game plan. We start with {{topics}}, and we take them properly rather than skimming.",
        planFocus: "So here\u2019s the plan: {{topics}} first, properly.",
        planFinal: "So we\u2019re not covering everything. Straight at {{topics}} \u2014 that\u2019s where the marks are.",
        planExamDay: "No new material today \u2014 that never helps. One fast pass over {{topics}}, then stop.",
        planAllStrong: "Honestly, you\u2019re in good shape. Your path is short checks to keep it that way, not a rebuild.",
        tail: "{{strong}} you\u2019ve already got \u2014 that moves to the end as a quick refresh."
      },
      diagnostic: {
        eyebrow: "Before we build your plan",
        eyebrowExam: "Before we plan for {{exam}}",
        title: "A few quick questions",
        sub: "Nothing here is graded. I just don\u2019t want to waste your time teaching you things you already know.",
        progressSr: "Question {{n}} of {{total}}",
        unsure: "I\u2019m not sure yet",
        knownTitle: "You\u2019ve got this one.",
        unsureTitle: "Good \u2014 that\u2019s worth knowing.",
        teachTitle: "Here\u2019s the idea:",
        next: "Next",
        seeResults: "Show me where I stand",
        skip: "Skip this \u2014 just build my plan",
        loadingTitle: "Reading your material\u2026",
        loadingSub: "Working out what to ask you.",
        buildingTitle: "Reading what you just showed me\u2026",
        buildingSub: "Working out where you actually stand."
      },
      map: {
        eyebrow: "Here\u2019s where you stand",
        contradiction: "You told me {{feared}} was your hardest \u2014 you\u2019re actually solid there. It\u2019s {{actual}} that needs the work.",
        strongEvidence: "You had {{concepts}}.",
        workEvidence: "Specifically: {{concepts}}.",
        workEvidenceGeneric: "We haven\u2019t proven this one yet.",
        cta: "Show me the plan",
        ctaBusy: "Building your path\u2026",
        and: " and "
      },
      study: {
        // StartStudyModal
        startJourney: "Start Study Journey",
        preparingJourney: "Preparing Your Journey",
        analyzingDocs: "Analyzing your documents...",
        creatingPath: "Creating your personalized study path...",
        savingProgress: "Setting up your journey...",
        ready: "Ready to learn!",
        // Rotating loading messages for study plan generation
        loadingMessages: [
          "Reading through your notes...",
          "Mapping out the key concepts...",
          "Building your personalized path...",
          "Connecting the dots between topics...",
          "Structuring your learning journey...",
          "Identifying what matters most...",
          "Tailoring the difficulty to you...",
          "Almost there, fine-tuning your plan...",
          "Organizing topics for maximum retention...",
          "Crafting the perfect study order..."
        ],
        // Rotating loading messages for quiz generation inside study mode
        quizLoadingMessages: [
          "Cooking up some brain teasers...",
          "Picking the trickiest concepts...",
          "Writing questions that actually matter...",
          "Calibrating difficulty to your level...",
          "Mixing in a few curveballs...",
          "Making sure these are NCLEX-worthy...",
          "Choosing the best clinical scenarios...",
          "Almost ready, sharpening the questions...",
          "Selecting the most important topics...",
          "Preparing your knowledge check..."
        ],
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

        // StartStudyModal — plan preview pane (after onboarding confirm)
        planReadyTitle: "Your path is ready",
        thinkTopics: "Read your material — found {{count}} topics",
        thinkSprintToday: "Your exam is today — cutting straight to what you need",
        thinkSprintTomorrow: "Your exam is tomorrow — skipping new material",
        thinkSprintSoon: "Only {{days}} days left — skipping new material",
        thinkFocus: "{{days}} days until your exam — prioritising your weak spots",
        thinkMaster: "Plenty of time — building full coverage",
        thinkHardest: "Putting {{topics}} first — you said it's the hardest",
        thinkBuilding: "Building your steps…",
        planSprintToday: "Your exam is today — here's the plan",
        planSprintTomorrow: "Your exam is tomorrow — here's the plan",
        planSprintSoon: "Your exam is in {{days}} days — here's the plan",
        planSprintNote: "No new material — we find your gaps and drill them.",
        planFocusTitle: "Built for your exam in {{days}} days",
        planFocusNote: "We check what you know first, then rebuild the weak spots.",
        planPitch: "We'll start with a quick {{action}} {{label}} — just to see where you're at.",
        planFirstBadge: "Start here",
        planEstimate: "{{steps}} steps · about {{mins}} min total",
        planMore: "more steps",
        planReserveNote: "+{{count}} more, unlocked when you finish these",
        blockDoneTitle: "Block complete",
        blockDoneBody: "You finished all {{count}} steps. That's the whole block done.",
        blockExtend: "Add the next {{count}} steps",
        blockExtending: "Adding your next steps...",
        blockAllDone: "You've finished everything we planned from these documents.",
        letsGo: "Let's go",
        closeAria: "Close",

        // StudyPlanOverview
        yourStudyPlan: "Your Study Plan",
        muteSounds: "Mute sounds",
        unmuteSounds: "Unmute sounds",
        comingSoon: "Coming soon!",
        start: "START",

        // Node types
        nodeType: {
          lesson: "Quick Review",
          quiz: "Quiz",
          flashcard: "Flashcard",
          audio: "Audio",
          mindmap: "Mind Map",
          review: "Review",
          exam: "Mini-Test"
        },

        // StudyModeContainer & loading states
        preparing: "Preparing your {{type}}...",
        startingSession: "Starting your study session...",
        exitStudyMode: "Exit Study Mode",

        // Node-type loading messages (rotating)
        lessonLoading1: "Summarizing the key concepts...",
        lessonLoading2: "Highlighting what matters most...",
        lessonLoading3: "Organizing your review notes...",
        lessonLoading4: "Simplifying complex ideas...",
        lessonLoading5: "Building your quick-reference guide...",
        lessonLoading6: "Almost there...",

        quizLoading1: "Generating practice questions...",
        quizLoading2: "Targeting your weak spots...",
        quizLoading3: "Calibrating difficulty level...",
        quizLoading4: "Writing detailed rationales...",
        quizLoading5: "Building your personalized quiz...",
        quizLoading6: "Almost ready...",

        flashcardLoading1: "Creating your flashcards...",
        flashcardLoading2: "Distilling key terms and concepts...",
        flashcardLoading3: "Crafting memorable explanations...",
        flashcardLoading4: "Organizing by topic priority...",
        flashcardLoading5: "Polishing the final cards...",
        flashcardLoading6: "Almost ready...",

        audioLoading1: "Preparing your audio review...",
        audioLoading2: "Structuring the key talking points...",
        audioLoading3: "Optimizing for easy listening...",
        audioLoading4: "Building your study podcast...",
        audioLoading5: "Almost ready to play...",

        mindmapLoading1: "Mapping out the connections...",
        mindmapLoading2: "Identifying core relationships...",
        mindmapLoading3: "Organizing the concept hierarchy...",
        mindmapLoading4: "Designing your visual overview...",
        mindmapLoading5: "Adding the finishing touches...",

        // StudyLessonCard
        lessonTitle: "Quick Review",
        keyPoints: "Key Points",
        loadingLesson: "Loading lesson content...",

        // StudyQuizCard
        quickCheck: "Quick Check",
        // Diagnostic (auto-launched first quiz) — calibration, not assessment
        calibrationTitle: "Quick calibration",
        diagnosticIntro_one: "{{count}} quick question so I can tune your plan — this isn't graded.",
        diagnosticIntro_other: "{{count}} quick questions so I can tune your plan — this isn't graded.",
        notSureYet: "Not sure yet",
        diagnosticDoneTitle: "Plan tuned to you",
        diagnosticDoneBody: "That's all I needed. Your plan now starts where it'll help you most.",
        diagnosticDoneCta: "See my plan",
        // Elapsed-aware loading screen
        loadingTakingLonger: "This one's a little longer than usual — hang tight.",
        loadingStillWorking: "Still going. Longer documents take a bit more thinking — your content is on its way.",
        loadingProgressAria: "Generating your content",
        loadingTakingTooLong: "Taking too long?",
        loadingRetry: "Try again",
        loadingBackToPlan: "Back to my plan",
        // Streaming lessons
        lessonWritingFirstPage: "Writing your first page…",
        lessonWritingNextPage: "Writing next page…",
        // Plan preview: first-node readiness
        firstLessonReady: "Your first lesson is ready",
        firstQuizReady: "Your first quiz is ready",
        firstCardsReady: "Your first cards are ready",
        firstNodePreparing: "Getting your first step ready…",
        // Today's session card
        todaySession: "Today's session",
        aboutMinutes: "~{{min}} min",
        planTuned: "Plan tuned",
        nodesOfSession: "{{done}} of {{total}} done",
        seeFullPlan: "{{count}}-step plan · see all",
        hideFullPlan: "Hide full plan",
        afterThisSession_one: "{{count}} more step after this",
        afterThisSession_other: "{{count}} more steps after this",
        stepN: "Step {{n}}",
        // Dated plan — today's mission
        todayMission: "Today's mission",
        finalPrep: "Final prep",
        examDayReview: "Exam day · final review",
        dayXofY: "Day {{day}} of {{total}}",
        focusPrefix: "Focus:",
        // Session arc — Learn → Practice → Review
        arcLearn: "Learn",
        arcPractice: "Practice",
        arcReview: "Review",
        startMission: "Start mission",
        continueMission: "Continue mission",
        seeWholePlan: "See the whole plan",
        tunedFromAnswers: "Tuned from your onboarding answers",
        // Why today is worth doing — by the student's standing on the topic
        whyExamDay: "Reviewing what you're most likely to miss — nothing new today.",
        whyFinal: "Consolidating what you already half-know is what pays off now.",
        whyUntested: "You haven't been tested on this yet — today gives you a real score on it.",
        whyWeak: "This is one of your weaker areas, so it's where today buys you the most.",
        whyDeveloping: "You're close on this one. Today should tip it over.",
        whyStrong: "A quick pass to keep this one sharp.",
        // Action → outcome
        completeToRaise: "Complete today's mission",
        readinessJump: "{{from}}% → {{to}}%",
        estimatedReadiness: "estimated readiness",
        firstScore: "Today's practice gives you your first readiness score.",
        groundworkToday: "Groundwork today — finishing your plan puts you near {{pct}}% estimated readiness.",
        nowReady: "You're now at {{pct}}% estimated readiness.",
        missionComplete: "Today's mission complete",
        onTrackFor: "You're on track to be ready by {{date}}.",
        everyDayCounts: "Every session closes the gap before {{date}}.",
        comeBackTomorrow: "Nice work — pick it back up tomorrow.",
        tomorrowFocus: "Tomorrow",
        keepGoing: "Keep going anyway",
        upcoming: "Upcoming",
        correct: "Correct!",
        incorrect: "Incorrect",
        correctAnswer: "Correct Answer:",
        learnMore: "Learn more",
        showLess: "Show less",
        loadingRationale: "Loading…",
        rationaleError: "Couldn't load the explanation. Try again?",
        retry: "Retry",
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
        audioIntroPrompt: "Want to hear this lesson, or skip ahead?",
        audioIntroListen: "Listen",
        audioIntroSkip: "Skip",
        audioIntroDuration: "~{{duration}} min listen",
        creatingAudioLesson: "Creating your audio lesson...",
        generatingAudioProgress: "Generating audio... {{progress}}%",
        convertingToSpeech: "Converting to speech...",
        failedToGenerate: "Failed to generate audio",
        retry: "Retry",

        // Diagnostic Quiz
        diagnosticEyebrow: "Let's see where you stand",
        diagnosticTitle: "5 quick questions to customize your path",
        questionOf: "Question {{n}} of {{total}}",
        baselineTitle: "Your baseline is set!",
        baselineSubtitle: "Your study path is being personalized...",

        // Quiz Mastery Summary
        quizComplete: "Quiz Complete",
        yourScore: "Your Score",
        improvementPositive: "+{{n}}% improvement from your baseline",
        improvementNegative: "{{n}}% below your baseline — keep practicing",
        improvementNeutral: "Same as your baseline — consistency is key",
        baselineMark: "Your baseline",
        reviewThese: "To review:",

        // Adaptive Flashcard Toasts
        adaptiveSpeed: "You're getting these fast! Flagging as strong.",
        adaptiveMode: "Adaptive Mode: Narrowing down on {{topic}}",

        // Common
        continueBtn: "Continue",
        loading: "Loading...",

        // Celebration messages
        wayToGo: "Way to go!",
        fantastic: "Fantastic!",
        keepItUp: "Keep it up!",
        youreOnFire: "You're on fire!",
        lessonComplete: "Lesson complete!",
        amazingWork: "Amazing work!",
        youDidIt: "You did it!",
        totalXP: "TOTAL XP",
        perfect: "PERFECT!",
        speedy: "SPEEDY",
        claimXP: "CLAIM XP",

        // Milestone messages - context-aware based on performance
        // Great performance (80%+)
        milestoneGreat1: "You're doing great!",
        milestoneGreat2: "Excellent progress!",
        milestoneGreat3: "Keep up the momentum!",
        // Okay performance (50-79%)
        milestoneOkay1: "You're making progress!",
        milestoneOkay2: "Keep going, you got this!",
        milestoneOkay3: "Stay focused!",
        // Struggling (<50%)
        milestoneStruggle1: "You can do this!",
        milestoneStruggle2: "I admire your perseverance!",
        milestoneStruggle3: "Don't give up!",
        milestoneStruggle4: "Every attempt makes you stronger!",

        // "I don't know" button
        dontKnow: "I don't know",
        dontKnowReviewNote: "This one will come back for review.",
        dontKnowMessages: [
          "Honesty is the best study strategy!",
          "That's okay! This is exactly how learning works.",
          "No shame in that \u2014 let's learn this together!",
          "Nothing wrong with 'not yet'! You'll get there.",
          "We all start somewhere \u2014 let's build from here!",
          "Smart move! Better to know what you don't know.",
          "Knowing what you don't know is half the battle!",
          "Respect for the honesty! Let's review this one.",
          "Brave choice! Let's turn this into knowledge.",
          "Self-awareness is a superpower. Seriously.",
          "Hey, at least you didn't guess! Points for integrity.",
          "Plot twist: admitting it is the first step to nailing it!",
          "Your future self will thank you for flagging this.",
          "Better to say 'I don't know' than to fake it on the NCLEX!",
          "No guessing games here \u2014 just real learning.",
          "We'll circle back to this one \u2014 you've got this!",
          "That's the spirit! Review round will handle this.",
          "Every 'I don't know' today is an 'I got this' tomorrow!",
          "This is going straight to your review queue. We gotchu.",
          "Flagged and noted! We'll make sure you learn this one.",
          "No worries! Rome wasn't built in a day.",
          "One step at a time \u2014 you're doing great!",
          "It's okay not to know everything... yet!",
          "Learning is a journey, not a sprint. Let's keep going!",
          "Don't stress \u2014 that's literally why we have review rounds!",
        ],

        // Review transition
        timeToReview: "Time to Review!",
        reviewMessage: "You have {{count}} card to review. Let's go over them again!",
        reviewMessage_plural: "You have {{count}} cards to review. Let's go over them again!",
        reviewQuestionMessage: "You have {{count}} question to review. Let's try again!",
        reviewQuestionMessage_plural: "You have {{count}} questions to review. Let's try again!",
        startReview: "Let's Go!",
        finishLesson: "Finish",
        close: "Close",

        // Streaming indicators
        generatingQuestions: "Generating questions...",
        questionsWillAppear: "Questions will appear as they are ready",
        generatingFlashcards: "Generating flashcards...",
        cardsWillAppear: "Cards will appear as they are ready",
        loadingMore: "Loading questions ({{current}}/{{total}})...",
        loadingMoreCards: "Loading cards ({{current}}/{{total}})...",

        // Insights & performance tracking
        insights: "Insights",
        yourInsights: "Your Insights",
        viewInsights: "View your progress insights",
        loadingInsights: "Loading...",
        noInsightsYet: "No data yet — complete a quiz or flashcard set to see your insights.",
        strong: "Strong",
        developing: "Developing",
        weak: "Needs work",
        retake: "Retake",
        quizAccuracy: "Quiz",
        flashcardAccuracy: "Flashcards",
        toReview: "To review:",
        notedStrength: "Noted as strength",
        notedReview: "Noted for review",

        // Review confirmation
        reviewNode: "Review this lesson?",
        reviewNodeDescription: "You've already completed this lesson. Would you like to review it again?",
        earnXpReview: "for reviewing",
        reviewNow: "Review Now",

        // Phase 2 — personalized study based on insights
        sectionLabel: "SECTION {{number}}",
        basedOnInsights: "Based on Your Insights",
        generatingPlan: "Analyzing your results...",
        targetedLesson: "Strengthen Weak Areas",
        masterConcepts: "Master Key Concepts",
        proveKnowledge: "Prove Your Knowledge",
        builtFromResults: "Built from your results",
        adaptiveFocus: "FOCUS",
        sessionsAdded: "{{count}} sessions added to your path",

        // StudyPlanOverview — section cards, milestones, sidebar
        done: "Done",
        of: "of",
        nodes: "nodes",
        nodesDone: "nodes done",
        review: "Review",
        miniTest: "Mini-Test",
        needsWork: "Needs work",
        passed: "Passed",
        yourProgress: "Your Progress",
        viewAll: "View all",
        buildingPersonalizedPlan: "Building your personalized review plan...",
        tapToGenerateReview: "Tap to generate your review plan",
        noNodesYet: "No study plan generated yet.",

        // Readiness Snapshot — Phase 2 entry card
        testReadiness: "Test readiness",
        confidence: "confidence",
        gapsToClose: "Gaps to close before test day",
        lockedIn_one: "{{count}} topic locked in",
        lockedIn_other: "{{count}} topics locked in",
        estimateMin: "~{{min}} min",
        buildFocusedReview: "Build my focused review",
        buildPracticeRound: "Build my practice round",
        buildingFocusedReview: "Building your focused review",
        readinessNoData: "Let's lock in what you've learned",
        readinessNoDataSub: "A short mixed practice round to consolidate everything",
        readinessAllStrong: "You're solid across the board",
        readinessAllStrongSub: "A few mixed-format quizzes to keep it sharp",
        readinessMixed: "Strong start. Let's close these gaps.",
        readinessBuildUp: "Let's build your foundation before test day",
        readinessGapsSub: "We'll target the spots most likely to surprise you on test day",
        narrationReview: "Reviewing your results",
        narrationAnalyze: "Mapping accuracy by topic",
        narrationFinding: "Picking the spots that matter most",
        narrationBuilding: "Building your targeted nodes",
        readinessSoFar: "Readiness so far",
        keepGoingCta: "Keep going",
        nodesUntilReview_one: "{{count}} more node",
        nodesUntilReview_other: "{{count}} more nodes",
        basedOnQuestions_one: "Based on {{count}} answered question",
        basedOnQuestions_other: "Based on {{count}} answered questions",
        readinessUntested_one: "{{count}} topic not measured yet",
        readinessUntested_other: "{{count}} topics not measured yet",
        readinessUntestedSub: "Your confidence will sharpen as you cover more",
        readinessJustStarted: "Your test readiness starts here",
        readinessFirstQuiz: "Take your first quiz to start measuring how ready you are",
        // Starter ring (no quiz data yet) — replaces the harsh "0% confidence"
        letsBegin: "Let's begin",
        readyToBegin: "Ready to begin",
        gapsAndUntested: "Topics to cover before test day",
        notMeasuredYet: "Not measured",

        // StudyMindmapCard
        conceptMap: "Concept Map",
        buildingConceptMap: "Building your concept map...",
        allConceptsReviewed: "All concepts reviewed!",
        back: "Back",
        nodeProgress: "{{current}} / {{total}}",
        nextConcept: "Next Concept →",
        finishReview: "Finish Review →",

        // StudyFlashcardCard extra
        loadingCard: "Loading card..."
      },

      // WarmUrgencyDashboard — empathic exam dashboard
      warmUrgency: {
        yourExam: "Your exam",
        nodesDone_one: "{{count}} step done",
        nodesDone_other: "{{count}} steps done",
        topicsLocked: "{{count}} of {{total}} topics locked in",
        yourStudyJourney: "Your study journey",
        ofTotal: "of",
        journeyHeadline_one: "You've tackled {{count}} question so far",
        journeyHeadline_other: "You've tackled {{count}} questions so far",
        journeyNoTopics: "A few questions in — keep going.",
        journeyAllLocked: "You've locked in all {{total}} topics — you're ready.",
        journeyOneMore: "You've locked in {{completed}} of {{total}} topics — one more session gets you there.",
        journeySome: "You've locked in {{completed}} of {{total}} topics — plenty of time to cover the rest.",
        nudgeUrgent: "One focused session on {{topic}} could lock it in before tomorrow.",
        nudgeUrgentGeneric: "A short focused session today could lock things in before tomorrow.",
        nudgeModerate: "You've got time — a 20-min focus session today keeps your momentum going.",
        nudgeCalm: "You're in a good position. Consistent daily sessions are what turn into confidence on exam day.",

        // Dated plan — countdown states
        daysUntilExam_one: "{{count}} day until your exam",
        daysUntilExam_other: "{{count}} days until your exam",
        examTomorrow: "Your exam is tomorrow",
        examToday: "Your exam is today",
        nudgeExamDay: "Don't learn anything new today — a light review of what you've covered is enough.",
        nudgeExamDayReady: "Today's the day. Nothing new now \u2014 one calm pass over {{topic}}, then trust the work you've put in.",
        nudgeExamDayTopic: "Today's the day. Nothing new now \u2014 one calm pass over {{topic}} and leave the rest.",
        nudgeTomorrowReady: "Tomorrow \u2014 and you've got a real base. Tonight is for locking in {{topic}}, not starting anything new.",
        nudgeTomorrowBehind: "Tomorrow. Don't spread yourself thin \u2014 get {{topic}} solid and let the rest go. One topic properly beats five half-read.",
        nudgeTomorrowGeneric: "Tomorrow. Go back over the things you already half-know \u2014 that is where tonight actually pays off.",
        nudgeTwoDaysReady: "Two days. That's enough to make {{topic}} properly solid \u2014 it's the one that moves your score most.",
        nudgeTwoDaysBehind: "Two days, so we go narrow: {{topic}} today, review tomorrow. Chasing everything is how both days disappear.",
        nudgeTwoDaysGeneric: "Two days. Go narrow \u2014 a couple of topics made solid will do more than a pass over everything.",
        nudgeFocus: "{{count}} days out. Enough time to fix {{topic}} properly, and that is what today is for.",
        nudgeFocusBehind: "{{count}} days out, and the plan's been reshaped around them. {{topic}} is today.",
        nudgeFocusGeneric: "Exam week — today's session goes at your biggest gaps first.",
        nudgeRebalanced: "We've rebalanced the rest of your plan around the days you have left.",
        nudgePast: "That exam date has passed — finish the plan whenever suits you, or start a new one.",
        readinessLabel: "Readiness",
        readinessEstimated: "estimated",
        readinessTooltip: "Estimated from {{count}} practice questions across your topics. Topics you have not been tested on yet count as zero.",
        ctaUrgentTitle: "Quick review: 10 key questions",
        ctaUrgentSub: "~15 min · focused on {{topic}}",
        ctaUrgentSubGeneric: "~15 min · keep it sharp",
        ctaModerateTitle: "Focus session: {{topic}}",
        ctaModerateTitleGeneric: "Focus session",
        ctaModerateSub: "~20 min · build on what you already know",
        ctaCalmTitle: "Continue studying",
        ctaCalmSub: "Pick up where you left off",
        lockedInBadge: "Locked in",
        readyToExplore: "Ready to explore",
        // Completed-plan variants — shown when every node is done
        completeAllLocked: "You've made it through your plan and locked in all {{total}} topics — you're ready.",
        completePartial: "You've made it through your plan — {{completed}} of {{total}} fully locked in. A practice round will fold in the rest.",
        nudgeCompleteAllLocked: "Plan's done and topics are locked in — a practice round keeps it sharp.",
        nudgeCompletePartial: "You've made it through the plan — one practice round can solidify everything.",
        ctaCompletePractice: "Build my practice round",
        ctaCompleteFocused: "Build my focused review",
        ctaCompleteSub: "~{{min}} min · pull it all together",
        ctaCompleteSubGeneric: "Pull it all together",
        couldUseRefresh: "One more pass"
      },

      // NodeTransition — post-node decision screen
      transition: {
        // Exit
        exit: "Exit session",

        // Diagnosis — quiz
        quizDone: "Quiz Complete",
        quizExcellent: "{{correct}} of {{total}} on {{topic}}. You crushed it.",
        quizGood: "{{correct}} of {{total}} on {{topic}}. {{missed}} miss{{missed, plural, one {} other {es}}} — close to solid.",
        quizMixed: "{{correct}} of {{total}} on {{topic}}. Some gaps worth tightening.",
        quizTough: "{{correct}} of {{total}} on {{topic}}. This one was tough — that's ok, it means we found what to work on.",

        // Diagnosis — exam
        examDone: "Mini-Test Complete",
        examExcellent: "{{correct}} of {{total}} on the {{topic}} exam. Excellent — you're exam-ready.",
        examGood: "{{correct}} of {{total}} on the {{topic}} exam. {{missed}} to review before you're solid.",
        examMixed: "{{correct}} of {{total}} on the {{topic}} exam. Some concepts need more work.",
        examTough: "{{correct}} of {{total}} on the {{topic}} exam. This section needs review — let's strengthen it.",

        // Diagnosis — flashcard
        flashcardDone: "Flashcards Complete",
        flashcardExcellent: "{{mastered}} of {{total}} mastered on {{topic}}. Sharp.",
        flashcardGood: "{{mastered}} of {{total}} mastered on {{topic}}. {{review}} needed another look.",
        flashcardTough: "{{mastered}} of {{total}} mastered on {{topic}}. These concepts could use more time.",

        // Diagnosis — lesson, audio, mindmap
        lessonDone: "You covered {{topic}}.",
        audioDone: "You listened to {{topic}}.",
        audioSkipped: "You skipped the audio for {{topic}}.",
        mindmapDone: "You explored {{visited}} of {{total}} concepts in {{topic}}.",
        mindmapDoneSimple: "You explored the concept map for {{topic}}.",

        // Suggestions
        suggestNext: "Up next: {{type}} on {{label}}.",
        suggestContinue: "You're solid here. Next up is {{type}} on {{label}}.",
        suggestEither: "You could drill the gaps before moving on, or press ahead. Your call.",
        suggestRemediate: "A focused practice session could help lock these in.",

        // Score bar
        correct: "Correct",
        mastered: "Mastered",

        // Missed concepts
        toReview: "To review:",
        cardsToReview: "Cards that needed another look:",

        // Action buttons
        drillGaps_one: "Review {{count}} missed concept",
        drillGaps_other: "Review {{count}} missed concepts",
        practiceMore: "Practice more",
        moveOn: "Move on to {{topic}}",
        continue: "Continue",
        building: "Building your practice...",
        loadingNext: "Loading your next step…",
        sessionDone: "You finished {{topic}}.",

        // Remediation labels
        remediationLesson: "Review: {{topic}}",
        remediationFlashcard: "Practice: {{topic}}",
        remediationQuiz: "Focused drill: {{topic}}",

        // Coach / custom request
        orCustomize: "Or tell the coach what you want",
        placeholder: "e.g. \"Focus on side effects\" or \"Make it harder\"",
        goBack: "Go back",
        soundsGood: "Sounds good",
        customError: "Something went wrong. Try again or continue to the next step.",

        // Example chips — "Practice more" lives here as a chip, not a top-level button
        chipPracticeMore: "Practice more",
        chipHarder: "Make it harder",
        chipFlashcards: "Just flashcards",
        chipExplain: "Explain what I missed",
        chipQuizMe: "Quiz me on this",
        chipGoDeeper: "Go deeper",
        chipSkipAhead: "Skip ahead",

        // ── End-of-session redesign (D1 retention) ──
        // Identity-based headers by score bucket
        headerMastered: "Knowledge locked in",
        headerSolid: "Solid session",
        headerGaps: "Working the hard stuff",
        headerTough: "Tough one — you showed up",

        // Identity sentences — reinforce growth, not winning
        identityMastered: "You're building mastery on {{topic}}.",
        identityMasteredFc: "You're building mastery on {{topic}}.",
        identitySolid: "You're sharpening your reasoning on {{topic}}.",
        identitySolidFc: "You're sharpening your recall on {{topic}}.",
        identityGaps: "You're closing gaps on {{topic}}.",
        identityTough: "You're tackling the part most students avoid.",

        // Score line — extra context after "{n} of {total}."
        scoreOf: "of",
        tailSolid: "{{count}} to firm up.",
        tailGaps_one: "{{count}} concept to revisit.",
        tailGaps_other: "{{count}} concepts to revisit.",
        tailTough: "{{topic}} is worth another pass.",
        tailKeepBuilding: "Keep building.",
        closerToReady: "closer to ready",

        // Recap (retention anchor) — REQUIRED on every session
        recapReady: "Your next recap is ready:",
        recapDetail: "4 min on what you just learned, before you forget it.",

        // Next-step CTA
        nextStepIs: "Your next step is:",
        keepGoing: "Keep going →",
        morePractice: "More questions on this topic",

        // Frictionless exit
        doneForToday: "Save progress & return tomorrow",

        // Farewell card — shown after the user taps the exit link.
        // Calm send-off, no commitment ask, no scheduling.
        farewellTitle: "Progress saved.",
        farewellBody1: "Your brain is now deciding what stays and what fades.",
        farewellBody2: "Tomorrow's 4-minute recall will reinforce the concepts that matter most.",
        farewellFooter: "Your streak continues tomorrow.",
        farewellNextLabel: "Next time",
        remindMe: "Remind me tomorrow",
        remindOn: "I'll remind you tomorrow",
        remindBlocked: "Reminders are blocked in your browser settings",
        farewellClose: "Close",

        // ── Post-node readout (see nodeReadout.js) ──
        // Headline: what happened, in the tutor's voice. One per state, never
        // one for all of them — a header that never changes is a header nobody
        // reads.
        hConfirmed: "You just proved it.",
        hPattern: "I found something interesting.",
        hImproving: "You're getting better at {{topic}}.",
        hMastered: "That's locked in.",
        hSolid: "You're getting the hang of this.",
        hGaps: "This one exposed a gap worth fixing.",
        hTough: "Now I know what to work on with you.",

        // Score caption — what the number means, not the number again
        capImproving: "Up from {{pct}}% on this topic before today.",
        capPattern: "Your misses here aren't random.",
        capMastered: "Nothing left to firm up here.",
        capMasteredFc: "Every card, first time.",
        capSolidOne: "One thing to firm up.",
        capSolid: "{{count}} to firm up.",
        capGaps_one: "{{count}} concept to revisit.",
        capGaps_other: "{{count}} concepts to revisit.",
        capTough: "Worth another pass before you move on.",

        // "Not enough evidence yet" — says what's being looked for and what
        // would settle it, instead of apologising for having nothing
        learningLead: "I'm learning how you think",
        noteLead: "What I wrote down",
        learningBody: "I've been through all {{count}} of your answers. I'm watching how you approach a question, not just whether you got it right.",

        // The takeaway — one line, the hero of the transition screen. The
        // label follows the note's mode: "focus on" is wrong for a clean run
        // and wrong again for a total blank.
        takeawayFocus: "Focus on",
        noticedLead: "What I noticed",
        takeawayClean: "Locked in",
        takeawayBlank: "Start here",
        // The alternative action, offered as an aside rather than a rival card
        lockInFirst: "Want to lock in that weak spot first?",
        reviewMins: "Review · 4 min",

        // The note on a node with no score (lesson, audio, concept map).
        // The two "linked" lines label concepts matched server-side against
        // her ledger — they are the evidence for the note above them, so
        // they state a fact about her record and never praise her for it.
        noteLoading: "Looking at what this covered for you…",
        linkedStruggle: "still costing you: “{{concept}}”",
        linkedFixed: "you used to miss “{{concept}}”",
        learningPromise: "A few more questions and I should have something specific for you.",
        learningPromiseN_one: "{{count}} more of these and I should have something specific for you.",
        learningPromiseN_other: "{{count}} more of these and I should have something specific for you.",

        // The recommendation
        whatIdDo: "Here's what I'd do next",
        skillPriority: "prioritization",
        skillMulti: "select-all-that-apply",
        skillGeneric: "these",
        recTestTitle: "One question, built around {{skill}}",
        recTestWhy: "If I'm right, you'll get it by changing how you read it — not by knowing more.",
        recFixTitle: "{{count}} {{skill}} questions",
        recFixWhy: "Aimed at the exact pattern I just described — not at the topic.",
        recMissedTitle: "{{count}} questions on what you missed",
        recMissedWhy: "Same concepts, asked a different way.",
        recWalkTitle: "One worked example first",
        recWalkWhy: "Let's slow this one down. I'll walk you through it before testing you again.",
        recHarderTitle: "A harder version of {{topic}}",
        recHarderWhy: "Same concepts inside a full patient scenario — that's where they actually get tested.",
        recMoreTitle: "More on {{topic}}",
        recMoreWhy: "You've finished the plan for this one — let's keep it warm.",
        recNextWhy: "You're solid here — this is what it builds into.",
        recNextWhyConfirmed: "Carry that same approach into the next one.",
        recNextFallback: "The next step in your plan",

        // CTAs — each says what the button will actually do
        ctaTest: "Test my theory →",
        ctaFix: "Fix this →",
        ctaWalk: "Show me how →",
        ctaHarder: "Challenge me →",
        ctaKeep: "Keep building →",
        metaOneQuestion: "1 question · ~2 min",
        metaDrill: "{{count}} questions · ~5 min",
        metaLesson: "Lesson · ~5 min",
        metaChallenge: "2 scenarios · ~6 min",
        drillLabel: "Targeted practice: {{skill}}",
        challengeLabel: "Harder: {{topic}}",

        // Secondary review row — retention, offered without competing
        beforeYouMoveOn: "Before you move on",
        recapDetailShort: "4 min · lock in what you just learned",
        review: "Review →",
        recapLabel: "Recap: {{topic}}",
        recapReason: "Lock in what you just learned",

        // Coach link
        askFor: "Ask for something else"
      },

      // Exam — mini-test at end of each section
      drill: {
        // Exam Drill — the adaptive examiner. Deliberately plain, exam-room
        // language: no encouragement, no exclamation marks. The checkpoint is
        // the only place the tone warms up.
        preparing: "Preparing your first question…",
        // The one question asked on the way into a drill, when nothing else
        // in the app has established an exam date yet.
        dateEyebrow: "Before we start",
        dateQuestion: "When is your exam?",
        dateWhy: "It sets the pace, and it is the countdown you will see each time you come back.",
        dateSkip: "I do not have a date yet",
        // The drill counts questions ANSWERED, cumulatively — blocks are our
        // bookkeeping, not hers. The block shows up as the checkpoint
        // countdown instead, which is the part she has a reason to care about.
        questionNumber: "Question {{n}}",
        checkpointIn: "Checkpoint in {{count}}",
        checkpointNext: "Checkpoint after this one",
        next: "Next question",
        loadingNext: "Writing your next question…",
        // Rotating status while the next question generates. Not filler — the
        // drill really does read the answer, choose a spec, then write.
        writing1: "Reading what you just answered…",
        writing2: "Deciding what to ask next…",
        writing3: "Writing the question…",
        writing4: "Checking the rationale…",
        writingSlow: "Taking a moment longer on this one — it is worth getting right.",
        // Opening a drill: no previous answer to read, so its own copy.
        startup1: "Opening your material…",
        startup2: "Choosing where to start…",
        startup3: "Writing your first question…",
        seeCheckpoint: "See where you stand",
        untilCheckpoint: "{{count}} until your checkpoint",
        correct: "Correct",
        incorrect: "Not quite",
        exit: "Finish for now",
        retry: "Try again",
        generationFailed: "That question would not generate. Try again in a moment.",
        notFound: "That drill is not available.",
        checkpointEyebrow: "Checkpoint",
        gapHardLabel: "SATA & case studies",
        // ── Checkpoint narration ──────────────────────────────────────
        // Spoken beats, typed one after another. Written as speech: no
        // headings, no scores, no exclamation marks. See
        // checkpointNarration.js for the ordering rules.
        beatAck: "Okay — {{count}} questions in. That is already enough to see something.",
        beatAckMany: "Right — {{count}} questions in. I have a clear picture now.",
        beatStrongOne: "You have properly shown me {{topics}} — that one is yours.",
        beatStrongMany: "You have properly shown me these: {{topics}}.",
        beatFormatGap: "Here is the thing, though. You know this material — it is the format catching you out. {{mcq}}% on multiple choice, {{hard}}% the moment it turns into select-all or a case study.",
        beatProvisional: "I would not call {{topics}} safe yet — you have only met that as multiple choice, which is the easy version.",
        beatWeak: "Where it actually falls apart is {{topics}}.",
        beatInconsistent: "{{topics}} is not settled either — right sometimes, wrong sometimes.",
        beatMisconception: "And you keep coming back to the same idea: {{concept}}.",
        beatMisconceptionUnnamed: "The same misunderstanding has caught you more than once now.",
        beatFirstHardWin: "One thing did change in there, though: your first {{format}} answered fully right. That is the first evidence these are doable for you at all.",
        beatStruggling: "Here is the straight version, though. Too much of this is going wrong to blame the format — the material itself has not landed yet, and that is the part we work on.",
        beatNothingYet: "Nothing has fallen over yet — but that is not the same as being ready. Let us keep going until it tells us something.",
        beatRecFormat: "So that is what we fix. More {{format}} next — that is where the marks are going.",
        beatRecWeak: "Next we stay on {{topic}} until it holds. This is a real gap, not a bad run.",
        beatRecMisconception: "Next few are aimed straight at that.",
        beatRecInconsistent: "Let us settle {{topic}} one way or the other.",
        beatRecProveIt: "Next I test {{topic}} properly, the way your exam will.",
        beatRecNewTopic: "Nothing left to prove here — we move to {{topic}}.",
        beatRecFoundations: "So we go back to the base of it — plainer questions, one idea at a time, until I can see which parts are actually missing.",
        beatRecBroaden: "We widen out across the rest of your material.",
        continueDrilling: "Keep drilling",
        // Resume bar shown in place of the chat composer on a drilled chat.
        keepDrilling: "Keep drilling",
        inProgress: "Drill in progress",
        readyEyebrow: "Drill ready",
        notStartedYet: "Nothing answered yet",
        startDrilling: "Start the drill",
        coveredSoFar: "Covered so far",
        moreTopics: "+{{count}} more",
        examToday: "Your exam is today",
        examTomorrow: "Your exam is tomorrow",
        examInDays: "{{count}} days until your exam",
        answeredSoFar: "{{count}} questions answered so far",
        outOfQuestions: "You have used your free questions for this week.",
        unlockUnlimited: "Unlock unlimited drilling",
        remainingQuestions: "{{count}} questions left this week"
      },
      exam: {
        configTitle: "Mini-Test",
        configDescription: "Configure your mini-test to match how your real exam will look.",
        questionTypes: "Question types",
        typeMCQ: "Multiple Choice",
        typeMCQDesc: "1 correct answer",
        typeSATA: "Select All That Apply",
        typeSATADesc: "Multiple correct answers",
        typeCaseStudy: "Case Study",
        typeCaseStudyDesc: "NGN clinical scenarios",
        questionCount: "Number of questions",
        timeEstimate: "~{{minutes}} min",
        simulateTiming: "Simulate exam timing",
        timerHint: "Countdown per question to practice pacing",
        customInstructions: "Additional instructions",
        optional: "optional",
        customPlaceholder: "e.g. \"My professor focuses on prioritization\" or \"Include drug calculations\"",
        graceNote: "You have {{remaining}} free questions left right now and this mini-test needs {{count}}. We’ll build the full test anyway — your success comes first.",
        graceUpgrade: "Free questions refill every week · Go unlimited with Pro",
        startExam: "Start Mini-Test",
        generating: "Building your mini-test...",
        generatingHint: "Generating {{count}} questions with mixed formats",
        loading1: "Crafting clinical scenarios...",
        loading2: "Selecting key nursing concepts...",
        loading3: "Building answer rationales...",
        loading4: "Mixing question formats...",
        loading5: "Reviewing for accuracy...",
        loading6: "Pulling from your study material...",
        loading7: "Creating realistic patient situations...",
        loading8: "Writing detailed explanations...",
        loading9: "Calibrating difficulty level...",
        loading10: "Polishing the final questions...",
        loading11: "Almost ready...",
        examBadge: "EXAM",
        questionProgress: "{{current}} / {{total}}",
        nextQuestion: "Next Question",
        finishExam: "Finish Exam",
        complete: "Mini-Test Complete",
        scoreDetail: "{{correct}} of {{total}} correct"
      }
    }
  },

  fr: {
    translation: {
      // Upgrade / monetization modal
      upgrade: {
        title: "Étudie sans limites",
        titleNclex: "Réussis ton NCLEX avec de la marge",
        titleCourse: "Cartonne à ton examen",
        titleBlocked: "N'arrête pas maintenant. 🔥",
        titlePlanBlocked: "Tu as d'autres examens à préparer.",
        body: "Maîtrise chaque sujet, repère tes points faibles plus vite et arrive prêt(e) à ton examen.",
        bodyBlocked: "Tu as atteint ta limite de pratique gratuite. Passe en Pro et continue à préparer ton examen.",
        bodyExam: "Ton examen est {{when}} — ne laisse pas une limite de questions freiner ta dernière ligne droite.",
        bodyBlockedExam: "Tu as atteint ta limite de pratique gratuite — et ton examen est {{when}}. Passe en Pro et continue ta préparation.",
        examToday: "aujourd'hui",
        examTomorrow: "demain",
        examInDays: "dans {{days}} jours",
        examIs: "Ton examen est {{when}}",
        nextBatchInline: "Continuer gratuitement dans {{time}} (prochaine série)",
        nextPlanInline: "Continuer gratuitement dans {{time}} (prochain plan)",
        bodyPlan: "Pro donne à chaque cours que tu suis son propre plan — pas seulement aux premiers.",
        bodyPlanBlocked: "Tu as déjà créé {{count}} plans d'étude ce mois-ci. Donne à chaque cours son propre plan personnalisé avec Pro.",
        bodyPlanBlockedExam: "Tu as déjà créé {{count}} plans d'étude ce mois-ci — et ton examen est {{when}}. Donne à chaque cours son propre plan personnalisé avec Pro.",
        // Contexte + élan
        wereStudying: "Tu pratiquais",
        questionsDone: "questions complétées",
        momentumNudge: "Garde ton élan !",
        // L'offre
        proBadge: "PRO",
        excelTitle: "Étudie pour exceller, pas juste pour passer.",
        out: {
          practice: "Pratique jusqu'à ce que ça clique",
          practiceSub: "Aucune limite, aucune attente",
          plans: "Un plan pour chaque examen",
          plansSub: "Bâti autour de la date de ton examen",
          uploads: "Tes notes deviennent des questions",
          uploadsSub: "Étudie ce qui est vraiment à ton examen",
          faster: "Sois prêt(e) à l'examen plus tôt",
          fasterSub: "Pratique ce que tu maîtrises le moins",
          weakSpots: "Transforme tes faiblesses en forces",
          weakSpotsSub: "On les suit pour toi",
          nextStep: "Sache quoi étudier ensuite",
          nextStepSub: "Ne perds plus une seule séance"
        },
        // Prix + CTA
        perMonth: "/ mois",
        cancelAnytime: "Annule à tout moment. Sans engagement.",
        // Le symbole est écrit en toutes lettres ici : "$50" se dit "50 $ US".
        billedYearly: "Facturé {{amount}} $ US par année. Annule à tout moment.",
        savePct: "Économise {{pct}} %",
        withAnnual: "avec l'annuel",
        switchMonthly: "Passer au mensuel",
        ctaContinue: "Continuer d'étudier avec Pro",
        ctaPlans: "Débloquer tous les plans avec Pro",
        or: "ou",
        notNow: "Plus tard",
        // Déjà Pro
        proTitle: "Tu es en Pro",
        proBody: "Pratique, téléversements et révisions illimités — tu as tout. Gère ton forfait, mets à jour ton paiement ou annule à tout moment.",
        manage: "Gérer l'abonnement",
        manageSub: "Changer de forfait, mettre à jour la carte ou annuler",
        portalOpening: "Ouverture…",
        close: "Fermer"
      },
      usageBadge: {
        title: "Questions restantes — recharge chaque semaine",
        blockedTitle: "Plus de questions — réinitialisation bientôt, ou passe en Pro pour éviter l'attente",
        resetsIn: "Réinitialisation dans {{time}}",
        remaining: "{{remaining}}/{{limit}} questions"
      },
      usagePanel: {
        tooltip: "Questions utilisées — recharge chaque semaine",
        upgradeTitle: "Passer à Pro",
        upgrade: "Devenir Pro",
        proUnlimited: "Pro · Illimité",
        manage: "Gérer",
        manageTitle: "Gérer ou annuler ton abonnement"
      },
      account: {
        title: "Compte",
        close: "Fermer",
        rowTitle: "Compte et abonnement",
        noEmail: "Connecté(e)",
        planPro: "Pro",
        planFree: "Forfait gratuit",
        planFreeShort: "Gratuit",
        subscribed: "Abonné(e)",
        notSubscribed: "Non abonné(e)",
        proDetail: "Questions, téléversements et révisions illimités.",
        freeDetail: "{{used}} questions sur {{limit}} utilisées cette semaine.",
        freeBlocked: "Plus de questions — prochaine recharge dans {{time}}.",
        upgrade: "Passer à Pro",
        upgradeShort: "Devenir Pro",
        manage: "Gérer mon abonnement",
        manageHint: "Change de forfait, mets à jour ta carte ou annule — via le portail sécurisé Stripe.",
        portalOpening: "Ouverture…",
        signOut: "Se déconnecter"
      },
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
        recommended: "Recommandé",
        studyPlanStartsHere: "Prépare ton examen",
        uploadWeHandle: "Importe tes notes et on te crée un plan d'étude personnalisé.",
        uploadOrPaste: "Importe ou colle tes notes. On s'occupe du reste.",
        uploadMyNotes: "Importer mes notes",
        pasteMyNotes: "Coller mes notes",
        examPasteCta: "Coller tes notes",
        // Empty-state CTA card (multi-step "Prépare ton examen")
        prepareForExam: "Étudier pour l'examen",
        // Exam Drill — la seconde porte depuis l'état vide.
        drillTagline: "Déjà révisé ? Passe le plan et trouve tes lacunes.",
        drillCta: "Interroge-moi sur mes notes",
        pathTitle: "Sur quoi veux-tu travailler aujourd'hui ?",
        pathSub: "Choisis ta voie. On te rejoint là où tu en es.",
        planCardTitle: "Suivre ton plan d'étude",
        planCardDesc: "Un plan personnalisé, étape par étape, construit à partir de tes notes pour maîtriser la matière.",
        planCardNote: "Idéal pour construire tes connaissances sur la durée",
        drillCardTitle: "Trouver mes points faibles",
        drillCardDesc: "Fais-toi challenger avec des questions difficiles tirées de tes notes et vois ce qu'il te reste à travailler.",
        drillCardCta: "Tester ma préparation",
        drillCardNote: "Idéal pour un bilan rapide et la préparation à l'examen",
        newBadge: "Nouveau",
        prepareTagline: "Un plan d'étude personnalisé bâti à partir de tes notes",
        howToAddNotes: "Comment veux-tu ajouter tes notes ?",
        uploadShort: "Importer",
        pasteShort: "Coller",
        back: "Retour",
        // Input-row button tooltips
        tooltipAttachFile: "Joindre du matériel d'étude — PDF, diapos, photos",
        tooltipFilesEmpty: "Aucun fichier — tes téléversements apparaîtront ici",
        tooltipFilesCount_one: "{{count}} fichier dans ce chat — ouvrir la bibliothèque",
        tooltipFilesCount_other: "{{count}} fichiers dans ce chat — ouvrir la bibliothèque",
        tooltipVoiceDictate: "Dicte ton message au lieu de taper",
        tooltipVoiceStop: "Arrêter et transcrire",
        tooltipVoiceTranscribing: "Transcription…",
        pasteNotesTitle: "Colle tes notes",
        pasteNotesSubtitle: "Copie et colle ton contenu d'étude ci-dessous",
        pasteNotesPlaceholder: "Colle ou écris tes notes ici...",
        startStudying: "Commencer à étudier",
        characters: "caractères",
        progressSaved: "progression sauvegardée",
        copy: "Copier",
        copied: "Copié",
        streamError: "Une erreur est survenue et aucune réponse n'a été reçue.",
        timeoutError: "Cette réponse n'est jamais arrivée. Rien n'est perdu — réessaie.",
        retry: "Réessayer",
        copyMessageAria: "Copier le message",
        copyTooltip: "Copier",
        rewrite: "Reformuler",
        rewriting: "Reformulation…",
        rewriteAria: "Reformuler le message",
        rewritingAria: "Reformulation en cours",
        rewriteTooltip: "Reformuler dans un style plus naturel",
        rewritingTooltip: "Reformulation…",
        rewritten: "Reformulé",
        rewrittenAria: "Version reformulée",
        copyRewrite: "Copier la reformulation",
        discardRewrite: "Annuler",
        discardRewriteAria: "Annuler la reformulation",
        rewriteFailed: "La reformulation a échoué. Veuillez réessayer.",
        ratingGroupAria: "Évaluer cette réponse",
        ratingHelpful: "Utile",
        ratingHelpfulAria: "Marquer cette réponse comme utile",
        ratingNotHelpful: "Pas utile",
        ratingNotHelpfulAria: "Marquer cette réponse comme pas utile",
        ratingThanks: "Merci — c'est noté",
        ratingReasonIncorrect: "Incorrect ou incomplet",
        ratingReasonNotAsked: "Ce n'est pas ce que j'ai demandé",
        ratingReasonConfusing: "Explication confuse",
        ratingReasonNotExamStyle: "Pas le style de l'examen",
        ratingReasonTooLong: "Trop long",
        ratingReasonSlowBuggy: "Lent ou bogué",
        ratingReasonOther: "Autre",
        shareFeedbackTitle: "Partager un commentaire",
        shareFeedbackClose: "Fermer",
        shareFeedbackReasonsAria: "Qu'est-ce qui n'allait pas ?",
        shareFeedbackDetailsAria: "Détails",
        shareFeedbackPlaceholder: "Dis-nous ce dont tu avais besoin à la place (facultatif)",
        shareFeedbackPrivacy: "Cette conversation sera envoyée avec ton commentaire afin d'améliorer le tuteur.",
        shareFeedbackSubmit: "Envoyer",
        edit: "Modifier",
        editMessage: "Modifier le message",
        editCancel: "Annuler",
        editSave: "Enregistrer",
        editPlaceholder: "Modifier votre message…"
      },

      // Common UI Elements
      common: {
        loading: "Chargement...",
        save: "Enregistrer",
        cancel: "Annuler",
        submit: "Soumettre",
        search: "Rechercher",
        welcome: "Bienvenue",
        close: "Fermer"
      },

      // Barre d'actions de sélection + popover d'explication
      selection: {
        toolbar: "Actions de sélection",
        copy: "Copier",
        copied: "Copié",
        explain: "Expliquer",
        explainTitle: "Explication",
        keyPoints: "Points clés",
        explainAria: "Explication de la sélection",
        explainError: "Impossible de charger pour le moment. Réessaie.",
        explainEmpty: "Aucune explication clinique pour cette sélection."
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
        uploadFailed: "Échec du téléversement",
        uploadFailedHint: "Une erreur est survenue lors du téléversement. Vérifiez votre connexion et réessayez.",
        uploadOverloaded: "Forte affluence en ce moment",
        uploadOverloadedHint: "Trop d'étudiants utilisent NurseQuizAI en ce moment et nous n'avons pas pu traiter votre demande. Réessayez dans quelques minutes.",
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

      // Case Study / NGN Questions
      caseStudy: {
        badge: "Étude de cas",
        nursesNotes: "Notes infirmières",
        vitalSigns: "Signes vitaux",
        labResults: "Résultats de laboratoire",
        noData: "Aucune donnée disponible pour cet onglet.",
        dragHint: "Glissez et déposez pour organiser dans le bon ordre",
        submitOrder: "Soumettre l'ordre",
        partialCredit: "Crédit partiel",
        correctOrder: "Ordre correct :"
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
        // Échéance d'examen à côté de la date de chaque discussion.
        drillSession: "Entraînement",
        examToday: "Examen aujourd'hui",
        examTomorrow: "Examen demain",
        examInDays: "Examen dans {{count}} jours",
        examYesterday: "Examen hier",
        examDaysAgo: "Examen il y a {{count}} jours",
        chats: "Discussions",
        newChat: "Nouveau chat",
        expandSidebar: "Ouvrir le menu",
        usage: "Analytiques",
        logout: "Déconnexion",
        studySession: "Session d'étude",
        rename: "Renommer",
        delete: "Supprimer",
        deleteTitle: "Supprimer le chat?",
        deleteBody: "Cette action supprimera définitivement tous les messages, fichiers téléversés et données d'étude associés à ce chat.",
        deleteCancel: "Annuler",
        deleteConfirm: "Supprimer"
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
      // Carte de session « Vérifie ma compréhension »
      checkme: {
        title: "Vérification de ta compréhension",
        stepOf: "Concept {{current}} sur {{total}}",
        allCovered: "Les {{total}} concepts sont couverts"
      },

      postUpload: {
        // Action button labels
        checkmeLabel: "Vérifie ma compréhension",
        quizLabel: "Quiz",
        flashcardsLabel: "Créer des cartes mémoire",
        studysheetLabel: "Feuille d'étude",
        audioLabel: "Résumé audio",
        mindmapLabel: "Schéma conceptuel",
        // Action prompts sent to AI (quiz prompts now handled by mode selector)
        // « dans mes propres mots » est essentiel : cette phrase correspond à
        // TEACH_PATTERNS côté backend et force une réponse rédigée directe.
        checkmePrompt: "Demande-moi d'expliquer {{topics}} dans mes propres mots, un concept à la fois, et corrige-moi dès que je me trompe.",
        flashcardsPrompt: "Crée des cartes mémoire pour : {{topics}}",
        studysheetPrompt: "Crée une feuille d'étude résumant les documents téléversés",
        mindmapPrompt: "Crée un schéma conceptuel pour : {{topics}}",
        // Quiz mode-specific prompts
        knowledgeQuizPrompt: "Génère un quiz de connaissances sur {{topics}}. Utilise des questions factuelles directes, pas de scénarios cliniques.",
        nclexQuizPrompt: "Génère un quiz de style NCLEX sur {{topics}}. Utilise des questions à choix multiples (format QCM) avec des scénarios cliniques testant le jugement. Ne pas utiliser le format étude de cas."
      },

      // Plan Onboarding (3-question gate before study plan generation,
      // shown only on first upload for exam-prep students)
      planOnboarding: {
        eyebrow: "Plan personnalisé",
        hookHeadline_one: "J'ai lu ton fichier sur {{topics}}.",
        hookHeadline_other: "J'ai lu tes {{count}} fichiers sur {{topics}}.",
        hookFallbackTopic: "ton matériel d'étude",
        back: "Retour",
        continue: "Continuer",
        daysHelperToday: "Aujourd'hui — on priorise",
        daysHelper_one: "Dans 1 jour — serré mais faisable",
        daysHelper_other: "Dans {{count}} jours",
        examToday: "Examen aujourd'hui",
        examInDays_one: "Examen dans 1 jour",
        examInDays_other: "Examen dans {{count}} jours",
        q1: {
          title: "C'est quand l'examen ?",
          subtitle: "Je dimensionne le plan en conséquence.",
          options: {
            today: "Aujourd'hui",
            tomorrow: "Demain",
            this_week: "Cette semaine",
            next_week: "La semaine prochaine",
            two_plus_weeks: "2+ semaines"
          },
          pickDate: "Choisir une date"
        },
        q2: {
          title: "Lequel te semble le plus difficile ?",
          subtitle: "Choisis-en jusqu'à 2 — je vais y concentrer le plan.",
          counter_one: "{{count}}/2 sélectionné",
          counter_other: "{{count}}/2 sélectionnés",
          noTopics: "Aucun sujet extrait pour l'instant — continue et on s'en occupe ensemble."
        },
        q3: {
          title: "Et où en es-tu dans ta préparation ?"
        },
        prepOptions: {
          not_started: "Pas encore commencé",
          just_started: "Je viens de commencer",
          making_progress: "Je progresse",
          cramming: "Je bûche"
        },
        confirm: {
          title: "Voici ce que je vais construire pour toi.",
          summaryAria: "Résumé du plan",
          focusPrefix: "Focus :",
          topicJoiner: ", ",
          cta: "Construis mon plan",
          edit: "Modifier mes réponses"
        }
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
        errorGenerating: "Impossible de générer la carte mentale. Veuillez réessayer.",
        // Schémas dessinés à partir d'un croquis ASCII dans une réponse
        conceptMapBadge: "Schéma conceptuel",
        viewAsText: "Voir en texte",
        viewAsDiagram: "Voir le schéma",
        buildingDiagram: "Création de votre schéma conceptuel..."
      },

      // Debrief post-examen: la conversation unique "comment ca s est passe ?"
      examDebrief: {
        heading: "Comment s'est pass\u00e9 votre examen\u00a0?",
        headingNamed: "Comment s'est pass\u00e9 votre examen de {{exam}}\u00a0?",
        opener: "Salut, content de vous revoir\u00a0! \ud83d\udc4b Vous avez pass\u00e9 votre examen r\u00e9cemment. Comment \u00e7a s'est pass\u00e9\u00a0?",
        openerNamed: "Salut, content de vous revoir\u00a0! \ud83d\udc4b Vous avez pass\u00e9 votre examen de {{exam}} r\u00e9cemment. Comment \u00e7a s'est pass\u00e9\u00a0?",
        suggestWell: "\u00c7a s'est bien pass\u00e9",
        suggestHarder: "Plus difficile que pr\u00e9vu",
        suggestRough: "C'\u00e9tait dur",
        placeholder: "Racontez-nous comment \u00e7a s'est pass\u00e9\u2026",
        typing: "En train d'\u00e9crire",
        send: "Envoyer",
        done: "Fermer",
        close: "Fermer",
        closing: "Merci \u2014 c'est vraiment utile. Ce genre de retour nous aide \u00e0 am\u00e9liorer la pr\u00e9paration pour votre prochain examen et pour les autres \u00e9tudiants."
      },

      // \u00c9valuation de satisfaction apr\u00e8s un contenu (ContentRating)
      contentRating: {
        promptQuiz: "Ce quiz vous a-t-il \u00e9t\u00e9 utile\u00a0?",
        promptFlashcard: "Ces cartes vous ont-elles \u00e9t\u00e9 utiles\u00a0?",
        promptBlock: "Cela vous a-t-il \u00e9t\u00e9 utile\u00a0?",
        thanks: "Merci \u2014 c'est not\u00e9",
        groupAria: "\u00c9valuer ce contenu",
        helpful: "Utile",
        helpfulAria: "Cela m'a \u00e9t\u00e9 utile",
        notHelpful: "Pas utile",
        notHelpfulAria: "Cela ne m'a pas \u00e9t\u00e9 utile",
        modalTitleQuiz: "Qu'est-ce qui n'allait pas dans ce quiz\u00a0?",
        modalTitleFlashcard: "Qu'est-ce qui n'allait pas dans ces cartes\u00a0?",
        modalTitleBlock: "Qu'est-ce qui n'allait pas\u00a0?",
        reasonWrongAnswer: "Mauvaise r\u00e9ponse marqu\u00e9e correcte",
        reasonNotInMaterial: "Absent de mes documents",
        reasonBadExplanation: "L'explication n'a pas aid\u00e9",
        reasonConfusingWording: "Formulation confuse",
        reasonTooHard: "Trop difficile",
        reasonTooEasy: "Trop facile",
        reasonNotExamStyle: "Pas dans le style NCLEX",
        reasonCardWrong: "La r\u00e9ponse semble incorrecte",
        reasonCardWordy: "Trop de texte sur la carte",
        reasonRepetitive: "Cartes r\u00e9p\u00e9titives",
        reasonNothingNew: "Ne m'a rien appris de nouveau",
        reasonTooShallow: "Trop superficiel",
        reasonTooLong: "Trop long",
        reasonOther: "Autre"
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

      // Onboarding
      onboarding: {
        intro: "Pour mieux comprendre vos besoins, veuillez répondre à ces questions rapides ✨",
        step1Title: "Quel est votre objectif aujourd'hui?",
        step2Title: "Où en êtes-vous dans votre parcours ?",
        step3Title: "Comment apprenez-vous le mieux ?",
        step4Title: "Qu'espérez-vous que NurseQuizAI vous aide à accomplir ?",
        loading: "Configuration de votre profil...",
        tracker: "Question {{current}} sur {{total}}",
        processing: {
          analyzing: "Analyse de vos préférences...",
          personalizing: "Personnalisation de votre expérience..."
        },
        options: {
          nclex: "Préparation NCLEX",
          courseExam: "Examen de cours",
          generalReview: "Révision générale",
          stage1: "Pré-soins infirmiers / Semestre 1",
          stage2: "Semestre 2-3",
          stage3: "Dernier semestre / Préparation NCLEX",
          formatPractice: "Questions de pratique",
          formatFlashcards: "Flashcards",
          formatConcept: "Cartes conceptuelles visuelles",
          formatAudio: "Résumés audio",
          skipText: "Passer",
          submitText: "Soumettre"
        },
        expectationPlaceholder: "J'ai du mal à retenir la pharmacologie...",
        success: {
          title: "C'est tout bon! 🚀",
          message: "Merci d'avoir configuré votre profil. Vous êtes prêt à apprendre!",
          button: "Commencer l'apprentissage"
        },
        recommendation: {
          studyjourney: "Votre profil est configuré. Prêt à générer une session personnalisée pour un étudiant ?",
          flashcards: "Votre profil est configuré. Prêt à générer des flashcards personnalisées ?",
          studysheet: "Votre profil est configuré. Prêt à générer une fiche de révision personnalisée ?",
          default: "Votre profil est configuré. Prêt à générer une session **{{reviewFormat}}** personnalisée pour un étudiant en **{{userStage}}** ?"
        },
        successButtons: {
          startSession: "Commencer ma première session"
        }
      },

      // First Upload "Wow Effect" - Messages personnalisés basés sur les choix d'intégration
      wowEffect: {
        flashcards: "Je vois que tu prépares {{goal}} et que tu veux utiliser des apps de flashcards. Je vais créer des flashcards de {{topics}} que tu pourras exporter!",
        studyjourney: "Je vois que tu prépares {{goal}} et que tu veux suivre tes progrès. Commençons ton parcours d'étude personnalisé sur {{topics}}!",
        studysheet: "Je vois que tu prépares {{goal}} et que tu veux du contenu imprimable. Je vais créer une feuille d'étude à partir de {{topics}}!",
        default: "Super! J'ai analysé {{topics}}. On commence!",
        defaultTopics: "ton matériel",
        defaultGoal: "tes études",
        cta: {
          flashcards: "Créer mes flashcards",
          studyjourney: "Commencer mon parcours d'étude",
          studysheet: "Créer ma feuille d'étude",
          default: "Commencer"
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
        noSetup: "Aucune configuration. On te guide étape par étape.",
        fileFormats: "PDF, PPT, Word, Images • Jusqu'à 15Mo",
        featureQuiz: "Quiz",
        featureFlashcards: "Flashcards",
        featureMindMap: "Schéma conceptuel",
        featureAudio: "Audio",
        featureStudySheet: "Fiche d'étude",
        // Hero section — v3 conversion-focused copy (FR mirror)
        sloganLine1: "Tu connais la matière. Ce sont les questions qui te piègent.",
        sloganLine2Prefix: "On reconstruit tes notes en ",
        sloganLine2Suffix: ".",
        typewriter: {
          quiz: "questions « toutes les réponses ».",
          flashcards: "questions de priorisation.",
          mindmaps: "mises en situation cliniques.",
          audio: "format exact de ton examen.",
          studysheet: "ce que ton prof demande.",
          success: "réussite à l'examen."
        },
        subtitle: "Téléverse tes notes. Premier quiz en moins de 2 minutes.",
        // Auth buttons
        login: "Connexion",
        signup: "S'inscrire",
        logout: "Déconnexion",
        // Social proof badges
        badge1: "Créé avec des infirmières",
        badge2: "Utilisé par 1 000+ étudiants en soins infirmiers",
        badge2Countries: "Étudiants aux États-Unis, au Canada, aux Philippines, en Australie et en Afrique du Sud",
        // Footer
        footerText: "Conçu pour les étudiants en soins infirmiers. Med-Surg, pharmaco, patho — pas seulement le NCLEX.",
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
        unsupportedFileType: "Type de fichier non supporté : {{files}}. Seuls les fichiers PDF, Word, PowerPoint, Excel et texte sont acceptés.",
        unsupportedFileTypePartial: "Certains fichiers ont été ignorés (type non supporté) : {{files}}. Traitement des autres fichiers.",
        supportedFormats: "Formats acceptés : PDF, Word, PowerPoint, Excel, Texte",
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
        today: "Aujourd'hui",
        // Readiness-card countdown banner
        eyebrowUntil: "Examen dans",
        eyebrowToday: "Jour J",
        eyebrowPast: "Examen passé",
        unitDays_one: "jour",
        unitDays_other: "jours",
        unitHours_one: "heure",
        unitHours_other: "heures",
        unitMinutes_one: "minute",
        unitMinutes_other: "minutes",
        unitSeconds_one: "seconde",
        unitSeconds_other: "secondes",
        almostThere: "On y est presque",
        // Past-exam phrasing — single localized sentence so EN ("5 days ago")
        // and FR ("il y a 5 jours") both read naturally
        daysAgo_one: "il y a 1 jour",
        daysAgo_other: "il y a {{count}} jours",
        earlierToday: "Plus tôt aujourd'hui",
        aria: "Temps avant l'examen"
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
      history: {
        fixedConcept: "Tu te trompais sur {{concept}} plus tôt. Tu l’as eu juste {{count}} fois depuis.",
        topicClimb: "La première fois sur {{topic}}, tu avais {{firstCorrect}} sur {{firstTotal}}. Cette fois, {{latestCorrect}} sur {{latestTotal}}.",
        persistentConcept: "{{concept}} t’a piégée {{count}} fois maintenant. C’est celui-là qui mérite qu’on ralentisse."
      },
      narration: {
        ack: "D\u2019accord \u2014 \u00e7a m\u2019en dit beaucoup.",
        strongOne: "Tu es en meilleure position que tu ne le penses. Celui-l\u00e0, tu l\u2019as d\u00e9j\u00e0\u00a0:",
        strongMany: "Tu es en meilleure position que tu ne le penses. Ceux-l\u00e0, tu les as d\u00e9j\u00e0\u00a0:",
        contradiction: "Et voil\u00e0 le truc \u2014 tu m\u2019avais dit que {{feared}} \u00e9tait le plus dur. Ce ne l\u2019est pas. Celui-l\u00e0, tu l\u2019as.",
        work: "L\u00e0 o\u00f9 \u00e7a se complique, c\u2019est ici\u00a0:",
        workAfterTwist: "Ce qui a vraiment besoin de ton temps, c\u2019est \u00e7a\u00a0:"
      },
      coach: {
        steady: "Ton examen est dans {{count}} jours \u2014 on a le temps.",
        focus: "Ton examen est dans {{count}} jours. Assez pour combler de vraies lacunes \u2014 pas assez pour tout refaire.",
        twoDays: "Deux jours. C\u2019est serr\u00e9.",
        tomorrow: "Ton examen est demain. \u00c7a laisse peu de temps.",
        examDay: "Ton examen est aujourd\u2019hui.",
        past: "Cette date d\u2019examen est d\u00e9j\u00e0 pass\u00e9e.",
        undated: "Pas de date d\u2019examen, alors on y va \u00e0 un rythme r\u00e9gulier.",
        planSteady: "Voici le plan de match. On commence par {{topics}}, et on les fait pour vrai, pas en surface.",
        planFocus: "Alors voici le plan\u00a0: {{topics}} d\u2019abord, comme il faut.",
        planFinal: "On ne couvrira donc pas tout. Droit sur {{topics}} \u2014 c\u2019est l\u00e0 que sont les points.",
        planExamDay: "Pas de nouvelle mati\u00e8re aujourd\u2019hui \u2014 \u00e7a n\u2019aide jamais. Une passe rapide sur {{topics}}, puis on arr\u00eate.",
        planAllStrong: "Franchement, tu es en bonne position. Ton parcours sert \u00e0 garder \u00e7a \u2014 des v\u00e9rifications courtes, pas un recommencement.",
        tail: "{{strong}}, tu l\u2019as d\u00e9j\u00e0 \u2014 \u00e7a passe \u00e0 la fin, en r\u00e9vision rapide."
      },
      diagnostic: {
        eyebrow: "Avant de b\u00e2tir ton plan",
        eyebrowExam: "Avant de planifier pour {{exam}}",
        title: "Quelques questions rapides",
        sub: "Rien ici n\u2019est not\u00e9. Je ne veux simplement pas te faire perdre du temps sur ce que tu ma\u00eetrises d\u00e9j\u00e0.",
        progressSr: "Question {{n}} sur {{total}}",
        unsure: "Je ne suis pas encore s\u00fbre",
        knownTitle: "\u00c7a, tu l\u2019as.",
        unsureTitle: "Bien \u2014 c\u2019est utile \u00e0 savoir.",
        teachTitle: "Voici l\u2019id\u00e9e\u00a0:",
        next: "Suivant",
        seeResults: "Montre-moi o\u00f9 j\u2019en suis",
        skip: "Passer \u2014 b\u00e2tis simplement mon plan",
        loadingTitle: "Je lis ton mat\u00e9riel\u2026",
        loadingSub: "Je pr\u00e9pare mes questions.",
        buildingTitle: "Je regarde ce que tu viens de me montrer\u2026",
        buildingSub: "Je situe o\u00f9 tu en es vraiment."
      },
      map: {
        eyebrow: "Voici o\u00f9 tu en es",
        contradiction: "Tu m\u2019avais dit que {{feared}} \u00e9tait le plus dur \u2014 en fait tu es solide l\u00e0-dessus. C\u2019est {{actual}} qui demande du travail.",
        strongEvidence: "Tu avais {{concepts}}.",
        workEvidence: "Pr\u00e9cis\u00e9ment\u00a0: {{concepts}}.",
        workEvidenceGeneric: "On n\u2019a pas encore v\u00e9rifi\u00e9 celui-l\u00e0.",
        cta: "Montre-moi le plan",
        ctaBusy: "Je b\u00e2tis ton parcours\u2026",
        and: " et "
      },
      study: {
        // StartStudyModal
        startJourney: "Commencer le parcours d'étude",
        preparingJourney: "Préparation de ton parcours",
        analyzingDocs: "Analyse de tes documents...",
        creatingPath: "Création de ton parcours d'étude personnalisé...",
        savingProgress: "Mise en place de ton parcours...",
        ready: "Prêt à apprendre!",
        loadingMessages: [
          "Lecture de tes notes en cours...",
          "Repérage des concepts clés...",
          "Construction de ton parcours personnalisé...",
          "Connexion des sujets entre eux...",
          "Structuration de ton apprentissage...",
          "Identification de l'essentiel...",
          "Ajustement de la difficulté pour toi...",
          "Presque prêt, peaufinage du plan...",
          "Organisation des sujets pour mieux retenir...",
          "Création de l'ordre d'étude parfait..."
        ],
        quizLoadingMessages: [
          "Préparation de questions corsées...",
          "Sélection des concepts les plus importants...",
          "Rédaction de questions qui comptent vraiment...",
          "Calibrage de la difficulté à ton niveau...",
          "Ajout de quelques pièges bien placés...",
          "Vérification du niveau NCLEX...",
          "Choix des meilleurs scénarios cliniques...",
          "Presque prêt, affinage des questions...",
          "Sélection des sujets prioritaires...",
          "Préparation de ta vérification des connaissances..."
        ],
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

        // StartStudyModal — plan preview pane (after onboarding confirm)
        planReadyTitle: "Ton parcours est prêt",
        thinkTopics: "J'ai lu ta matière — {{count}} sujets trouvés",
        thinkSprintToday: "Ton examen est aujourd'hui — on va droit à l'essentiel",
        thinkSprintTomorrow: "Ton examen est demain — on saute la nouvelle matière",
        thinkSprintSoon: "Plus que {{days}} jours — on saute la nouvelle matière",
        thinkFocus: "{{days}} jours avant ton examen — on cible tes points faibles",
        thinkMaster: "Tu as le temps — couverture complète",
        thinkHardest: "{{topics}} en premier — tu as dit que c'est le plus difficile",
        thinkBuilding: "Construction de tes étapes…",
        planSprintToday: "Ton examen est aujourd'hui — voici le plan",
        planSprintTomorrow: "Ton examen est demain — voici le plan",
        planSprintSoon: "Ton examen est dans {{days}} jours — voici le plan",
        planSprintNote: "Pas de nouvelle matière — on cible tes lacunes et on s'entraîne.",
        planFocusTitle: "Conçu pour ton examen dans {{days}} jours",
        planFocusNote: "On vérifie d'abord ce que tu sais, puis on renforce les points faibles.",
        // {{action}} is gendered/articled per node type (see NODE_TYPE_META.actionFr
        // in StartStudyModal.js) — e.g. "un quiz sur" / "une leçon sur" — so the
        // sentence reads naturally regardless of the first-node type. Don't add
        // "un petit" here; it would clash with feminine actions like "leçon".
        planPitch: "On commence par {{action}} {{label}} — juste pour voir où tu en es.",
        planFirstBadge: "Commence ici",
        planEstimate: "{{steps}} étapes · environ {{mins}} min au total",
        planMore: "étapes de plus",
        planReserveNote: "+{{count}} autres, débloquées quand tu auras terminé celles-ci",
        blockDoneTitle: "Bloc terminé",
        blockDoneBody: "Tu as terminé les {{count}} étapes. Le bloc est complet.",
        blockExtend: "Ajouter les {{count}} prochaines étapes",
        blockExtending: "Ajout de tes prochaines étapes...",
        blockAllDone: "Tu as terminé tout ce qu'on avait prévu à partir de ces documents.",
        letsGo: "C'est parti",
        closeAria: "Fermer",

        // StudyPlanOverview
        yourStudyPlan: "Ton plan d'étude",
        muteSounds: "Couper le son",
        unmuteSounds: "Activer le son",
        comingSoon: "Bientôt disponible!",
        start: "COMMENCER",

        // Node types
        nodeType: {
          lesson: "Révision",
          quiz: "Quiz",
          flashcard: "Flashcard",
          audio: "Audio",
          mindmap: "Carte mentale",
          review: "Révision",
          exam: "Mini-Test"
        },

        // StudyModeContainer & loading states
        preparing: "Préparation de ta {{type}}...",
        startingSession: "Démarrage de ta session d'étude...",
        exitStudyMode: "Quitter le mode étude",

        // Node-type loading messages (rotating)
        lessonLoading1: "Résumé des concepts clés...",
        lessonLoading2: "Mise en avant de l'essentiel...",
        lessonLoading3: "Organisation de tes notes de révision...",
        lessonLoading4: "Simplification des idées complexes...",
        lessonLoading5: "Création de ton guide de référence...",
        lessonLoading6: "Presque terminé...",

        quizLoading1: "Génération des questions pratiques...",
        quizLoading2: "Ciblage de tes points faibles...",
        quizLoading3: "Calibrage du niveau de difficulté...",
        quizLoading4: "Rédaction des justifications détaillées...",
        quizLoading5: "Construction de ton quiz personnalisé...",
        quizLoading6: "Presque prêt...",

        flashcardLoading1: "Création de tes cartes mémoire...",
        flashcardLoading2: "Extraction des termes et concepts clés...",
        flashcardLoading3: "Rédaction d'explications mémorables...",
        flashcardLoading4: "Organisation par priorité de sujet...",
        flashcardLoading5: "Peaufinage des cartes finales...",
        flashcardLoading6: "Presque prêt...",

        audioLoading1: "Préparation de ta révision audio...",
        audioLoading2: "Structuration des points clés...",
        audioLoading3: "Optimisation pour une écoute facile...",
        audioLoading4: "Création de ton podcast d'étude...",
        audioLoading5: "Presque prêt à écouter...",

        mindmapLoading1: "Cartographie des connexions...",
        mindmapLoading2: "Identification des relations essentielles...",
        mindmapLoading3: "Organisation de la hiérarchie conceptuelle...",
        mindmapLoading4: "Conception de ta vue d'ensemble visuelle...",
        mindmapLoading5: "Dernières retouches...",

        // StudyLessonCard
        lessonTitle: "Révision Rapide",
        keyPoints: "Points clés",
        loadingLesson: "Chargement du contenu de la leçon...",

        // StudyQuizCard
        quickCheck: "Vérification rapide",
        // Diagnostic (premier quiz lancé automatiquement) — calibrage, pas évaluation
        calibrationTitle: "Calibrage rapide",
        diagnosticIntro_one: "{{count}} question rapide pour ajuster ton plan — ce n'est pas noté.",
        diagnosticIntro_other: "{{count}} questions rapides pour ajuster ton plan — ce n'est pas noté.",
        notSureYet: "Pas encore sûr",
        diagnosticDoneTitle: "Plan ajusté pour toi",
        diagnosticDoneBody: "C'est tout ce qu'il me fallait. Ton plan commence maintenant là où il t'aidera le plus.",
        diagnosticDoneCta: "Voir mon plan",
        // Écran de chargement sensible au temps écoulé
        loadingTakingLonger: "Celui-ci est un peu plus long que d'habitude — encore un instant.",
        loadingStillWorking: "Toujours en cours. Les documents plus longs demandent plus de réflexion — ton contenu arrive.",
        loadingProgressAria: "Génération de ton contenu",
        loadingTakingTooLong: "Ça prend trop de temps ?",
        loadingRetry: "Réessayer",
        loadingBackToPlan: "Retour à mon plan",
        // Leçons en continu
        lessonWritingFirstPage: "Rédaction de ta première page…",
        lessonWritingNextPage: "Rédaction de la page suivante…",
        // Aperçu du plan : première étape prête
        firstLessonReady: "Ta première leçon est prête",
        firstQuizReady: "Ton premier quiz est prêt",
        firstCardsReady: "Tes premières cartes sont prêtes",
        firstNodePreparing: "Préparation de ta première étape…",
        // Carte « séance du jour »
        todaySession: "Séance du jour",
        aboutMinutes: "~{{min}} min",
        planTuned: "Plan ajusté",
        nodesOfSession: "{{done}} sur {{total}} terminées",
        seeFullPlan: "Plan en {{count}} étapes · tout voir",
        hideFullPlan: "Masquer le plan complet",
        afterThisSession_one: "{{count}} étape de plus après celle-ci",
        afterThisSession_other: "{{count}} étapes de plus après celle-ci",
        stepN: "Étape {{n}}",
        // Plan daté — mission du jour
        todayMission: "Mission du jour",
        finalPrep: "Dernière ligne droite",
        examDayReview: "Jour J · révision finale",
        dayXofY: "Jour {{day}} sur {{total}}",
        focusPrefix: "Au programme :",
        // Arc de la séance — Apprendre → S'exercer → Réviser
        arcLearn: "Apprendre",
        arcPractice: "S'exercer",
        arcReview: "Réviser",
        startMission: "Démarrer la mission",
        continueMission: "Continuer la mission",
        seeWholePlan: "Voir tout le plan",
        tunedFromAnswers: "Ajusté selon tes réponses de départ",
        // Pourquoi ça vaut le coup aujourd'hui
        whyExamDay: "On revoit ce que tu risques le plus d'oublier — rien de nouveau aujourd'hui.",
        whyFinal: "Consolider ce que tu sais déjà à moitié, c'est ça qui paie maintenant.",
        whyUntested: "Tu n'as pas encore été testé·e là-dessus — aujourd'hui te donne un vrai score.",
        whyWeak: "C'est un de tes points faibles, donc c'est là que la séance rapporte le plus.",
        whyDeveloping: "Tu y es presque. Aujourd'hui devrait faire basculer les choses.",
        whyStrong: "Un passage rapide pour garder ça au frais.",
        // Action → résultat
        completeToRaise: "Termine la mission du jour",
        readinessJump: "{{from}} % → {{to}} %",
        estimatedReadiness: "de préparation estimée",
        firstScore: "L'entraînement du jour te donne ton premier score de préparation.",
        groundworkToday: "Séance de fond aujourd'hui — terminer ton plan t'amène autour de {{pct}} % de préparation estimée.",
        nowReady: "Tu es maintenant à {{pct}} % de préparation estimée.",
        missionComplete: "Mission du jour accomplie",
        onTrackFor: "Tu es en bonne voie pour être prêt·e le {{date}}.",
        everyDayCounts: "Chaque séance réduit l'écart avant le {{date}}.",
        comeBackTomorrow: "Beau travail — on reprend demain.",
        tomorrowFocus: "Demain",
        keepGoing: "Continuer quand même",
        upcoming: "À venir",
        correct: "Correct!",
        incorrect: "Incorrect",
        correctAnswer: "Bonne réponse:",
        learnMore: "En savoir plus",
        showLess: "Réduire",
        loadingRationale: "Chargement…",
        rationaleError: "Impossible de charger l'explication. Réessayer ?",
        retry: "Réessayer",
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
        audioIntroPrompt: "Tu veux écouter cette leçon ou passer à la suite ?",
        audioIntroListen: "Écouter",
        audioIntroSkip: "Passer",
        audioIntroDuration: "~{{duration}} min d'écoute",
        creatingAudioLesson: "Création de ta leçon audio...",
        generatingAudioProgress: "Génération audio... {{progress}}%",
        convertingToSpeech: "Conversion en parole...",
        failedToGenerate: "Échec de la génération audio",
        retry: "Réessayer",

        // Diagnostic Quiz
        diagnosticEyebrow: "Voyons où tu en es",
        diagnosticTitle: "5 questions rapides pour personnaliser ton parcours",
        questionOf: "Question {{n}} sur {{total}}",
        baselineTitle: "Ton niveau de base est défini !",
        baselineSubtitle: "Ton parcours d'étude est en cours de personnalisation...",

        // Quiz Mastery Summary
        quizComplete: "Quiz terminé",
        yourScore: "Ton score",
        improvementPositive: "+{{n}}% d'amélioration par rapport à ta base",
        improvementNegative: "{{n}}% en dessous de ta base — continue de t'entraîner",
        improvementNeutral: "Identique à ta base — la constance est la clé",
        baselineMark: "Ta base",
        reviewThese: "À revoir :",

        // Adaptive Flashcard Toasts
        adaptiveSpeed: "Tu les maîtrises rapidement ! Marqué comme fort.",
        adaptiveMode: "Mode adaptatif : concentration sur {{topic}}",

        // Common
        continueBtn: "Continuer",
        loading: "Chargement...",

        // Celebration messages
        wayToGo: "Bravo!",
        fantastic: "Fantastique!",
        keepItUp: "Continue comme ça!",
        youreOnFire: "Tu es en feu!",
        lessonComplete: "Leçon terminée!",
        amazingWork: "Travail incroyable!",
        youDidIt: "Tu l'as fait!",
        totalXP: "XP TOTAL",
        perfect: "PARFAIT!",
        speedy: "RAPIDE",
        claimXP: "RÉCUPÉRER XP",

        // Milestone messages - context-aware based on performance
        // Great performance (80%+)
        milestoneGreat1: "Tu t'en sors très bien!",
        milestoneGreat2: "Excellente progression!",
        milestoneGreat3: "Continue sur cette lancée!",
        // Okay performance (50-79%)
        milestoneOkay1: "Tu progresses!",
        milestoneOkay2: "Continue, tu y arrives!",
        milestoneOkay3: "Reste concentré!",
        // Struggling (<50%)
        milestoneStruggle1: "Tu peux le faire!",
        milestoneStruggle2: "J'admire ta persévérance!",
        milestoneStruggle3: "N'abandonne pas!",
        milestoneStruggle4: "Chaque essai te rend plus fort!",

        // Bouton "Je ne sais pas"
        dontKnow: "Je ne sais pas",
        dontKnowReviewNote: "Celle-ci reviendra en r\u00e9vision.",
        dontKnowMessages: [
          "L'honn\u00eatet\u00e9, c'est la meilleure strat\u00e9gie d'\u00e9tude!",
          "C'est correct! C'est exactement comme \u00e7a qu'on apprend.",
          "Aucune honte \u00e0 \u00e7a \u2014 on va l'apprendre ensemble!",
          "Rien de mal \u00e0 dire 'pas encore'! Tu vas y arriver.",
          "On commence tous quelque part \u2014 construisons \u00e0 partir d'ici!",
          "Bon r\u00e9flexe! Mieux vaut savoir ce qu'on ne sait pas.",
          "Conna\u00eetre ses lacunes, c'est d\u00e9j\u00e0 la moiti\u00e9 du chemin!",
          "Chapeau pour l'honn\u00eatet\u00e9! On va revoir celle-ci.",
          "Choix courageux! Transformons \u00e7a en savoir.",
          "La conscience de soi, c'est un super-pouvoir. Vraiment.",
          "Au moins, t'as pas devin\u00e9! Points pour l'int\u00e9grit\u00e9.",
          "Rebondissement: l'admettre, c'est le premier pas pour le ma\u00eetriser!",
          "Ton futur toi va te remercier d'avoir signal\u00e9 celle-ci.",
          "Mieux vaut dire 'je ne sais pas' que de bluffer \u00e0 l'examen!",
          "Pas de devinettes ici \u2014 juste du vrai apprentissage.",
          "On va y revenir \u2014 tu vas y arriver!",
          "C'est l'esprit! La ronde de r\u00e9vision s'en occupe.",
          "Chaque 'je ne sais pas' aujourd'hui sera un 'je g\u00e8re' demain!",
          "Direction la file de r\u00e9vision. On s'en occupe!",
          "Not\u00e9 et signal\u00e9! On va s'assurer que tu apprennes celle-ci.",
          "T'inqui\u00e8te! Rome ne s'est pas construite en un jour.",
          "Une \u00e9tape \u00e0 la fois \u2014 tu t'en sors tr\u00e8s bien!",
          "C'est correct de ne pas tout savoir... pour l'instant!",
          "Apprendre, c'est un voyage, pas un sprint. On continue!",
          "Pas de stress \u2014 c'est litt\u00e9ralement pour \u00e7a qu'on a les rondes de r\u00e9vision!",
        ],

        // Review transition
        timeToReview: "C'est l'heure de réviser!",
        reviewMessage: "Tu as {{count}} carte à revoir. On les reprend ensemble!",
        reviewMessage_plural: "Tu as {{count}} cartes à revoir. On les reprend ensemble!",
        reviewQuestionMessage: "Tu as {{count}} question à revoir. On réessaie!",
        reviewQuestionMessage_plural: "Tu as {{count}} questions à revoir. On réessaie!",
        startReview: "C'est parti!",
        finishLesson: "Terminer",
        close: "Fermer",

        // Streaming indicators
        generatingQuestions: "Génération des questions...",
        questionsWillAppear: "Les questions apparaîtront au fur et à mesure",
        generatingFlashcards: "Génération des flashcards...",
        cardsWillAppear: "Les cartes apparaîtront au fur et à mesure",
        loadingMore: "Chargement des questions ({{current}}/{{total}})...",
        loadingMoreCards: "Chargement des cartes ({{current}}/{{total}})...",

        // Insights & performance tracking
        insights: "Suivi",
        yourInsights: "Ton suivi",
        viewInsights: "Voir ton suivi de progression",
        loadingInsights: "Chargement...",
        noInsightsYet: "Pas encore de données — complète un quiz ou des flashcards pour voir ton suivi.",
        strong: "Maîtrisé",
        developing: "En progression",
        weak: "À travailler",
        retake: "Reprendre",
        quizAccuracy: "Quiz",
        flashcardAccuracy: "Flashcards",
        toReview: "À revoir :",
        notedStrength: "Noté comme acquis",
        notedReview: "Noté à revoir",

        // Review confirmation
        reviewNode: "Revoir cette leçon ?",
        reviewNodeDescription: "Tu as déjà complété cette leçon. Voudrais-tu la revoir ?",
        earnXpReview: "pour la révision",
        reviewNow: "Revoir maintenant",

        // Phase 2 — étude personnalisée basée sur les points faibles
        sectionLabel: "SECTION {{number}}",
        basedOnInsights: "Basé sur tes résultats",
        generatingPlan: "Analyse de tes résultats...",
        targetedLesson: "Renforcer tes points faibles",
        masterConcepts: "Maîtriser les concepts clés",
        proveKnowledge: "Prouver tes connaissances",
        builtFromResults: "Construit à partir de tes résultats",
        adaptiveFocus: "FOCUS",
        sessionsAdded: "{{count}} sessions ajoutées à ta route",

        // StudyPlanOverview — cartes de section, jalons, barre latérale
        done: "Terminé",
        of: "sur",
        nodes: "étapes",
        nodesDone: "étapes complétées",
        review: "Revoir",
        miniTest: "Mini-Test",
        needsWork: "À travailler",
        passed: "Réussi",
        yourProgress: "Ta progression",
        viewAll: "Voir tout",
        buildingPersonalizedPlan: "Création de ton plan de révision personnalisé...",
        tapToGenerateReview: "Appuie pour générer ton plan de révision",
        noNodesYet: "Aucun plan d'étude généré pour l'instant.",

        // Readiness Snapshot — carte d'entrée de la Phase 2
        testReadiness: "Préparation à l'examen",
        confidence: "confiance",
        gapsToClose: "Lacunes à combler avant le jour J",
        lockedIn_one: "{{count}} sujet maîtrisé",
        lockedIn_other: "{{count}} sujets maîtrisés",
        estimateMin: "~{{min}} min",
        buildFocusedReview: "Crée ma révision ciblée",
        buildPracticeRound: "Crée ma série de pratique",
        buildingFocusedReview: "Création de ta révision ciblée",
        readinessNoData: "Consolidons ce que tu as appris",
        readinessNoDataSub: "Une courte série mixte pour tout consolider",
        readinessAllStrong: "Tu es solide sur toute la ligne",
        readinessAllStrongSub: "Quelques quiz mixtes pour garder le cap",
        readinessMixed: "Bon départ. Comblons ces lacunes.",
        readinessBuildUp: "Bâtissons ta base avant le jour J",
        readinessGapsSub: "On vise les zones les plus susceptibles de te surprendre le jour de l'examen",
        narrationReview: "Analyse de tes résultats",
        narrationAnalyze: "Cartographie de ta précision par sujet",
        narrationFinding: "Sélection des zones les plus importantes",
        narrationBuilding: "Construction de tes étapes ciblées",
        readinessSoFar: "Préparation jusqu'ici",
        keepGoingCta: "Continue",
        nodesUntilReview_one: "{{count}} étape de plus",
        nodesUntilReview_other: "{{count}} étapes de plus",
        basedOnQuestions_one: "Basé sur {{count}} question répondue",
        basedOnQuestions_other: "Basé sur {{count}} questions répondues",
        readinessUntested_one: "{{count}} sujet pas encore évalué",
        readinessUntested_other: "{{count}} sujets pas encore évalués",
        readinessUntestedSub: "Ta confiance se précisera à mesure que tu progresses",
        readinessJustStarted: "Ta préparation à l'examen commence ici",
        readinessFirstQuiz: "Fais ton premier quiz pour commencer à mesurer ta préparation",
        // Starter ring (no quiz data yet) — replaces the harsh "0% confidence"
        letsBegin: "On commence",
        readyToBegin: "Prêt à commencer",
        gapsAndUntested: "Sujets à couvrir avant le jour J",
        notMeasuredYet: "Non évalué",

        // StudyMindmapCard
        conceptMap: "Carte mentale",
        buildingConceptMap: "Construction de ta carte mentale...",
        allConceptsReviewed: "Tous les concepts ont été révisés !",
        back: "Retour",
        nodeProgress: "{{current}} / {{total}}",
        nextConcept: "Concept suivant →",
        finishReview: "Terminer la révision →",

        // StudyFlashcardCard extra
        loadingCard: "Chargement de la carte..."
      },

      // WarmUrgencyDashboard — tableau de bord empathique
      warmUrgency: {
        yourExam: "Ton examen",
        nodesDone_one: "{{count}} étape terminée",
        nodesDone_other: "{{count}} étapes terminées",
        topicsLocked: "{{count}} sujets maîtrisés sur {{total}}",
        yourStudyJourney: "Ton parcours d'étude",
        ofTotal: "sur",
        journeyHeadline_one: "Tu as répondu à {{count}} question jusqu'ici",
        journeyHeadline_other: "Tu as répondu à {{count}} questions jusqu'ici",
        journeyNoTopics: "Quelques questions à ton actif — continue.",
        journeyAllLocked: "Tu as maîtrisé les {{total}} sujets — tu es prêt·e.",
        journeyOneMore: "Tu as maîtrisé {{completed}} des {{total}} sujets — une dernière session et c'est dans la poche.",
        journeySome: "Tu as maîtrisé {{completed}} des {{total}} sujets — tu as le temps de couvrir le reste.",
        nudgeUrgent: "Une session ciblée sur {{topic}} pourrait suffire avant demain.",
        nudgeUrgentGeneric: "Une courte session ciblée aujourd'hui pourrait tout solidifier avant demain.",
        nudgeModerate: "Tu as le temps — une session de 20 minutes aujourd'hui garde ton élan.",
        nudgeCalm: "Tu es bien placé·e. C'est la régularité qui se transforme en confiance le jour J.",

        // Plan daté — états du compte à rebours
        daysUntilExam_one: "Plus que {{count}} jour avant ton examen",
        daysUntilExam_other: "Plus que {{count}} jours avant ton examen",
        examTomorrow: "Ton examen est demain",
        examToday: "Ton examen est aujourd'hui",
        nudgeExamDay: "N'apprends rien de nouveau aujourd'hui — une révision légère de ce que tu as vu suffit.",
        nudgeExamDayReady: "C'est aujourd'hui. Rien de nouveau maintenant \u2014 une passe calme sur {{topic}}, puis fais confiance au travail accompli.",
        nudgeExamDayTopic: "C'est aujourd'hui. Rien de nouveau maintenant \u2014 une passe calme sur {{topic}}, et laisse le reste.",
        nudgeTomorrowReady: "C'est demain \u2014 et tu as une vraie base. Ce soir, on consolide {{topic}}, on ne commence rien de neuf.",
        nudgeTomorrowBehind: "C'est demain. Ne t'\u00e9parpille pas \u2014 rends {{topic}} solide et laisse aller le reste. Un sujet bien ma\u00eetris\u00e9 vaut mieux que cinq survol\u00e9s.",
        nudgeTomorrowGeneric: "C'est demain. Reprends ce que tu sais d\u00e9j\u00e0 \u00e0 moiti\u00e9 \u2014 c'est l\u00e0 que la soir\u00e9e rapporte vraiment.",
        nudgeTwoDaysReady: "Deux jours. C'est assez pour rendre {{topic}} vraiment solide \u2014 c'est ce qui fera le plus bouger ton score.",
        nudgeTwoDaysBehind: "Deux jours, alors on resserre\u00a0: {{topic}} aujourd'hui, r\u00e9vision demain. Vouloir tout couvrir, c'est perdre les deux jours.",
        nudgeTwoDaysGeneric: "Deux jours. Resserre \u2014 deux sujets bien solides valent mieux qu'un survol de tout.",
        nudgeFocus: "Dans {{count}} jours. Assez de temps pour régler {{topic}} comme il faut, et c'est à ça que sert aujourd'hui.",
        nudgeFocusBehind: "Dans {{count}} jours, et le plan a été refait autour de ces jours-là. {{topic}}, c'est aujourd'hui.",
        nudgeFocusGeneric: "Semaine d'examen — la session d'aujourd'hui attaque d'abord tes plus grandes lacunes.",
        nudgeRebalanced: "On a réparti le reste de ton plan sur les jours qu'il te reste.",
        nudgePast: "Cette date d'examen est passée — termine le plan quand tu veux, ou lances-en un nouveau.",
        readinessLabel: "Préparation",
        readinessEstimated: "estimée",
        readinessTooltip: "Estimé à partir de {{count}} questions d'entraînement sur tes sujets. Les sujets pas encore testés comptent pour zéro.",
        ctaUrgentTitle: "Révision rapide : 10 questions clés",
        ctaUrgentSub: "~15 min · ciblé sur {{topic}}",
        ctaUrgentSubGeneric: "~15 min · pour rester affûté·e",
        ctaModerateTitle: "Session ciblée : {{topic}}",
        ctaModerateTitleGeneric: "Session ciblée",
        ctaModerateSub: "~20 min · pour consolider tes acquis",
        ctaCalmTitle: "Continuer l'étude",
        ctaCalmSub: "Reprends là où tu t'étais arrêté·e",
        lockedInBadge: "Maîtrisé",
        readyToExplore: "À explorer",
        // Variantes "plan terminé" — affichées quand toutes les étapes sont faites
        completeAllLocked: "Tu as terminé ton plan et maîtrisé les {{total}} sujets — tu es prêt·e.",
        completePartial: "Tu as terminé ton plan — {{completed}} sur {{total}} entièrement maîtrisés. Une série de pratique consolidera le reste.",
        nudgeCompleteAllLocked: "Plan terminé et sujets maîtrisés — une série de pratique pour rester affûté·e.",
        nudgeCompletePartial: "Tu as terminé le plan — une série de pratique peut tout consolider.",
        ctaCompletePractice: "Crée ma série de pratique",
        ctaCompleteFocused: "Crée ma révision ciblée",
        ctaCompleteSub: "~{{min}} min · pour tout rassembler",
        ctaCompleteSubGeneric: "Pour tout rassembler",
        couldUseRefresh: "Une passe de plus"
      },

      // NodeTransition — écran de décision post-nœud
      transition: {
        // Quitter
        exit: "Quitter la session",

        // Diagnostic — quiz
        quizDone: "Quiz terminé",
        quizExcellent: "{{correct}} sur {{total}} sur {{topic}}. Tu as tout déchiré.",
        quizGood: "{{correct}} sur {{total}} sur {{topic}}. {{missed}} erreur{{missed, plural, one {} other {s}}} — presque parfait.",
        quizMixed: "{{correct}} sur {{total}} sur {{topic}}. Quelques lacunes à combler.",
        quizTough: "{{correct}} sur {{total}} sur {{topic}}. C'était difficile — c'est correct, ça nous montre quoi travailler.",

        // Diagnostic — examen
        examDone: "Mini-Test terminé",
        examExcellent: "{{correct}} sur {{total}} à l'examen {{topic}}. Excellent — tu es prête.",
        examGood: "{{correct}} sur {{total}} à l'examen {{topic}}. {{missed}} à revoir pour être solide.",
        examMixed: "{{correct}} sur {{total}} à l'examen {{topic}}. Certains concepts à approfondir.",
        examTough: "{{correct}} sur {{total}} à l'examen {{topic}}. Cette section mérite une révision — on va la renforcer.",

        // Diagnostic — flashcard
        flashcardDone: "Flashcards terminées",
        flashcardExcellent: "{{mastered}} sur {{total}} maîtrisées sur {{topic}}. Bien joué.",
        flashcardGood: "{{mastered}} sur {{total}} maîtrisées sur {{topic}}. {{review}} à revoir.",
        flashcardTough: "{{mastered}} sur {{total}} maîtrisées sur {{topic}}. Ces concepts méritent plus de temps.",

        // Diagnostic — leçon, audio, carte mentale
        lessonDone: "Tu as couvert {{topic}}.",
        audioDone: "Tu as écouté {{topic}}.",
        audioSkipped: "Tu as passé l'audio sur {{topic}}.",
        mindmapDone: "Tu as exploré {{visited}} sur {{total}} concepts de {{topic}}.",
        mindmapDoneSimple: "Tu as exploré la carte mentale de {{topic}}.",

        // Suggestions
        suggestNext: "Prochaine étape : {{type}} sur {{label}}.",
        suggestContinue: "Tu maîtrises bien. La suite : {{type}} sur {{label}}.",
        suggestEither: "Tu peux travailler les lacunes avant de continuer, ou avancer. À toi de choisir.",
        suggestRemediate: "Une session de pratique ciblée pourrait t'aider à consolider tout ça.",

        // Barre de score
        correct: "Correct",
        mastered: "Maîtrisé",

        // Concepts manqués
        toReview: "À revoir :",
        cardsToReview: "Cartes qui ont besoin d'un autre regard :",

        // Boutons d'action
        drillGaps_one: "Réviser {{count}} concept manqué",
        drillGaps_other: "Réviser {{count}} concepts manqués",
        practiceMore: "Pratiquer encore",
        moveOn: "Passer à {{topic}}",
        continue: "Continuer",
        building: "Préparation de ta pratique...",
        loadingNext: "Chargement de ta prochaine étape…",
        sessionDone: "Tu as terminé {{topic}}.",

        // Labels de remédiation
        remediationLesson: "Révision : {{topic}}",
        remediationFlashcard: "Pratique : {{topic}}",
        remediationQuiz: "Exercice ciblé : {{topic}}",

        // Coach / demande personnalisée
        orCustomize: "Ou dis au coach ce que tu veux",
        placeholder: "ex. « Concentre-toi sur les effets secondaires » ou « Rends-le plus difficile »",
        goBack: "Retour",
        soundsGood: "Ça me va",
        customError: "Quelque chose s'est mal passé. Réessaie ou continue à la prochaine étape.",

        // Puces d'exemples — « Pratiquer encore » est ici comme puce, pas comme bouton principal
        chipPracticeMore: "Pratiquer encore",
        chipHarder: "Rends-le plus difficile",
        chipFlashcards: "Juste des flashcards",
        chipExplain: "Explique ce que j'ai raté",
        chipQuizMe: "Teste-moi là-dessus",
        chipGoDeeper: "Approfondis",
        chipSkipAhead: "Passer au suivant",

        // ── Refonte de fin de session (rétention J+1) ──
        // En-têtes basés sur l'identité, par tranche de score
        headerMastered: "Acquis bien ancré",
        headerSolid: "Belle session",
        headerGaps: "Tu travailles le plus exigeant",
        headerTough: "Difficile — bravo d'être venue",

        // Phrases d'identité — renforcer la progression, pas la victoire
        identityMastered: "Tu bâtis ta maîtrise sur {{topic}}.",
        identityMasteredFc: "Tu bâtis ta maîtrise sur {{topic}}.",
        identitySolid: "Tu affines ton raisonnement sur {{topic}}.",
        identitySolidFc: "Tu affines ta mémorisation sur {{topic}}.",
        identityGaps: "Tu combles tes lacunes sur {{topic}}.",
        identityTough: "Tu t'attaques à la partie que la plupart évitent.",

        // Ligne de score — contexte supplémentaire après « {n} sur {total}. »
        scoreOf: "sur",
        tailSolid: "{{count}} à consolider.",
        tailGaps_one: "{{count}} concept à revoir.",
        tailGaps_other: "{{count}} concepts à revoir.",
        tailTough: "{{topic}} mérite un second passage.",
        tailKeepBuilding: "Continue à construire.",
        closerToReady: "plus prête",

        // Récap (ancre de rétention) — REQUIS à chaque session
        recapReady: "Ton prochain récap est prêt :",
        recapDetail: "4 min sur ce que tu viens d'apprendre, avant de l'oublier.",

        // CTA prochaine étape
        nextStepIs: "Ta prochaine étape :",
        keepGoing: "Continuer →",
        morePractice: "Plus de questions sur ce sujet",

        // Sortie sans friction
        doneForToday: "Sauvegarder et revenir demain",

        // Carte d'au revoir — affichée après le clic sur le lien de sortie.
        // Message apaisant, sans engagement ni planification.
        farewellTitle: "Progression sauvegardée.",
        farewellBody1: "Ton cerveau décide en ce moment ce qui reste et ce qui s'efface.",
        farewellBody2: "Le rappel de 4 minutes de demain renforcera les concepts qui comptent le plus.",
        farewellFooter: "Ta série continue demain.",
        farewellNextLabel: "La prochaine fois",
        remindMe: "Rappelle-le-moi demain",
        remindOn: "Je te le rappellerai demain",
        remindBlocked: "Les notifications sont bloquées dans les réglages de ton navigateur",
        farewellClose: "Fermer",

        // ── Bilan de fin de nœud (voir nodeReadout.js) ──
        hConfirmed: "Tu viens de le prouver.",
        hPattern: "J'ai remarqué quelque chose d'intéressant.",
        hImproving: "Tu progresses sur {{topic}}.",
        hMastered: "C'est acquis.",
        hSolid: "Tu commences à maîtriser ça.",
        hGaps: "Celui-ci a révélé une lacune à corriger.",
        hTough: "Maintenant je sais quoi travailler avec toi.",

        // Légende du score — ce que le chiffre veut dire
        capImproving: "Tu étais à {{pct}} % sur ce sujet avant aujourd'hui.",
        capPattern: "Tes erreurs ici ne sont pas au hasard.",
        capMastered: "Plus rien à consolider ici.",
        capMasteredFc: "Toutes les cartes, du premier coup.",
        capSolidOne: "Une chose à consolider.",
        capSolid: "{{count}} à consolider.",
        capGaps_one: "{{count}} concept à revoir.",
        capGaps_other: "{{count}} concepts à revoir.",
        capTough: "Ça mérite un second passage avant de continuer.",

        // Pas encore assez d'indices
        learningLead: "J'apprends comment tu raisonnes",
        noteLead: "Ce que j’ai noté",
        learningBody: "J'ai repris tes {{count}} réponses. Je regarde comment tu abordes une question, pas seulement si tu as juste.",

        // Le point à retenir — une ligne, l'élément principal de l'écran.
        takeawayFocus: "À retenir",
        noticedLead: "Ce que j’ai remarqué",
        takeawayClean: "Acquis",
        takeawayBlank: "Commence par",
        lockInFirst: "Tu veux d'abord consolider ce point faible ?",
        reviewMins: "Réviser · 4 min",

        // La note sur une étape sans score (leçon, audio, carte conceptuelle).
        noteLoading: "Je regarde ce que ça couvre pour toi…",
        linkedStruggle: "te coûte encore : « {{concept}} »",
        linkedFixed: "tu ratais « {{concept}} » avant",
        learningPromise: "Encore quelques questions et j'aurai quelque chose de précis pour toi.",
        learningPromiseN_one: "Encore {{count}} de ce type et j'aurai quelque chose de précis pour toi.",
        learningPromiseN_other: "Encore {{count}} de ce type et j'aurai quelque chose de précis pour toi.",

        // La recommandation
        whatIdDo: "Voici ce que je ferais maintenant",
        skillPriority: "priorisation",
        skillMulti: "réponses multiples",
        skillGeneric: "ces",
        recTestTitle: "Une question, construite autour de la {{skill}}",
        recTestWhy: "Si j'ai raison, tu vas la réussir en changeant ta façon de la lire — pas en apprenant plus.",
        recFixTitle: "{{count}} questions de {{skill}}",
        recFixWhy: "Ciblées sur le schéma que je viens de décrire — pas sur le sujet.",
        recMissedTitle: "{{count}} questions sur ce que tu as manqué",
        recMissedWhy: "Les mêmes concepts, posés autrement.",
        recWalkTitle: "D'abord un exemple guidé",
        recWalkWhy: "On ralentit sur celui-là. Je te l'explique pas à pas avant de te retester.",
        recHarderTitle: "Une version plus difficile de {{topic}}",
        recHarderWhy: "Les mêmes concepts dans un vrai scénario clinique — c'est là qu'ils sont testés.",
        recMoreTitle: "Encore sur {{topic}}",
        recMoreWhy: "Tu as terminé le plan là-dessus — gardons ça au chaud.",
        recNextWhy: "Tu es solide ici — voilà la suite logique.",
        recNextWhyConfirmed: "Garde la même approche pour la suite.",
        recNextFallback: "La prochaine étape de ton plan",

        // Boutons — chacun dit ce qu'il va faire
        ctaTest: "Teste ta théorie →",
        ctaFix: "Corriger ça →",
        ctaWalk: "Montre-moi →",
        ctaHarder: "Corse-moi ça →",
        ctaKeep: "On continue →",
        metaOneQuestion: "1 question · ~2 min",
        metaDrill: "{{count}} questions · ~5 min",
        metaLesson: "Leçon · ~5 min",
        metaChallenge: "2 scénarios · ~6 min",
        drillLabel: "Pratique ciblée : {{skill}}",
        challengeLabel: "Plus difficile : {{topic}}",

        // Révision secondaire
        beforeYouMoveOn: "Avant de passer à la suite",
        recapDetailShort: "4 min · ancrer ce que tu viens d'apprendre",
        review: "Réviser →",
        recapLabel: "Récap : {{topic}}",
        recapReason: "Ancrer ce que tu viens d'apprendre",

        // Lien coach
        askFor: "Demander autre chose"
      },

      // Exam Drill — l'examinateur adaptatif. Ton volontairement neutre,
      // comme en salle d'examen : aucun encouragement, aucun point
      // d'exclamation. Seul le bilan se réchauffe.
      drill: {
        preparing: "Préparation de ta première question…",
        dateEyebrow: "Avant de commencer",
        dateQuestion: "C'est quand, ton examen ?",
        dateWhy: "Ça donne le rythme, et c'est le compte à rebours que tu verras à chaque retour.",
        dateSkip: "Je n'ai pas encore de date",
        questionNumber: "Question {{n}}",
        checkpointIn: "Bilan dans {{count}} questions",
        checkpointNext: "Bilan après celle-ci",
        next: "Question suivante",
        loadingNext: "Rédaction de ta prochaine question…",
        // Statut rotatif pendant la génération de la question suivante.
        writing1: "Lecture de ta réponse…",
        writing2: "Choix de la prochaine question…",
        writing3: "Rédaction de la question…",
        writing4: "Vérification de l'explication…",
        writingSlow: "Celle-ci prend un peu plus de temps — autant bien la faire.",
        // Ouverture d'un entraînement : aucune réponse précédente à lire.
        startup1: "Ouverture de ta matière…",
        startup2: "Choix du point de départ…",
        startup3: "Rédaction de ta première question…",
        seeCheckpoint: "Voir où tu en es",
        untilCheckpoint: "{{count}} avant ton bilan",
        correct: "Correct",
        incorrect: "Pas tout à fait",
        exit: "Terminer pour l'instant",
        retry: "Réessayer",
        generationFailed: "Cette question n'a pas pu être générée. Réessaie dans un instant.",
        notFound: "Cet entraînement n'est pas disponible.",
        checkpointEyebrow: "Bilan",
        gapHardLabel: "SATA et études de cas",
        // ── Narration du bilan ────────────────────────────────────────
        // Des phrases dites à voix haute, tapées l'une après l'autre.
        // Pas de titres, pas de score, pas de point d'exclamation.
        beatAck: "Bon — {{count}} questions. C'est déjà assez pour voir quelque chose.",
        beatAckMany: "Voilà — {{count}} questions. J'ai une image claire maintenant.",
        beatStrongOne: "Tu m'as vraiment montré {{topics}} — celui-là est acquis.",
        beatStrongMany: "Tu m'as vraiment montré ceux-ci : {{topics}}.",
        beatFormatGap: "Mais voilà le vrai sujet. Tu connais la matière — c'est le format qui te piège. {{mcq}} % en choix multiple, {{hard}} % dès que ça devient un « tout ce qui s'applique » ou une étude de cas.",
        beatProvisional: "Je ne dirais pas encore que {{topics}} est acquis — tu ne l'as vu qu'en choix multiple, la version facile.",
        beatWeak: "Là où ça casse vraiment, c'est {{topics}}.",
        beatInconsistent: "{{topics}} n'est pas stable non plus — parfois juste, parfois faux.",
        beatMisconception: "Et tu reviens toujours sur la même idée : {{concept}}.",
        beatMisconceptionUnnamed: "Le même malentendu t'a piégée plus d'une fois maintenant.",
        beatFirstHardWin: "Une chose a changé, par contre : ta première {{format}} entièrement réussie. C'est la première preuve que tu peux les faire.",
        beatStruggling: "Soyons directs, par contre. Il y a trop d'erreurs ici pour blâmer le format — c'est la matière elle-même qui n'est pas encore acquise, et c'est là-dessus qu'on travaille.",
        beatNothingYet: "Rien ne s'est effondré pour l'instant — mais ce n'est pas la même chose qu'être prête. On continue jusqu'à ce que ça nous dise quelque chose.",
        beatRecFormat: "Alors c'est ça qu'on corrige. Plus de {{format}} ensuite — c'est là que partent les points.",
        beatRecWeak: "On reste sur {{topic}} jusqu'à ce que ça tienne. C'est une vraie lacune, pas un mauvais moment.",
        beatRecMisconception: "Les prochaines visent exactement ça.",
        beatRecInconsistent: "On va trancher {{topic}} dans un sens ou dans l'autre.",
        beatRecProveIt: "Maintenant je teste {{topic}} pour de vrai, comme ton examen le fera.",
        beatRecNewTopic: "Plus rien à prouver ici — on passe à {{topic}}.",
        beatRecFoundations: "Alors on reprend à la base — des questions plus simples, une idée à la fois, jusqu'à ce que je voie ce qui manque vraiment.",
        beatRecBroaden: "On élargit au reste de ta matière.",
        continueDrilling: "Continuer l'entraînement",
        // Barre de reprise affichée à la place du champ de saisie.
        keepDrilling: "Continuer l'entraînement",
        inProgress: "Entraînement en cours",
        readyEyebrow: "Entraînement prêt",
        notStartedYet: "Rien de répondu pour l'instant",
        startDrilling: "Commencer l'entraînement",
        coveredSoFar: "Déjà couvert",
        moreTopics: "+{{count}} de plus",
        examToday: "Ton examen est aujourd'hui",
        examTomorrow: "Ton examen est demain",
        examInDays: "{{count}} jours avant ton examen",
        answeredSoFar: "{{count}} questions répondues jusqu'ici",
        outOfQuestions: "Tu as utilisé tes questions gratuites pour cette semaine.",
        unlockUnlimited: "Débloquer l'entraînement illimité",
        remainingQuestions: "{{count}} questions restantes cette semaine"
      },
      // Examen — mini-test à la fin de chaque section
      exam: {
        configTitle: "Mini-Test",
        configDescription: "Configure ton mini-test pour qu'il ressemble à ton vrai examen.",
        questionTypes: "Types de questions",
        typeMCQ: "Choix multiple",
        typeMCQDesc: "1 bonne réponse",
        typeSATA: "Sélectionner tout ce qui s'applique",
        typeSATADesc: "Plusieurs bonnes réponses",
        typeCaseStudy: "Étude de cas",
        typeCaseStudyDesc: "Scénarios cliniques NGN",
        questionCount: "Nombre de questions",
        timeEstimate: "~{{minutes}} min",
        simulateTiming: "Simuler le temps d'examen",
        timerHint: "Compte à rebours par question pour pratiquer le rythme",
        customInstructions: "Instructions supplémentaires",
        optional: "optionnel",
        customPlaceholder: "ex. « Mon prof se concentre sur la priorisation » ou « Inclure des calculs de dosage »",
        graceNote: "Il te reste {{remaining}} questions gratuites en ce moment et ce mini-test en demande {{count}}. On le génère quand même au complet — ta réussite passe en premier.",
        graceUpgrade: "Tes questions gratuites se rechargent chaque semaine · Passe à Pro pour l'illimité",
        startExam: "Commencer le mini-test",
        generating: "Préparation de ton mini-test...",
        generatingHint: "Génération de {{count}} questions en formats mixtes",
        loading1: "Création de scénarios cliniques...",
        loading2: "Sélection des concepts clés en soins infirmiers...",
        loading3: "Rédaction des justifications...",
        loading4: "Mélange des formats de questions...",
        loading5: "Vérification de la précision...",
        loading6: "Extraction de ton matériel d'étude...",
        loading7: "Création de situations réalistes de patients...",
        loading8: "Rédaction d'explications détaillées...",
        loading9: "Calibrage du niveau de difficulté...",
        loading10: "Peaufinage des questions finales...",
        loading11: "Presque prêt...",
        examBadge: "EXAMEN",
        questionProgress: "{{current}} / {{total}}",
        nextQuestion: "Question suivante",
        finishExam: "Terminer l'examen",
        complete: "Mini-Test terminé",
        scoreDetail: "{{correct}} sur {{total}} correct"
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
