/**
 * The homepage's "keep practicing" set: the harder formats, with the real
 * walkthroughs.
 *
 * WHY THE WALKTHROUGHS ARE STORED HERE
 *
 * In the app they are written on demand (NQBackEnd2/services/order_walkthrough.py,
 * quiz_walkthrough.py), which takes 8-15 seconds on a cold instance because the
 * backend cache is per-process. A stranger will not wait that long, and every
 * anonymous visit should not cost a model call. So these were generated once
 * through those same endpoints on 2026-11-08, and passed their validators (the
 * model is handed the key and a walkthrough that contradicts it is discarded).
 * The reasoning text is unedited. landingCases.test.js re-checks the rules that
 * can be checked here: quotes are literal, verdicts match the key, ladders are
 * known.
 *
 * If a question below changes, regenerate its walkthrough. Do not hand-edit one.
 *
 * Case studies are original. The select-all is catalog question p-2.
 */

const ORDER_PROMPT = "Place the nurse's actions in order of priority.";

export const LANDING_CASES = [
  {
    id: 'warfarin-teaching',
    kind: 'sata',
    label: 'Warfarin teaching',
    quiz: {
      question: 'Which statements show appropriate warfarin teaching? Select all that apply.',
      options: [
        'Keep INR monitoring appointments',
        'Double the next dose after a missed day',
        'Discuss new supplements with the pharmacist or prescriber',
        'Keep vitamin K intake reasonably consistent',
      ],
      answer: [
        'Keep INR monitoring appointments',
        'Discuss new supplements with the pharmacist or prescriber',
        'Keep vitamin K intake reasonably consistent',
      ],
      justification: "Monitoring and interaction checks matter. Vitamin K intake should be consistent, and a missed dose is not corrected by doubling the next day's dose.",
    },
    walkthrough: {
      breakdown: [
        { role: 'problem', quote: 'warfarin teaching', meaning: 'Patient takes warfarin, so teaching must prevent dangerous bleeding.' },
        // Narrowed by hand from "appropriate warfarin teaching": it overlapped the
        // quote above, and the highlighter drops the first of two overlapping parts.
        { role: 'risk', quote: 'appropriate', meaning: 'Wrong dose or diet changes can cause bleeding or clots.' },
        { role: 'task', quote: 'Select all that apply', meaning: 'Pick every correct teaching point, not just one.' },
      ],
      key_fact: 'warfarin teaching',
      fact_meaning: 'Patient takes warfarin, so teaching must prevent dangerous bleeding.',
      test_question: 'Does this keep warfarin safe and steady, avoiding bleeding or clot risk?',
      method_line: 'One fact, one question, every option.',
      options: [
        { index: 0, verdict: true, chain: ['INR shows blood thinning level', 'Checks catch bleeding or clot risk early'], part: 1, hint: 'Ask what the INR test tells the team about bleeding risk.' },
        { index: 1, verdict: false, chain: ['Doubling after a missed dose adds warfarin', 'Extra warfarin raises bleeding risk sharply'], part: 1, hint: 'Think about what extra warfarin does to bleeding risk.' },
        { index: 2, verdict: true, chain: ["Supplements can change warfarin's effect", 'Interactions can cause bleeding or clotting'], part: 1, hint: 'Consider whether a new supplement could change how warfarin works.' },
        { index: 3, verdict: true, chain: ['Vitamin K works against warfarin', 'Steady intake keeps the dose predictable'], part: 1, hint: "Consider whether big swings in vitamin K would change warfarin's effect." },
      ],
    },
  },
  {
    id: 'hypoglycemia',
    kind: 'casestudy',
    label: 'Low blood sugar',
    quiz: {
      question: ORDER_PROMPT,
      caseStudy: {
        nursesNotes: '<p>Mr. T, 58, has type 2 diabetes. He received his morning insulin at 7:30 and ate very little breakfast. At 11:00 he is sweaty, shaky, and slow to answer, but awake and swallowing normally.</p>',
        vitalSigns: '<p>BP 128/76, HR 104, RR 18, SpO2 98% on room air</p>',
      },
      options: [
        { id: 'teach', text: 'Teach him to match his meals to his insulin' },
        { id: 'recheck', text: 'Recheck his blood glucose in 15 minutes' },
        { id: 'check', text: 'Check his blood glucose at the bedside' },
        { id: 'carbs', text: 'Give 15 g of fast-acting carbohydrate by mouth' },
      ],
      correctOrder: [{ id: 'check' }, { id: 'carbs' }, { id: 'recheck' }, { id: 'teach' }],
      justification: 'Confirm the low with a glucose reading, treat it with fast-acting carbohydrate while he can swallow safely, then recheck in 15 minutes to see if it worked. Teaching waits until he is safe and able to take it in.',
    },
    walkthrough: {
      ladder: 'maslow',
      breakdown: [
        { role: 'problem', quote: 'sweaty, shaky, and slow to answer', meaning: 'Signs of low blood sugar are present right now.' },
        { role: 'risk', quote: 'ate very little breakfast', meaning: 'His sugar may keep falling without food.' },
      ],
      first_thinking: [
        'Is he low, or is something else wrong?',
        'He is sweaty, shaky, and slow, and he took insulin with little food.',
        'That fits low blood sugar, so check his glucose first.',
      ],
      items: [
        { position: 1, rung: 0, rule: 'assess_first', label: 'Is his sugar low?', why_here: 'Checking glucose comes first: it confirms low sugar before you treat him.', nudge: '' },
        { position: 2, rung: 0, rule: 'maslow', label: 'Raises his blood sugar', why_here: 'Sugar by mouth comes next: he is awake and swallowing, so he can safely take it.', nudge: 'Do you have his number yet? Check what must come before you treat him.' },
        { position: 3, rung: 0, rule: 'sequence', label: 'Did his sugar rise?', why_here: 'The 15 minute recheck shows if the carbohydrate worked, so it needs step two first.', nudge: 'Has the sugar had time to act? What has to happen before you check again?' },
        { position: 4, rung: 4, rule: 'teach_last', label: 'Plans meals with insulin', why_here: 'Teaching waits until his sugar is safe and he is alert enough to learn.', nudge: 'Is he safe and able to learn right now? What does his body need first?' },
      ],
      method_line: 'Climb the ladder: body needs first, teaching last.',
    },
  },
  {
    id: 'anaphylaxis',
    kind: 'casestudy',
    label: 'Reaction during an infusion',
    quiz: {
      question: ORDER_PROMPT,
      caseStudy: {
        nursesNotes: '<p>Ms. R, 62, started IV ceftriaxone 10 minutes ago for pneumonia. She says her throat feels tight and she cannot catch her breath. Hives are spreading across her chest and she is wheezing. An anaphylaxis protocol is active on the unit.</p>',
        vitalSigns: '<p>BP 86/50, HR 126, RR 30, SpO2 89% on room air</p>',
      },
      options: [
        { id: 'recheck', text: 'Recheck her airway, breathing, and blood pressure' },
        { id: 'record', text: 'Record the reaction and add the allergy to her chart' },
        { id: 'epi', text: 'Give IM epinephrine per the anaphylaxis protocol' },
        { id: 'stop', text: 'Stop the ceftriaxone infusion' },
      ],
      correctOrder: [{ id: 'stop' }, { id: 'epi' }, { id: 'recheck' }, { id: 'record' }],
      justification: 'Stop the drug that is causing the reaction, then give epinephrine, the first-line treatment for anaphylaxis. Recheck to see if it worked. Charting and the allergy record matter, but they wait until she is safer.',
    },
    walkthrough: {
      ladder: 'abc',
      breakdown: [
        { role: 'problem', quote: 'She says her throat feels tight and she cannot catch her breath.', meaning: 'Airway may be closing: life threat now.' },
        { role: 'risk', quote: 'started IV ceftriaxone 10 minutes ago', meaning: 'Drug is still going in; stop it.' },
      ],
      first_thinking: [
        'Is the drug still running into her vein?',
        'Yes. She started ceftriaxone only 10 minutes ago.',
        'So stop the infusion first.',
      ],
      items: [
        { position: 1, rung: 2, rule: 'acute_first', label: 'Stops the trigger now', why_here: 'Stopping the ceftriaxone comes first: it is the new trigger and it is still running.', nudge: '' },
        { position: 2, rung: 2, rule: 'abc', label: 'Treats airway and blood pressure', why_here: 'Epinephrine comes next: her airway and blood pressure are failing right now.', nudge: 'Is the ceftriaxone still running into her vein? Deal with that first.' },
        { position: 3, rung: 2, rule: 'sequence', label: 'Did the epinephrine help?', why_here: 'Recheck comes after the epinephrine, so you see whether it worked.', nudge: 'Has the treatment had time to work? Give the epinephrine first, then check.' },
        { position: 4, rung: 5, rule: 'treat_before_record', label: 'Documents the reaction', why_here: 'Charting and the allergy come last: they record the event and can wait until she is treated.', nudge: 'Her airway and blood pressure still need care. Can the chart wait until she is safer?' },
      ],
      method_line: 'Climb the ladder: airway and circulation first, then record.',
    },
  },
];

/** Her result on one step, in the words the end screen shows. */
export const caseOutcome = (answer) => {
  if (!answer) return { done: false, line: 'Skipped' };
  if (answer.isCorrect) return { done: true, correct: true, line: 'All right' };
  const result = answer.scoreResult || {};
  if (Number.isInteger(result.correctPositions) && result.totalItems) {
    return { done: true, correct: false, line: `${result.correctPositions} of ${result.totalItems} in the right place` };
  }
  return { done: true, correct: false, line: 'Partly right' };
};
