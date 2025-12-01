import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import "./StudySheetLivePreview.css"

const StudySheetLivePreview = ({ 
  topic,
  chatId,
  onClose,
  websocketData 
}) => {
  const [htmlContent, setHtmlContent] = useState('');
  const [progress, setProgress] = useState(0);
  const [currentSection, setCurrentSection] = useState(null);
  const [sections, setSections] = useState([]);
  const [isComplete, setIsComplete] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showProgress, setShowProgress] = useState(true);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [iframeKey, setIframeKey] = useState(0); // Force iframe remount
  
  const iframeRef = useRef(null);
  const activityCheckRef = useRef(null);
  const { t } = useTranslation();
  
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // FORCE iframe to update - use multiple techniques
  useEffect(() => {
    if (htmlContent && htmlContent.length > 0 && iframeRef.current) {
      console.log('🔄 FORCING iframe update, content length:', htmlContent.length);
      
      try {
        const iframe = iframeRef.current;
        
        // Method 1: Write directly to iframe document
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          iframeDoc.open();
          iframeDoc.write(htmlContent);
          iframeDoc.close();
          console.log('✅ iframe updated via document.write()');
        } else {
          // Fallback: Use srcdoc
          iframe.srcdoc = htmlContent;
          console.log('✅ iframe updated via srcdoc');
        }
        
        // Force iframe key increment to trigger React re-render
        // (Only needed if above methods fail)
        // setIframeKey(prev => prev + 1);
        
      } catch (error) {
        console.error('❌ Error updating iframe:', error);
        // Last resort: Force complete remount
        setIframeKey(prev => prev + 1);
      }
    }
  }, [htmlContent]);

  // Activity-based timeout - only timeout if NO activity for 90 seconds
  useEffect(() => {
    activityCheckRef.current = setInterval(() => {
      const timeSinceActivity = Date.now() - lastActivity;
      
      console.log('⏰ Activity check:', {
        timeSinceActivity: Math.round(timeSinceActivity / 1000) + 's',
        hasContent: !!htmlContent,
        contentLength: htmlContent?.length,
        isComplete,
        hasError
      });
      
      if (timeSinceActivity > 90000 && !htmlContent && !isComplete && !hasError) {
        console.error('⏰ Timeout: No updates for 90 seconds');
        setHasError(true);
        setErrorMessage('Study sheet generation timed out. Please try again.');
        clearInterval(activityCheckRef.current);
      }
    }, 10000);

    return () => {
      if (activityCheckRef.current) {
        clearInterval(activityCheckRef.current);
      }
    };
  }, [lastActivity, htmlContent, isComplete, hasError]);

  useEffect(() => {
    if (isComplete || hasError) {
      if (activityCheckRef.current) {
        console.log('✅ Clearing activity check - generation complete or error');
        clearInterval(activityCheckRef.current);
      }
    }
  }, [isComplete, hasError]);

  useEffect(() => {
    if (isComplete) {
      const timer = setTimeout(() => {
        setShowProgress(false);
      }, 3000); // 3 seconds to see completion badge
      return () => clearTimeout(timer);
    }
  }, [isComplete]);

  // Handle WebSocket data updates
  useEffect(() => {
    if (websocketData) {
      console.log('📨 WebSocket data received:', websocketData.status);
      setLastActivity(Date.now());
      handleWebSocketUpdate(websocketData);
    }
  }, [websocketData]);

  const handleWebSocketUpdate = (data) => {
    console.log('🔍 Study sheet WebSocket update:', data.status, {
      hasHtmlContent: !!data.html_content,
      htmlLength: data.html_content?.length,
      progress: data.progress,
      currentState: { 
        hasContent: !!htmlContent, 
        contentLength: htmlContent?.length,
        isComplete, 
        hasError 
      }
    });
    
    if (data.status === 'error') {
      console.error('❌ Study sheet error:', data.message);
      setHasError(true);
      setErrorMessage(data.message || 'An error occurred generating the study sheet');
      if (activityCheckRef.current) clearInterval(activityCheckRef.current);
      return;
    }
    
    switch (data.status) {
      case 'study_sheet_plan_ready':
        console.log('📋 Plan ready, sections:', data.sections?.length);
        setSections(data.sections || []);
        setProgress(15);
        break;
        
      case 'study_sheet_html_skeleton':
        console.log('🏗️ Skeleton received, length:', data.html_content?.length);
        if (data.html_content && data.html_content.length > 0) {
          setHtmlContent(data.html_content);
          console.log('✅ HTML skeleton set, length:', data.html_content.length);
        } else {
          console.warn('⚠️ Empty html_content in skeleton');
        }
        break;
        
      case 'study_sheet_section_start':
        console.log('📝 Section start:', data.section_title);
        setCurrentSection({
          id: data.section_id,
          title: data.section_title,
          message: data.message
        });
        if (data.progress) {
          setProgress(data.progress);
        }
        break;
        
      case 'study_sheet_content_update':
        console.log('🔄 Content update received!', {
          newLength: data.html_content?.length,
          oldLength: htmlContent?.length,
          progress: data.progress
        });
        
        if (data.html_content && data.html_content.length > 0) {
          // THIS IS THE KEY UPDATE - Force new content
          setHtmlContent(data.html_content);
          console.log('✅ Content state updated - iframe should refresh');
        }
        
        if (data.progress) {
          setProgress(data.progress);
        }
        break;
        
      case 'study_sheet_section_complete':
        console.log('✅ Section complete:', data.section_id);
        setSections(prev => prev.map(section => 
          section.id === data.section_id 
            ? { ...section, completed: true }
            : section
        ));
        if (data.progress) {
          setProgress(data.progress);
        }
        
        // IMPORTANT: Update content on section complete too
        if (data.html_content) {
          setHtmlContent(data.html_content);
          console.log('✅ Updated content after section complete');
        }
        break;
        
      case 'study_sheet_complete':
        console.log('🎉 Study sheet complete!');
        if (data.html_content) {
          setHtmlContent(data.html_content);
        }
        setProgress(100);
        setIsComplete(true);
        setCurrentSection({ 
          id: 'complete', 
          title: 'Complete', 
          message: 'Study sheet ready!' 
        });
        if (activityCheckRef.current) {
          clearInterval(activityCheckRef.current);
        }
        break;
        
      default:
        console.log('❓ Unknown study sheet status:', data.status);
    }
  };

  const getStepStatus = (section) => {
    if (section.completed) return 'completed';
    if (currentSection && section.id === currentSection.id) return 'current';
    return 'pending';
  };

  const getStepIcon = (section) => {
    const status = getStepStatus(section);
    switch (status) {
      case 'completed': return '✅';
      case 'current': return '🔄';
      default: return '⏳';
    }
  };

  const handleClose = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    console.log('🔴 Close button clicked');
    
    if (activityCheckRef.current) {
      clearInterval(activityCheckRef.current);
    }
    
    if (typeof onClose === 'function') {
      console.log('✅ Calling onClose function');
      onClose();
    } else {
      console.error('❌ onClose is not a function:', onClose);
    }
  };

  const hasContent = htmlContent && htmlContent.length > 0;

  return (
    <div className="study-sheet-wrapper">
      {/* Floating close button - always visible */}
      <button 
        className="floating-close-btn" 
        onClick={handleClose}
        onTouchEnd={handleClose}
        aria-label="Close study sheet"
        title="Close"
        type="button"
      >
        ✕
      </button>

      {/* Header - hide completely after 3 seconds of completion */}
      {(!isComplete || showProgress) && (
        <div className={`study-sheet-inner-header ${isComplete && !showProgress ? 'complete' : ''}`}>
          <div className="header-content">
            <h2 className="header-title">
              📚 {topic}
            </h2>
          </div>
          
          {/* Progress Section - only show while building */}
          {!isComplete && showProgress && !hasError && (
            <div className="progress-section">
              <div className="progress-header">
                <span className="progress-label">{t('studysheet.building')}</span>
                <span className="progress-percentage">{Math.round(progress)}%</span>
              </div>
              
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
              
              {currentSection && (
                <div className="current-step">
                  <span className="step-icon">📝</span>
                  <span className="step-message">
                    {currentSection.message || currentSection.title}
                  </span>
                </div>
              )}
              
              {sections && sections.length > 0 && (
                <div className="steps-list">
                  {sections.map(section => (
                    <div 
                      key={section.id} 
                      className={`step-item ${getStepStatus(section)}`}
                    >
                      <span className="step-icon">{getStepIcon(section)}</span>
                      <span className="step-title">{section.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Compact completion badge */}
          {isComplete && showProgress && !hasError && (
            <div className="completion-badge">
              <span className="completion-icon">✅</span>
              <span className="completion-text">Study sheet complete!</span>
            </div>
          )}
          
          {/* Error State */}
          {hasError && (
            <div className="error-state">
              <div className="error-message">
                <span className="error-icon">⚠️</span>
                <span>{errorMessage}</span>
              </div>
              <button className="retry-btn" onClick={handleClose}>
                Close and Try Again
              </button>
            </div>
          )}
        </div>
      )}

      {/* Content Area */}
      <div className="study-sheet-inner-content">
        {/* Always show iframe if not errored */}
        {!hasError && (
          <iframe
            key={iframeKey} // Forces remount if key changes
            ref={iframeRef}
            className="study-sheet-iframe"
            title="Study Sheet Preview"
            sandbox="allow-same-origin allow-scripts"
          />
        )}
        
        {/* Show loading overlay only when no content yet */}
        {!hasContent && !hasError && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>{t('studysheet.loading')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudySheetLivePreview;