import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './QuizNavigation.css'; // We'll add styles here

const QuizFeedback = () => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [feedbackStep, setFeedbackStep] = useState('initial'); // initial, rating, detail, thanks
    const [rating, setRating] = useState(null);

    const handleToggle = () => {
        setIsOpen(!isOpen);
        if (!isOpen) setFeedbackStep('initial');
    };

    const handleRating = (value) => {
        setRating(value);
        setFeedbackStep('detail');
    };

    const submitFeedback = (detail) => {
        // Here you would send the data to your backend
        console.log('Feedback submitted:', { rating, detail });
        setFeedbackStep('thanks');
        setTimeout(() => {
            setIsOpen(false);
            setFeedbackStep('initial');
        }, 2000);
    };

    return (
        <div className="quiz-feedback-container">
            {/* Trigger Button */}
            <button
                className={`feedback-trigger-btn ${isOpen ? 'active' : ''}`}
                onClick={handleToggle}
                title={t('quizFeedback.leaveFeedback', 'Leave Feedback')}
            >
                <span className="feedback-icon">💬</span>
            </button>

            {/* Popover Content */}
            {isOpen && (
                <div className="feedback-popover">
                    <div className="feedback-header">
                        <h4>{t('quizFeedback.title', 'Quick Feedback')}</h4>
                        <button className="close-btn" onClick={handleToggle}>×</button>
                    </div>

                    <div className="feedback-content">
                        {feedbackStep === 'initial' && (
                            <div className="feedback-step-initial">
                                <p>{t('quizFeedback.question', 'How is your quiz experience?')}</p>
                                <div className="emoji-rating">
                                    <button onClick={() => handleRating('bad')} title="Bad">☹️</button>
                                    <button onClick={() => handleRating('neutral')} title="Okay">😐</button>
                                    <button onClick={() => handleRating('good')} title="Good">😄</button>
                                </div>
                            </div>
                        )}

                        {feedbackStep === 'detail' && (
                            <div className="feedback-step-detail">
                                <p>
                                    {rating === 'bad'
                                        ? t('quizFeedback.whatWrong', 'Oh no! What went wrong?')
                                        : t('quizFeedback.whatLike', 'What do you like most?')}
                                </p>
                                <div className="feedback-options">
                                    {rating === 'bad' ? (
                                        <>
                                            <button onClick={() => submitFeedback('too_hard')}>Too Hard</button>
                                            <button onClick={() => submitFeedback('confusing')}>Confusing</button>
                                            <button onClick={() => submitFeedback('bugs')}>Bugs</button>
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={() => submitFeedback('content')}>Content</button>
                                            <button onClick={() => submitFeedback('ui')}>Design</button>
                                            <button onClick={() => submitFeedback('learning')}>Learning</button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {feedbackStep === 'thanks' && (
                            <div className="feedback-step-thanks">
                                <p>🎉 {t('quizFeedback.thanks', 'Thanks for your help!')}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default QuizFeedback;
