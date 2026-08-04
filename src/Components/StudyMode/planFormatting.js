/**
 * planFormatting — shared label/type helpers for study-path nodes.
 *
 * Both the StartStudyModal preview and StudyPlanOverview render the SAME
 * node array. Without these shared helpers each view used to apply its own
 * label transform, so a single `{type:"lesson", label:"X - Review"}` node
 * showed up as "📖 X - Review" in the preview but "QUICK REVIEW · X" on the
 * study page — making the user think the plan had silently changed.
 */

/**
 * Format a node type for display via i18n. Falls back to the capitalized
 * type string if no translation exists.
 *   formatNodeType('lesson', t) → "Quick Review"
 *   formatNodeType('exam',   t) → "Mini-Test"
 */
export const formatNodeType = (type, t) => {
  return t(`study.nodeType.${type}`, type.charAt(0).toUpperCase() + type.slice(1));
};

/**
 * Strip type-suffixes from an LLM-generated node label so just the topic
 * name remains. The LLM emits labels like "Topic - Pre-Test" / "Topic - Review"
 * / "Topic - Recap" depending on the reviewFormat — we surface the type
 * separately via formatNodeType, so the topic name is enough on its own.
 *
 * Bilingual: the backend prompt instructs the LLM to translate labels into
 * the user's language (see _build_study_path_prompt in main.py), so a French
 * session emits "Topic - Pré-test" / "Topic - Révision" / etc. The pattern
 * below covers both English and French suffixes.
 */
export const getStepTopicLabel = (label) => {
  if (!label) return '';
  const suffixes = [
    new RegExp(
      '\\s*[-–]\\s*(' +
        // English
        'Quiz|Listen|Audio|Concept Map|Vocabulaire|Basics|Advanced|' +
        'Review|Pre-Test|Pre Test|Final Test|Recap|Lesson|' +
        // French — gendered/plural variants where the LLM might produce them
        'Pré-test|Pré test|Test final|' +
        'Révision|Récap|Récapitulatif|Leçon|' +
        'Écouter|Écoute|Carte mentale|Carte conceptuelle|' +
        'Bases|Avancé|Avancée|Avancés|Avancées' +
      ')\\s*$',
      'i'
    ),
  ];
  let clean = label;
  for (const re of suffixes) {
    clean = clean.replace(re, '');
  }
  return clean.trim() || label;
};

/**
 * Rough minutes a node takes. Used for the "~14 min" session estimate and the
 * per-section time on the plan page. Students schedule around minutes, so a
 * plan that never states its cost reads as open-ended — and open-ended is what
 * people postpone.
 */
const NODE_MINUTES = {
  lesson: 5,
  quiz: 4,
  flashcard: 3,
  audio: 6,
  mindmap: 5,
  review: 2,
  exam: 15,
};

export const getNodeEstimate = (type) => NODE_MINUTES[type] || 4;

/** Summed estimate for a list of nodes, in whole minutes. */
export const estimateMinutes = (nodes = []) =>
  nodes.reduce((sum, n) => sum + getNodeEstimate(n?.type), 0);
