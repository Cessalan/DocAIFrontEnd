import { buildPrintableQuiz, richText, sanitizeRichText } from './quizPrintModel';
import { renderQuizPrintHtml } from './quizPrintDocument';

const mcq = { question: 'Which finding needs action first?', options: ['A) Pulse 88', 'B) SpO2 86%', 'C) Temp 37.9', 'D) Pain 3/10'], answer: 'B) SpO2 86%', justification: '<b>Airway</b> and oxygenation come first.', topic: 'Priorities' };
const sata = { question: 'Signs of hypoglycemia?', options: ['Tremors', 'Diaphoresis', 'Bradycardia', 'Confusion'], answer: ['Tremors', 'Diaphoresis', 'Confusion'], topic: 'Endocrine' };
const ordering = { questionType: 'casestudy', question: 'Order the actions', options: [{ id: 'a', text: 'Call RRT' }, { id: 'b', text: 'Raise HOB' }, { id: 'c', text: 'Apply O2' }], correctOrder: ['b', 'c', 'a'], caseStudy: { nursesNotes: '0800 Client dyspneic.', vitalSigns: 'RR 28', labResults: '' } };

describe('buildPrintableQuiz', () => {
  it('finds the MCQ key from the option text and strips letter prefixes', () => {
    const [item] = buildPrintableQuiz({ questions: [mcq] }).items;
    expect(item.kind).toBe('single');
    expect(item.options.map(o => o.text)).toEqual(['Pulse 88', 'SpO2 86%', 'Temp 37.9', 'Pain 3/10']);
    expect(item.key).toEqual(['B']);
    expect(item.keyText).toEqual(['SpO2 86%']);
  });

  it('accepts a bare letter or correctIndex as the key', () => {
    expect(buildPrintableQuiz({ questions: [{ ...mcq, answer: 'C' }] }).items[0].key).toEqual(['C']);
    expect(buildPrintableQuiz({ questions: [{ ...mcq, answer: 'nothing', correctIndex: 3 }] }).items[0].key).toEqual(['D']);
  });

  it('never guesses a key it cannot find', () => {
    expect(buildPrintableQuiz({ questions: [{ ...mcq, answer: 'Something else entirely' }] }).items[0].key).toEqual([]);
  });

  it('keys select-all by every matching option', () => {
    const [item] = buildPrintableQuiz({ questions: [sata] }).items;
    expect(item.kind).toBe('multi');
    expect(item.key).toEqual(['A', 'B', 'D']);
  });

  it('prints ordering questions with their chart and the correct sequence', () => {
    const [item] = buildPrintableQuiz({ questions: [ordering] }).items;
    expect(item.kind).toBe('order');
    expect(item.key).toEqual(['B', 'C', 'A']);
    expect(item.chart.sections.map(s => s.key)).toEqual(['nursesNotes', 'vitalSigns']);
  });

  it('flattens an unfolding case into numbered parts', () => {
    const unfolding = { scenario: { patientInfo: '72 y/o with CHF', items: [{ question: 'First?', options: ['X', 'Y'], answer: 'Y' }, { question: 'Then?', options: ['P', 'Q', 'R'], answer: ['P', 'R'] }] } };
    const [item] = buildPrintableQuiz({ questions: [mcq, unfolding] }).items.slice(1);
    expect(item.kind).toBe('unfolding');
    expect(item.parts.map(p => [p.number, p.kind, p.key.join('')])).toEqual([['2.1', 'single', 'B'], ['2.2', 'multi', 'AC']]);
    expect(item.chart.patient).toBe('72 y/o with CHF');
  });

  it('reports only the attempts that were actually recorded', () => {
    const quiz = buildPrintableQuiz({
      questions: [{ ...mcq, userSelection: { selectedIndex: 0, isCorrect: false } }, sata, mcq],
      answers: { 1: { selectedOptions: ['Tremors', 'Confusion'], isCorrect: false } },
    });
    expect(quiz.items.map(i => i.attempt)).toEqual([{ letters: ['A'], isCorrect: false }, { letters: ['A', 'D'], isCorrect: false }, null]);
    expect(quiz.result).toEqual({ answered: 2, correct: 0, total: 3 });
  });

  it('ignores placeholder topics and falls back to the questions’ own', () => {
    expect(buildPrintableQuiz({ questions: [mcq, sata], topic: 'Quiz practice' }).title).toBe('Priorities · Endocrine');
    expect(buildPrintableQuiz({ questions: [mcq], topic: 'Cardiac meds' }).title).toBe('Cardiac meds');
  });
});

describe('sanitizeRichText', () => {
  it('keeps formatting and drops anything executable', () => {
    const out = sanitizeRichText('<p onclick="x()">Give <b>O2</b> <img src=x onerror=alert(1)><script>alert(1)</script><a href="javascript:1">now</a></p>');
    expect(out).toBe('<p>Give <b>O2</b> now</p>');
  });
  it('escapes text that looks like markup', () => {
    expect(sanitizeRichText('K+ &lt; 3.5 means <i>hypo</i>')).toBe('K+ &lt; 3.5 means <i>hypo</i>');
  });
});

describe('renderQuizPrintHtml', () => {
  const t = (key, vars) => (vars ? `${key}:${JSON.stringify(vars)}` : key);
  it('strips markup that could run and carries the brand', () => {
    const html = renderQuizPrintHtml({ questions: [{ ...mcq, question: '<img src=x onerror=alert(1)>' }], t, topic: 'Resp' });
    expect(html).not.toContain('<img');
    expect(html).not.toContain('onerror');
    expect(html).toContain('NurseQuiz<b>AI</b>');
    expect(html).toContain('<title>NurseQuizAI - Resp</title>');
  });

  it('renders a chart written as HTML instead of printing its tags', () => {
    const html = renderQuizPrintHtml({ t, questions: [{ ...ordering, caseStudy: { nursesNotes: '<p><strong>Scenario:</strong> A breach of <strong>HIPAA</strong>.</p>' } }] });
    expect(html).toContain('<div class="chart-text"><p><strong>Scenario:</strong> A breach of <strong>HIPAA</strong>.</p></div>');
    expect(html).not.toContain('&lt;strong&gt;');
  });
  it('has no name, date or score lines', () => {
    const html = renderQuizPrintHtml({ t, questions: [mcq] });
    expect(html).not.toContain('quizPrint.name');
    expect(html).not.toContain('class="fields"');
  });
});

describe('richText', () => {
  it('keeps line breaks in plain text and escapes it', () => {
    expect(richText('0800 SOB\n0805 O2 on & HOB up')).toBe('0800 SOB<br>0805 O2 on &amp; HOB up');
  });
  it('does not mistake a comparison for markup', () => {
    expect(richText('K+ < 3.5 and Na > 145')).toBe('K+ &lt; 3.5 and Na &gt; 145');
  });
});
