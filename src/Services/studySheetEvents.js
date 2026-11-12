// Pure streaming reducer, shared by the transport and its regression tests.
export function updateStudySheetMessage(message, event) {
  switch (event.status) {
    case 'study_sheet_reset': {
      // The first draft is thrown away, but the reading and planning behind it
      // are not redone, so those two ticks stay.
      const { materials, plan } = message.progress || {};
      return { ...message, content: '', studySheet: null, error: null, isStreaming: true,
        restarted: true, progress: { ...(materials ? { materials } : {}), ...(plan ? { plan } : {}) } };
    }
    case 'study_sheet_step': {
      // One step of the checklist really started or ended (see
      // studySheetProgressModel.js). Facts ride along with the state.
      const { status, step, state, ...facts } = event;
      if (!step || !state) return message;
      return { ...message, progress: { ...(message.progress || {}), [step]: { state, ...facts } } };
    }
    case 'study_sheet_header':
      return { ...message, studySheet: event.studySheet, topic: event.studySheet.title };
    case 'study_sheet_section':
      if (!message.studySheet) return message;
      return { ...message, studySheet: { ...message.studySheet,
        sections: [...message.studySheet.sections.filter(s => s.id !== event.section.id), event.section] } };
    case 'study_sheet_chunk':
      return { ...message, content: message.content + (event.content || '') };
    case 'study_sheet_complete':
      return { ...message, content: event.content ?? message.content,
        studySheet: event.studySheet || message.studySheet,
        topic: event.studySheet?.title || message.topic, isStreaming: false,
        // Live only (never saved): lets the finished sheet ease in where the
        // checklist was, instead of every old sheet animating on page load.
        justFinished: true };
    case 'study_sheet_error':
      return { ...message, isStreaming: false, error: event.message };
    default:
      return message;
  }
}

export function savedStudySheetMessage(message) {
  return { id: message.id, role: 'assistant', type: 'studysheet', topic: message.topic,
    content: message.content,
    ...(message.studySheet ? { studySheet: studySheetForFirestore(message.studySheet) } : {}),
    timestamp: message.timestamp || new Date() };
}

// Firestore cannot store an array directly inside an array, and the sheet's
// table blocks are exactly that (`rows: [["Name", "Detail"], ...]`). addDoc
// threw "Nested arrays are not supported", the catch only logged it, and from
// the v2 sheet's launch until 2026-10-06 not one structured sheet was saved:
// every sheet vanished on reload. Rows are stored as `{cells: [...]}` and
// turned back into arrays by `studySheetFromFirestore` before rendering.
// The JSON round trip also drops `undefined`, which Firestore rejects too.
export function studySheetForFirestore(sheet) {
  const copy = JSON.parse(JSON.stringify(sheet));
  (copy.sections || []).forEach(section => (section.blocks || []).forEach(block => {
    if (block.kind === 'table' && Array.isArray(block.rows)) {
      block.rows = block.rows.map(row => (Array.isArray(row) ? { cells: row } : row));
    }
  }));
  return copy;
}

// Accepts either shape, so sheets still streaming (arrays) and sheets read back
// from Firestore (`{cells}`) render through the same code.
export function studySheetFromFirestore(sheet) {
  if (!sheet || !Array.isArray(sheet.sections)) return sheet;
  const needs = sheet.sections.some(s => (s.blocks || []).some(b =>
    b.kind === 'table' && Array.isArray(b.rows) && b.rows.some(r => !Array.isArray(r))));
  if (!needs) return sheet;
  return { ...sheet, sections: sheet.sections.map(section => ({ ...section,
    blocks: (section.blocks || []).map(block => (block.kind === 'table' && Array.isArray(block.rows)
      ? { ...block, rows: block.rows.map(row => (Array.isArray(row) ? row : (row?.cells || []))) }
      : block)) })) };
}
