import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { GetAllFeedback, DeleteFeedback, UpdateFeedbackStatus } from '../../Services/FeedbackService';
import './FeedbackViewer.css';

const FeedbackViewer = ({ onClose }) => {
  const { t } = useTranslation();
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, new, reviewed, resolved
  const [typeFilter, setTypeFilter] = useState('all'); // all, general, bug, feature, other
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    loadFeedbacks();
  }, []);

  const loadFeedbacks = async () => {
    try {
      setLoading(true);
      const data = await GetAllFeedback();
      setFeedbacks(data);
    } catch (error) {
      console.error('Error loading feedbacks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (feedbackId) => {
    if (!window.confirm('Delete this feedback? This action is irreversible.')) {
      return;
    }

    try {
      await DeleteFeedback(feedbackId);
      setFeedbacks(feedbacks.filter(f => f.id !== feedbackId));
    } catch (error) {
      console.error('Error deleting feedback:', error);
      alert('Failed to delete feedback');
    }
  };

  const handleStatusChange = async (feedbackId, newStatus) => {
    try {
      await UpdateFeedbackStatus(feedbackId, newStatus);
      setFeedbacks(feedbacks.map(f =>
        f.id === feedbackId ? { ...f, status: newStatus } : f
      ));
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    }
  };

  const filteredFeedbacks = feedbacks.filter(f => {
    const statusMatch = filter === 'all' || f.status === filter;
    const typeMatch = typeFilter === 'all' || f.feedbackType === typeFilter;
    return statusMatch && typeMatch;
  });

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return 'Invalid Date';
    }
  };

  const getTypeEmoji = (type) => {
    switch (type) {
      case 'general': return '💬';
      case 'bug': return '🐛';
      case 'feature': return '✨';
      case 'other': return '📝';
      default: return '📋';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'new': return '#3b82f6';
      case 'reviewed': return '#f59e0b';
      case 'resolved': return '#10b981';
      default: return '#6b7280';
    }
  };

  return (
    <div className="feedback-viewer-overlay" onClick={onClose}>
      <div className="feedback-viewer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="feedback-viewer-header">
          <h2>🔍 Feedback Viewer (Dev Mode)</h2>
          <button className="close-viewer-btn" onClick={onClose}>✕</button>
        </div>

        {/* Filters */}
        <div className="feedback-filters">
          <div className="filter-group">
            <label>Status:</label>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All ({feedbacks.length})</option>
              <option value="new">New ({feedbacks.filter(f => f.status === 'new').length})</option>
              <option value="reviewed">Reviewed ({feedbacks.filter(f => f.status === 'reviewed').length})</option>
              <option value="resolved">Resolved ({feedbacks.filter(f => f.status === 'resolved').length})</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Type:</label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All Types</option>
              <option value="general">💬 General</option>
              <option value="bug">🐛 Bug Report</option>
              <option value="feature">✨ Feature Request</option>
              <option value="other">📝 Other</option>
            </select>
          </div>

          <button className="refresh-btn" onClick={loadFeedbacks} disabled={loading}>
            🔄 Refresh
          </button>
        </div>

        {/* Feedback List */}
        <div className="feedback-list">
          {loading ? (
            <div className="feedback-loading">
              <div className="spinner"></div>
              <p>Loading feedbacks...</p>
            </div>
          ) : filteredFeedbacks.length === 0 ? (
            <div className="feedback-empty">
              <p>📭 No feedback found</p>
            </div>
          ) : (
            filteredFeedbacks.map((feedback) => (
              <div
                key={feedback.id}
                className={`feedback-item ${expandedId === feedback.id ? 'expanded' : ''}`}
              >
                <div className="feedback-item-header" onClick={() => setExpandedId(expandedId === feedback.id ? null : feedback.id)}>
                  <div className="feedback-item-left">
                    <span className="feedback-type-emoji">{getTypeEmoji(feedback.feedbackType)}</span>
                    <div className="feedback-item-info">
                      <div className="feedback-item-title">
                        <span className="feedback-user-email">{feedback.userEmail || `${feedback.userId?.substring(0, 8)}...`}</span>
                        <span className="feedback-date">{formatDate(feedback.timestamp)}</span>
                      </div>
                      <div className="feedback-preview">
                        {feedback.feedbackText?.substring(0, 80)}
                        {feedback.feedbackText?.length > 80 ? '...' : ''}
                      </div>
                    </div>
                  </div>
                  <div className="feedback-item-right">
                    <span
                      className="feedback-status-badge"
                      style={{ background: getStatusColor(feedback.status) }}
                    >
                      {feedback.status}
                    </span>
                    <span className="expand-icon">{expandedId === feedback.id ? '▼' : '▶'}</span>
                  </div>
                </div>

                {expandedId === feedback.id && (
                  <div className="feedback-item-details">
                    <div className="feedback-detail-section">
                      <strong>Full Message:</strong>
                      <p className="feedback-full-text">{feedback.feedbackText}</p>
                    </div>

                    <div className="feedback-detail-grid">
                      <div className="feedback-detail-item">
                        <strong>User Email:</strong>
                        <span>{feedback.userEmail || 'N/A'}</span>
                      </div>
                      <div className="feedback-detail-item">
                        <strong>User ID:</strong>
                        <span>{feedback.userId}</span>
                      </div>
                      <div className="feedback-detail-item">
                        <strong>Chat ID:</strong>
                        <span>{feedback.chatId || 'N/A'}</span>
                      </div>
                      <div className="feedback-detail-item">
                        <strong>Type:</strong>
                        <span>{getTypeEmoji(feedback.feedbackType)} {feedback.feedbackType}</span>
                      </div>
                      <div className="feedback-detail-item">
                        <strong>Language:</strong>
                        <span>{feedback.language || 'N/A'}</span>
                      </div>
                      <div className="feedback-detail-item">
                        <strong>Platform:</strong>
                        <span>{feedback.metadata?.platform || 'N/A'}</span>
                      </div>
                      <div className="feedback-detail-item">
                        <strong>Screen:</strong>
                        <span>{feedback.metadata?.screenWidth}x{feedback.metadata?.screenHeight}</span>
                      </div>
                    </div>

                    <div className="feedback-detail-section">
                      <strong>User Agent:</strong>
                      <p className="user-agent-text">{feedback.userAgent}</p>
                    </div>

                    <div className="feedback-actions">
                      <button
                        className="status-btn status-new"
                        onClick={() => handleStatusChange(feedback.id, 'new')}
                        disabled={feedback.status === 'new'}
                      >
                        🆕 New
                      </button>
                      <button
                        className="status-btn status-reviewed"
                        onClick={() => handleStatusChange(feedback.id, 'reviewed')}
                        disabled={feedback.status === 'reviewed'}
                      >
                        👁️ Reviewed
                      </button>
                      <button
                        className="status-btn status-resolved"
                        onClick={() => handleStatusChange(feedback.id, 'resolved')}
                        disabled={feedback.status === 'resolved'}
                      >
                        ✅ Resolved
                      </button>
                      <button
                        className="delete-btn"
                        onClick={() => handleDelete(feedback.id)}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default FeedbackViewer;
