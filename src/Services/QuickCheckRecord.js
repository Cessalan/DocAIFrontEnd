import { exactTopicKey as canonical, questionFingerprint } from './topicProgressModel';

/** A first-attempt answer. toJSON returns plain Firestore-compatible data.
 * Topic keys are exact normalized labels within this check, never fuzzy matches.
 * The fingerprint detects identical stems/options, not paraphrased questions.
 */
export class QuestionAnswerRecord {
  constructor({ checkId, questionIndex, question, selection, grade, recordedAt = new Date().toISOString() }) {
    if (!checkId || !Number.isInteger(questionIndex) || questionIndex < 0 || !question?.topic || !question?.question) {
      throw new Error('An answer requires a check, question index, topic and question');
    }
    if (selection == null || typeof grade?.correct !== 'boolean') throw new Error('An answer requires a selection and grade');
    this.schemaVersion = 1;
    this.checkId = checkId;
    this.questionId = `${checkId}:${questionIndex}`;
    this.questionIndex = questionIndex;
    this.source = 'quick_check';
    this.attempt = 1;
    this.recordedAt = recordedAt;
    this.topic = question.topic;
    this.topicKey = canonical(question.topic);
    this.concept = question.concept || null;
    this.question = question.question;
    this.options = [...(question.options || [])];
    this.scenario = question.scenario || null;
    this.format = question.format || 'mcq';
    this.kind = question.kind || null;
    this.difficulty = question.difficulty ?? null;
    this.correctIndices = this.format === 'sata' ? [...question.correctIndices] : [question.correctIndex];
    this.rationale = question.rationale || null;
    this.selection = Array.isArray(selection) ? [...selection] : selection;
    this.correct = grade.correct;
    this.partial = !!grade.partial;
    this.unsure = selection === 'unsure';
    this.questionFingerprint = questionFingerprint(question);
  }

  toJSON() { return JSON.parse(JSON.stringify({ ...this })); }
}

/** An immutable baseline; aggregates are derived from the individual answers. */
export class QuickCheckRecord {
  constructor({ checkId, chatId, answers, offered, funnelId = null, completedAt = new Date().toISOString() }) {
    if (!checkId || !chatId || !answers?.length) throw new Error('A baseline requires answered questions');
    const records = answers.map(answer => answer instanceof QuestionAnswerRecord ? answer.toJSON() : { ...answer });
    if (records.some(answer => answer.checkId !== checkId || answer.source !== 'quick_check' || answer.attempt !== 1)
      || new Set(records.map(answer => answer.questionId)).size !== records.length) {
      throw new Error('Baseline answers must belong to one check and be unique first attempts');
    }
    this.schemaVersion = 1;
    this.checkId = checkId;
    this.chatId = chatId;
    this.funnelId = funnelId;
    this.completedAt = completedAt;
    this.offered = offered;
    this.answered = records.length;
    this.completion = records.length === offered ? 'completed' : 'ended_early';
    this.answers = records;
    const topics = new Map();
    records.forEach(answer => {
      const topic = topics.get(answer.topicKey) || { topicKey: answer.topicKey, name: answer.topic, correct: 0, answered: 0, partial: 0, unsure: 0 };
      topic.answered += 1;
      topic.correct += Number(answer.correct);
      topic.partial += Number(answer.partial);
      topic.unsure += Number(answer.unsure);
      topics.set(answer.topicKey, topic);
    });
    this.topics = [...topics.values()];
  }

  toJSON() { return JSON.parse(JSON.stringify({ ...this })); }
}
