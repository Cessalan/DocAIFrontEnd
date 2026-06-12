import './LoadingMessageBox.css';
import StethoscopeScanningDocIcon from './StethoscopeScanningDocIcon';
import { useTranslation } from 'react-i18next';

/**
 * LoadingMessageBox - Shows real-time file upload insights in chat
 * 
 * Displays:
 * - Loading animation while processing
 * - Cumulative stats (files processed, topics found, concepts found)
 * - Latest file insights (filename + topics)
 * - Final summary text
 * 
 * Props:
 * @param {boolean} isLoading - Show loading animation
 * @param {Array} insights - Array of { filename, topics, concepts, document_type }
 * @param {string} summary - Final 1-2 sentence summary after upload
 * @param {number} fileCount - Total number of files uploaded (from batch_start event)
 * @param {Array} filenames - Array of uploaded filenames
 * @param {string} language - User's language ('en' or 'fr')
 */
const LoadingMessageBox = ({
  isLoading = false,
  error = false,
  errorCode = null,
  insights = [],
  summary = null,
  fileCount = 0,
  filenames = [],
  language = 'en'
}) => {
  const { t } = useTranslation();
  
  // ========================================
  // Calculate Cumulative Statistics
  // ========================================
  
  // Count total topics across all files
  const totalTopics = insights.reduce((sum, insight) => {
    return sum + (insight.topics?.length || 0);
  }, 0);
  
  // Count total concepts across all files
  const totalConcepts = insights.reduce((sum, insight) => {
    return sum + (insight.concepts?.length || 0);
  }, 0);
  
  // Use fileCount prop as source of truth for files processed
  // Fallback to insights.length only if fileCount not provided
  const filesProcessed = fileCount > 0 ? fileCount : insights.length;
  
  // ========================================
  // Determine Loading State Text
  // ========================================
  const getStatusText = () => {
    if (error) {
      return errorCode === 'capacity'
        ? t('loading.uploadOverloaded')
        : t('loading.uploadFailed');
    }

    if (!isLoading) {
      return t('loading.complete');
    }
    
    // If we have insights and summary, we're finishing up
    if (insights.length > 0 && summary) {
      return t('loading.finishingUp');
    }
    
    // Otherwise we're analyzing
    return t('loading.analyzing');
  };
  
  // ========================================
  // Render Component
  // ========================================
  return (
    <div className={`loading-message-box ${error ? 'upload-error' : isLoading ? 'loading' : 'complete-with-insights'}`}>

      {/* ========================================
          HEADER: Loading Icon + Status Text
          ======================================== */}
      <div className="loading-header">
        {error ? (
          <span className="complete-icon">⚠️</span>
        ) : isLoading ? (
          <div className="loading-icon-container">
            <StethoscopeScanningDocIcon />
          </div>
        ) : (
          <span className="complete-icon">✅</span>
        )}
        <span className="loading-text">
          <span className="loading-text-content">{getStatusText()}</span>
          <span className="loading-text-shimmer"></span>
        </span>
      </div>

      {/* ========================================
          ERROR STATE: retry hint, no stats/insights
          ======================================== */}
      {error && (
        <div className="upload-error-hint">
          {errorCode === 'capacity'
            ? t('loading.uploadOverloadedHint')
            : t('loading.uploadFailedHint')}
        </div>
      )}

      {/* ========================================
          PROGRESS STATS: Files, Topics, Concepts
          Always visible once we have data
          ======================================== */}
      {!error && filesProcessed > 0 && (
        <div className="progress-stats">
          
          {/* Files Processed Counter */}
          <div className="stat-item">
            <span className="stat-number">{filesProcessed}</span>
            <span className="stat-label">
              {filesProcessed === 1 
                ? t('loading.fileProcessed') 
                : t('loading.filesProcessed')
              }
            </span>
          </div>
          
          {/* Topics Found Counter */}
          {totalTopics > 0 && (
            <div className="stat-item">
              <span className="stat-number">{totalTopics}</span>
              <span className="stat-label">
                {totalTopics === 1
                  ? t('loading.topicFound')
                  : t('loading.topicsFound')
                }
              </span>
            </div>
          )}
          
          {/* Concepts Found Counter */}
          {totalConcepts > 0 && (
            <div className="stat-item">
              <span className="stat-number">{totalConcepts}</span>
              <span className="stat-label">
                {totalConcepts === 1
                  ? t('loading.conceptFound')
                  : t('loading.conceptsFound')
                }
              </span>
            </div>
          )}
        </div>
      )}
      
      {/* ========================================
          FILE INSIGHTS: Show files processed
          While loading: Show last 2 files (streaming effect)
          When complete: Show ALL files
          ======================================== */}
      {!error && insights.length > 0 && (
        <div className="latest-insights">
          {insights.map((insight, index) => (
            <div key={`insight-${index}-${insight.filename}`} className="insight-preview fade-in">
              <span className="insight-icon">📄</span>
              <span className="insight-text">
                <strong>{insight.filename}</strong>
                {insight.topics && insight.topics.length > 0 && (
                  <>
                    <br />
                    <span className="insight-detail">
                      • {insight.topics.slice(0, 2).join(', ')}
                    </span>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
      
      {/* ========================================
          SUMMARY PREVIEW: Final 1-2 sentence summary
          Always visible when summary exists
          ======================================== */}
      {!error && summary && (
        <div className="summary-preview">
          {summary}
        </div>
      )}
    </div>
  );
};

export default LoadingMessageBox;