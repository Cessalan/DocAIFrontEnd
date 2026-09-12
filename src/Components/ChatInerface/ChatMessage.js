import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkDown from "react-markdown";
import remarkGfm from "remark-gfm";
import ChatQuizStream from "./ChatQuizStream";
import PracticeLaunchCard from './PracticeLaunchCard';
import PracticeDebrief from './PracticeDebrief';
import FlashcardPractice from './FlashcardPractice';
import SummaryDisplay from "./ChatSummary";
import ChatScenario from "./ChatScenario";
import ChatStudySheet from "./ChatStudySheet";
import MessageRating from "./MessageRating";

import StreamingLogo from "./StreamingLogo";
import StaticLogo from "./StaticLogo";

import './ChatInterface.css';
import { useTranslation } from 'react-i18next';
import { devLog } from '../../Services/devLogger';
import { rewrite_text } from '../../Services/FastAPICalls';
import DiagramAwarePre from '../Mindmap/DiagramAwarePre';
import useArtifactEngagement from './useArtifactEngagement';

// Draws the ASCII concept maps and pathophysiology flows the tutor writes in
// fenced blocks as real graphs. Ordinary code blocks pass through untouched.
const diagramMarkdownComponents = { pre: DiagramAwarePre };

function CopyMessageButton({ text }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="message-copy-button"
      aria-label={copied ? t('chat.copied') : t('chat.copyMessageAria')}
      title={copied ? t('chat.copied') : t('chat.copyTooltip')}
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
      <span className="message-copy-label">{copied ? t('chat.copied') : t('chat.copy')}</span>
    </button>
  );
}

function RewriteButton({ disabled, busy, onClick }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className={`message-rewrite-button ${busy ? 'is-busy' : ''}`}
      aria-label={busy ? t('chat.rewritingAria') : t('chat.rewriteAria')}
      title={busy ? t('chat.rewritingTooltip') : t('chat.rewriteTooltip')}
    >
      {busy ? (
        <span className="rewrite-spinner" aria-hidden="true" />
      ) : (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {/* Sparkle / wand-style icon */}
          <path d="M12 3l1.6 4.2L18 9l-4.4 1.8L12 15l-1.6-4.2L6 9l4.4-1.8z" />
          <path d="M19 14l.7 1.8L21.5 16.5l-1.8.7L19 19l-.7-1.8L16.5 16.5l1.8-.7z" />
        </svg>
      )}
      <span className="message-copy-label">{busy ? t('chat.rewriting') : t('chat.rewrite')}</span>
    </button>
  );
}

