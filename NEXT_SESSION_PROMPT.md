# Prompt for the next session

Paste everything below the line into a new Claude Code chat opened in `C:\Users\Billion\Desktop\ragfrontend`
(with `C:\Users\Billion\Desktop\NQBackEnd\NQBackEnd2` added as a working directory).

---

You are continuing work on **NurseQuizAI** (React frontend in this repo, FastAPI backend in
`NQBackEnd2`, Firebase project `docai-efb03`). Read `CLAUDE.md` and your memory index first. This
prompt carries what the previous session learned and decided, so you don't have to re-derive it.

## 1. Who the students are (measured in production, Sept-Oct 2026)

- **They cram.** Median exam is 2 days away at signup; 79% are active on a single day; only ~17%
  come back on a second day. Judge every feature by what it delivers in the FIRST evening.
- **They want practice questions on their own material**, not lessons. Every one of the 16 payers
  since 2026-09-07 uploaded first. What separates payers from non-payers is **volume** (88-205
  questions answered), not a different skill profile.
- **The universal gap:** about 80-89% on multiple choice vs 22-42% on select-all, case-study/ordering
  and matrix questions. Non-payers show the same gap (median 86% vs 40%), so it explains the pain
  but not who pays. Pro students repeat prioritization drills without improving.
- **They pay mid-study, fast:** almost all within 30 s to 2.5 min of a paywall, usually right after a
  weak result. Paid-within-24h by paywall trigger: upload gate 9.4%, account menu 9.6%, question
  limit 7.9%, **usage badge 3.4% (most opened, worst)**. Students who reached the weak-areas screen
  later paid at 4.3% vs 2.1% for students who only started a plan.
- **Checkout leaks:** 40 opened checkout, 16 paid; **24 abandoned and nothing follows up.**
- **They come back for the next exam:** 5 of 16 payers paid 1-5 months after signup, for a new exam.
  Nothing prompts that return (the email system is built but has never sent).
- **They tell us what's on the exam:** ~25 students pasted notes into chat with flags like
  "MUST know the bone & muscle landmarks. This will be on the exam." Until this session the planner
  ignored all of it.
