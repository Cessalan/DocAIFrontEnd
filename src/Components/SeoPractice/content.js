const focusedTopics = {
  'dosage-calculation-practice-questions': {
    label: 'Calculation lab',
    title: 'Turn every mistake into a repeatable setup.',
    lede: 'Dosage errors usually begin before the arithmetic. Learn to identify the ordered dose, available dose, conversion, and final unit before you calculate.',
    cards: [
      ['01 · Set up', 'Write the units first', 'Start with what is ordered and what is available. Let the units show you which values belong in the equation.'],
      ['02 · Solve', 'Calculate once, estimate once', 'Do the arithmetic, then estimate the expected size of the answer. A decimal in the wrong place should feel wrong.'],
      ['03 · Verify', 'Finish with a safety check', 'Re-read whether the order is per dose or per day and confirm that the requested unit matches your answer.']
    ]
  },
  'nursing-fundamentals-practice-questions': {
    label: 'Fundamentals focus',
    title: 'Practice the habits that make every answer safer.',
    lede: 'Fundamentals questions reward consistent safety reasoning: prevent exposure, protect the patient, and choose the action that addresses the immediate risk.',
    cards: [
      ['Safety first', 'Name the immediate risk', 'Before comparing options, identify what could harm the patient or nurse in the next few moments.'],
      ['Precautions', 'Match protection to exposure', 'Choose hand hygiene and protective equipment based on the task—not habit or convenience.'],
      ['Priority', 'Do before you document', 'When an option prevents harm and another only records it, the preventive action usually comes first.']
    ]
  },
  'pharmacology-nclex-questions': {
    label: 'Pharmacology focus',
    title: 'Move beyond memorizing medication lists.',
    lede: 'Strong pharmacology reasoning connects the drug to the risk: what to monitor, what finding changes the plan, and what teaching prevents harm.',
    cards: [
      ['Recognize', 'Pair the drug with its biggest risk', 'Build a short safety profile: therapeutic purpose, priority adverse effect, and the finding you cannot ignore.'],
      ['Assess', 'Look for evidence before acting', 'Connect symptoms, vital signs, and laboratory values to the medication before choosing the next nursing action.'],
      ['Teach', 'Make instructions usable', 'Good teaching tells the patient what to do, what to avoid, and when to contact the care team.']
    ]
  },
  'cardiac-nclex-questions': {
    label: 'Cardiac focus',
    title: 'Follow the blood flow. Then follow the risk.',
    lede: 'Cardiac questions become clearer when anatomy, perfusion, and medication safety are treated as one connected system.',
    cards: [
      ['Map it', 'Trace chamber to vessel', 'Use a consistent circulation pathway so valve and chamber questions become retrieval, not guessing.'],
      ['Notice', 'Connect findings to perfusion', 'Ask what the heart is failing to deliver and which organ or tissue is showing the consequence.'],
      ['Prioritize', 'Act on instability first', 'Separate a finding that needs routine follow-up from one that threatens circulation now.']
    ]
  },
  'pediatric-nclex-questions': {
    label: 'Pediatrics focus',
    title: 'Adjust the reasoning for age, weight, and development.',
    lede: 'Pediatric safety depends on details that adult questions may not emphasize: developmental stage, caregiver teaching, and weight-based decisions.',
    cards: [
      ['Development', 'Know what changed', 'A newly emerging skill and a lost skill are different findings. Read the scenario for direction, not only age.'],
      ['Environment', 'Remove the preventable risk', 'For infant and child safety, choose the action that makes the environment safer before adding complexity.'],
      ['Calculation', 'Convert weight before dosing', 'When an order uses kilograms, make the weight conversion explicit before applying the dose.']
    ]
  }
};

export function experienceFor(page) {
  if (page.kind === 'planner') return {
    eyebrow: 'Built around your real calendar',
    metrics: [['4 inputs', 'to shape your plan'], ['2–8 weeks', 'or use your test date'], ['Daily actions', 'not vague advice']],
    label: 'The planning method',
    title: 'A study schedule should tell you what to do next.',
    lede: 'Your plan moves from baseline practice to focused repetition and finally mixed clinical judgment. It keeps broad NCLEX coverage while giving your selected priorities more attention.',
    cards: [
      ['Phase 01', 'Find your gaps', 'Use short baseline sets to separate familiar material from concepts that need deliberate review.'],
      ['Phase 02', 'Attack weak areas', 'Return to missed concepts with rationales, select-all items, and patient scenarios.'],
      ['Phase 03', 'Bring it together', 'Mix subjects and decision types so practice feels less predictable before test day.']
    ]
  };
  if (page.kind === 'guide') return {
    eyebrow: 'Review, then retrieve',
    metrics: [['12 topics', 'across 4 sections'], ['1-minute', 'topic refreshers'], ['Instant check', 'after every review']],
    label: 'A more active study guide',
    title: 'Reading feels fluent. Recall proves what stayed.',
    lede: 'Each topic gives you a compact mental model, a common trap to avoid, and a question you can answer without your notes.',
    cards: [
      ['Learn', 'Build one useful connection', 'Focus on the relationship that helps you solve a question, not a page of disconnected facts.'],
      ['Retrieve', 'Close the note and answer', 'Testing immediately exposes the difference between recognition and recall.'],
      ['Repeat', 'Return where recall breaks', 'Use the missed concept—not the total score—to choose your next review.']
    ]
  };
  if (page.slug === 'hesi-a2-practice-test') return {
    eyebrow: 'A focused admission-prep check',
    metrics: [['12 questions', 'across your sections'], ['4 sections', 'choose what matters'], ['Instant result', 'with review priorities']],
    label: 'What this diagnostic gives you',
    title: 'A percentage is not a study strategy.',
    lede: 'Finish with section-by-section performance, the concepts you missed, and a clear first topic to revisit. Use it as a starting point alongside your school’s required HESI A2 sections.',
    cards: [
      ['Choose', 'Test the sections you need', 'Select math, anatomy and physiology, reading, or vocabulary before you begin.'],
      ['Understand', 'Read every rationale', 'See the reasoning while the choice you made is still fresh.'],
      ['Target', 'Leave with a review order', 'Your result turns missed concepts into a short, specific next-practice list.']
    ]
  };
  if (page.slug === 'hesi-practice-questions') return {
    eyebrow: 'Built for nursing-course decisions',
    metrics: [['6 questions', 'in a focused sample'], ['Clinical mix', 'across core subjects'], ['Weak-area map', 'after your last answer']],
    label: 'Closer to your actual exam',
    title: 'Practice is more useful when it matches your course.',
    lede: 'This starter checks nursing judgment across several subjects. The natural next step is to turn your professor’s slides, notes, and study guide into targeted practice.',
    cards: [
      ['Apply', 'Choose in context', 'Work through safety, medication, and pediatric decisions instead of isolated definitions.'],
      ['Explain', 'Understand the best answer', 'Use the rationale to identify the clue that should shape your decision.'],
      ['Personalize', 'Bring your own material', 'Continue in NurseQuiz with questions generated from what your course actually covers.']
    ]
  };
  const focused = focusedTopics[page.slug];
  return {
    eyebrow: 'Focused practice, useful feedback',
    metrics: [['5 minutes', 'for a first signal'], ['1 at a time', 'with rationales'], ['Personal result', 'to guide review']],
    ...focused
  };
}

