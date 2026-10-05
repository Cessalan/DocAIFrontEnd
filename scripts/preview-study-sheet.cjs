// Local visual/PDF check with fictional learning records. No Firebase access.
const esbuild = require('esbuild'), http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const sample = { version: 2, language: 'english', title: 'Kidney Disorders & Filtration',
  subtitle: 'Glomerular injury, related syndromes, and the role of filtration markers',
  summary: 'Connect the mechanism of glomerular injury with its findings, then distinguish the syndromes and explain what filtration markers tell you. Start with the comparison you flagged for your exam.',
  sources: [{ id: 'P1', kind: 'conversation', label: 'Your study request', quote: 'My teacher emphasized the distinction between nephritic and nephrotic syndromes.' },
    { id: 'Q1', kind: 'quiz', label: 'Kidney review', answered: 4, total: 5 }, { id: 'D1', kind: 'document', label: 'Kidney lecture notes.pdf', page: 8 }],
  sections: [
    { id: 'section-1', title: 'Your review priorities', blocks: [
      { kind: 'callout', tone: 'teacher', title: 'Explain the distinction, not just the definitions', text: 'You mentioned that your teacher emphasized **nephritic versus nephrotic syndromes**. Use the comparison below, then explain how the glomerular change leads to the findings.', sourceIds: ['P1'] },
      { kind: 'callout', tone: 'practice', title: 'Separate the syndrome from a filtration marker', text: 'In your fictional practice example, you selected a filtration marker as the defining feature of a syndrome. Review the difference between a clinical pattern and a measure used to assess kidney function.', sourceIds: ['Q1'] },
    ] },
    { id: 'section-2', title: 'Build the mechanism', blocks: [
      { kind: 'paragraph', text: '**Glomerulonephritis** involves inflammation and injury of the glomeruli. Connect the affected structure to the change in filtration before memorizing a list of findings.', sourceIds: ['D1'] },
      { kind: 'list', ordered: true, title: 'A useful explanation sequence', items: ['Name the affected structure: the glomerulus.', 'Describe the injury or permeability change in your notes.', 'Link that change to the clinical pattern.', 'Explain what you would assess and why.'], sourceIds: [] },
      { kind: 'callout', tone: 'takeaway', title: 'Use the mechanism as your memory cue', text: 'If you can explain the chain from injury to findings, the facts become easier to recall and apply.', sourceIds: [] },
    ] },
    { id: 'section-3', title: 'Compare similar concepts', blocks: [
      { kind: 'table', title: 'Organize your revision', columns: ['Concept', 'What to explain', 'Question to ask yourself'], rows: [
        ['Glomerular injury', 'The affected structure and mechanism described in your notes.', 'How does the injury change filtration?'],
        ['Related syndromes', 'The pattern of findings that distinguishes each syndrome.', 'Which finding best separates these patterns?'],
        ['Filtration markers', 'What the marker measures and the limitations in your course material.', 'Am I describing a syndrome or assessing function?'],
      ], sourceIds: ['D1'] },
    ] },
    { id: 'section-4', title: 'Check your understanding', blocks: [
      { kind: 'self_check', questions: [{ question: 'Explain glomerular injury without using a memorized definition.', answer: 'Name the affected structure, explain the change described in your notes, and connect it to the findings. Use the mechanism to justify your explanation.' },
        { question: 'Why should a clinical syndrome and a filtration marker be studied separately?', answer: 'A syndrome describes a pattern of findings; a marker contributes to an assessment of function. They answer different questions.' }], sourceIds: [] },
      { kind: 'list', title: 'Before you finish', ordered: false, items: ['Explain the teacher-emphasized comparison aloud.', 'Revisit the distinction from your practice.', 'Return to the cited lecture page for details.'], sourceIds: [] },
    ] },
  ] };
