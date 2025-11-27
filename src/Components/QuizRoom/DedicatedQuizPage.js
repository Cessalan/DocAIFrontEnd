import React, { useState, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import HospitalHallway from './HospitalHallway';
import SerumTube from './SerumTube';
import ThemeToggle, { useDarkMode } from '../Common/ThemeToggle';
import './DedicatedQuizPage.css';

// Constants
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

// Demo quiz data for testing
const DEMO_QUIZ_DATA = [
  {
    question: "A 60-year-old male patient with Parkinson's disease is experiencing difficulty with mobility and coordination. As part of the nursing process, what should the nurse prioritize to promote patient-centered outcomes?",
    options: [
      "Schedule frequent rest periods to prevent fatigue.",
      "Collaborate with physical therapy to develop a tailored exercise program.",
      "Encourage the patient to independently perform daily activities.",
      "Implement a high-protein diet to improve muscle strength."
    ],
    answer: "Collaborate with physical therapy to develop a tailored exercise program.",
    topic: "Mobility Enhancement",
    justification: "Collaborating with physical therapy ensures a comprehensive, patient-centered approach that addresses the specific mobility challenges of Parkinson's disease while promoting safety and independence."
  },
  {
    question: "A nurse is caring for a patient who has been diagnosed with type 2 diabetes. Which intervention should the nurse prioritize when developing the patient's plan of care?",
    options: [
      "Administer insulin as ordered before meals.",
      "Teach the patient about blood glucose monitoring.",
      "Restrict the patient's fluid intake.",
      "Encourage the patient to exercise only when blood sugar is high."
    ],
    answer: "Teach the patient about blood glucose monitoring.",
    topic: "Diabetes Management",
    justification: "Patient education about blood glucose monitoring is essential for self-management of diabetes and helps the patient understand how lifestyle choices affect their condition."
  },
  {
    question: "A patient with heart failure is prescribed furosemide (Lasix). Which assessment finding would require the nurse to hold the medication and notify the provider?",
    options: [
      "Blood pressure of 118/76 mmHg",
      "Serum potassium level of 2.8 mEq/L",
      "Heart rate of 78 beats per minute",
      "Weight gain of 0.5 kg over 24 hours"
    ],
    answer: "Serum potassium level of 2.8 mEq/L",
    topic: "Cardiovascular Pharmacology",
    justification: "A potassium level of 2.8 mEq/L indicates hypokalemia, which is a serious side effect of loop diuretics like furosemide. This must be addressed before continuing the medication."
  },
  {
    question: "During a home health visit, the nurse observes that an elderly patient has multiple throw rugs throughout the house. What is the most appropriate nursing intervention?",
    options: [
      "Document the observation in the patient's chart.",
      "Recommend removing or securing the throw rugs to prevent falls.",
      "Suggest the patient wear non-slip socks at all times.",
      "Install grab bars in every room of the house."
    ],
    answer: "Recommend removing or securing the throw rugs to prevent falls.",
    topic: "Fall Prevention",
    justification: "Throw rugs are a significant fall hazard for elderly patients. Removing or securing them directly addresses the identified risk and promotes home safety."
  },
  {
    question: "A nurse is preparing to administer a blood transfusion to a patient. Which action is most important before starting the transfusion?",
    options: [
      "Verify the blood type with another nurse at the bedside.",
      "Administer diphenhydramine prophylactically.",
      "Warm the blood to body temperature.",
      "Start an IV with dextrose solution."
    ],
    answer: "Verify the blood type with another nurse at the bedside.",
    topic: "Blood Transfusion Safety",
    justification: "Verifying blood type with two nurses at the bedside is a critical safety check that prevents potentially fatal transfusion reactions due to blood type incompatibility."
  }
];

// Icon Components
function CheckmarkIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XMarkIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function BackArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  );
}


/**
 * DedicatedQuizPage - A cinematic quiz experience
 *
 * As the user answers correctly, they walk down a hospital hallway
 * toward Room 217, where a child patient awaits their help.
 */
function DedicatedQuizPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [isDarkMode] = useDarkMode();

  // Get quiz data from location state or use demo data
  const quizData = location.state?.quizzes || DEMO_QUIZ_DATA;
  const quizTitle = location.state?.title || 'Room 217';

  // Quiz state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [userAnswers, setUserAnswers] = useState([]);
  const [quizComplete, setQuizComplete] = useState(false);

  // Cinematic state
  const [showPatientMessage, setShowPatientMessage] = useState(false);
  const [messagePhase, setMessagePhase] = useState(0);
  const [cinematicPhase, setCinematicPhase] = useState(0); // 0: initial, 1: serum moving, 2: delivered, 3: light spills, 4: black screen, 5: final message

  // Serum tube state
  const [isAnimating, setIsAnimating] = useState(false);

  // Current question
  const currentQuestion = quizData[currentQuestionIndex];
  const totalQuestions = quizData.length;

  // Calculate correct answers
  const correctCount = useMemo(() => {
    return userAnswers.filter(a => a.isCorrect).length;
  }, [userAnswers]);

  // Calculate hallway progress based on questions ANSWERED (not correct)
  // This way you always walk toward the room regardless of answers
  const hallwayProgress = useMemo(() => {
    return Math.round((userAnswers.length / totalQuestions) * 100);
  }, [userAnswers.length, totalQuestions]);

  // Calculate serum percentage (correct answers)
  const serumPercentage = useMemo(() => {
    return Math.round((correctCount / totalQuestions) * 100);
  }, [correctCount, totalQuestions]);

  // Calculate correct index for current question
  const correctIndex = useMemo(() => {
    if (!currentQuestion) return -1;
    return currentQuestion.options.findIndex(opt => opt === currentQuestion.answer);
  }, [currentQuestion]);

  // Handle answer selection
  const handleSelect = useCallback((index) => {
    if (revealed) return;

    setSelectedIndex(index);
    setRevealed(true);

    const isCorrect = index === correctIndex;

    // Trigger tube animation on correct
    if (isCorrect) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 1200);
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }

    // Record answer
    const answerData = {
      questionIndex: currentQuestionIndex,
      selectedIndex: index,
      selectedText: currentQuestion.options[index],
      correctIndex: correctIndex,
      correctText: currentQuestion.answer,
      isCorrect: isCorrect,
      timestamp: new Date()
    };

    setUserAnswers(prev => [...prev, answerData]);

    // Show feedback after short delay
    setTimeout(() => {
      setShowFeedback(true);
    }, 300);
  }, [revealed, correctIndex, currentQuestionIndex, currentQuestion]);

  // Handle next question
  const handleNext = useCallback(() => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedIndex(null);
      setRevealed(false);
      setShowFeedback(false);
    } else {
      // Quiz complete - trigger cinematic ending sequence
      setQuizComplete(true);

      // Cinematic sequence timeline:
      // Phase 1: Serum glides toward door (2s delay, then animation)
      setTimeout(() => setCinematicPhase(1), 1000);

      // Phase 2: Serum delivered - enters door
      setTimeout(() => setCinematicPhase(2), 3500);

      // Phase 3: Light spills out from door
      setTimeout(() => setCinematicPhase(3), 5000);

      // Phase 4: Fade to black
      setTimeout(() => setCinematicPhase(4), 6500);

      // Phase 5: Final message appears
      setTimeout(() => {
        setCinematicPhase(5);
        setShowPatientMessage(true);
        // Progress through message phases
        setTimeout(() => setMessagePhase(1), 1500);
        setTimeout(() => setMessagePhase(2), 3000);
        setTimeout(() => setMessagePhase(3), 4500);
      }, 8000);
    }
  }, [currentQuestionIndex, totalQuestions]);

  // Handle restart
  const handleRestart = useCallback(() => {
    setCurrentQuestionIndex(0);
    setSelectedIndex(null);
    setRevealed(false);
    setShowFeedback(false);
    setUserAnswers([]);
    setQuizComplete(false);
    setShowPatientMessage(false);
    setMessagePhase(0);
    setCinematicPhase(0);
  }, []);

  // Handle back navigation
  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  // Render cinematic results screen
  if (quizComplete) {
    return (
      <div className={`dedicated-quiz-page results-page cinematic phase-${cinematicPhase} ${isDarkMode ? 'dark-theme' : 'light-theme'}`}>
        {/* Hospital hallway background at final stage - always 100% since we reached the room */}
        <HospitalHallway progress={100} isComplete={true} />

        {/* Floating controls - hidden during early cinematic phases */}
        {cinematicPhase >= 5 && (
          <div className="quiz-floating-controls">
            <button className="quiz-back-button" onClick={handleBack} aria-label="Go back">
              <BackArrowIcon />
            </button>
            <ThemeToggle />
          </div>
        )}

        {/* Black overlay for fade to black effect */}
        <div className={`cinematic-black-overlay ${cinematicPhase >= 4 ? 'visible' : ''}`} />

        {/* Light spill effect from door */}
        <div className={`door-light-spill ${cinematicPhase >= 3 ? 'visible' : ''}`} />

        {/* Cinematic overlay content */}
        <div className="cinematic-results">
          {/* Serum delivery animation - glides toward door */}
          <div className={`serum-delivery phase-${cinematicPhase} ${cinematicPhase >= 2 ? 'delivered' : ''}`}>
            <div className="serum-tube-wrapper">
              <SerumTube
                correctCount={correctCount}
                totalQuestions={totalQuestions}
                size={cinematicPhase >= 1 ? 120 : 160}
              />
            </div>
            {cinematicPhase < 2 && (
              <div className="delivery-label">
                {correctCount > 0 ? `${correctCount} doses ready` : 'No serum collected'}
              </div>
            )}
          </div>

          {/* Patient message sequence - only after fade to black */}
          {cinematicPhase >= 5 && showPatientMessage && (
            <div className="patient-message-container">
              <div className="cinematic-header">
                <span className="serum-delivered-text">Serum delivered.</span>
                <span className="kept-alive-text">You kept him alive today.</span>
              </div>

              <div className={`patient-message ${messagePhase >= 1 ? 'visible' : ''}`}>
                <p className="message-text">His eyes flutter open...</p>
              </div>

              <div className={`patient-message ${messagePhase >= 2 ? 'visible' : ''}`}>
                <p className="message-text breathing">His breathing steadies.</p>
              </div>

              <div className={`patient-message whisper ${messagePhase >= 3 ? 'visible' : ''}`}>
                <p className="message-quote">"You came back..."</p>
              </div>
            </div>
          )}

          {/* Final stats and actions */}
          <div className={`results-final ${messagePhase >= 3 ? 'visible' : ''}`}>
            <div className="final-message">
              {serumPercentage >= 80
                ? "You saved him today."
                : serumPercentage >= 50
                  ? "He's stabilizing. Keep learning."
                  : "He needs you to keep trying."}
            </div>

            <div className="results-stats">
              <span className="stat-value">{serumPercentage}%</span>
              <span className="stat-label">{correctCount} of {totalQuestions} correct</span>
            </div>

            <div className="results-actions">
              <button className="retry-btn" onClick={handleRestart}>
                Save Eli again tomorrow
              </button>
              <button className="back-btn" onClick={handleBack}>
                Review answers
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`dedicated-quiz-page cinematic ${isDarkMode ? 'dark-theme' : 'light-theme'}`}>
      {/* Hospital hallway background - progress based on questions answered */}
      <HospitalHallway progress={hallwayProgress} />

      {/* Floating controls */}
      <div className="quiz-floating-controls">
        <button className="quiz-back-button" onClick={handleBack} aria-label="Go back">
          <BackArrowIcon />
        </button>
        <ThemeToggle />
      </div>

      {/* Main content */}
      <main className="quiz-page-main cinematic-layout">
        {/* Left sidebar - Serum Tube */}
        <aside className="quiz-sidebar-left">
          <div className="tube-container">
            <SerumTube
              correctCount={correctCount}
              totalQuestions={totalQuestions}
              isAnimating={isAnimating}
              size={280}
            />
            <div className="progress-hint">
              {hallwayProgress < 20 && "The hallway is dark..."}
              {hallwayProgress >= 20 && hallwayProgress < 40 && "Lights flicker on ahead"}
              {hallwayProgress >= 40 && hallwayProgress < 60 && "You're getting closer"}
              {hallwayProgress >= 60 && hallwayProgress < 80 && "Room 217 is near"}
              {hallwayProgress >= 80 && "The door begins to open..."}
            </div>
          </div>
        </aside>

        {/* Center - Quiz content */}
        <div className="quiz-content-area">
          <div className="quiz-card glassmorphic">
            {/* Compact header inside card */}
            <div className="quiz-card-header">
              <div className="header-left-section">
                <span className="question-counter">
                  Question {currentQuestionIndex + 1} of {totalQuestions}
                </span>
                {currentQuestion?.topic && (
                  <div className="topic-badge">
                    <span className="topic-dot"></span>
                    <span className="topic-text">{currentQuestion.topic}</span>
                  </div>
                )}
              </div>
              <span className="quiz-title">Room 217</span>
            </div>

            {/* Question */}
            <div className="question-text">
              {currentQuestion?.question}
            </div>

            {/* Options */}
            <div className="options-container">
              {currentQuestion?.options?.map((option, index) => {
                const isSelected = index === selectedIndex;
                const isAnswer = index === correctIndex;

                let optionClass = 'quiz-option';
                if (revealed) {
                  if (isAnswer) {
                    optionClass += ' correct';
                  } else if (isSelected) {
                    optionClass += ' incorrect';
                  } else {
                    optionClass += ' disabled';
                  }
                }
                if (isSelected) {
                  optionClass += ' selected';
                }

                return (
                  <div
                    key={index}
                    className={optionClass}
                    onClick={() => handleSelect(index)}
                    role="button"
                    tabIndex={revealed ? -1 : 0}
                    onKeyDown={(e) => {
                      if (!revealed && (e.key === 'Enter' || e.key === ' ')) {
                        handleSelect(index);
                      }
                    }}
                  >
                    <span className={`option-letter ${isSelected ? 'selected' : ''} ${revealed && isAnswer ? 'correct' : ''}`}>
                      {OPTION_LETTERS[index]}
                    </span>
                    <span className="option-text">{option}</span>

                    {revealed && isAnswer && (
                      <span className="option-icon checkmark">
                        <CheckmarkIcon />
                      </span>
                    )}
                    {revealed && !isAnswer && isSelected && (
                      <span className="option-icon x-mark">
                        <XMarkIcon />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Feedback */}
            {showFeedback && (
              <div className={`quiz-feedback ${selectedIndex === correctIndex ? 'correct' : 'incorrect'}`}>
                <div className="feedback-icon-wrapper">
                  {selectedIndex === correctIndex ? (
                    <div className="feedback-icon correct">
                      <CheckmarkIcon />
                    </div>
                  ) : (
                    <div className="feedback-icon incorrect">
                      <XMarkIcon />
                    </div>
                  )}
                </div>
                <div className="feedback-content">
                  <span className={`feedback-status ${selectedIndex === correctIndex ? 'correct' : 'incorrect'}`}>
                    {selectedIndex === correctIndex ? 'Correct' : 'Incorrect'}
                  </span>
                  {currentQuestion?.justification && (
                    <p className="feedback-explanation">
                      {currentQuestion.justification}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Next button */}
            {showFeedback && (
              <button className="next-button" onClick={handleNext}>
                {currentQuestionIndex < totalQuestions - 1 ? 'Continue →' : 'Enter Room 217 →'}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default DedicatedQuizPage;