- Most never type into chat; the button/study-plan path is the revenue path.
- NCLEX product (`/nclex`): ~9 real users, one sitting each, zero return, **zero feedback collected**
  (no rating widget there, and the post-exam conversation doesn't read `nclexMeta/profile.examDate`).
- Latest subscriber read (2026-10-09, Kayla, `KKzpsZgiseeDieaU6Cm2ay7dHm73`): signed up 5 weeks
  earlier, returned the night before the exam, MCQ 54/61 vs select-all 2/9, matrix 0/8, hit the
  question limit right after a 10/20 exam, paid Monthly in 2 minutes.

## 2. The product thesis

Be **the app that gets a nursing student ready for tomorrow's exam from their own notes, and
visibly fixes the questions they keep missing.** It feels smart when it says something specific and
true about the student that they didn't tell it, then acts on it. Never fake intelligence: no "pass
probability", confidence labels may only go down, a wrong "I noticed you…" costs more than ten right
ones.

Five levers, in priority order:
1. **Teach the format, don't just drill it** (started: select-all walkthrough, below).
2. An "exam tonight" mode: check → 60-90 min on the worst format/topic → re-check showing movement.
3. One memory across chat, pasted notes, plans and flags, and say what it did ("Skipped ABGs, you
   got 9 of 10 yesterday").
4. Be there for the next exam: keep course history, send the countdown/win-back emails.
5. Never be wrong: answer keys audited, every explanation tied to the student's notes.

## 3. What the previous session built (UNCOMMITTED at handoff; check `git status` in both repos)

The owner is shipping these now. Verify what landed before building on top of them.

- **Clarity analytics:** every `logFunnelStep` also fires a Clarity event and tags
  (`Services/ClarityService.js`); NCLEX tags/events; study-plan tags (`plan_progress`,
  `exam_countdown`, `StudyMode/studyClarityTags.js`) and node events; Clarity snippet on the 17
  static pages in `public/`.
- **Pasted notes shape the plan** (backend `services/student_emphasis.py` + `_store.py`, wired into
  `/study/plan` and `/study/start`): instructor flags promote topics, "less X" demotes, response
  carries `student_flags` and `recommended_start.basis: "student_flag"`. **The frontend does not
  display `student_flags` yet.**
- **Paywall gap offer:** `Common/gapOfferModel.js`; quiet line in `CourseIntelligence/QuickCheckFindings.js`;
  gap version of `UpgradeModal` (counts from the readiness check, % from saved practice, ≥5 answers per
  side, matrix counts as hard); voluntary opens use prefetched practice; limit-blocked windows keep
  their own copy; paywall rows carry `gapShown`. Dev-only "GAP" pill in the dev dock (B/C buttons).
- **Calmer select-all card** (`ChatInerface/SATAQuestion.js`, `sataFeedbackModel.js`): one-sentence
  verdict naming letters, rows stay plain with icon + word (Right / Wrong pick / Missed), explanation
  folds to a lead with "Full explanation", Next becomes an outlined button on a miss.
- **"Show me how to solve it" walkthrough** for missed select-all questions:
  backend `services/quiz_walkthrough.py` + `POST /quiz/walkthrough` (model `claude-haiku-5-5`,
  effort low, structured output via `extra_body` because the repo's anthropic SDK is 0.68,
  `PROMPT_VERSION` in the cache key, currently 5). The model is HANDED the answer key and never decides
  correctness; any verdict contradicting the key discards the walkthrough; quotes must be literal
  substrings of the stem; filler steps ("Answer: yes", "fits the test") are stripped.
  Frontend `ChatInerface/MethodWalkthrough.js/.css` + `walkthroughModel.js`: break down the question
  (problem / risk / what you're asked, numbered badges in the kept question paragraph) → one test
  question → "Watch me evaluate option A" (slow, staged thinking) → "Now you try option B" → your
  turn, top to bottom. Prefetched the moment an answer is wrong (a live call takes ~7.6 s);
  auto-opens on the first 2 misses per device (`localStorage.nqWalkthroughAutoOpened`). Applies
  everywhere the shared select-all card is used (study quiz/exam steps, drills, chat, quiz room).

## 4. What to work on next (recommended order)

0. **Confirm the deploy** (backend first: the frontend calls the new `/quiz/walkthrough`). Then
   watch: walkthrough opened/completed (Clarity), `gapShown` vs badge conversion (3.4% baseline),
   student_flags firing in backend logs.
1. **Fix the Semester Pass wording** (~15 min, real risk): UpgradeModal says "One payment, covers
   your term" but the Stripe price RENEWS every 4 months (see `config/billing.js` comments). Change to
   "Renews every 4 months, cancel anytime", or build a true one-time pass (needs an expiry; Pro
   currently has no end date).
2. **"Who first?" walkthrough for prioritization** (~1.5 days): same Break down → Watch → Together →
   Your turn flow; each client labelled with what's at risk (airway, breathing, circulation, safety,
   comfort, teaching), then a priority ladder. Backend tags the deciding rule from a closed set.
   Biggest remaining learning gap (Pro drill loops).
3. **Abandoned-checkout follow-up** (~0.5 day): one reminder email via the existing email system
   (`NQBackEnd2/services/email_*`). Nothing is sent without the owner approving the copy and the
   `EMAIL_ENABLED` flag; read `/api/email/audience` first.
4. **Show plan decisions** (~0.5 day): render `student_flags` / `recommended_start.basis` on the plan
   screen ("Starting with landmarks: your notes say they're on the exam").
5. Then: feed chat-quiz answers (`practice.firstAnswers`) into the plan's diagnostic with sample sizes
   (needs `{pct, n, source}` and merging AFTER the quickCheckId overwrite in `/study/plan` and
   `/study/start`); targeted drills open with the walkthrough; move "Learn more"
   (`quiz_rationale.py`) to Haiku 5.5 after a quality check; NCLEX feedback (rating widget +
   debrief reading `nclexMeta/profile.examDate`); walkthroughs for case-study and matrix formats.

## 5. How the owner works (follow these)

- Wants **a visual preview before building** UI (an inline mockup), then builds on "go".
- Explain things **plainly and simply**; recommendations, not surveys.
- UI taste (from repeated feedback this session): one main action per moment; no competing filled
  buttons; no full-row green/red fills; numbers only where they link something; text must be easy
  to read; animations slow enough to watch; things must stand out but belong (in dark mode use the
  lavender accent with the card's own materials, not a solid slab); no em dashes in student copy;
  English AND French for every string.
- Teaching must be **watch → do together → your turn**, with the question kept visible and the
  reasoning shown step by step, top to bottom.
- Commits: short lowercase messages, **no AI co-author trailer**.

## 6. Gotchas learned the hard way

- **Restart the local backend** after any backend change; it caches walkthroughs in memory, and a
  stale backend once made a feature look broken.
- Files mix CRLF and LF line endings; scripted replacements must handle both. Heredocs containing
  emoji or `\b` break; write edit scripts to a file instead.
- Real-account testing isn't possible from the agent (dev and prod share one Firebase project). Use
  the dev pills, or an esbuild preview harness with mocked services (the pattern in
  `scripts/preview-admin-email.cjs`; set `jsx: 'automatic'`).
- The owner's account is Pro, so free-user surfaces need the dev pills to be seen.
- Production reads: use the backend venv + `service-account-key.json` (see memory
  `reference_firestore_admin_read`), write UTF-8 output files, exclude the owner uid
  `VymBNcl0KiOrv1tbPPQgjHal0SG3` from cohorts.
- Any change to a shared constant listed in CLAUDE.md "Cross-repo contracts" must change both repos.
