import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../Contexts/AuthContext/AuthContext';
import NurseQuizMascot from './NurseQuizMascot';
import BrainMascot from './BrainMascot';
import './QuizRoomLanding.css';
// Import the login prompt styles from DedicatedQuizPage
import './DedicatedQuizPage.css';

// Firebase imports for creating game chat
import { db, auth } from '../../Firebase/config';
import { handleSignOut, handleSignInWithGoogleAccount } from '../../Firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

// API imports for file upload
import { upload_files_with_progress } from '../../Services/FastAPICalls';

// Animated counter component
const AnimatedCounter = ({ target, duration = 2000, suffix = '%', onComplete }) => {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            setHasAnimated(true);
            // Start counting animation
            const startTime = Date.now();
            const animate = () => {
              const elapsed = Date.now() - startTime;
              const progress = Math.min(elapsed / duration, 1);
              // Easing function for smooth deceleration
              const easeOutQuart = 1 - Math.pow(1 - progress, 4);
              const currentCount = Math.floor(easeOutQuart * target);
              setCount(currentCount);

              if (progress < 1) {
                requestAnimationFrame(animate);
              } else {
                setCount(target);
                // Notify parent that animation is complete
                if (onComplete) {
                  onComplete();
                }
              }
            };
            requestAnimationFrame(animate);
          }
        });
      },
      { threshold: 0.3 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [target, duration, hasAnimated, onComplete]);

  return <span ref={ref}>{count}{suffix}</span>;
};

/**
 * QuizRoomLanding - Premium, welcoming landing page
 * Shows immediate value with micro-interactions
 */
