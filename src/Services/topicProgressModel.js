export const exactTopicKey = value => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
// Same identity rule as QuickCheckRecord, independent of option order.
export const questionFingerprint = question => JSON.stringify([
  exactTopicKey(question.scenario), exactTopicKey(question.question),
  (question.options || []).map(option => exactTopicKey(typeof option === 'string' ? option : option?.text || option?.label)).sort(),
]);

/** A completed first pass. Keep per-question evidence, never a review-round score. */
export class PracticeAttemptRecord {
  constructor({ checkId, node, content, progress, completedAt = new Date().toISOString() }) {
    this.schemaVersion = 1;
    this.checkId = checkId;
    this.nodeId = node.id;
    this.type = node.type;
    this.completedAt = completedAt;
    this.source = 'study_practice';
    this.answers = [];
    const questions = content?.questions || [];
    if (!['quiz', 'exam'].includes(node.type) || !questions.length) return;
    const statuses = progress?.firstAttemptStatuses;
    questions.forEach((question, index) => {
      const status = statuses?.[index];
      const examAnswer = node.type === 'exam' ? progress?.answers?.[index] : null;
      const correct = node.type === 'exam' ? examAnswer?.isCorrect : status === 'correct' ? true : status === 'incorrect' ? false : null;
      if (typeof correct !== 'boolean' || !question.question) return;
      const topicKey = question.topic ? exactTopicKey(question.topic) : node.topicKey;
      if (!topicKey) return;
      const detail = progress?.firstAttemptAnswers?.[index];
      this.answers.push({ questionId: `${node.id}:${index}`, questionIndex: index, topicKey, topic: question.topic || node.topic,
        fingerprint: questionFingerprint(question), question: question.question,
        scenario: question.scenario || null, options: question.options || [],
        correctIndex: question.correctIndex ?? null, correctIndices: question.correctIndices ?? null,
        difficulty: question.difficulty || null, recordedAt: detail?.recordedAt || completedAt,
        format: question.format || question.questionType || question.metadata?.questionType || 'mcq',
        concept: question.concept || null, kind: question.kind || null,
        correct, partial: detail?.partial ?? examAnswer?.isPartial ?? false,
        selection: detail?.selection ?? examAnswer?.selectedIndices ?? examAnswer?.selectedIndex ?? null, attempt: 1,
      });
    });
    // Do not turn a partial/unfinished quiz into a completed measurement.
    if (this.answers.length !== questions.length) this.answers = [];
  }
  toJSON() { return JSON.parse(JSON.stringify({ ...this })); }
}

export const baselineTopics = baseline => {
  const rows = {};
  (baseline?.answers || []).forEach(answer => {
    const key = answer.topicKey || exactTopicKey(answer.topic);
    const row = rows[key] || { topicKey: key, topic: answer.topic, correct: 0, answered: 0 };
    row.correct += Number(answer.correct === true);
    row.answered += 1;
    rows[key] = row;
  });
  return rows;
};

export const compareTopicResult = (baseline, latest) => {
  if (!baseline?.answered || !latest?.answered) return null;
  const delta = Math.round(100 * (latest.correct / latest.answered - baseline.correct / baseline.answered));
  return { baseline, latest, delta, direction: delta > 0 ? 'higher' : delta < 0 ? 'lower' : 'same' };
};
