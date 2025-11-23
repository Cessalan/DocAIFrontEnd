import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './FlashcardNavigation.css';

const FlashcardFeedback = ({ onFeedbackSubmit, hasSubmitted }) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [feedbackStep, setFeedbackStep] = useState('initial'); // initial, rating, detail, thanks
    const [rating, setRating] = useState(null);
    const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
    const buttonRef = useRef(null);
    const popoverRef = useRef(null);

    const handleToggle = () => {
        if (hasSubmitted) return; // Don't open if already submitted
        setIsOpen(!isOpen);
        if (!isOpen) setFeedbackStep('initial');
    };

    // Calculate popover position when opening
    useEffect(() => {
        if (isOpen && buttonRef.current) {
            const buttonRect = buttonRef.current.getBoundingClientRect();
            const popoverWidth = 220;
            const popoverHeight = 200; // approximate
            const spacing = 8;

            // Try to position to the right of the button
            let left = buttonRect.right + spacing;
            let top = buttonRect.top;

            // If it would overflow the right edge, position to the left
            if (left + popoverWidth > window.innerWidth) {
                left = buttonRect.left - popoverWidth - spacing;
            }

            // Ensure it doesn't overflow the bottom
            if (top + popoverHeight > window.innerHeight) {
                top = window.innerHeight - popoverHeight - spacing;
            }

            // Ensure it doesn't overflow the top
            if (top < spacing) {
                top = spacing;
            }

            setPopoverPosition({ top, left });
        }
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
        console.log('Flashcard Feedback submitted:', feedbackData);

        if (onFeedbackSubmit) {
            onFeedbackSubmit(feedbackData);
        }

        setFeedbackStep('thanks');
        setTimeout(() => {
            setIsOpen(false);
            setFeedbackStep('initial');
        }, 2000);
    };

    return (
        <div className="flashcard-feedback-container">
            {/* Trigger Button */}
            <button
                ref={buttonRef}
                className={`feedback-trigger-btn ${isOpen ? 'active' : ''} ${hasSubmitted ? 'submitted' : ''}`}
                onClick={handleToggle}
                title={t('flashcardFeedback.leaveFeedback', 'Leave Feedback')}
            >
                <span className="feedback-icon">💬</span>
            </button>

            {/* Popover Content */}
            {isOpen && (
                <div
                    ref={popoverRef}
                    className="feedback-popover"
                    style={{
                        top: `${popoverPosition.top}px`,
                        left: `${popoverPosition.left}px`
                    }}
                >
                    <div className="feedback-header">
                        <h4>{t('flashcardFeedback.title', 'Quick Feedback')}</h4>
                        <button className="close-btn" onClick={handleToggle}>×</button>
                    </div>

                    <div className="feedback-content">
                        {feedbackStep === 'initial' && (
                            <div className="feedback-step-initial">
                                <p>{t('flashcardFeedback.question', 'How is your flashcard experience?')}</p>
                                <div className="emoji-rating">
                                    <button onClick={() => handleRating('bad')} title={t('flashcardFeedback.ratingBad', 'Bad')}>☹️</button>
                                    <button onClick={() => handleRating('neutral')} title={t('flashcardFeedback.ratingOkay', 'Okay')}>😐</button>
                                    <button onClick={() => handleRating('good')} title={t('flashcardFeedback.ratingGood', 'Good')}>😄</button>
                                </div>
                            </div>
                        )}

                        {feedbackStep === 'detail' && (
                            <div className="feedback-step-detail">
                                <p>
                                    {rating === 'bad'
                                        ? t('flashcardFeedback.whatWrong', 'Oh no! What went wrong?')
                                        : t('flashcardFeedback.whatLike', 'What do you like most?')}
                                </p>
                                <div className="feedback-options">
                                    {rating === 'bad' ? (
                                        <>
                                            <button onClick={() => submitFeedback('too_hard')}>{t('flashcardFeedback.tooHard', 'Too Hard')}</button>
                                            <button onClick={() => submitFeedback('confusing')}>{t('flashcardFeedback.confusing', 'Confusing')}</button>
                                            <button onClick={() => submitFeedback('bugs')}>{t('flashcardFeedback.bugs', 'Bugs')}</button>
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={() => submitFeedback('content')}>{t('flashcardFeedback.content', 'Content')}</button>
                                            <button onClick={() => submitFeedback('ui')}>{t('flashcardFeedback.design', 'Design')}</button>
                                            <button onClick={() => submitFeedback('learning')}>{t('flashcardFeedback.learning', 'Learning')}</button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {feedbackStep === 'thanks' && (
                            <div className="feedback-step-thanks">
                                <p>🎉 {t('flashcardFeedback.thanks', 'Thanks for your help!')}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FlashcardFeedback;
