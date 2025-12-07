import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import './ExamPrepModal.css';

/**
 * ExamPrepModal - Modal for creating an exam prep chat
 * Asks for exam name and date, then creates a chat linked to that exam
 */
const ExamPrepModal = ({ onClose, onSubmit, isSubmitting }) => {
  const { t } = useTranslation();

  const [formData, setFormData] = useState({
    examName: '',
    examDate: ''
  });
  const [error, setError] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // Get minimum date (today)
  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Format date for display
  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Calculate days until exam
  const getDaysUntil = (dateStr) => {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const examDate = new Date(dateStr + 'T00:00:00');
    const diffTime = examDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Quick date presets
  const datePresets = [
    { label: '1 week', days: 7, icon: '📅' },
    { label: '2 weeks', days: 14, icon: '📆' },
    { label: '1 month', days: 30, icon: '🗓️' },
    { label: '2 months', days: 60, icon: '📋' },
  ];

  const selectDatePreset = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const dateStr = date.toISOString().split('T')[0];
    setFormData(prev => ({ ...prev, examDate: dateStr }));
    setError(null);
  };

  // Calendar helpers
  const calendarData = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days = [];
    // Add padding for days before month starts
    for (let i = 0; i < startPadding; i++) {
      days.push(null);
    }
    // Add actual days
    for (let i = 1; i <= totalDays; i++) {
      days.push(i);
    }

    return { year, month, days };
  }, [calendarMonth]);

  const isDateDisabled = (day) => {
    if (!day) return true;
    const date = new Date(calendarData.year, calendarData.month, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const isDateSelected = (day) => {
    if (!day || !formData.examDate) return false;
    const selectedDate = new Date(formData.examDate + 'T00:00:00');
    return selectedDate.getFullYear() === calendarData.year &&
           selectedDate.getMonth() === calendarData.month &&
           selectedDate.getDate() === day;
  };

  const selectCalendarDate = (day) => {
    if (isDateDisabled(day)) return;
    const date = new Date(calendarData.year, calendarData.month, day);
    const dateStr = date.toISOString().split('T')[0];
    setFormData(prev => ({ ...prev, examDate: dateStr }));
    setShowCalendar(false);
    setError(null);
  };

  const navigateMonth = (direction) => {
    setCalendarMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + direction);
      return newDate;
    });
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.examName.trim()) {
      setError(t('examPrep.error.name', 'Please enter an exam name'));
      return;
    }

    if (!formData.examDate) {
      setError(t('examPrep.error.date', 'Please select an exam date'));
      return;
    }

    onSubmit({
      examName: formData.examName.trim(),
      examDate: new Date(formData.examDate)
    });
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && !isSubmitting) {
      onClose();
    }
  };


  return (
    <div className="exam-prep-overlay" onClick={handleOverlayClick}>
      <div className="exam-prep-modal">
        <div className="exam-prep-header">
          <div className="exam-prep-icon">🎯</div>
          <h2 className="exam-prep-title">
            {t('examPrep.title', 'Prepare for an Exam')}
          </h2>
          <p className="exam-prep-subtitle">
            {t('examPrep.subtitle', 'We\'ll help you study and track your progress')}
          </p>
        </div>

        <form className="exam-prep-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="exam-name" className="form-label">
              {t('examPrep.examName', 'What exam are you preparing for?')}
            </label>
            <input
              type="text"
              id="exam-name"
              name="examName"
              value={formData.examName}
              onChange={handleInputChange}
              placeholder={t('examPrep.examNamePlaceholder', 'e.g., Pharmacology Final')}
              className="form-input"
              autoFocus
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              {t('examPrep.examDate', 'When is your exam?')}
            </label>

            {/* Quick date presets */}
            <div className="date-presets">
              {datePresets.map((preset) => (
                <button
                  key={preset.days}
                  type="button"
                  className={`date-preset-btn ${getDaysUntil(formData.examDate) === preset.days ? 'selected' : ''}`}
                  onClick={() => selectDatePreset(preset.days)}
                  disabled={isSubmitting}
                >
                  <span className="date-preset-label">{preset.label}</span>
                </button>
              ))}
            </div>

            {/* Custom date selector */}
            <div className="date-selector-wrapper">
              <button
                type="button"
                className={`date-selector-btn ${formData.examDate ? 'has-date' : ''}`}
                onClick={() => setShowCalendar(!showCalendar)}
                disabled={isSubmitting}
              >
                <span className="date-selector-icon">📅</span>
                {formData.examDate ? (
                  <div className="date-selector-value">
                    <span className="date-display">{formatDateDisplay(formData.examDate)}</span>
                    <span className="days-until">
                      {getDaysUntil(formData.examDate) === 0
                        ? 'Today!'
                        : getDaysUntil(formData.examDate) === 1
                          ? 'Tomorrow'
                          : `${getDaysUntil(formData.examDate)} days away`}
                    </span>
                  </div>
                ) : (
                  <span className="date-placeholder">{t('examPrep.selectDate', 'Pick a specific date...')}</span>
                )}
                <span className="date-selector-arrow">{showCalendar ? '▲' : '▼'}</span>
              </button>

              {/* Calendar dropdown */}
              {showCalendar && (
                <div className="calendar-dropdown">
                  <div className="calendar-header">
                    <button
                      type="button"
                      className="calendar-nav-btn"
                      onClick={() => navigateMonth(-1)}
                    >
                      ‹
                    </button>
                    <span className="calendar-month-year">
                      {monthNames[calendarData.month]} {calendarData.year}
                    </span>
                    <button
                      type="button"
                      className="calendar-nav-btn"
                      onClick={() => navigateMonth(1)}
                    >
                      ›
                    </button>
                  </div>

                  <div className="calendar-weekdays">
                    {dayNames.map(day => (
                      <span key={day} className="calendar-weekday">{day}</span>
                    ))}
                  </div>

                  <div className="calendar-days">
                    {calendarData.days.map((day, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className={`calendar-day ${!day ? 'empty' : ''} ${isDateDisabled(day) ? 'disabled' : ''} ${isDateSelected(day) ? 'selected' : ''}`}
                        onClick={() => selectCalendarDate(day)}
                        disabled={!day || isDateDisabled(day)}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="form-error">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              className="cancel-btn"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t('examPrep.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              className="submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? t('examPrep.creating', 'Creating...')
                : t('examPrep.start', 'Start Preparing')
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExamPrepModal;
