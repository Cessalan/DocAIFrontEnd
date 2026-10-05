// Inert visual check of the real inspector. No Firebase or student records.
const esbuild = require('esbuild');
const http = require('http');
const path = require('path');
const root = path.resolve(__dirname, '..');
const prefix = '/admin/workspace/study-plans';
const port = Number(process.env.STUDY_PREVIEW_PORT || 4186);
const snapshot = { chat: { id: 'demo', title: 'Cardiac exam preparation', createdAt: '2026-09-20T12:00:00Z', study: { status: 'active', path: { nodes: [
  { id: 'n1', label: 'Initial readiness check', type: 'quiz', status: 'done', messageId: 'm1', completedAt: '2026-09-20T12:05:00Z' },
  { id: 'n2', label: 'Choosing the first action', type: 'exam', status: 'done', messageId: 'm2', adaptive: true, reason: 'Check the distinction discussed with the tutor in a new scenario.', tags: ['reasoning_followup'], examConfig: { customInstructions: 'Three new scenarios about choosing the first action. Do not repeat the previous questions.' } },
  { id: 'n3', label: 'Medication review', type: 'lesson', status: 'locked' },
] } } }, owner: { email: 'sample-student@example.com' }, performance: { history: [{ nodeId: 'n1', at: '2026-09-20T12:05:00Z', correct: 1, total: 3, topic: 'Initial readiness check' }] } };
const firstQuestion = { question: 'In this example from the uploaded notes, which action comes first?', options: ['Check the information described in the case', 'Begin the next planned action', 'Document the final result'], correctIndex: 0, questionType: 'mcq', rationale: 'Sample explanation: identify the information required before moving to the next step.' };
const summary = [
  { id: 'm1', nodeId: 'n1', type: 'study_quiz', timestamp: '2026-09-20T12:01:00Z', answerRecords: { first: { 0: { correct: false, recordedAt: '2026-09-20T12:02:00Z' } }, latest: { 0: { isCorrect: true } } } },
  { id: 'm2', nodeId: 'n2', type: 'study_exam', timestamp: '2026-09-20T12:10:00Z', answerRecords: { first: { 0: { correct: false, recordedAt: '2026-09-20T12:02:00Z' } }, latest: { 0: { isCorrect: true } } } },
];
const detail = id => ({ message: { id, type: id === 'm1' ? 'study_quiz' : 'study_exam', timestamp: id === 'm1' ? '2026-09-20T12:01:00Z' : '2026-09-20T12:10:00Z', studyContent: { questions: [firstQuestion,
  { question: 'Which details in the sample should be checked? Select all that apply.', options: ['The current information', 'The relevant instructions', 'An unrelated detail'], questionType: 'sata', correctAnswers: [0, 1], rationale: 'Sample explanation: evaluate each option against the information in the case.' },
  { question: 'Classify each sample statement.', questionType: 'matrix', columns: [{ id: 'yes', label: 'Relevant' }, { id: 'no', label: 'Not relevant' }], rows: [{ id: 'r1', text: 'A detail from the current case', correctColumnId: 'yes' }, { id: 'r2', text: 'An unrelated detail', correctColumnId: 'no' }] },
] }, quizProgress: { firstAttemptAnswers: { 0: { correct: false, selection: 1, recordedAt: '2026-09-20T12:02:00Z' } }, answers: { 0: { isCorrect: true, selectedIndex: 0 } } } }, discussions: [{ id: '0', history: [{ role: 'user', content: 'I chose the action because it sounded useful, but I missed that it asked what comes first.' }, { role: 'assistant', content: 'Look at the information the case gives you. Which check must happen before that action?' }] }], summaries: [{ id: 'latest', summaries: [{ question_index: 0, summary: 'Check the difference between a useful action and the first action.', learner_quote: 'I missed that it asked what comes first.', status: 'needs_check' }], focus: { skill: 'Identify the first action' } }] });
async function main() {
  const result = await esbuild.build({ absWorkingDir: root, stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {BrowserRouter,Routes,Route} from 'react-router-dom'; import Inspector from './src/Components/Admin/StudyPlanInspector'; createRoot(document.getElementById('root')).render(<BrowserRouter><div style={{padding:10,background:'#263343',color:'white',font:'13px system-ui'}}>VISUAL PREVIEW · fictional sample records · no production connection</div><Routes><Route path='/admin/study-plans' element={<Inspector/>}/><Route path='/admin/study-plans/:chatId' element={<Inspector/>}/></Routes></BrowserRouter>);`, resolveDir: root, loader: 'jsx' }, bundle: true, write: false, outdir: 'preview-output', define: { 'process.env.NODE_ENV': '"production"' }, loader: { '.js': 'jsx' }, plugins: [{ name: 'inert-admin', setup(build) {
    build.onResolve({ filter: /Services\/AdminService$/ }, () => ({ path: 'admin-fixture', namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `const prefix=${JSON.stringify(prefix)}, snapshot=${JSON.stringify(snapshot)}, summary=${JSON.stringify(summary)}, details=${JSON.stringify({ m1: detail('m1'), m2: detail('m2') })}; export async function adminRequest(url){if(url===prefix)return {items:[snapshot.chat],cursor:null};if(url===prefix+'/demo')return snapshot;if(url===prefix+'/demo/messages')return {items:summary,cursor:null};if(url.includes('/messages/'))return details[url.split('/').pop()];throw Error('Unknown sample record');}` }));
  } }] });
  const files = Object.fromEntries(result.outputFiles.map(f => [f.path.endsWith('.css') ? '/app.css' : '/app.js', f.contents]));
  http.createServer((req, res) => {
    if (files[req.url]) { res.setHeader('Content-Type', req.url.endsWith('.css') ? 'text/css' : 'text/javascript'); return res.end(files[req.url]); }
    res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Study timeline inspector preview</title><link rel="stylesheet" href="/app.css"><style>body{margin:0}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
  }).listen(port, '127.0.0.1', () => console.log(`Preview: http://127.0.0.1:${port}/admin/study-plans/demo`));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
