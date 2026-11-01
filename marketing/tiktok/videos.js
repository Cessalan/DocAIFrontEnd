/**
 * First batch of "can you answer this?" TikTok/Reels/Shorts videos.
 * Questions come from scripts/seo-topics.js (same answer keys as the site);
 * `why` is a one-line rationale short enough to read in about 4 seconds.
 *
 * Hooks are lowercase "relatable stress" lines: in DarkUGC's education
 * library (Nov 2026) that hook type ran ~2.2M median views against ~244K for
 * plain questions. Keep them first-person feelings, never invented statistics.
 */
module.exports = [
  {
    id: '01-digoxin',
    topic: 'Pharmacology',
    hook: 'pharm exam tomorrow and i still freeze on this one 😭',
    stem: 'Digoxin 0.25 mg is due. Apical pulse is 54. What do you do?',
    options: ['Give it, recheck in 1 hour', 'Hold it and notify the provider', 'Give half the dose', 'Give it with orange juice'],
    correct: 1,
    why: 'Hold digoxin when the adult apical pulse is under 60. Never adjust the dose yourself.',
    caption: 'Digoxin and a pulse of 54. Would you give it? 💊 Answer in the comments before the reveal. #nursingschool #nclex #nursingstudent #pharmacology #nclexprep',
  },
  {
    id: '02-heparin',
    topic: 'Pharmacology',
    hook: 'the antidote question i keep mixing up 💀',
    stem: 'The aPTT is way above range and the IV site is oozing. Which drug reverses heparin?',
    options: ['Vitamin K', 'Protamine sulfate', 'Naloxone', 'Flumazenil'],
    correct: 1,
    why: 'Protamine reverses heparin. Vitamin K is for warfarin.',
    caption: 'The antidote question that shows up on every pharm exam 🩸 #nclex #nursingschool #pharmacology #nursingstudent #studytok',
  },
  {
    id: '03-cdiff',
    topic: 'Infection control',
    hook: 'clinical instructor watching me reach for the hand sanitizer 👀',
    stem: 'Your patient has C. diff. How do you clean your hands after care?',
    options: ['Alcohol-based hand rub', 'Soap and water', 'Either one works', 'Gloves are enough'],
    correct: 1,
    why: 'Alcohol does not kill C. diff spores. Soap and water physically removes them.',
    caption: 'C. diff = soap and water. Every time. 🧼 #nursingschool #nclex #fundamentals #nursingstudent #infectioncontrol',
  },
  {
    id: '04-hypoxia',
    topic: 'Respiratory',
    hook: 'med-surg exam flashbacks: early sign or late sign? 😭',
    stem: 'Which is an EARLY sign of hypoxia in an adult?',
    options: ['Cyanosis', 'Restlessness', 'Bradycardia', 'Decreased LOC'],
    correct: 1,
    why: 'Restlessness, anxiety and tachycardia come first. Cyanosis is late.',
    caption: 'Cyanosis is a LATE sign. What comes first? 🫁 #nclex #nursingschool #medsurg #nursingstudent #respiratory',
  },
  {
    id: '05-priority',
    topic: 'Prioritization',
    hook: '4 call lights. 1 nurse. who do you see first? 🚨',
    stem: 'Four patients. Who do you see first?',
    options: ['Hip fracture, pain 6/10', 'Asthma, new wheezing and anxious', 'Diabetic, insulin due in 30 min', 'Wants discharge teaching'],
    correct: 1,
    why: 'Airway and breathing first. A new breathing problem beats pain and scheduled meds.',
    caption: 'Prioritization questions are just ABCs in disguise 🚨 #nclex #prioritization #nursingschool #nursingstudent #nclexprep',
  },
  {
    id: '06-epiglottitis',
    topic: 'Pediatrics',
    hook: 'the peds question that actually scared me 😳',
    stem: 'A drooling child is sitting up, leaning forward. Suspected epiglottitis. Which action do you AVOID?',
    options: ['Keep the child calm with a parent', 'Look in the throat with a tongue depressor', 'Have airway equipment ready', 'Let the child stay upright'],
    correct: 1,
    avoid: true, // the answer is the harmful action: reveal it in red with ✗, not green ✓
    why: 'A tongue depressor can trigger complete airway obstruction.',
    caption: 'Peds question that could save a life 👶 #pediatrics #nclex #nursingschool #nursingstudent #pedsnursing',
  },
  {
    id: '07-abg',
    topic: 'ABGs',
    hook: 'me pretending i understand ABGs 🫠 can you read this one?',
    stem: 'pH 7.30 · PaCO2 52 · HCO3 24. What is it?',
    options: ['Uncompensated respiratory acidosis', 'Uncompensated metabolic acidosis', 'Compensated respiratory alkalosis', 'Metabolic alkalosis'],
    correct: 0,
    why: 'Low pH + high CO2 = respiratory acidosis. HCO3 is normal, so no compensation yet.',
    caption: 'ABGs in 3 steps: pH, match, compensation 🧪 #abg #nclex #nursingschool #nursingstudent #medsurg',
  },
];
