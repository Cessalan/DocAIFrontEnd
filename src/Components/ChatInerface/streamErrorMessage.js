// Quiz setup can replace the original placeholder before an error arrives.
// Always leave a visible error, and preserve any questions already delivered.
export function applyStreamError(messages, { messageId, relatedIds = [], code, message, retryText }) {
  const target = messages.find(item => item.id === messageId);
  const preserveQuiz = target?.type === 'quiz' && target.quizData?.length > 0;
  const errorId = preserveQuiz ? `${messageId}-error` : messageId;
  const error = {
    id: errorId,
    role: 'assistant',
    type: 'text',
    content: target && !target.type ? target.content || '' : '',
    error: true,
    errorKey: code === 'timeout' ? 'chat.timeoutError' : 'chat.streamError',
    errorMessage: code === 'material_support' ? message || '' : '',
    retryText,
    isStreaming: false,
    timestamp: target?.timestamp || new Date(),
  };
  const next = messages.map(item => item.id === errorId ? error
    : relatedIds.includes(item.id) || item.id === messageId ? { ...item, isStreaming: false } : item);
  return next.some(item => item.id === errorId) ? next : [...next, error];
}
