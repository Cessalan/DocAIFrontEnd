import React from 'react';
import { useTranslation } from 'react-i18next';
import { appendUniqueQuestions, practiceTarget } from './practiceModel';
import { collectPracticeItems } from './practiceCoverageModel';
import { useUsageLimit } from '../../Contexts/UsageContext/UsageContext';
import PrintQuizButton from './PrintQuizButton';
import PracticePlanSummary from './PracticePlanSummary';
import './PracticeLaunchCard.css';

export default function PracticeLaunchCard({ message, questions = [], onOpen }) {
  const { t } = useTranslation();
  const { remaining, isPro } = useUsageLimit();
  const all = appendUniqueQuestions(questions, message.practice?.questions || []);
  // Questions arrive in batches while she works, so "loaded" is not the size
  // of the practice. Progress and the headline use the target, like the quiz.
  const target = Math.max(all.length, practiceTarget(message, all.length, remaining, isPro));
  const growing = target > all.length;
  const subjects = [...new Set(all.map(question => question.topic || question.metadata?.topic).filter(topic => typeof topic === 'string' && topic.trim()).map(topic => topic.trim()))];
  const namedTopic = [message.quizTopic, message.topic].find(topic => typeof topic === 'string' && topic.trim() && !/^(quiz practice|your practice|quiz|general|uploaded course material)$/i.test(topic.trim()));
  const topic = namedTopic || subjects.slice(0, 2).join(' · ');
  const answered = all.filter((question, index) => typeof (message.practice?.answers?.[index] || question.userSelection)?.isCorrect === 'boolean').length;
  const started = answered > 0 || (message.practice?.snapshot?.queueIndex || 0) > 0;
  const complete = all.length > 0 && !growing && answered === all.length && !message.isStreaming;
  // The score lives here, not in the review note below the card: the note
  // talks about what she can do and what to fix, and this states the result.
  // Same first-try rule as the coverage model, so the two never disagree.
  const firstTry = complete ? collectPracticeItems([{ ...message, type: 'quiz', isStreaming: false, quizData: all }]) : [];
  const firstTryCorrect = firstTry.filter(item => item.correctFirst).length;
  const showScore = complete && firstTry.length === all.length && firstTry.every(item => item.attempted);
  const label = complete ? t('practiceEntry.review', 'Review practice') : started ? t('practiceEntry.resume', 'Resume practice') : message.isStreaming ? t('practiceEntry.open', 'Open practice') : t('practiceEntry.start', 'Start practice');
  return <section className="practice-entry" aria-label={t('practiceEntry.label', 'Quiz practice')}>
    <div className="practice-entry-heading">
      <span className="practice-entry-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 15 10-10 4 4L9 19l-5 1 1-5ZM13 7l4 4M4 23h15"/></svg></span>
      <div><span className="practice-entry-kicker">{target > 10 ? t('practiceEntry.noteSet', { defaultValue: 'a {{count}}-question practice on…', count: target }) : t('practiceEntry.note', 'a little practice on…')}</span><h3>{topic || t('practiceEntry.fromQuestions', 'From your questions')}</h3></div>
    </div>
    {!topic && all[0]?.question && <p className="practice-entry-preview">{all[0].question}</p>}
    <PracticePlanSummary plan={message.practice?.settings?.practice_plan} />
    <p className="practice-entry-detail">{showScore ? t('practiceEntry.firstTry', { defaultValue: '{{correct}} of {{count}} right first time', correct: firstTryCorrect, count: all.length }) : message.isStreaming ? t('practiceEntry.preparing', 'Preparing your questions…') : growing ? t('practiceEntry.readyOf', { defaultValue: '{{loaded}} of {{count}} ready · more load as you go', loaded: all.length, count: target }) : t('practiceEntry.ready', { defaultValue: '{{count}} questions ready', count: all.length })}</p>
    {started && <div className="practice-entry-progress"><div className="practice-entry-track" role="progressbar" aria-label={t('practiceEntry.progress', 'Questions answered')} aria-valuemin={0} aria-valuemax={target} aria-valuenow={answered}><span style={{ width: `${target ? answered / target * 100 : 0}%` }} /></div><span>{answered}/{target}</span></div>}
    <div className="practice-entry-footer"><span>{started ? t('practiceEntry.saved', 'Your place is saved') : t('practiceEntry.help', 'A hint if you need one')}</span><div className="practice-entry-actions">{!message.isStreaming && <PrintQuizButton questions={all} answers={message.practice?.answers} topic={topic} />}<button type="button" onClick={event => {
      const { left, top, width, height } = event.currentTarget.closest('.practice-entry').getBoundingClientRect();
      onOpen(message.id, { left, top, width, height });
    }}>{label}<svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 10h12m-5-5 5 5-5 5"/></svg></button></div></div>
  </section>;
}
