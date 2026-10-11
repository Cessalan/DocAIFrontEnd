/* ══════════════════════════════════════════════════════════════════════
   REQUEST BRIEF — what she asked for, read back to her, ticked as it is
   actually done.

   WHY THIS EXISTS (2026-10-11)
   ────────────────────────────
   A Pro student asked four times for a hard, NCLEX-style "full exam on both
   these chapters with medications questions", adding that her professor
   tests "medication class not medications name". Each time the app opened a
   5-question quiz whose loading screen said "Reading your notes". Nothing she
   could see said any of it had been heard, and much of it had not been: by
   the fourth quiz the app had kept one line of it.

   The backend now keeps her request as a brief, plans the whole practice from
   it and checks every question against her words (NQBackEnd2
   services/request_brief.py, practice_plan.py, requirement_check.py). This
   model turns those events into the lines the quiz screen shows.

   THE RULE
   ────────
   A line is ticked only for something the backend has actually done:
     heard     her words arrived (the brief), nothing done yet
     planned   the blueprint allocated it (questions per file, per focus)
     checked   questions were judged against it; the count says how many
               passed, so 9 of 10 reads as 9 of 10, not as done
     gap       her material cannot give it; said plainly, never filled
     limited   her plan covers fewer questions than she asked for
     unsupported  the app cannot do it
   Nothing here advances on a timer, and no line claims more than the
   numbers it was given.
   ══════════════════════════════════════════════════════════════════════ */

export const LINE_ORDER = ['count', 'scope', 'focus', 'style', 'difficulty', 'format', 'rule', 'conditions', 'unsupported'];

const fileName = name => String(name || '').replace(/\.[a-z0-9]{2,5}$/i, '').trim();

/** Her own words for the whole request: the user message this quiz answers. */
export function requestText(messages, quizMessageId) {
  const list = Array.isArray(messages) ? messages : [];
  const at = list.findIndex(m => m && m.id === quizMessageId);
  for (let i = (at < 0 ? list.length : at) - 1; i >= 0; i -= 1) {
    const m = list[i];
    if (m && m.role === 'user' && typeof m.content === 'string' && m.content.trim()) return m.content.trim();
  }
  return '';
}

/** {checked, met} for one requirement over the questions delivered so far. */
export function verification(questions, id, { servesOnly = false } = {}) {
  let checked = 0;
  let met = 0;
  for (const q of questions || []) {
    const request = q && q.request;
    if (!request || !request.verified || !(id in request.verified)) continue;
    if (servesOnly && !(request.serves || []).includes(id)) continue;
    const verdict = request.verified[id];
    if (verdict === true || verdict === false) {
      checked += 1;
      if (verdict === true) met += 1;
    }
  }
  return { checked, met };
}

function gapFor(plan, id) {
  return ((plan && plan.gaps) || []).filter(g => g && g.id === id);
}

function line(item, extra) {
  return { id: item.id, kind: item.kind, label: item.label || null, said: item.said || null, ...extra };
}

/**
 * The checklist. Each line: {id, kind, label, said, status, text, detail}
 * where text/detail are {key, vars} for i18n, or null.
 */
