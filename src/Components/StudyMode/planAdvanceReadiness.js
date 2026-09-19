export function hasUsableStudyContent(type, content) {
  if (!content) return false;
  if (type === 'quiz' || type === 'exam') return !!content.questions?.length;
  if (type === 'flashcard') return !!content.cards?.length;
  if (type === 'lesson') return !!content.pages?.length || !!content.body;
  // Audio and mindmap have an intentional introduction/configuration screen.
  return true;
}