export const guideNotes = {
  'a-math-1': { summary: 'When a fraction is applied after part of a task is complete, apply it to what remains—not to the original whole.', points: ['Find the unfinished fraction first.', 'Multiply the next fraction by that remainder.', 'Check that the final remainder is smaller than the earlier one.'], trap: 'Subtracting both fractions directly from one whole.' },
  'a-math-2': { summary: 'A ratio describes equal parts. Add the ratio terms to find the total number of parts before assigning the total quantity.', points: ['Add all ratio parts.', 'Divide the total by that number.', 'Multiply by the parts requested.'], trap: 'Dividing by only the larger side of the ratio.' },
  'a-math-3': { summary: 'Metric conversion is easiest when you predict whether the number should grow or shrink before moving the decimal.', points: ['Liters to milliliters multiplies by 1,000.', 'Write the conversion factor with units.', 'Estimate the scale before calculating.'], trap: 'Moving the decimal in the correct direction but by the wrong number of places.' },
  'a-math-4': { summary: 'Undo operations in reverse order while keeping both sides of the equation balanced.', points: ['Simplify or divide first.', 'Isolate the variable.', 'Substitute the answer back into the original equation.'], trap: 'Distributing correctly but forgetting to reverse the subtraction.' },
  'a-ap-1': { summary: 'The right side sends blood to the lungs; the left side sends blood to the body. Chamber questions become easier when you trace the route.', points: ['Right atrium receives systemic venous blood.', 'Right ventricle pumps into the pulmonary trunk.', 'Left ventricle pumps into the aorta.'], trap: 'Associating oxygen-poor blood with the left side because the lungs are nearby.' },
  'a-ap-2': { summary: 'Respiratory gases diffuse down their own partial-pressure gradients across the alveolar-capillary membrane.', points: ['Oxygen moves toward lower oxygen pressure.', 'Carbon dioxide follows a separate gradient.', 'Diffusion does not require an alveolar pump.'], trap: 'Using blood pressure alone to explain gas movement.' },
  'a-read-1': { summary: 'A main idea must capture the central contrast or outcome without adding a claim the passage never made.', points: ['Notice repeated ideas and outcomes.', 'Prefer the answer covering the whole passage.', 'Reject absolute words unless the text supports them.'], trap: 'Choosing a true detail that is too narrow to be the main idea.' },
  'a-read-2': { summary: 'A supported inference goes one careful step beyond the text. It should require no outside assumptions.', points: ['Name only what the evidence makes likely.', 'Avoid claims about every person or every outcome.', 'Re-read the exact detail supporting your choice.'], trap: 'Choosing a plausible story instead of the conclusion best supported by the passage.' },
  'a-vocab-1': { summary: 'Context clues often define a word indirectly through contrast, cause, or the sentence’s outcome.', points: ['Replace the word with each option.', 'Use surrounding phrases as evidence.', 'Check that tone and timing still make sense.'], trap: 'Choosing a familiar-sounding word without testing it in the sentence.' },
  'a-vocab-2': { summary: 'Medical prefixes carry reliable meaning: bi- means two, uni- means one, and location terms describe relationship.', points: ['Break the term into prefix and root.', 'Translate the prefix first.', 'Separate side-related terms from distance-related terms.'], trap: 'Confusing bilateral with proximal because both can describe body findings.' },
  'a-ap-3': { summary: 'The endocrine pancreas uses different islet cells for opposing blood-glucose hormones.', points: ['Beta cells release insulin.', 'Alpha cells release glucagon.', 'Pair the cell and hormone before recalling the effect.'], trap: 'Reversing alpha and beta cell functions.' },
  'a-ap-4': { summary: 'The autonomic nervous system balances activation and recovery through sympathetic and parasympathetic divisions.', points: ['Sympathetic supports fight-or-flight responses.', 'Parasympathetic supports many rest-and-digest functions.', 'Somatic pathways are a different division.'], trap: 'Treating every automatic body process as sympathetic.' }
};
