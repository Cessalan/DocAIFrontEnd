import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import i18n from '../../src/i18n/i18n';
import CourseContextForm from '../../src/Components/CourseIntelligence/CourseContextForm';
import { CourseUploadWelcome } from '../../src/Components/CourseIntelligence/CourseExamWelcome';
import CourseStudyBrief from '../../src/Components/CourseIntelligence/CourseStudyBrief';
import { normalizeReport, initialTimeline, reduceTimeline } from '../../src/Components/CourseIntelligence/courseIntelligenceModel';
import { studioReport, studioFiles, studioQuestions } from '../../src/Components/CourseIntelligence/__fixtures__/courseStudio';
import '../../src/index.css';
import '../../src/Components/ChatInerface/ChatInterface.css';
import '../../src/Components/ChatInerface/PlanOnboarding.css';

const demoPassages = [
  'Cardiac output is the volume of blood pumped in one minute: heart rate × stroke volume. Stroke volume is the volume ejected by a ventricle with each beat.',
  'The fluid balance record brings together fluid intake and output. Hyponatremia describes a low sodium concentration in the blood.',
  'Endocrine glands release hormones into the bloodstream. The pancreas contains cells that produce insulin.',
];
const demoQuiz = { questions: studioQuestions.questions.map((q, i) => ({ ...q,
  source: { filename: studioFiles[Math.floor(i / 2)], excerpt: demoPassages[Math.floor(i / 2)] },
})) };

function Preview() {
  const [phase, setPhase] = useState('discovery');
  const [run, setRun] = useState(0);
  const [dark, setDark] = useState(true);
  const [mobile, setMobile] = useState(false);
  const [lang, setLang] = useState('en');
  const [context, setContext] = useState({});
  const [date, setDate] = useState('');
  const [timeline, setTimeline] = useState(initialTimeline);
  const [handoff, setHandoff] = useState(null);
  const report = normalizeReport(studioReport);
  useEffect(() => { document.body.classList.toggle('dark-mode', dark); }, [dark]);
  useEffect(() => { i18n.changeLanguage(lang); }, [lang]);
  useEffect(() => {
    if (phase !== 'discovery') return undefined;
    setTimeline(initialTimeline());
    // Demo events only. Production uses the real SSE stream.
    const events = [
      ['materials_analyzed', 'done', { topic_count: 4, file_count: 4, top_topics: report.strategy.orderedTopics }],
      ['course_research', 'running', {}], ['exam_analysis', 'running', {}],
      ['course_research', 'empty', {}], ['professor_research', 'empty', {}], ['academic_resources_research', 'empty', {}],
      ['exam_analysis', 'done', { coverage_count: 3 }], ['concept_mapping', 'running', {}], ['concept_mapping', 'done', { scored: 4 }],
      ['study_strategy', 'done', { start: report.strategy.orderedTopics[0] }],
    ];
    const timers = events.map(([step, state, detail], index) => setTimeout(() => setTimeline(prev => reduceTimeline(prev, { status: 'course_intelligence_progress', step, state, detail })), 700 + index * 430));
    timers.push(setTimeout(() => setTimeline(prev => reduceTimeline(prev, {
      status: 'course_material_excerpt', source: demoQuiz.questions[0].source,
      topics: report.strategy.orderedTopics.slice(0, 3),
    })), 1600));
    timers.push(setTimeout(() => setPhase('brief'), 5700));
    return () => timers.forEach(clearTimeout);
  // The illustrative report is fixed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, run]);
  return <>
    <nav className="preview-controls"><span>Design preview · illustrative course data</span><div>
      <button onClick={() => { setPhase('discovery'); setDate(''); setRun(r => r + 1); setHandoff(null); }}>Restart</button>
      <button onClick={() => setPhase('discovery')}>Discovery</button>
      <button onClick={() => { setPhase('overview'); setRun(r => r + 1); setHandoff(null); }}>Overview</button>
      <button onClick={() => { setPhase('brief'); setRun(r => r + 1); setHandoff(null); }}>Question</button>
      <button aria-pressed={mobile} onClick={() => setMobile(v => !v)}>Mobile</button>
      <button aria-pressed={dark} onClick={() => setDark(v => !v)}>Dark</button>
      <button onClick={() => setLang(l => l === 'en' ? 'fr' : 'en')}>{lang === 'en' ? 'Français' : 'English'}</button>
    </div></nav>
    <main className={`preview-main${mobile ? ' preview-mobile' : ''}`}>
      <div className="preview-intro"><span>NurseQuizAI</span><p>Study plan preview</p></div>
      {phase === 'context' && <CourseContextForm language={lang} filenames={studioFiles} fileCount={4} uploading onSubmit={value => { setContext(value); setDate(value.examDate); setPhase('discovery'); }} onSkip={value => { setContext(value); setPhase('discovery'); }} />}
      {phase === 'discovery' && <div className="message ai-message"><div className="message-content"><div className="plan-onboarding" data-phase="intelligence"><CourseUploadWelcome materialsReady={timeline.steps.some(step => step.state === 'done')} /></div></div></div>}
      {(phase === 'brief' || phase === 'overview') && !handoff && <div className="message ai-message"><div className="message-content"><div className="plan-onboarding" data-phase="report"><CourseStudyBrief key={run} streamlined report={report} initialQuiz={demoQuiz} initialPhase="check" chatId="illustrative-preview" filenames={studioFiles} language={lang} examDate={date} onExamDate={setDate} onStart={setHandoff} /></div></div></div>}
      {handoff && <div className="preview-handoff" role="status"><strong>Verified handoff to the planner</strong><p>{handoff.rankedTopics.map(r => r.topic).join(' → ')}</p><p>Diagnostic: {JSON.stringify(handoff.diagnostic)}</p><button onClick={() => { setRun(r => r + 1); setHandoff(null); }}>Try different answers</button></div>}
    </main>
  </>;
}
createRoot(document.getElementById('root')).render(<Preview />);