const QuizRoomLanding = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [pressedCard, setPressedCard] = useState(null);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const heroRef = useRef(null);
  const mascotRef = useRef(null);
  const lastScrollY = useRef(0);
  const scrollTimeout = useRef(null);

  // Mascot scroll-following state
  const [mascotIsFloating, setMascotIsFloating] = useState(false);
  const [mascotIsExitingFloat, setMascotIsExitingFloat] = useState(false);
  const [mascotIsReturning, setMascotIsReturning] = useState(false);
  const [mascotIsFlying, setMascotIsFlying] = useState(false);
  const [flyDirection, setFlyDirection] = useState('none');
  const [mouseLookDirection, setMouseLookDirection] = useState('center');
  const [mascotIsExcited, setMascotIsExcited] = useState(false);
  const [mascotIsSurprised, setMascotIsSurprised] = useState(false);
  const floatExitTimeout = useRef(null);

  // Brain mascot explosion state
  const [brainIsExploding, setBrainIsExploding] = useState(false);
  const [completedCounters, setCompletedCounters] = useState(0);
  const totalCounters = 3;

  // Direct upload flow state
  const [uploadPhase, setUploadPhase] = useState('idle'); // 'idle' | 'processing'
  const fileInputRef = useRef(null);

  // ============================================
  // LOGIN-REQUIRED UPLOAD FLOW STATE
  // ============================================
  // When a user uploads files but isn't logged in,
  // we store the files in memory and show a login prompt.
  // After they log in, we resume the upload automatically.
  // ============================================
  const [pendingFiles, setPendingFiles] = useState([]);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);

  // Handle counter completion - trigger explosion when all 3 are done
  const handleCounterComplete = useCallback(() => {
    setCompletedCounters(prev => {
      const newCount = prev + 1;
      if (newCount >= totalCounters && !brainIsExploding) {
        setBrainIsExploding(true);
        // Reset explosion after animation
        setTimeout(() => {
          setBrainIsExploding(false);
        }, 1000);
      }
      return newCount;
    });
  }, [brainIsExploding]);

  // Dark mode state - check localStorage first, then browser preference
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode !== null) {
      return savedDarkMode === 'true';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Apply dark mode class to body and persist to localStorage
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    localStorage.setItem('darkMode', isDarkMode);
  }, [isDarkMode]);

  // Toggle dark mode with mascot surprise animation
  const toggleDarkMode = () => {
    // Trigger surprised blink animation
    setMascotIsSurprised(true);

    // After blink (eyes closed), change theme
    setTimeout(() => {
      setIsDarkMode(prev => !prev);
    }, 150);

    // Open eyes after theme change
    setTimeout(() => {
      setMascotIsSurprised(false);
    }, 400);
  };

  // Handle mouse movement for mascot eye tracking when floating
  const handleMouseMove = useCallback((e) => {
    if (!mascotRef.current || !mascotIsFloating) return;

    const mascotRect = mascotRef.current.getBoundingClientRect();
    const mascotCenterX = mascotRect.left + mascotRect.width / 2;
    const mascotCenterY = mascotRect.top + mascotRect.height / 2;

    const deltaX = e.clientX - mascotCenterX;
    const deltaY = e.clientY - mascotCenterY;
    const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

    // Map angle to look directions
    if (angle >= -30 && angle < 30) {
      setMouseLookDirection('right');
    } else if (angle >= 30 && angle < 60) {
      setMouseLookDirection('down-right');
    } else if (angle >= 60 && angle < 120) {
      setMouseLookDirection('down-center');
    } else if (angle >= 120 && angle < 150) {
      setMouseLookDirection('down-left');
    } else if (angle >= 150 || angle < -150) {
      setMouseLookDirection('left');
    } else if (angle >= -120 && angle < -60) {
      setMouseLookDirection('up');
    } else {
      setMouseLookDirection('center');
    }
  }, [mascotIsFloating]);

  // Handle scroll for mascot floating behavior
  const handleScroll = useCallback(() => {
    // Disable floating mascot on mobile (768px and below)
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      setMascotIsFloating(false);
      setMascotIsExitingFloat(false);
      setMascotIsReturning(false);
      return;
    }

    const scrollY = window.scrollY;
    const heroHeight = heroRef?.current?.offsetHeight || window.innerHeight;
    const mascotTriggerPoint = heroHeight * 0.4; // Start floating after 40% of hero

    // Determine if mascot should float
    if (scrollY > mascotTriggerPoint) {
      // Clear any exit animation in progress
      if (floatExitTimeout.current) {
        clearTimeout(floatExitTimeout.current);
        floatExitTimeout.current = null;
      }
      setMascotIsExitingFloat(false);
      setMascotIsReturning(false);
      setMascotIsFloating(true);
    } else if (mascotIsFloating && !mascotIsExitingFloat) {
      // Start exit animation sequence
      setMascotIsExitingFloat(true);

      // After exit animation, return to hero position
      floatExitTimeout.current = setTimeout(() => {
        setMascotIsFloating(false);
        setMascotIsExitingFloat(false);
        setMascotIsReturning(true);

        // Clear returning state quickly
        setTimeout(() => {
          setMascotIsReturning(false);
        }, 50);
      }, 350); // Match CSS animation duration
    }

    // Determine scroll direction for flying animation
    const scrollDelta = scrollY - lastScrollY.current;

    if (Math.abs(scrollDelta) > 3) {
      setMascotIsFlying(true);
      setFlyDirection(scrollDelta > 0 ? 'down' : 'up');
    }

    // Clear existing timeout
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
    }

    // Stop flying after scroll stops
    scrollTimeout.current = setTimeout(() => {
      setMascotIsFlying(false);
      setFlyDirection('none');
    }, 150);

    lastScrollY.current = scrollY;
  }, [mascotIsFloating, mascotIsExitingFloat]);

  // Set up scroll and mouse event listeners
  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
      if (floatExitTimeout.current) {
        clearTimeout(floatExitTimeout.current);
      }
    };
  }, [handleScroll, handleMouseMove]);

  // Map hovered card to mascot look direction
  const getMascotLookDirection = () => {
    // When floating, use mouse tracking
    if (mascotIsFloating) {
      return mouseLookDirection;
    }
    // When in hero, use card hover tracking
    switch (hoveredCard) {
      case 'login':
        return 'right';
      case 'signup':
        return 'right';
      case 'upload':
        return 'down-center';
      case 'nclex':
        return 'down-left';
      case 'tutor':
        return 'down-center';
      case 'challenge':
        return 'down-right';
      default:
        return 'center';
    }
  };

  // Handle card press for haptic-like feedback
  const handleCardPress = (cardId) => {
    setPressedCard(cardId);
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  const handleCardRelease = () => {
    setPressedCard(null);
  };

  // Handle card hover for mascot eye tracking and excitement
  const handleCardHover = (cardId) => {
    setHoveredCard(cardId);
    // Set mascot excited when hovering over any CTA buttons (including login/signup)
    const ctaCards = ['upload', 'nclex', 'tutor', 'challenge', 'login', 'signup', 'startLearning', 'joinCommunity'];
    setMascotIsExcited(ctaCards.includes(cardId));
  };

  const handleCardHoverEnd = () => {
    setHoveredCard(null);
    setMascotIsExcited(false);
  };

  // Trigger mascot fly away animation
  const triggerMascotSpin = () => {
    if (!isSpinning) {
      setIsSpinning(true);
      setTimeout(() => setIsSpinning(false), 500); // Match animation duration
    }
  };

  // Trigger anime-style page exit animation
  const triggerPageExit = (callback) => {
    if (isExiting) return;

    setIsExiting(true);
    setShowFlash(true);
    triggerMascotSpin();

    // Haptic feedback for mobile
    if (navigator.vibrate) {
      navigator.vibrate([10, 50, 20]);
    }

    // Navigate after animation completes (longer for gentle, smooth feel)
    setTimeout(() => {
      callback();
    }, 750);
  };

  // Navigate to chat interface (if logged in) or signup (if not)
  const navigateWithAction = (action) => {
    sessionStorage.setItem('landingAction', action);
    if (currentUser) {
      navigate('/c');
    } else {
      navigate('/signup');
    }
  };

  // Delayed navigation with anime exit animation
  const handleDelayedNavigation = (callback) => {
    triggerPageExit(callback);
  };

  // Navigation handlers
  const handleStudyNCLEX = () => handleDelayedNavigation(() => navigateWithAction('quiz'));

  // Direct file upload - opens file picker immediately
  const handleUploadNotes = () => {
    fileInputRef.current?.click();
  };

  // ============================================
  // FILE SELECTION HANDLER
  // ============================================
  // This is the main entry point when a user picks files.
  //
  // FLOW:
  // 1. User selects one or more files
  // 2. If NOT logged in → store files in memory, show login modal
  // 3. If logged in → proceed with upload immediately
  // 4. After login (if was prompted) → auto-resume upload
  // ============================================
  const handleFileSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Reset file input so the same files can be selected again
    e.target.value = '';

    // ------------------------------------------
    // STEP 1: Check if user is logged in
    // ------------------------------------------
    if (!currentUser) {
      // User is NOT logged in
      // Store the files in memory and show login prompt
      console.log(`📁 ${files.length} file(s) selected but user not logged in. Storing files in memory...`);
      setPendingFiles(files);
      setShowLoginPrompt(true);
      return;
    }

    // ------------------------------------------
    // STEP 2: User IS logged in - proceed with upload
    // ------------------------------------------
    await processFileUpload(files);
  };

  // ============================================
  // PROCESS FILE UPLOAD
  // ============================================
  // This function handles the actual upload flow.
  // It's called either:
  // - Directly when user is already logged in
  // - After user logs in (with the pending files)
  // ============================================
  const processFileUpload = async (files) => {
    // Ensure files is an array
    const fileArray = Array.isArray(files) ? files : [files];
    if (fileArray.length === 0) return;

    // Get the browser language for embedding
    // i18n.language gives us 'en' or 'fr' based on detection
    const browserLanguage = i18n.language || 'en';
    console.log('🌐 Browser language detected:', browserLanguage);

    // Start processing phase - show loading overlay
    setUploadPhase('processing');

    try {
      // ------------------------------------------
      // Step 1: Generate a unique chat ID for this game session
      // ------------------------------------------
      const gameId = `game_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      console.log('🎮 Starting game session:', gameId);

      // ------------------------------------------
      // Step 2: Create the game chat document in Firestore
      // User MUST be logged in at this point
      // ------------------------------------------
      const userId = auth.currentUser.uid;
      const chatRef = doc(db, 'chats', gameId);

      // Create title from file names
      const title = fileArray.length === 1
        ? fileArray[0].name.replace(/\.[^/.]+$/, '')
        : `${fileArray[0].name.replace(/\.[^/.]+$/, '')} +${fileArray.length - 1} more`;

      await setDoc(chatRef, {
        userId,
        title,
        type: 'game', // Mark this as a game session
        language: browserLanguage, // Store the language used
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        // Initialize game state
        gameState: {
          status: 'uploading',
          serumCollected: 0,
          serumRequired: 100,
          attempts: 0,
          completedAt: null
        }
      });

      console.log('✅ Game chat document created for user:', userId);

      // ------------------------------------------
      // Step 3: Upload the files and embed them
      // Pass the browser language for proper embedding
      // ------------------------------------------
      console.log(`📤 Uploading ${fileArray.length} file(s):`, fileArray.map(f => f.name).join(', '), 'with language:', browserLanguage);

      await upload_files_with_progress(
        fileArray,        // Files array
        gameId,           // Chat ID we just created
        (update) => {     // Progress callback
          console.log('Upload progress:', update);
        },
        browserLanguage   // Language for processing (from browser)
      );

      console.log('✅ Files uploaded and embedded');

      // ------------------------------------------
      // Step 4: Navigate to the quiz page
      // The quiz page will connect via WebSocket and stream questions
      // ------------------------------------------
      setUploadPhase('idle');

      navigate('/quiz/play', {
        state: {
          chatId: gameId,
          title,
          fromUpload: true,
          isGameMode: true,
          language: browserLanguage // Pass language to quiz page
        }
      });

    } catch (error) {
      // Handle errors gracefully
      setUploadPhase('idle');
      console.error('❌ Game setup failed:', error);

      // Show user-friendly error
      alert(t('landing.uploadError', 'Failed to process your files. Please try again.'));
    }
  };

  // ============================================
  // LOGIN PROMPT HANDLERS
  // ============================================

  // Called when user clicks "Login" in the prompt
  const handleLoginFromPrompt = async () => {
    // Store the pending files info in sessionStorage
    // We convert to simple objects since File objects can't be serialized
    if (pendingFiles.length > 0) {
      const pendingUploadState = {
        files: pendingFiles.map(f => ({
          fileName: f.name,
          fileSize: f.size,
          fileType: f.type
        })),
        timestamp: Date.now()
      };
      sessionStorage.setItem('pendingUploadState', JSON.stringify(pendingUploadState));

      // Store the actual files as base64 in sessionStorage
      // Note: For very large files, consider using IndexedDB instead
      const filesBase64 = await Promise.all(
        pendingFiles.map(file => new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        }))
      );
      sessionStorage.setItem('pendingUploadFiles', JSON.stringify(filesBase64));

      setShowLoginPrompt(false);
      // Navigate to login - after login, user goes to /c where
      // ProtectedRoute will show QuizRoomLanding with the restored files
      navigate('/login', {
        state: {
          returnTo: '/c',
          message: t('landing.loginToUpload', 'Sign in to upload your notes and start learning!')
        }
      });
    }
  };

  // Called when user clicks "Sign Up" in the prompt
  const handleSignupFromPrompt = async () => {
    if (pendingFiles.length > 0) {
      const pendingUploadState = {
        files: pendingFiles.map(f => ({
          fileName: f.name,
          fileSize: f.size,
          fileType: f.type
        })),
        timestamp: Date.now()
      };
      sessionStorage.setItem('pendingUploadState', JSON.stringify(pendingUploadState));

      // Store the actual files as base64 in sessionStorage
      const filesBase64 = await Promise.all(
        pendingFiles.map(file => new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        }))
      );
      sessionStorage.setItem('pendingUploadFiles', JSON.stringify(filesBase64));

      setShowLoginPrompt(false);
      // Navigate to signup - after signup, user goes to /c
      navigate('/signup', {
        state: {
          returnTo: '/c',
          message: t('landing.signupToUpload', 'Create an account to upload your notes!')
        }
      });
    }
  };

  // Called when user dismisses the login prompt
  const handleCloseLoginPrompt = () => {
    setShowLoginPrompt(false);
    setPendingFiles([]);
  };

  // ============================================
  // GOOGLE SIGN-IN DIRECTLY FROM MODAL
  // ============================================
  // This allows users to sign in with Google without leaving the modal.
  // After successful sign-in, we store the files and navigate to /c
  // where they will be processed automatically.
  // ============================================
  const handleGoogleSignInFromPrompt = async () => {
    if (pendingFiles.length === 0) return;

    setIsGoogleSigningIn(true);

    try {
      // Store the pending files info in sessionStorage BEFORE signing in
      const pendingUploadState = {
        files: pendingFiles.map(f => ({
          fileName: f.name,
          fileSize: f.size,
          fileType: f.type
        })),
        timestamp: Date.now()
      };
      sessionStorage.setItem('pendingUploadState', JSON.stringify(pendingUploadState));

      // Store the actual files as base64
      const filesBase64 = await Promise.all(
        pendingFiles.map(file => new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        }))
      );
      sessionStorage.setItem('pendingUploadFiles', JSON.stringify(filesBase64));

      // Now sign in with Google
      await handleSignInWithGoogleAccount();

      // Close the modal and navigate to /c
      // The pending upload will be restored there
      setShowLoginPrompt(false);
      setPendingFiles([]);
      navigate('/c', { replace: true });

    } catch (error) {
      console.error('Google sign-in failed:', error);
      // Clear session storage on error
      sessionStorage.removeItem('pendingUploadState');
      sessionStorage.removeItem('pendingUploadFiles');
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  // NOTE: Pending upload restoration is handled in ChatLayout (App.js)
  // because QuizRoomLanding is not rendered when the user is logged in

  const handleTalkToTutor = () => handleDelayedNavigation(() => navigateWithAction('tutor'));
  const handleDailyChallenge = () => handleDelayedNavigation(() => navigateWithAction('daily'));

  return (
    <div className={`quiz-landing-page ${isExiting ? 'exiting' : ''}`}>
      {/* Hidden file input for direct upload - supports multiple files */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.ppt,.pptx,.doc,.docx,.txt,.md"
        onChange={handleFileSelected}
        multiple
        style={{ display: 'none' }}
      />

      {/* Login Prompt Modal - shows when user tries to upload without being logged in */}
      {showLoginPrompt && (
        <div className="login-prompt-overlay" onClick={handleCloseLoginPrompt}>
          <div className="login-prompt-modal glassmorphic" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <button className="login-prompt-close" onClick={handleCloseLoginPrompt} aria-label="Close">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Mascot */}
            <div className="login-prompt-mascot">
              <NurseQuizMascot size={100} isExcited={true} />
            </div>

            {/* Content */}
            <h2 className="login-prompt-title">{t('landing.loginPromptTitle', 'Almost there!')}</h2>
            <p className="login-prompt-message">
              {t('landing.loginPromptMessage', 'Sign in to save your progress and track your learning journey.')}
            </p>

            {/* Show file names so user knows they're ready */}
            {pendingFiles.length > 0 && (
              <div className="login-prompt-file-indicator">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 2H6C5.44772 2 5 2.44772 5 3V21C5 21.5523 5.44772 22 6 22H18C18.5523 22 19 21.5523 19 21V7L14 2Z" />
                  <path d="M14 2V7H19" />
                </svg>
                <span className="file-name">
                  {pendingFiles.length === 1
                    ? pendingFiles[0].name
                    : `${pendingFiles[0].name} +${pendingFiles.length - 1} more`}
                </span>
                <span className="file-status">
                  {pendingFiles.length === 1
                    ? t('landing.fileReady', 'Ready to upload')
                    : t('landing.filesReady', `${pendingFiles.length} files ready`)}
                </span>
              </div>
            )}

            {/* Quick Google Sign-in - Less friction */}
            <button
              type="button"
              className="login-prompt-google-btn"
              onClick={handleGoogleSignInFromPrompt}
              disabled={isGoogleSigningIn}
            >
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt="Google logo"
                className="google-logo"
              />
              <span>{isGoogleSigningIn ? t('landing.signingIn', 'Signing in...') : t('landing.continueWithGoogle', 'Continue with Google')}</span>
            </button>

            {/* Divider */}
            <div className="login-prompt-divider">
              <span>{t('landing.or', 'or')}</span>
            </div>

            {/* Benefits list */}
            <ul className="login-prompt-benefits">
              <li>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {t('landing.benefit1', 'Save your quiz progress')}
              </li>
              <li>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {t('landing.benefit2', 'Track your learning stats')}
              </li>
              <li>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {t('landing.benefit3', 'Access your uploaded notes anytime')}
              </li>
            </ul>

            {/* Action buttons */}
            <div className="login-prompt-actions">
              <button className="login-prompt-btn primary" onClick={handleSignupFromPrompt}>
                {t('landing.createAccount', 'Create Free Account')}
              </button>
              <button className="login-prompt-btn secondary" onClick={handleLoginFromPrompt}>
                {t('landing.haveAccount', 'I already have an account')}
              </button>
            </div>

            {/* Reassurance */}
            <p className="login-prompt-reassurance">
              {t('landing.fileWillBeUploaded', 'Your file will be uploaded automatically after you sign in.')}
            </p>
          </div>
        </div>
      )}

      {/* Simple Loading Overlay - shows while generating quiz */}
      {uploadPhase === 'processing' && (
        <div className="simple-loading-overlay">
          <div className="simple-loading-content">
            <div className="simple-loading-spinner" />
            <p className="simple-loading-text">{t('landing.generatingQuestions', 'Generating NCLEX-style questions...')}</p>
            <p className="simple-loading-subtext">{t('landing.analyzingNotes', 'Analyzing your notes')}</p>
          </div>
        </div>
      )}

      {/* Anime exit flash overlay */}
      {showFlash && <div className="page-exit-flash" />}

      
      {/* ============================================
          HERO SECTION
          ============================================ */}
      <section className="hero-section" ref={heroRef}>
        {/* Ambient background glow */}
        <div className="landing-ambient-glow" />

        {/* Top navigation bar */}
        <nav className="landing-nav">
        <div className="landing-brand">
          <span className="brand-name">NurseQuizAI</span>
        </div>
        <div className="landing-auth-header">
          {/* Subtle dark mode toggle */}
          <button
            className="theme-toggle-btn"
            onClick={toggleDarkMode}
            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDarkMode ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/>
                <path d="M12 2V4M12 20V22M4 12H2M22 12H20M5.64 5.64L4.22 4.22M19.78 19.78L18.36 18.36M5.64 18.36L4.22 19.78M19.78 4.22L18.36 5.64" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
          {currentUser ? (
            <button
              className="auth-header-btn logout-btn"
              onClick={handleSignOut}
            >
              {t('landing.logout', 'Log out')}
            </button>
          ) : (
            <>
              <button
                className="auth-header-btn login-btn"
                onClick={() => handleDelayedNavigation(() => navigate('/login'))}
                onMouseEnter={() => handleCardHover('login')}
                onMouseLeave={handleCardHoverEnd}
              >
                {t('landing.login', 'Log in')}
              </button>
              <button
                className="auth-header-btn signup-btn"
                onClick={() => handleDelayedNavigation(() => navigate('/signup'))}
                onMouseEnter={() => handleCardHover('signup')}
                onMouseLeave={handleCardHoverEnd}
              >
                {t('landing.signup', 'Sign up')}
              </button>
            </>
          )}
        </div>
      </nav>

      <div className="quiz-landing-wrapper">
        <div className="quiz-landing-content">
          {/* Mascot - follows scroll with anime-style flying */}
          <div
            ref={mascotRef}
            className={`landing-mascot ${isSpinning ? 'spinning' : ''} ${mascotIsFloating ? 'floating' : ''} ${mascotIsExitingFloat ? 'exiting-float' : ''} ${mascotIsReturning ? 'returning' : ''} ${mascotIsFlying ? 'flying' : 'idle'} fly-${flyDirection}`}
          >
            <NurseQuizMascot size={120} lookDirection={getMascotLookDirection()} isExcited={mascotIsExcited} isSurprised={mascotIsSurprised} />
            {/* Motion trails for anime effect */}
            {mascotIsFlying && mascotIsFloating && (
              <div className="mascot-motion-trails">
                <span className="trail"></span>
                <span className="trail"></span>
                <span className="trail"></span>
              </div>
            )}
          </div>

          {/* Welcome Header */}
          <header className="landing-header">
            <p className="landing-slogan">
              {t('landing.sloganLine1', 'Too much to study. Not enough time.')}
              <br />
              <span className="slogan-highlight">{t('landing.sloganLine2', 'We fix that — by turning your notes into instant practice quizzes.')}</span>
            </p>
            <h2 className="landing-subtitle">
              {t('landing.subtitle', 'Spend less time studying, more time understanding.')}
            </h2>
          </header>

          {/* Primary CTA Section - Upload Notes */}
          <div className="hero-cta-section">
            <button
              className={`hero-upload-btn ${pressedCard === 'upload' ? 'pressed' : ''}`}
              onClick={handleUploadNotes}
              onMouseDown={() => handleCardPress('upload')}
              onMouseUp={handleCardRelease}
              onMouseEnter={() => handleCardHover('upload')}
              onMouseLeave={() => { handleCardRelease(); handleCardHoverEnd(); }}
              onTouchStart={() => handleCardPress('upload')}
              onTouchEnd={handleCardRelease}
              aria-label={t('landing.uploadNotes', 'Upload Your Notes')}
            >
              <svg className="upload-btn-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 15V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M17 8L12 3L7 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 3V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>{t('landing.uploadNotesTitle', 'Upload a file, save a life')}</span>
            </button>
          </div>

          {/* Feature Cards - Inline in Hero */}
          {/* <div className="hero-features">
            <button
              className={`hero-feature-card nclex-card ${pressedCard === 'nclex' ? 'pressed' : ''}`}
              onClick={handleStudyNCLEX}
              onMouseDown={() => handleCardPress('nclex')}
              onMouseUp={handleCardRelease}
              onMouseEnter={() => handleCardHover('nclex')}
              onMouseLeave={() => { handleCardRelease(); handleCardHoverEnd(); }}
              onTouchStart={() => handleCardPress('nclex')}
              onTouchEnd={handleCardRelease}
            >
              <span className="popular-badge">{t('landing.mostPopular', 'Most Popular')}</span>
              <div className="hero-feature-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="5" y="4" width="14" height="17" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                  <path d="M8 10L10.5 12.5L16 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="hero-feature-text">
                <span className="hero-feature-title">{t('landing.studyNCLEX', 'NCLEX Prep')}</span>
                <span className="hero-feature-subtitle">{t('landing.nclexSubtitle', 'AI-generated questions • Progress tracking')}</span>
              </div>
            </button>

            <button
              className={`hero-feature-card tutor-card ${pressedCard === 'tutor' ? 'pressed' : ''}`}
              onClick={handleTalkToTutor}
              onMouseDown={() => handleCardPress('tutor')}
              onMouseUp={handleCardRelease}
              onMouseEnter={() => handleCardHover('tutor')}
              onMouseLeave={() => { handleCardRelease(); handleCardHoverEnd(); }}
              onTouchStart={() => handleCardPress('tutor')}
              onTouchEnd={handleCardRelease}
            >
              <div className="hero-feature-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 12C21 16.4183 16.9706 20 12 20C10.5607 20 9.19627 19.7003 8 19.1679L3 21L4.5 16.5C3.55039 15.2226 3 13.6646 3 12C3 7.58172 7.02944 4 12 4C16.9706 4 21 7.58172 21 12Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="hero-feature-title">{t('landing.talkToTutor', 'Talk to Tutor')}</span>
            </button>

            <button
              className={`hero-feature-card challenge-card ${pressedCard === 'challenge' ? 'pressed' : ''}`}
              onClick={handleDailyChallenge}
              onMouseDown={() => handleCardPress('challenge')}
              onMouseUp={handleCardRelease}
              onMouseEnter={() => handleCardHover('challenge')}
              onMouseLeave={() => { handleCardRelease(); handleCardHoverEnd(); }}
              onTouchStart={() => handleCardPress('challenge')}
              onTouchEnd={handleCardRelease}
            >
              <div className="hero-feature-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C12 2 9 5.5 9 9C9 11 10 13 10 13C10 13 8.5 12 7.5 13.5C6.5 15 6 17 7 19C8 21 10 22 12 22C14 22 16 21 17 19C18 17 17.5 15 16.5 13.5C15.5 12 14 13 14 13C14 13 15 11 15 9C15 5.5 12 2 12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="hero-feature-title">{t('landing.dailyChallenge', "Daily Challenge")}</span>
            </button>
          </div> */}

          {/* Social Proof Badges */}
          <div className="landing-social-proof">
            <div className="social-proof-badge">
              <div className="badge-icon heart-nurses-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="#ef4444" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17 21V19C17 16.7909 15.2091 15 13 15H5C2.79086 15 1 16.7909 1 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
                  <path d="M23 21V19C23 17.1362 21.7252 15.5701 20 15.126" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M16 3.12598C17.7252 3.56983 19 5.13616 19 6.99998C19 8.8638 17.7252 10.4301 16 10.874" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <span className="badge-text">{t('landing.badge1', 'Made with nurses')}</span>
            </div>
            <div className="social-proof-divider" />
            <div className="social-proof-badge">
              <div className="badge-icon stars-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                </svg>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                </svg>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                </svg>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                </svg>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                </svg>
              </div>
              <span className="badge-text">{t('landing.badge2', 'Trusted across North America')}</span>
            </div>
          </div>

          {/* Bottom motivational text */}
          <div className="landing-footer">
            <p className="footer-text">
              {t('landing.footerText', 'Built for Nursing exams and NCLEX')}
            </p>
          </div>
        </div>
      </div>
      </section>

      {/* ============================================
          PRODUCT SHOWCASE SECTION
          Animated demo cycling through all phases
          ============================================ */}
      <section className="product-showcase-section">
        <div className="showcase-container">
          <h2 className="showcase-title">{t('landing.showcaseTitle', 'See How It Works')}</h2>
          <p className="showcase-subtitle">{t('landing.showcaseSubtitle', 'From notes to knowledge in minutes')}</p>

          {/* Animated Demo Card */}
          <div className="demo-container">
            <div className="demo-card">
              {/* Demo Header with phase indicators */}
              <div className="demo-header">
                <div className="demo-phase-indicators">
                  <span className="demo-phase-dot phase-1"></span>
                  <span className="demo-phase-dot phase-2"></span>
                  <span className="demo-phase-dot phase-3"></span>
                </div>
                <span className="demo-phase-label">{t('landing.demoLabel', 'Live Demo')}</span>
              </div>

              {/* Demo Content - All phases stacked, animated */}
              <div className="demo-content">
                {/* Phase 1: Upload */}
                <div className="demo-phase demo-upload">
                  <div className="demo-upload-area">
                    <div className="demo-file-icon">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M14 2H6C5.44772 2 5 2.44772 5 3V21C5 21.5523 5.44772 22 6 22H18C18.5523 22 19 21.5523 19 21V7L14 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M14 2V7H19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span className="demo-upload-text">{t('landing.demoUpload', 'Pharmacology_Notes.pdf')}</span>
                    <div className="demo-upload-progress">
                      <div className="demo-upload-progress-fill"></div>
                    </div>
                  </div>
                </div>

                {/* Phase 2: Generate */}
                <div className="demo-phase demo-generate">
                  <div className="demo-generating">
                    <div className="demo-ai-icon">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span className="demo-generating-text">{t('landing.demoGenerating', 'AI generating NCLEX-style quiz...')}</span>
                    <div className="demo-typing-dots">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                </div>

                {/* Phase 3: Quiz */}
                <div className="demo-phase demo-quiz">
                  <div className="demo-question">
                    <span className="demo-question-number">Q1</span>
                    <p className="demo-question-text">{t('landing.demoQuestion', 'Which medication class is primarily used to treat hypertension?')}</p>
                  </div>
                  <div className="demo-answers">
                    <div className="demo-answer">{t('landing.demoAnswer1', 'A. Antihistamines')}</div>
                    <div className="demo-answer selecting">{t('landing.demoAnswer2', 'B. ACE Inhibitors')}</div>
                    <div className="demo-answer">{t('landing.demoAnswer3', 'C. Antibiotics')}</div>
                    <div className="demo-answer">{t('landing.demoAnswer4', 'D. Antidepressants')}</div>
                  </div>
                </div>

                {/* Phase 4: Result */}
                <div className="demo-phase demo-result">
                  <div className="demo-correct">
                    <div className="demo-check-icon">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                        <path d="M8 12L11 15L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span className="demo-correct-text">{t('landing.demoCorrect', 'Correct!')}</span>
                    <div className="demo-score">
                      <span className="demo-score-label">{t('landing.demoScore', 'Your Score')}</span>
                      <span className="demo-score-value">92%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress bar at bottom */}
              <div className="demo-timeline">
                <div className="demo-timeline-fill"></div>
              </div>
            </div>

            {/* Phase labels below */}
            <div className="demo-phase-labels">
              <span className="phase-label">{t('landing.phase1', '1. Upload')}</span>
              <span className="phase-label">{t('landing.phase2', '2. Generate')}</span>
              <span className="phase-label">{t('landing.phase3', '3. Quiz')}</span>
              <span className="phase-label">{t('landing.phase4', '4. Learn')}</span>
            </div>
          </div>

          {/* CTA after showcase */}
          <div className="section-cta">
            <button
              className="section-cta-btn primary"
              onClick={handleUploadNotes}
              onMouseEnter={() => handleCardHover('startLearning')}
              onMouseLeave={handleCardHoverEnd}
            >
              {t('landing.showcaseCta', 'Start Learning Now')}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <p className="section-cta-subtext">{t('landing.showcaseCtaSubtext', 'Free to try • No credit card required')}</p>
          </div>
        </div>
      </section>

      {/* Spacer */}
      <div className="section-spacer" />

      {/* ============================================
          BACKED BY SCIENCE SECTION
          Research-backed statistics
          ============================================ */}
      <section className="science-section">
        <div className="science-container">
          {/* Brain Mascot */}
          <div className="science-brain-mascot">
            <BrainMascot size={140} isExploding={brainIsExploding} />
          </div>

          <h2 className="science-title">{t('landing.scienceTitle', 'Backed by Science')}</h2>
          <p className="science-subtitle">{t('landing.scienceSubtitle', 'Research-proven methods for better learning outcomes')}</p>

          <div className="science-stats-grid">
            {/* Stat 1: Score Higher - Trending up chart icon */}
            <div className="science-stat-card">
              <div className="stat-icon-wrapper">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M23 6L13.5 15.5L8.5 10.5L1 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M17 6H23V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="stat-number"><AnimatedCounter target={73} duration={2000} onComplete={handleCounterComplete} /></div>
              <h3 className="stat-title">{t('landing.stat1Title', 'Score 73% Higher')}</h3>
              <p className="stat-description">{t('landing.stat1Desc', 'Students using AI-powered interactive quizzes score 73% higher on exams than those using traditional study methods')}</p>
              <span className="stat-source">{t('landing.stat1Source', 'Educational Technology Research, 2024')}</span>
            </div>

            {/* Stat 2: Remember More - Brain/memory icon */}
            <div className="science-stat-card">
              <div className="stat-icon-wrapper">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C9.5 2 7.5 4 7.5 6.5C7.5 7.5 7.8 8.4 8.3 9.1C6.9 9.5 6 10.8 6 12.5C6 13.8 6.6 14.9 7.5 15.6C6.6 16.3 6 17.5 6 18.8C6 21 7.8 22 9.5 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M12 2C14.5 2 16.5 4 16.5 6.5C16.5 7.5 16.2 8.4 15.7 9.1C17.1 9.5 18 10.8 18 12.5C18 13.8 17.4 14.9 16.5 15.6C17.4 16.3 18 17.5 18 18.8C18 21 16.2 22 14.5 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M12 2V22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M8 12H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="stat-number"><AnimatedCounter target={85} duration={2200} onComplete={handleCounterComplete} /></div>
              <h3 className="stat-title">{t('landing.stat2Title', 'Remember 85% More')}</h3>
              <p className="stat-description">{t('landing.stat2Desc', 'Students using active learning methods show 85% better retention compared to passive study methods')}</p>
              <span className="stat-source">{t('landing.stat2Source', 'Journal of Educational Psychology, 2023')}</span>
            </div>

            {/* Stat 3: Save Time - Clock icon */}
            <div className="science-stat-card">
              <div className="stat-icon-wrapper">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="stat-number"><AnimatedCounter target={30} duration={1800} onComplete={handleCounterComplete} /></div>
              <h3 className="stat-title">{t('landing.stat3Title', 'Save 30% Study Time')}</h3>
              <p className="stat-description">{t('landing.stat3Desc', 'AI-generated study materials reduce preparation time by 30% while maintaining learning effectiveness')}</p>
              <span className="stat-source">{t('landing.stat3Source', 'Learning Technology Review, 2024')}</span>
            </div>
          </div>

          {/* CTA after science section */}
          <div className="section-cta">
            <button
              className="section-cta-btn secondary"
              onClick={handleUploadNotes}
              onMouseEnter={() => handleCardHover('joinCommunity')}
              onMouseLeave={handleCardHoverEnd}
            >
              <span className="cta-emoji">🔥</span>
              {t('landing.scienceCta', 'Join the Community')}
            </button>
          </div>
        </div>
      </section>

    </div>
  );
};

export default QuizRoomLanding;
