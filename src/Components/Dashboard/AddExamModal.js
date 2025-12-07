import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../Contexts/AuthContext/AuthContext';
import { createExam } from '../../Services/ExamService';
import './AddExamModal.css';

/**
 * AddExamModal - Modal for adding a new exam to the schedule
 */
const AddExamModal = ({ onClose, onExamAdded }) => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    date: '',
    subject: '',
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Get minimum date (today)
  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError(t('dashboard.addExam.error.name', 'Please enter an exam name'));
      return;
    }

    if (!formData.date) {
      setError(t('dashboard.addExam.error.date', 'Please select a date'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const examData = {
        name: formData.name.trim(),
        date: new Date(formData.date),
        subject: formData.subject.trim() || null,
        notes: formData.notes.trim() || null
      };

      const newExam = await createExam(currentUser.uid, examData);

      if (onExamAdded) {
        onExamAdded({
          ...newExam,
          date: examData.date
        });
      }
    } catch (err) {
      console.error('Error adding exam:', err);
      setError(t('dashboard.addExam.error.generic', 'Failed to add exam. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Preset exam types for quick selection
  const presetExams = [
    { name: 'NCLEX-RN', icon: '🏥' },
    { name: 'NCLEX-PN', icon: '💊' },
    { name: 'Pharmacology', icon: '💉' },
    { name: 'Med-Surg', icon: '🩺' },
    { name: 'Fundamentals', icon: '📚' },
    { name: 'Pediatrics', icon: '👶' },
    { name: 'OB/Maternity', icon: '🤰' },
    { name: 'Mental Health', icon: '🧠' },
  ];

  const selectPreset = (preset) => {
    setFormData(prev => ({
      ...prev,
      name: preset.name,
      subject: preset.name
    }));
  };

  return (
    <div className="add-exam-overlay" onClick={handleOverlayClick}>
      <div className="add-exam-modal">
        <div className="add-exam-header">
          <h2 className="add-exam-title">
            {t('dashboard.addExam.title', 'Schedule an Exam')}
          </h2>
          <button className="add-exam-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Quick Presets */}
        <div className="exam-presets">
          <span className="presets-label">
            {t('dashboard.addExam.quickSelect', 'Quick select:')}
          </span>
          <div className="presets-grid">
            {presetExams.map((preset) => (
              <button
                key={preset.name}
                type="button"
                className={`preset-btn ${formData.name === preset.name ? 'selected' : ''}`}
                onClick={() => selectPreset(preset)}
              >
                <span className="preset-icon">{preset.icon}</span>
                <span className="preset-name">{preset.name}</span>
              </button>
            ))}
          </div>
        </div>

        <form className="add-exam-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="exam-name" className="form-label">
              {t('dashboard.addExam.name', 'Exam Name')}
              <span className="required">*</span>
            </label>
            <input
              type="text"
              id="exam-name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder={t('dashboard.addExam.namePlaceholder', 'e.g., Pharmacology Final')}
              className="form-input"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="exam-date" className="form-label">
              {t('dashboard.addExam.date', 'Exam Date')}
              <span className="required">*</span>
            </label>
            <input
              type="date"
              id="exam-date"
              name="date"
              value={formData.date}
              onChange={handleInputChange}
              min={getMinDate()}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="exam-subject" className="form-label">
              {t('dashboard.addExam.subject', 'Subject (optional)')}
            </label>
            <input
              type="text"
              id="exam-subject"
              name="subject"
              value={formData.subject}
              onChange={handleInputChange}
              placeholder={t('dashboard.addExam.subjectPlaceholder', 'e.g., Nursing 201')}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="exam-notes" className="form-label">
              {t('dashboard.addExam.notes', 'Notes (optional)')}
            </label>
            <textarea
              id="exam-notes"
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              placeholder={t('dashboard.addExam.notesPlaceholder', 'Any additional details...')}
              className="form-textarea"
              rows={3}
            />
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
              {t('dashboard.addExam.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              className="submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? t('dashboard.addExam.saving', 'Saving...')
                : t('dashboard.addExam.save', 'Add Exam')
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddExamModal;
