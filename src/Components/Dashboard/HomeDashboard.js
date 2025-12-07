import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../Contexts/AuthContext/AuthContext';
import { useProgress } from '../../Contexts/ProgressContext/ProgressContext';
import { getUserExams, getExamReadiness, getExamChat } from '../../Services/ExamService';
import AddExamModal from './AddExamModal';
import ExamCountdown from '../Common/ExamCountdown';
import './HomeDashboard.css';

/**
 * HomeDashboard - Main dashboard for logged in users
 * Shows: Upcoming exam countdown, readiness, weak topics, streak, quick actions
 */
const HomeDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const {
    currentStreak,
    totalXP,
    currentLevel,
    dailyCorrectAnswers,
    dailySerumGoal,
    isSerumComplete,
  } = useProgress();

  const [exams, setExams] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddExamModal, setShowAddExamModal] = useState(false);
  const [examReadinessMap, setExamReadinessMap] = useState({}); // Map of examId -> readiness data
  const [examChats, setExamChats] = useState({}); // Map of examId -> chatId

  // Load user's exams, their linked chats, and readiness data
  useEffect(() => {
    const loadExams = async () => {
      if (!currentUser?.uid) {
        setIsLoading(false);
        return;
      }

      try {
        const userExams = await getUserExams(currentUser.uid);
        setExams(userExams);

        // Fetch chat IDs and readiness for all exams in parallel
        const chatMap = {};
        const readinessMap = {};

        await Promise.all(
          userExams.map(async (exam) => {
            const [chat, readiness] = await Promise.all([
              getExamChat(exam.id),
              getExamReadiness(exam.id)
            ]);

            if (chat) {
              chatMap[exam.id] = chat.id;
            }
            readinessMap[exam.id] = readiness;
          })
        );

        setExamChats(chatMap);
        setExamReadinessMap(readinessMap);
      } catch (error) {
        console.error('Error loading exams:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadExams();
  }, [currentUser]);

  // Get motivational message based on streak
  const getStreakMessage = () => {
    if (currentStreak === 0) return t('dashboard.streak.start', 'Start your streak today!');
    if (currentStreak === 1) return t('dashboard.streak.first', 'Great start!');
    if (currentStreak < 7) return t('dashboard.streak.building', 'Keep it up!');
    if (currentStreak < 30) return t('dashboard.streak.strong', 'You\'re on fire!');
    return t('dashboard.streak.legend', 'Legendary!');
  };

  // Get all upcoming exams sorted by date
  const upcomingExams = useMemo(() => {
    if (!exams || exams.length === 0) return [];

    const now = new Date();
    return exams
      .filter(exam => new Date(exam.date) > now)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [exams]);

  // Handle exam added
  const handleExamAdded = async (newExam) => {
    setExams(prev => [...prev, newExam]);
    setShowAddExamModal(false);

    // Fetch the chat for the new exam
    const chat = await getExamChat(newExam.id);
    if (chat) {
      setExamChats(prev => ({ ...prev, [newExam.id]: chat.id }));
    }
  };

  // Navigate to exam study chat
  const handleGoToExamChat = (examId) => {
    const chatId = examChats[examId];
    if (chatId) {
      navigate(`/c/${chatId}`);
    } else {
      // If no chat exists, create one by navigating to new chat
      navigate('/c');
    }
  };

  // Handle quick action - start new chat
  const handleStartNewChat = () => {
    navigate('/c');
  };

  if (isLoading) {
    return (
      <div className="dashboard-loading">
        <div className="dashboard-loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="home-dashboard">
      {/* Upcoming Exams Section */}
      {upcomingExams.length > 0 ? (
        <div className="upcoming-exams-section">
          <div className="section-header">
            <h2 className="section-title">
              {t('dashboard.upcomingExams.title', 'Upcoming Exams')}
            </h2>
            <button
              className="add-exam-small-btn"
              onClick={() => setShowAddExamModal(true)}
            >
              + {t('dashboard.examsList.add', 'Add')}
            </button>
          </div>

          <div className="exams-cards-list">
            {upcomingExams.map((exam, index) => {
              const isFirst = index === 0;
              const readiness = examReadinessMap[exam.id] || { percentage: 0, hasStarted: false };

              return (
                <div
                  key={exam.id}
                  className={`exam-card ${isFirst ? 'exam-card-primary' : ''}`}
                  onClick={() => handleGoToExamChat(exam.id)}
                >
                  <div className="exam-card-content">
                    <div className="exam-card-top">
                      <div className="exam-card-left">
                        <span className="exam-card-icon">{isFirst ? '🎯' : '📖'}</span>
                        <div className="exam-card-info">
                          <h3 className="exam-card-title">{exam.name}</h3>
                          <ExamCountdown
                            examDate={exam.date}
                            size="small"
                            showSeconds={true}
                          />
                        </div>
                      </div>
                      <div className="exam-card-right">
                        <span className="exam-card-study-btn">
                          {t('dashboard.exam.study', 'Study')} →
                        </span>
                      </div>
                    </div>

                    {/* Progress section */}
                    <div className="exam-card-progress">
                      <div className="exam-progress-header">
                        <span className="exam-progress-label">
                          {readiness.hasStarted
                            ? t('dashboard.readiness.short', '{{percent}}% ready', { percent: readiness.percentage })
                            : t('dashboard.readiness.notStartedShort', 'Not started')
                          }
                        </span>
                        <span className="exam-progress-stats">
                          {readiness.hasStarted && readiness.totalQuestions > 0
                            ? `${readiness.correctAnswers}/${readiness.totalQuestions}`
                            : ''
                          }
                        </span>
                      </div>
                      <div className="exam-progress-bar">
                        <div
                          className="exam-progress-fill"
                          style={{ width: `${readiness.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="dashboard-exam-card">
          <div className="no-exam-state">
            <span className="no-exam-icon">📚</span>
            <h2 className="no-exam-title">
              {t('dashboard.noExam.title', 'No upcoming exams')}
            </h2>
            <p className="no-exam-description">
              {t('dashboard.noExam.description', 'Add an exam to track your preparation progress')}
            </p>
            <button
              className="add-exam-btn"
              onClick={() => setShowAddExamModal(true)}
            >
              {t('dashboard.noExam.addButton', 'Add an exam')}
            </button>
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="dashboard-stats-row">
        {/* Streak Card */}
        <div className="dashboard-stat-card streak-stat">
          <div className="stat-icon-wrapper">
            <span className="stat-icon">🔥</span>
          </div>
          <div className="stat-content">
            <span className="stat-value">{currentStreak}</span>
            <span className="stat-label">
              {currentStreak === 1
                ? t('dashboard.streak.day', 'day streak')
                : t('dashboard.streak.days', 'day streak')
              }
            </span>
          </div>
          <span className="stat-message">{getStreakMessage()}</span>
        </div>

        {/* Daily Progress Card */}
        <div className="dashboard-stat-card daily-stat">
          <div className="stat-icon-wrapper">
            <span className="stat-icon">🧪</span>
          </div>
          <div className="stat-content">
            <span className="stat-value">{dailyCorrectAnswers}/{dailySerumGoal}</span>
            <span className="stat-label">
              {t('dashboard.daily.label', 'daily goal')}
            </span>
          </div>
          {isSerumComplete && (
            <span className="stat-complete-badge">
              {t('dashboard.daily.complete', 'Complete!')}
            </span>
          )}
        </div>

        {/* Level Card */}
        <div className="dashboard-stat-card level-stat">
          <div className="stat-icon-wrapper">
            <span className="stat-icon">⭐</span>
          </div>
          <div className="stat-content">
            <span className="stat-value">{t('dashboard.level.value', 'Level {{level}}', { level: currentLevel })}</span>
            <span className="stat-label">{totalXP} XP</span>
          </div>
        </div>
      </div>

      {/* Quick Action - Start New Chat */}
      <button className="dashboard-new-chat-btn" onClick={handleStartNewChat}>
        <span className="new-chat-icon">💬</span>
        <span className="new-chat-text">{t('dashboard.quickActions.newChat', 'Start a new chat')}</span>
        <span className="new-chat-arrow">→</span>
      </button>

      {/* Add Exam Modal */}
      {showAddExamModal && (
        <AddExamModal
          onClose={() => setShowAddExamModal(false)}
          onExamAdded={handleExamAdded}
        />
      )}
    </div>
  );
};

export default HomeDashboard;
