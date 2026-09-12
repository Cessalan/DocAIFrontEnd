/**
 * Keep a completed-practice review beside the quiz it describes. Firestore
 * stores the review later in time, but rendering it at the conversation end
 * disconnects it from an older quiz.
 */
export function placePracticeDebriefs(messages = []) {
  const sourceIds = new Set(messages.filter(message => message.type === 'quiz').map(message => message.id));
  const reviews = new Map();
  const timeline = [];

  for (const message of messages) {
    if (message.type === 'practice_debrief' && sourceIds.has(message.sourceQuizId)) {
      const group = reviews.get(message.sourceQuizId) || [];
      group.push(message);
      reviews.set(message.sourceQuizId, group);
    } else {
      timeline.push(message);
    }
  }

  return timeline.flatMap(message => message.type === 'quiz'
    ? [message, ...(reviews.get(message.id) || [])]
    : [message]);
}
