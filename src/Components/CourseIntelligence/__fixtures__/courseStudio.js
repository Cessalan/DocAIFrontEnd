// Illustrative data for local visual review and regression tests only.
const topics = ['Cardiovascular medications', 'Fluid & electrolytes', 'Endocrine care', 'Clinical assessment'];
export const studioReport = {
  course_information: { courseCode: 'NURS 234', courseName: 'Pharmacology', school: 'Your nursing program',
    examDescription: 'Midterm covering cardiovascular medications, fluids and electrolytes, and endocrine care.', examDate: null },
  uploaded_material_insights: { file_count: 4, topic_count: 4, concept_count: 23,
    topics: topics.map((topic, index) => ({ topic, emphasis: 90 - index * 15, file_count: 4 - index })) },
  priority_topics: topics.map((topic, index) => ({ topic, score: 90 - index * 15, file_count: 4 - index,
    signals: { exam_relevance: index < 3 ? 95 : 40, material_emphasis: 90 - index * 15 },
    evidence: [{ text: index < 3 ? 'Named in your exam description' : 'Appears in your uploaded materials', confidence: 'verified', source: 'exam_description' }],
  })),
  exam_analysis: { exam_type: 'Pharmacology midterm', coverage: topics.slice(0, 3), formats: ['Multiple choice'], stated_emphasis: [], unstated: [] },
  study_strategy: { ordered_topics: topics, recommended_start: { topic: topics[0] }, connections: [], note: '' },
  research_ran: false, research_enabled: true, relevant_public_context: {}, elapsed_ms: 4800,
};
export const studioQuestions = { questions: [
  { topic: topics[0], concept: 'cardiac output', question: 'A patient’s heart rate increases while stroke volume stays unchanged. What happens to cardiac output?',
    options: ['It increases', 'It decreases', 'It stays unchanged', 'The relationship cannot be determined'], correctIndex: 0,
    rationale: 'Cardiac output is the volume pumped per minute: heart rate multiplied by stroke volume.' },
  { topic: topics[0], concept: 'stroke volume', question: 'Which term describes the volume of blood ejected by a ventricle with each beat?',
    options: ['Heart rate', 'Stroke volume', 'Pulse pressure', 'Cardiac output'], correctIndex: 1,
    rationale: 'Stroke volume describes the volume ejected in a single heartbeat.' },
  { topic: topics[1], concept: 'fluid balance', question: 'Which record brings together a patient’s fluid intake and output?',
    options: ['Medication list', 'Pain scale', 'Fluid balance chart', 'Allergy list'], correctIndex: 2,
    rationale: 'A fluid balance chart records intake and output together.' },
  { topic: topics[1], concept: 'electrolyte terminology', question: 'Which term refers to a low sodium concentration in the blood?',
    options: ['Hypernatremia', 'Hypokalemia', 'Hyperkalemia', 'Hyponatremia'], correctIndex: 3,
    rationale: 'Hyponatremia refers to a low blood sodium concentration.' },
  { topic: topics[2], concept: 'endocrine signaling', question: 'What do endocrine glands release into the bloodstream?',
    options: ['Hormones', 'Digestive contents', 'Red blood cells', 'Bile'], correctIndex: 0,
    rationale: 'Endocrine glands release hormones that travel through the bloodstream.' },
  { topic: topics[2], concept: 'pancreatic hormones', question: 'Which organ contains the cells that produce insulin?',
    options: ['Thyroid', 'Pancreas', 'Spleen', 'Gallbladder'], correctIndex: 1,
    rationale: 'Insulin is produced by beta cells in the pancreas.' },
] };
export const studioFiles = ['Week 4 · Cardiovascular.pdf', 'Fluid balance.pdf', 'Endocrine review.pdf', 'Course outline.pdf'];
