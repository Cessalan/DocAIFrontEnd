import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import './QuizNavigation.css'; // We'll add styles here

const QuizFeedback = ({ onFeedbackSubmit, hasSubmitted }) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [feedbackStep, setFeedbackStep] = useState('initial'); // initial, rating, detail, thanks
    const [rating, setRating] = useState(null);
    const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
    const [popoverPlacement, setPopoverPlacement] = useState('right'); // right | left
    const triggerRef = useRef(null);

    const handleToggle = () => {
        if (hasSubmitted) return; // Don't open if already submitted
        setIsOpen(!isOpen);
        if (!isOpen) setFeedbackStep('initial');
    };

    // Update popover position when opened and on scroll
    useEffect(() => {
        const updatePosition = () => {
            if (isOpen && triggerRef.current) {
                const rect = triggerRef.current.getBoundingClientRect();
                const popoverWidth = 220;
                const popoverHeight = 200;
                const spacing = 12; // Spacing from trigger button
                const margin = 12;

                console.log('🎯 Button position:', {
                    top: rect.top,
                    left: rect.left,
                    right: rect.right,
                    bottom: rect.bottom,
                    width: rect.width,
                    height: rect.height
                });

                // Prefer to sit to the right of the button, vertically centered
                let placement = 'right';
                let left = rect.right + spacing;
                let top = rect.top + (rect.height / 2) - (popoverHeight / 2);

                // If it overflows on the right, flip to the left
                if (left + popoverWidth + margin > window.innerWidth) {
                    left = rect.left - popoverWidth - spacing;
                    placement = 'left';
                }

                // Clamp within viewport horizontally and vertically
                left = Math.max(margin, Math.min(left, window.innerWidth - popoverWidth - margin));
                top = Math.max(margin, Math.min(top, window.innerHeight - popoverHeight - margin));

                console.log('📍 Popover position:', { top, left });

                setPopoverPosition({ top, left });
                setPopoverPlacement(placement);
            }
        };

        // Update position initially
        updatePosition();

        // Update position on scroll (for chat interface scrolling)
        if (isOpen) {
            window.addEventListener('scroll', updatePosition, true);
            window.addEventListener('resize', updatePosition);

            return () => {
                window.removeEventListener('scroll', updatePosition, true);
                window.removeEventListener('resize', updatePosition);
            };
        }
    }, [isOpen]);

    // Close popover when clicking outside
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event) => {
            if (
                triggerRef.current &&
                !triggerRef.current.contains(event.target) &&
                !event.target.closest('.feedback-popover')
            ) {
                setIsOpen(false);
                setFeedbackStep('initial');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Hide the entire component if feedback has been submitted
    if (hasSubmitted) {
        return null;
    }

    const handleRating = (value) => {
        setRating(value);
        setFeedbackStep('detail');
    };

    const submitFeedback = (detail) => {
        const feedbackData = { rating, detail };
        console.log('Feedback submitted:', feedbackData);

        if (onFeedbackSubmit) {
            onFeedbackSubmit(feedbackData);
        }

        setFeedbackStep('thanks');
        setTimeout(() => {
            setIsOpen(false);
            setFeedbackStep('initial');
        }, 2000);
    };

    // Render the popover content
    const renderPopover = () => {
        if (!isOpen) return null;

        const popoverContent = (
            <div
                className={`feedback-popover feedback-popover-portal placement-${popoverPlacement}`}
                style={{
                    position: 'fixed',
                    top: `${popoverPosition.top}px`,
                    left: `${popoverPosition.left}px`
                }}
            >
                <div className="feedback-header">
                    <h4>{t('quizFeedback.title', 'Quick Feedback')}</h4>
                    <button className="close-btn" onClick={handleToggle}>×</button>
                </div>

                <div className="feedback-content">
                    {feedbackStep === 'initial' && (
                        <div className="feedback-step-initial">
                            <p>{t('quizFeedback.question', 'How is your quiz experience?')}</p>
                            <div className="emoji-rating">
                                <button onClick={() => handleRating('bad')} title={t('quizFeedback.ratingBad', 'Bad')}>☹️</button>
                                <button onClick={() => handleRating('neutral')} title={t('quizFeedback.ratingOkay', 'Okay')}>😐</button>
                                <button onClick={() => handleRating('good')} title={t('quizFeedback.ratingGood', 'Good')}>😄</button>
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
                                        <button onClick={() => submitFeedback('too_hard')}>{t('quizFeedback.tooHard', 'Too Hard')}</button>
                                        <button onClick={() => submitFeedback('confusing')}>{t('quizFeedback.confusing', 'Confusing')}</button>
                                        <button onClick={() => submitFeedback('bugs')}>{t('quizFeedback.bugs', 'Bugs')}</button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={() => submitFeedback('content')}>{t('quizFeedback.content', 'Content')}</button>
                                        <button onClick={() => submitFeedback('ui')}>{t('quizFeedback.design', 'Design')}</button>
                                        <button onClick={() => submitFeedback('learning')}>{t('quizFeedback.learning', 'Learning')}</button>
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
        );

        return createPortal(popoverContent, document.body);
    };

    return (
        <>
            <div className="quiz-feedback-container">
                {/* Trigger Button */}
                <button
                    ref={triggerRef}
                    className={`feedback-trigger-btn ${isOpen ? 'active' : ''}`}
                    onClick={handleToggle}
                    title={t('quizFeedback.leaveFeedback', 'Leave Feedback')}
                >
                    <span className="feedback-icon">💬</span>
                </button>
            </div>

            {/* Popover Content - Rendered to body via Portal */}
            {renderPopover()}
        </>
    );
};

export default QuizFeedback;