export function briefLines({ brief, plan = null, allowance = null, questions = [] } = {}) {
  const items = (brief && Array.isArray(brief.items)) ? brief.items : [];
  const lines = [];
  for (const item of items) {
    if (!item || !LINE_ORDER.includes(item.kind)) continue;
    if (item.kind === 'count') {
      const asked = allowance?.requested || item.value;
      const allowed = allowance?.allowed;
      if (allowed != null && asked && allowed < asked) {
        lines.push(line(item, { status: 'limited', text: { key: 'requestBrief.count', vars: { count: asked } },
          detail: { key: 'requestBrief.countLimited', vars: { count: allowed } } }));
      } else {
        lines.push(line(item, { status: plan ? 'planned' : 'heard', text: { key: 'requestBrief.count', vars: { count: asked } },
          detail: item.assumed ? { key: 'requestBrief.countAssumed' } : plan ? { key: 'requestBrief.countBatches' } : null }));
      }
      continue;
    }
    if (item.kind === 'scope') {
      const files = plan && plan.files ? Object.entries(plan.files) : [];
      const scopeGap = gapFor(plan, 'scope').length > 0;
      const partial = (plan && plan.partialFiles) || [];
      lines.push(line(item, {
        // Image pages the reader couldn't transcribe with confidence: said
        // once, here, rather than left for her to notice a slide is missing.
        note: partial.length ? { key: 'requestBrief.partialFiles', vars: { files: partial.map(fileName).join(', ') } } : null,
        status: scopeGap ? 'gap' : plan ? 'planned' : 'heard',
        text: item.label ? null : { key: 'requestBrief.allMaterial' },
        detail: scopeGap ? { key: 'requestBrief.gapScope' }
          : files.length > 1 ? { key: 'requestBrief.perFile', vars: { list: files.map(([f, n]) => `${fileName(f)} ${n}`).join(' · ') } }
          : files.length === 1 ? { key: 'requestBrief.oneFile', vars: { file: fileName(files[0][0]), chapters: plan.chapters || 0 } }
          : null,
      }));
      continue;
    }
    if (item.kind === 'focus') {
      const gaps = gapFor(plan, item.id);
      const none = gaps.find(g => g.kind === 'none');
      if (none) {
        lines.push(line(item, { status: 'gap', text: null, detail: { key: 'requestBrief.gapNone' } }));
        continue;
      }
      const planned = plan && plan.focus ? plan.focus[item.id] : null;
      const { checked, met } = verification(questions, item.id, { servesOnly: true });
      const missingFile = gaps.find(g => g.kind === 'file');
      lines.push(line(item, {
        status: checked ? 'checked' : planned != null ? 'planned' : 'heard',
        text: null,
        detail: missingFile ? { key: 'requestBrief.gapFile', vars: { file: fileName(missingFile.file), count: planned || 0 } }
          : checked && planned != null ? { key: 'requestBrief.focusChecked', vars: { count: planned, met, checked } }
          : checked ? { key: 'requestBrief.checkedOf', vars: { met, count: checked } }
          : planned != null ? { key: 'requestBrief.focusPlanned', vars: { count: planned } } : null,
      }));
      continue;
    }
    if (item.kind === 'style' || item.kind === 'rule') {
      const { checked, met } = verification(questions, item.id);
      lines.push(line(item, {
        status: checked ? 'checked' : plan ? 'planned' : 'heard',
        // The keyword-read style (backend request_brief.floor) has a fixed
        // English label; it is translated here. Analyzer labels are already
        // in her language.
        text: item.id === 'style:clinical' ? { key: 'requestBrief.styleClinical' }
          : item.label ? null : { key: 'requestBrief.style' },
        detail: checked ? { key: 'requestBrief.checkedOf', vars: { met, count: checked } } : { key: 'requestBrief.willCheck' },
      }));
      continue;
    }
    if (item.kind === 'difficulty') {
      // "Hard" is a standard every question is checked against (backend
      // requirement_check HARD_ID): ticked from those results, never from
      // the setting alone. On 2026-10-11 a hard exam was ticked "Hard" while
      // its key was the longest option in 9 of 10 questions.
      const { checked, met } = item.value === 'hard' ? verification(questions, 'difficulty') : { checked: 0, met: 0 };
      lines.push(line(item, {
        status: checked ? 'checked' : item.value === 'hard' ? 'heard' : plan ? 'planned' : 'heard',
        text: { key: `requestBrief.difficulty.${item.value}` },
        detail: item.value !== 'hard' ? null
          : checked ? { key: 'requestBrief.hardChecked', vars: { met, count: checked } } : { key: 'requestBrief.willCheckHard' },
      }));
      continue;
    }
    if (item.kind === 'format') {
      lines.push(line(item, { status: plan ? 'planned' : 'heard', text: { key: 'requestBrief.formats', vars: { formats: item.value || [] } },
        detail: (item.excluded || []).includes('casestudy') ? { key: 'requestBrief.noOrdering' } : null }));
      continue;
    }
    if (item.kind === 'conditions') {
      lines.push(line(item, { status: plan ? 'planned' : 'heard', text: { key: 'requestBrief.examConditions' },
        detail: { key: 'requestBrief.examConditionsDetail' } }));
      continue;
    }
    if (item.kind === 'unsupported') {
      lines.push(line(item, { status: 'unsupported', text: null, detail: { key: 'requestBrief.unsupported' } }));
    }
  }
  return lines.sort((a, b) => LINE_ORDER.indexOf(a.kind) - LINE_ORDER.indexOf(b.kind));
}

/** True for a line the student should read as done. */
export const isDone = status => status === 'planned' || status === 'checked';

/**
 * The short tag under one question: where it came from and which of her
 * requirements it was planned for. A focus is named only when the checker
 * judged this question and it met it.
 */
export function questionTag(question, brief) {
  const request = question && question.request;
  if (!request) return null;
  const labels = {};
  for (const item of (brief && brief.items) || []) {
    if (item && item.id && item.label) labels[item.id] = item.label;
  }
  const focus = (request.serves || []).filter(id => request.verified && request.verified[id] === true && labels[id])
    .map(id => labels[id]);
  const parts = [...focus];
  if (request.chapter) parts.push(request.chapter);
  return parts.length ? parts.join(' · ') : null;
}
