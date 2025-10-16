import React from 'react';

const GhostLoader = ({ type = 'message' }) => {
  const messageGhost = (
    <div className="ghost-message">
      <div className="ghost-content">
        <div className="skeleton-line long"></div>
        <div className="skeleton-line medium"></div>
        <div className="skeleton-line short"></div>
        <div className="skeleton-line medium"></div>
      </div>
    </div>
  );

  const studySheetGhost = (
    <div className="ghost-study-sheet">
      <div className="ghost-header">
        <div className="skeleton-line header-title"></div>
      </div>
      <div className="ghost-sections">
        <div className="ghost-section">
          <div className="skeleton-line section-title"></div>
          <div className="skeleton-line long"></div>
          <div className="skeleton-line medium"></div>
          <div className="skeleton-line short"></div>
        </div>
        <div className="ghost-section">
          <div className="skeleton-line section-title"></div>
          <div className="skeleton-line medium"></div>
          <div className="skeleton-line long"></div>
        </div>
      </div>
    </div>
  );

  const quizGhost = (
    <div className="ghost-quiz">
      <div className="ghost-question">
        <div className="skeleton-line question-text"></div>
        <div className="ghost-options">
          <div className="skeleton-line option"></div>
          <div className="skeleton-line option"></div>
          <div className="skeleton-line option"></div>
          <div className="skeleton-line option"></div>
        </div>
      </div>
    </div>
  );

  const renderGhost = () => {
    switch (type) {
      case 'studysheet':
        return studySheetGhost;
      case 'quiz':
        return quizGhost;
      default:
        return messageGhost;
    }
  };

  return (
    <div className="ghost-container">
      {renderGhost()}
      
      <style jsx>{`
        .ghost-container {
          padding: 15px;
          margin: 10px 0;
        }

        .ghost-message {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(10px);
          border-radius: 15px;
          padding: 20px;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .ghost-content {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .skeleton-line {
          height: 16px;
          background: linear-gradient(
            90deg,
            rgba(181, 140, 214, 0.1) 25%,
            rgba(217, 184, 244, 0.2) 50%,
            rgba(181, 140, 214, 0.1) 75%
          );
          background-size: 200% 100%;
          border-radius: 8px;
          animation: shimmer 1.8s infinite ease-in-out;
        }

        .skeleton-line.long { width: 85%; }
        .skeleton-line.medium { width: 65%; }
        .skeleton-line.short { width: 40%; }
        .skeleton-line.header-title { 
          width: 60%; 
          height: 24px; 
          margin-bottom: 15px;
        }
        .skeleton-line.section-title { 
          width: 45%; 
          height: 18px; 
          margin-bottom: 10px;
        }
        .skeleton-line.question-text { 
          width: 90%; 
          height: 20px; 
          margin-bottom: 15px;
        }
        .skeleton-line.option { 
          width: 70%; 
          height: 14px; 
          margin-bottom: 8px;
        }

        .ghost-study-sheet {
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(15px);
          border-radius: 20px;
          padding: 25px;
          border: 1px solid rgba(181, 140, 214, 0.2);
          box-shadow: 0 8px 32px rgba(181, 140, 214, 0.1);
        }

        .ghost-sections {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .ghost-section {
          background: rgba(217, 184, 244, 0.1);
          border-radius: 12px;
          padding: 15px;
          border-left: 4px solid rgba(181, 140, 214, 0.3);
        }

        .ghost-quiz {
          background: rgba(255, 255, 255, 0.75);
          backdrop-filter: blur(12px);
          border-radius: 18px;
          padding: 22px;
          border: 1px solid rgba(181, 140, 214, 0.15);
        }

        .ghost-options {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-left: 15px;
        }

        @keyframes shimmer {
          0% {
            background-position: -200% 0;
            opacity: 0.3;
          }
          50% {
            opacity: 0.6;
          }
          100% {
            background-position: 200% 0;
            opacity: 0.3;
          }
        }

        .skeleton-line:nth-child(1) { animation-delay: 0s; }
        .skeleton-line:nth-child(2) { animation-delay: 0.2s; }
        .skeleton-line:nth-child(3) { animation-delay: 0.4s; }
        .skeleton-line:nth-child(4) { animation-delay: 0.6s; }

        /* Responsive design */
        @media (max-width: 768px) {
          .ghost-container {
            padding: 10px;
          }
          
          .ghost-study-sheet,
          .ghost-quiz,
          .ghost-message {
            padding: 15px;
          }
        }

        /* Accessibility - Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .skeleton-line {
            animation: pulse 2s infinite;
          }
          
          @keyframes pulse {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 0.6; }
          }
        }
      `}</style>
    </div>
  );
};

export default GhostLoader;