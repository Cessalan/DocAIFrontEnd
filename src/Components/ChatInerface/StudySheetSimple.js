import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import html2pdf from 'html2pdf.js';
import './StudySheetSimple.css';

// Parse inline markdown (bold, italic) within text
function parseInlineMarkdown(text) {
  if (!text) return text;

  // Split by bold markers (**text**) and process
  const parts = [];
  let remaining = text;
  let keyIdx = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);

    if (boldMatch) {
      const beforeBold = remaining.substring(0, boldMatch.index);
      if (beforeBold) {
        parts.push(beforeBold);
      }
      parts.push(<strong key={`b-${keyIdx++}`}>{boldMatch[1]}</strong>);
      remaining = remaining.substring(boldMatch.index + boldMatch[0].length);
    } else {
      parts.push(remaining);
      break;
    }
  }

  return parts.length > 0 ? parts : text;
}

// Parse markdown content with headers, lists, and formatting
function parseContent(text) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Empty line = spacer
    if (!trimmed) {
      elements.push(<div key={`s-${idx}`} className="study-spacer" />);
      return;
    }

    // Horizontal rule (---, ___, ***)
    if (/^[-_*]{3,}$/.test(trimmed)) {
      elements.push(<hr key={`hr-${idx}`} className="study-divider" />);
      return;
    }

    // Markdown H1 (# Header)
    const h1Match = trimmed.match(/^#\s+(.+)/);
    if (h1Match) {
      elements.push(
        <h1 key={`h1-${idx}`} className="study-main-header">
          {parseInlineMarkdown(h1Match[1])}
        </h1>
      );
      return;
    }

    // Markdown H2 (## Header)
    const h2Match = trimmed.match(/^##\s+(.+)/);
    if (h2Match) {
      elements.push(
        <h2 key={`h2-${idx}`} className="study-section-header">
          {parseInlineMarkdown(h2Match[1])}
        </h2>
      );
      return;
    }

    // Markdown H3 (### Header)
    const h3Match = trimmed.match(/^###\s+(.+)/);
    if (h3Match) {
      elements.push(
        <h3 key={`h3-${idx}`} className="study-subsection-header">
          {parseInlineMarkdown(h3Match[1])}
        </h3>
      );
      return;
    }

    // UPPERCASE HEADER (line that's all caps, at least 3 chars) - legacy support
    if (trimmed.length > 2 && trimmed === trimmed.toUpperCase() && /^[A-Z\s]+$/.test(trimmed)) {
      elements.push(
        <h2 key={`h-${idx}`} className="study-section-header">
          {trimmed}
        </h2>
      );
      return;
    }

    // Bullet list items (- item or * item)
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)/);
    if (bulletMatch) {
      elements.push(
        <div key={`b-${idx}`} className="study-bullet">
          <span className="bullet-marker">•</span>
          <span className="bullet-content">{parseInlineMarkdown(bulletMatch[1])}</span>
        </div>
      );
      return;
    }

    // Numbered list items (1. 2. 3. etc)
    const numMatch = trimmed.match(/^(\d+)[.)]\s+(.+)/);
    if (numMatch) {
      elements.push(
        <div key={`n-${idx}`} className="study-numbered">
          <span className="number-marker">{numMatch[1]}</span>
          <span className="numbered-content">{parseInlineMarkdown(numMatch[2])}</span>
        </div>
      );
      return;
    }

    // Lines ending with colon are sub-headers (legacy support)
    if (trimmed.endsWith(':') && trimmed.length < 60 && !trimmed.startsWith('-') && !trimmed.startsWith('*')) {
      elements.push(
        <h3 key={`sh-${idx}`} className="study-subsection-header">
          {parseInlineMarkdown(trimmed)}
        </h3>
      );
      return;
    }

    // Regular paragraph with inline markdown support
    elements.push(
      <p key={`p-${idx}`} className="study-paragraph">
        {parseInlineMarkdown(trimmed)}
      </p>
    );
  });

  return elements;
}

