import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './ExamCountdown.css';

/**
 * ExamCountdown - Reusable live countdown timer to an exam date
 *
 * @param {Date|string|object} examDate - The exam date (can be Date, string, or Firestore Timestamp)
 * @param {string} size - Size variant: 'small', 'medium', 'large' (default: 'medium')
 * @param {boolean} showSeconds - Whether to show seconds (default: true)
 * @param {string} className - Additional CSS classes
 */
const ExamCountdown = ({
  examDate,
  size = 'medium',
  showSeconds = true,
  className = ''
}) => {
  const { t } = useTranslation();
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isPast: false
  });

  useEffect(() => {
    if (!examDate) return;

    const calculateTimeLeft = () => {
      // Handle different date formats (Firestore Timestamp, Date, or string)
      const exam = examDate?.toDate ? examDate.toDate() : new Date(examDate);
      const now = new Date();
      const diffTime = exam - now;

      if (diffTime < 0) {
        // Exam is in the past
        const pastDiff = Math.abs(diffTime);
        return {
          days: Math.floor(pastDiff / (1000 * 60 * 60 * 24)),
          hours: 0,
          minutes: 0,
          seconds: 0,
          isPast: true
        };
      }

      return {
        days: Math.floor(diffTime / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diffTime % (1000 * 60)) / 1000),
        isPast: false
      };
    };

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, [examDate]);

  // Don't render if no exam date
  if (!examDate) return null;

  const isUrgent = !timeLeft.isPast && timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes === 0;
  const isToday = !timeLeft.isPast && timeLeft.days === 0;

  // Build CSS classes
  const classes = [
    'exam-countdown',
    `exam-countdown--${size}`,
    timeLeft.isPast && 'exam-countdown--past',
    isUrgent && 'exam-countdown--urgent',
    isToday && !isUrgent && 'exam-countdown--today',
    className
  ].filter(Boolean).join(' ');

  // Past exam
  if (timeLeft.isPast) {
    return (
      <div className={classes}>
        <span className="exam-countdown__text">
          {t('countdown.past', '{{days}}d ago', { days: timeLeft.days })}
        </span>
      </div>
    );
  }

  // Exam starting now
  if (isUrgent) {
    return (
      <div className={classes}>
        <span className="exam-countdown__text exam-countdown__text--urgent">
          {t('countdown.now', 'Now!')}
        </span>
      </div>
    );
  }

  // Normal countdown
  return (
    <div className={classes}>
      <span className="exam-countdown__days">
        {t('countdown.days', '{{days}}d', { days: timeLeft.days })}
      </span>
      <span className="exam-countdown__time">
        {String(timeLeft.hours).padStart(2, '0')}:
        {String(timeLeft.minutes).padStart(2, '0')}
        {showSeconds && `:${String(timeLeft.seconds).padStart(2, '0')}`}
      </span>
    </div>
  );
};

export default ExamCountdown;