function RewritePreview({ text, onClose, onCopied }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      if (onCopied) onCopied();
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  return (
    <div className="rewrite-preview" role="region" aria-label={t('chat.rewrittenAria')}>
      <div className="rewrite-preview-header">
        <div className="rewrite-preview-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3l1.6 4.2L18 9l-4.4 1.8L12 15l-1.6-4.2L6 9l4.4-1.8z" />
            <path d="M19 14l.7 1.8L21.5 16.5l-1.8.7L19 19l-.7-1.8L16.5 16.5l1.8-.7z" />
          </svg>
          <span>{t('chat.rewritten')}</span>
        </div>
        <button
          type="button"
          className="rewrite-preview-close"
          onClick={onClose}
          aria-label={t('chat.discardRewriteAria')}
          title={t('chat.discardRewrite')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="rewrite-preview-body">
        <ReactMarkDown remarkPlugins={[remarkGfm]}>{text}</ReactMarkDown>
      </div>

      <div className="rewrite-preview-footer">
        <button
          type="button"
          onClick={handleCopy}
          className={`rewrite-preview-copy ${copied ? 'is-copied' : ''}`}
        >
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
          <span>{copied ? t('chat.copied') : t('chat.copyRewrite')}</span>
        </button>
      </div>
    </div>
  );
}

function DevCopyJsonButton({ quizData }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(quizData, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      type="button"
      style={{
        marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px',
        padding: '5px 10px', fontSize: '11px', fontWeight: '600',
        background: copied ? 'rgba(34,197,94,0.12)' : 'rgba(99,102,241,0.10)',
        border: `1px solid ${copied ? 'rgba(34,197,94,0.4)' : 'rgba(99,102,241,0.35)'}`,
        borderRadius: '6px', cursor: 'pointer',
        color: copied ? '#16a34a' : '#6366f1', transition: 'all 0.2s'
      }}
    >
      <span style={{ background: copied ? '#22c55e' : '#6366f1', color: 'white', fontSize: '9px', padding: '2px 5px', borderRadius: '3px', fontWeight: '700' }}>DEV</span>
      {copied ? '✓ Copied!' : '📋 Copy Quiz JSON'}
    </button>
  );
}

/**
 * ChatMessage Component - With Single-Question Quiz Navigation & Skip
 * 
 * QUIZ UX CHANGES:
 * - Shows one question at a time (no scrolling through all)
 * - User can skip questions and come back later
 * - User clicks "Next →" to advance
 * - Loading state if next question not streamed yet
 * - Results screen on completion with CTA
 */
const ChatMessage = ({
  message,
  chatId,
  onOptionClick,
  onQuizAnswerSelect,
  uploadedFilesList,
  onQuizVisibilityChange,
  onQuizInteraction,
  isActiveQuiz = false,
  onSendMessage,
  onRetryMessage,
  onMessageRated,
  onQuizExtended,
  onOpenPractice,
  onRetryDebrief,
  onDeleteMessage,
  onEditMessage,
  viewAllChatsMode = false
}) => {
  const { i18n, t } = useTranslation();

  // ============================================
  // ALL HOOKS MUST BE CALLED FIRST (before any returns)
  // ============================================

  // Hover state for delete button (dev mode only)
  const [isHovered, setIsHovered] = useState(false);

  // Engagement telemetry for passive artifacts (study sheet / concept map /
  // audio). Quizzes and flashcards stamp themselves when answered; these have
  // no such event, so we measure dwell on the message container instead.
  const messageNodeRef = useRef(null);
  useArtifactEngagement(chatId, message, messageNodeRef);

  // Inline edit state (user messages only)
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const editTextareaRef = useRef(null);

  useEffect(() => {
    if (isEditing && editTextareaRef.current) {
      const el = editTextareaRef.current;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    }
  }, [isEditing]);

  const startEditing = useCallback(() => {
    setEditText(message?.content || '');
    setIsEditing(true);
  }, [message?.content]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditText('');
  }, []);

  const submitEdit = useCallback(() => {
    const trimmed = editText.trim();
    if (!trimmed || trimmed === message?.content) {
      cancelEditing();
      return;
    }
    if (onEditMessage) onEditMessage(message.id, trimmed);
    setIsEditing(false);
    setEditText('');
  }, [editText, message?.content, message?.id, onEditMessage, cancelEditing]);

  // Rewrite-message state (AI text messages only)
  const [rewriteState, setRewriteState] = useState({
    busy: false,
    text: null,    // string when a rewrite is available
    error: null    // string when last attempt failed
  });

  const handleRewrite = useCallback(async () => {
    if (!message?.content) return;
    setRewriteState({ busy: true, text: null, error: null });
    try {
      const lang = i18n?.language || 'en';
      const rewritten = await rewrite_text(message.content, lang);
      setRewriteState({ busy: false, text: rewritten, error: null });
    } catch (err) {
      console.error('Rewrite failed:', err);
      setRewriteState({
        busy: false,
        text: null,
        error: t('chat.rewriteFailed')
      });
    }
  }, [message?.content, i18n?.language, t]);

  const handleCloseRewrite = useCallback(() => {
    setRewriteState({ busy: false, text: null, error: null });
  }, []);

  // Check if in development mode
  const isDevelopment = process.env.NODE_ENV === 'development' ||
                        window.location.hostname === 'localhost';

  // Parse quiz data
  const parsedQuizData = useMemo(() => {
    if (!message || !message.quizData) return null;

    try {
      if (Array.isArray(message.quizData)) {
        return message.quizData;
      }

      if (typeof message.quizData === "string") {
        return JSON.parse(message.quizData);
      }

      return null;
    } catch (err) {
      console.error("Failed to parse quizData:", err);
      return null;
    }
  }, [message?.quizData]);

  // Parse flashcard data
  const parsedFlashcardData = useMemo(() => {
    if (!message || !message.flashcardData) return null;

    try {
      if (Array.isArray(message.flashcardData)) {
        devLog("✅ Flashcard data parsed successfully:", message.flashcardData.length, "cards");
        devLog("📋 Message type:", message.type);
        devLog("📋 Message ID:", message.id);
        return message.flashcardData;
      }

      if (typeof message.flashcardData === "string") {
        const parsed = JSON.parse(message.flashcardData);
        devLog("✅ Flashcard data parsed from string:", parsed.length, "cards");
        return parsed;
      }

      return null;
    } catch (err) {
      console.error("Failed to parse flashcardData:", err);
      return null;
    }
  }, [message?.flashcardData]);

  // Quiz answer handler - forwards to parent for Firebase persistence
  const handleQuizAnswerSelect = useCallback((answerData) => {
    if (!message) return;

    if (onQuizInteraction) {
      onQuizInteraction(message.id);
    }

    if (onQuizAnswerSelect) {
      onQuizAnswerSelect({
        ...answerData,
        messageId: message.id,
        answeredAt: new Date().toISOString()
      });
    }
  }, [message?.id, onQuizInteraction, onQuizAnswerSelect]);


  // ============================================
  // GUARD CLAUSE (after all hooks)
  // ============================================

  if (!message) {
    console.warn('ChatMessage received undefined message');
    return null;
  }

  // ============================================
  // DERIVED VALUES (safe after guard)
  // ============================================

  devLog("msg check before role:", message)
  // Support both 'role' (standard) and 'sender' (legacy game quizzes)
  const isAI = message.role === "assistant" || message.sender === "ai";
  const isUser = message.role === "user" || message.sender === "user";

  const fullFile = uploadedFilesList?.find(
    (uploadedFile) => uploadedFile.name === message.file?.name && uploadedFile.id === message.file?.id
  );

  // ============================================
  // RENDER
  // ============================================

  // Check if message contains flashcards for styling
  const hasFlashcards = isAI && Array.isArray(parsedFlashcardData) && parsedFlashcardData.length > 0;

  return (
    <div
      ref={messageNodeRef}
      className={`message ${isUser ? "user-message" : "ai-message"} ${hasFlashcards ? "message-with-flashcards" : ""}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Avatar */}
      {isAI && (
        <div className="message-avatar-container">
          {message.isStreaming ? (
            <StreamingLogo />
          ) : (
            <StaticLogo />
          )}
        </div>
      )}

      {/* Content */}
      <div className="message-content" data-selectable="true">
        {message.type === 'practice_debrief' && <PracticeDebrief message={message} onSendMessage={onSendMessage} onRetry={onRetryDebrief} />}
        {/* Delete Button (Dev Mode + View All Chats Only) */}
        {isDevelopment && viewAllChatsMode && isHovered && onDeleteMessage && !message.isStreaming && (
          <button
            className="message-delete-button"
            onClick={() => onDeleteMessage(message.id)}
            title="Delete message"
          >
            ×
          </button>
        )}

        {/* Summary Display */}
        {isAI && message.type === "summary" && message.summaryData && (
          <div className="message-text">
            <SummaryDisplay summary={message.summaryData} />
          </div>
        )}

        {/* Quiz Display - New High-Dopamine Streaming Quiz */}
        {/* Only render when type is explicitly 'quiz' to prevent duplicate quiz renders */}
        {isAI && message.type === 'quiz' && (
          <div className="message-text">
            {onOpenPractice ? <PracticeLaunchCard message={message} questions={parsedQuizData || []} onOpen={onOpenPractice} /> : <ChatQuizStream
              quizData={parsedQuizData || []}
              messageId={message.id}
              isStreaming={message.isStreaming}
              expectedTotal={message.expectedTotal || parsedQuizData?.length || 4}
              generatingCurrent={message.generatingCurrent || 0}
              onAnswerSelect={handleQuizAnswerSelect}
              onComplete={(stats) => {
                devLog('Quiz completed:', stats);
                if (onQuizInteraction) {
                  onQuizInteraction(null);
                }
              }}
              chatId={chatId}
              /* Quizzes now ship short and grow as the student advances. The
                 topic is what the next batch is generated from — without it
                 the quiz simply stays the length it arrived at. */
              quizTopic={message.quizTopic || message.topic || null}
              onQuestionsAppended={
                onQuizExtended
                  ? (questions) => onQuizExtended(message.id, questions)
                  : undefined
              }
            />}
            {process.env.NODE_ENV === 'development' && (
              <DevCopyJsonButton quizData={parsedQuizData || []} />
            )}
          </div>
        )}

        {isAI && Array.isArray(parsedFlashcardData) && (parsedFlashcardData.length > 0 || message.isStreaming) && (
          <div className="message-text">
            <FlashcardPractice key={message.id} message={message} cards={parsedFlashcardData}
              chatId={chatId} files={uploadedFilesList} readOnly={viewAllChatsMode} />
          </div>
        )}

        {/* Study Sheet Display */}
        {isAI && message.html && (
          <ChatStudySheet message={message} />
        )}

        {/* Scenario Display */}
        {isAI && message.type === "scenario" && message.scenarioData && (
          <div className="message-text">
            <ChatScenario
              scenario={message.scenarioData}
              askScenario={() => onOptionClick("Mise en situation", message.file.name)}
            />
          </div>
        )}

        {/* Stream error — the response failed or came back empty.
            Rendered instead of the regular text block; offers a Retry that
            re-sends the original prompt. */}
        {isAI && message.error && (
          <div className="message-text">
            {message.content && (
              <ReactMarkDown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkDown>
            )}
            <div
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
                background: 'rgba(220,53,69,0.08)',
                border: '1px solid rgba(220,53,69,0.35)',
                borderRadius: 8,
                padding: '10px 14px',
                marginTop: message.content ? 8 : 0,
                fontSize: '14px'
              }}
            >
              <span>⚠️ {t(message.errorKey || 'chat.streamError')}</span>
              {message.retryText && onRetryMessage && (
                <button
                  type="button"
                  onClick={() => onRetryMessage(message)}
                  style={{
                    background: 'rgba(220,53,69,0.15)',
                    border: '1px solid rgba(220,53,69,0.45)',
                    borderRadius: 6,
                    padding: '4px 14px',
                    cursor: 'pointer',
                    color: 'inherit',
                    fontSize: '13px',
                    fontWeight: 600
                  }}
                >
                  ↻ {t('chat.retry')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Regular Text Message */}
        {!(isAI && message.error) && !parsedQuizData && !parsedFlashcardData && message.type !== "studysheet" && message.type !== 'practice_debrief' && (
          <div className={isAI ? "message-text" : isEditing ? "message-edit-mode" : "user-text user-text-markdown"}>
            {isUser ? (
              isEditing ? (
                <div className="message-edit-container">
                  <textarea
                    ref={editTextareaRef}
                    className="message-edit-textarea"
                    value={editText}
                    placeholder={t('chat.editPlaceholder')}
                    aria-label={t('chat.editMessage')}
                    onChange={e => {
                      setEditText(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit(); }
                      if (e.key === 'Escape') cancelEditing();
                    }}
                  />
                  <div className="message-edit-actions">
                    <button
                      type="button"
                      className="message-edit-cancel"
                      onClick={cancelEditing}
                    >
                      {t('chat.editCancel')}
                    </button>
                    <button
                      type="button"
                      className="message-edit-save"
                      onClick={submitEdit}
                      disabled={!editText.trim()}
                    >
                      {t('chat.editSave')}
                    </button>
                  </div>
                </div>
              ) : (
                <ReactMarkDown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkDown>
              )
            ) : (
              <div className={`ai-message-wrapper ${message.isStreaming ? 'streaming' : 'complete'}`}>
                {/* A half-streamed fence would parse into a garbled graph, so
                    diagrams are only promoted once the answer has landed. */}
                <ReactMarkDown
                  remarkPlugins={[remarkGfm]}
                  components={message.isStreaming ? undefined : diagramMarkdownComponents}
                >
                  {message.content}
                </ReactMarkDown>
                {message.isStreaming && (
                  <span className="streaming-cursor">▊</span>
                )}
                {!message.isStreaming && message.content && (
                  <div className="message-actions-row">
                    {/* Thumbs first, and always visible — Copy/Rewrite fade in
                        to their right so nothing moves when they appear. */}
                    <MessageRating
                      chatId={chatId}
                      message={message}
                      onRated={onMessageRated}
                    />
                    <div className="message-actions-hover-group">
                      <span className="message-actions-divider" aria-hidden="true" />
                      <CopyMessageButton text={message.content} />
                      <RewriteButton
                        busy={rewriteState.busy}
                        onClick={handleRewrite}
                      />
                    </div>
                  </div>
                )}
                {rewriteState.error && (
                  <div className="rewrite-error" role="alert">
                    {rewriteState.error}
                  </div>
                )}
                {rewriteState.text && (
                  <RewritePreview
                    text={rewriteState.text}
                    onClose={handleCloseRewrite}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* Edit button — shown on hover for user messages that are not streaming */}
        {isUser && !message.isStreaming && onEditMessage && !isEditing && (
          <div className="user-message-action-row">
            <button
              type="button"
              className="message-edit-btn"
              onClick={startEditing}
              title={t('chat.editMessage')}
              aria-label={t('chat.editMessage')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
              </svg>
            </button>
          </div>
        )}

        {/* File Attachment */}
        {fullFile && (
          <>
            {fullFile.status === "uploading" && (
              <div className="spinner"></div>
            )}
            <div className="file-attachment">
              <div className="file-icon">📄</div>
              <div className="file-details">
                <div className="file-name">{fullFile.name}</div>
                <div className="file-size">{fullFile.size}</div>

                {message.file.downloadURL && (
                  <a
                    href={message.file.downloadURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="file-link"
                  >
                    {i18n.language === 'fr' ? 'Voir le fichier' : 'View file'}
                  </a>
                )}
              </div>
            </div>
          </>
        )}

        {/* Image Attachment */}
        {message.image && (
          <div className="image-attachment">
            <img src={message.image} alt="Uploaded by user" />
          </div>
        )}

        {/* Metadata */}
        <div className="message-timestamp"></div>
        {message.model && <div className="message-model">{message.model}</div>}
      </div>
    </div>
  );
};

export default React.memo(ChatMessage);