async function main() {
  const result = await esbuild.build({ absWorkingDir: root, stdin: { contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import './src/index.css'; import './src/Components/ChatInerface/ChatInterface.css';
    import Sheet from './src/Components/ChatInerface/StudySheetSimple';
    import {createStudySheetPDF} from './src/Components/ChatInerface/studySheetPdf';
    const sheet=${JSON.stringify(sample)};
    const legacy={...sheet, title:'Glomerulonephritis and Related Syndromes, Kidney Function and Filtration Markers, Syndromes and Diseases of the Kidney', subtitle:'', summary:'', sources:[], sections:[
      'GLOMERULONEPHRITIS AND RELATED SYNDROMES','KIDNEY FUNCTION AND FILTRATION MARKERS','GLOMERULONEPHRITIS: CLASSIFICATIONS AND PATHOPHYSIOLOGY',
      'NEPHROTIC SYNDROME','NEPHRITIC SYNDROME','RAPID PROGRESSIVE GLOMERULONEPHRITIS (RPGN)',
      'SYNDROMES VS DISEASES OF THE KIDNEY','SYNDROMES AND DISEASES OF THE KIDNEY: OVERVIEW',
      'NURSING ASSESSMENTS FOR GLOMERULONEPHRITIS AND RELATED SYNDROMES','DIAGNOSTICS AND LABORATORY VALUES',
      'TREATMENT AND NURSING MANAGEMENT','LIFESPAN CONSIDERATIONS','NCLEX PEARL','SUMMARY'
    ].map((title,i)=>({id:'section-'+(i+1),title,blocks:i===0?[{kind:'paragraph',text:'This fictional layout sample uses the same long headings as the earlier study sheet.'},
      {kind:'list',ordered:true,title:'Key concepts',items:['Connect the mechanism in your notes to the findings.','Compare similar concepts before memorizing isolated definitions.','Explain what each filtration marker measures.','Use the priorities from your request to guide your review.']}]
      :[{kind:'paragraph',text:'Sample section content for checking navigation and typography.'}]}))};
    window.makePDF=async (value=sheet)=>Array.from(new Uint8Array((await createStudySheetPDF(value)).output('arraybuffer')));
    window.sampleSheet=sheet;
    window.legacySheet=legacy;
    const params=new URLSearchParams(location.search); if(params.has('dark'))document.body.classList.add('dark-mode');
    if(params.has('fr')){sheet.language='french';sheet.title='Évaluation rénale et filtration';sheet.subtitle='Révision ciblée · priorité de votre professeur';}
    const view=createRoot(document.getElementById('root'));
    window.renderSheet=value=>view.render(<main style={{maxWidth:860,margin:'32px auto',padding:'0 16px'}}><p className="preview-label">LOCAL PREVIEW · FICTIONAL LEARNING RECORDS</p><div className="study-sheet-message"><div className="message-content"><Sheet key={value.title} studySheet={value}/></div></div></main>);
    window.renderSheet(params.has('legacy')?legacy:sheet);
  `, resolveDir: root, loader: 'jsx' }, bundle: true, write: false, outdir: 'preview-output', loader: { '.js': 'jsx' },
    define: { 'process.env.NODE_ENV': '"production"', 'process.env.PUBLIC_URL': '""' },
    plugins: [{ name: 'preview-language', setup(build) {
      build.onResolve({ filter: /^react-i18next$/ }, () => ({ path: 'language', namespace: 'fixture' }));
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export function useTranslation(){return {i18n:{language:"en"}}}' }));
    } }] });
  const files = Object.fromEntries(result.outputFiles.map(f => [f.path.endsWith('.css') ? '/app.css' : '/app.js', f.contents]));
  http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (files[url.pathname]) { res.setHeader('Content-Type', url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript'); return res.end(files[url.pathname]); }
    if (/^\/fonts\/DejaVuSans(?:-Bold)?\.ttf$/.test(url.pathname)) {
      res.setHeader('Content-Type', 'font/ttf'); return res.end(fs.readFileSync(path.join(root, 'public', url.pathname)));
    }
    if (url.pathname === '/favicon.svg') {
      res.setHeader('Content-Type', 'image/svg+xml'); return res.end(fs.readFileSync(path.join(root, 'public/favicon.svg')));
    }
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Study sheet preview</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&display=swap"><link rel="stylesheet" href="/app.css"><style>body{margin:0;background:#fdf8f3}body.dark-mode{background:#2f2f2f}.preview-label{font-size:10px;letter-spacing:1px;color:#958780;margin:0 0 16px}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
  }).listen(4188, '127.0.0.1', () => console.log('Study sheet preview: http://127.0.0.1:4188'));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
