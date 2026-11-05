/**
 * "Daily NCLEX Question" posts: real footage + the question as plain text.
 *
 * Built from the vidIQ outlier research (2026-11-01): the nursing quiz videos
 * that broke out (e.g. a heparin-antidote question at 3.5M views) are a phone
 * shot with static native-looking text, no branding, and the answer left to
 * the comments. So: no logo, no animation, no reveal. `answer` is for the
 * pinned comment after people have guessed.
 *
 * Answer keys match scripts/seo-topics.js. `clip` is a folder under out/stock/
 * holding clip.mp4; `credit` is the Pexels attribution its license asks for.
 */
module.exports = [
  {
    id: 'daily-001-heparin',
    number: '001',
    clip: 'writing',
    credit: 'Video: ArtHouse Studio on Pexels',
    stem: 'Which medication is the antidote for heparin?',
    options: ['Vitamin K', 'Protamine sulfate', 'Naloxone', 'Flumazenil'],
    answer: 'B. Protamine sulfate reverses heparin. Vitamin K is the one for warfarin.',
    caption: '🚨 Daily NCLEX Question 001\n\nWhich medication is the antidote for heparin?\n\nComment your answer before you check the comments 👇\n\n#nclex #nursingschool #nursingstudent #pharmacology #nclexprep',
  },
  {
    id: 'daily-002-who-first',
    number: '002',
    clip: 'clipboard',
    credit: 'Video: Monstera Production on Pexels',
    stem: 'Four call lights go off. Who do you see FIRST?',
    options: ['Hip fracture, pain 6/10', 'Asthma, new wheezing + anxious', 'Diabetic, insulin due in 30 min', 'Wants discharge teaching'],
    answer: 'B. Airway and breathing first: a new breathing problem beats pain, scheduled meds and teaching.',
    caption: '🚨 Daily NCLEX Question 002\n\nFour call lights go off. Who do you see FIRST?\n\nComment A, B, C or D 👇\n\n#nclex #prioritization #nursingschool #nursingstudent #nclexprep',
  },
];
