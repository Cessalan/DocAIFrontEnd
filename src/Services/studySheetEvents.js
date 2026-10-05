// Pure streaming reducer, shared by the transport and its regression tests.
export function updateStudySheetMessage(message, event) {
  switch (event.status) {
    case 'study_sheet_reset':
      return { ...message, content: '', studySheet: null, error: null, isStreaming: true };
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
        topic: event.studySheet?.title || message.topic, isStreaming: false };
    case 'study_sheet_error':
      return { ...message, isStreaming: false, error: event.message };
    default:
      return message;
  }
}

export function savedStudySheetMessage(message) {
  return { id: message.id, role: 'assistant', type: 'studysheet', topic: message.topic,
    content: message.content, ...(message.studySheet ? { studySheet: message.studySheet } : {}),
    timestamp: message.timestamp || new Date() };
}