const StudySheetSimple = ({
  topic,
  content = '',
  isStreaming = false,
  error = null,
  inline = false
}) => {
  const contentRef = useRef(null);
  const pdfContentRef = useRef(null);
  const { t } = useTranslation();

  // Auto-scroll while streaming
  useEffect(() => {
    if (contentRef.current && isStreaming) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, isStreaming]);

  const handleDownloadPDF = async () => {
    if (!pdfContentRef.current || !content) return;

    // Create off-screen container with forced light mode styles
    const offscreenContainer = document.createElement('div');
    offscreenContainer.style.cssText = `
      position: absolute;
      left: -9999px;
      top: 0;
      width: 800px;
      background: #ffffff;
    `;

    // Clone the content
    const clone = pdfContentRef.current.cloneNode(true);

    // Apply light mode styles directly to cloned elements
    clone.style.background = '#ffffff';
    clone.style.color = '#333333';

    // Force light mode colors on all elements
    const applyLightStyles = (el) => {
      if (el.classList.contains('study-section-header')) {
        el.style.background = '#9b6fb0';
        el.style.color = 'white';
      }
      if (el.classList.contains('study-subsection-header')) {
        el.style.color = '#4a3660';
      }
      if (el.classList.contains('study-paragraph')) {
        el.style.color = '#333333';
      }
      if (el.classList.contains('study-numbered')) {
        el.style.background = 'rgba(155, 111, 176, 0.04)';
      }
      if (el.classList.contains('number-marker')) {
        el.style.background = '#9b6fb0';
        el.style.color = 'white';
      }
      if (el.classList.contains('numbered-content')) {
        el.style.color = '#333333';
      }
      if (el.classList.contains('pdf-header')) {
        el.style.display = 'block';
        el.style.color = '#1f1f1f';
      }
      Array.from(el.children).forEach(applyLightStyles);
    };
    applyLightStyles(clone);

    offscreenContainer.appendChild(clone);
    document.body.appendChild(offscreenContainer);

    const opt = {
      margin: [15, 15, 15, 15],
      filename: `${topic.replace(/[^a-zA-Z0-9]/g, '_')}_study_sheet.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: true,
        backgroundColor: '#ffffff'
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait'
      },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    try {
      await html2pdf().set(opt).from(clone).save();
    } catch (err) {
      console.error('PDF download failed:', err);
    } finally {
      // Clean up off-screen container
      document.body.removeChild(offscreenContainer);
    }
  };

  return (
    <div className={`study-sheet-simple-wrapper ${inline ? 'study-sheet-inline' : ''}`}>
      {/* Header */}
      <div className="study-sheet-simple-header">
        <div className="study-header-top">
          <h1 className="study-sheet-title">
            <span className="title-icon">📚</span>
            {topic}
          </h1>
          {!isStreaming && !error && content && (
            <button
              className="study-download-btn"
              onClick={handleDownloadPDF}
              title={t('studysheet.download', 'Download PDF')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>PDF</span>
            </button>
          )}
        </div>
        {isStreaming && (
          <div className="streaming-indicator">
            <span className="streaming-dot"></span>
            <span className="streaming-dot"></span>
            <span className="streaming-dot"></span>
            <span className="streaming-text">{t('studysheet.generating', 'Generating...')}</span>
          </div>
        )}
        {!isStreaming && !error && content && (
          <div className="complete-badge">
            <span>✓</span>
            <span>{t('studysheet.complete', 'Complete')}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="study-sheet-simple-content" ref={contentRef}>
        {error ? (
          <div className="study-error">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        ) : (
          <div className="study-text-content" ref={pdfContentRef}>
            {/* PDF Header - only visible in PDF */}
            <div className="pdf-header">
              <h1>{topic}</h1>
            </div>
            {parseContent(content)}
            {isStreaming && <span className="typing-cursor">|</span>}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudySheetSimple;
