# The Amazing NurseQuiz Experience — Build Plan

**Status:** planned, not started. Branch: `studysessionflow`.
**Source brief:** `nursequiz-amazing-experience(1).md` + the UX-precision addendum (2026-08-27).
**Decisions locked 2026-08-27:** quota untouched · all 7 steps in one pass ·
budget from time-to-exam, order from the diagnostic, strong topics as a closing review.

Every decision below carries a **Why**. Where a decision could be wrong, it also
carries **What would falsify this** — the observation that should make us reverse it.

---

## 0. North star — the rule every screen is judged against

> **Every screen answers: "how does this help me become more prepared?"**
> Hide system mechanics whenever they can be expressed as the student's
> learning state.

Four operating principles, from the UX addendum. They are not decoration — each
one **overrides** a decision made earlier in this document, and the overrides are
marked ⟳ where they appear.

| # | Principle | What it forbids |
|---|---|---|
| P1 | The KnowledgeMap is a revelation, not a dashboard | Charts, gauges, percentage-first layouts |
| P2 | Pruning must read as **intelligence**, not less value | Silently shipping a shorter plan |
| P3 | Progress is **human before quantitative** | Leading a readout with "21% → 24%" |
| P4 | Learning language, never system language | "Node 7", "Quiz Complete", "Score: 72%" |

**Scope discipline (addendum, verbatim):** *do not expand scope until this loop
feels genuinely excellent.* The loop is
**Diagnose → Understand me → Personalize → Teach → Challenge → Correct my
misconception → Prove improvement → Remember me.** Nothing outside it ships in
this branch.

---

## 1. The one structural change

Today the study plan is generated **before the product knows anything about the
student**. `PlanOnboarding` asks 3 questions (exam date, self-reported hardest
topics, progress state), pre-fires `/study/start` on Q3, and the backend emits a
uniform 5-node unit × 3–5 topics = 15–20 nodes regardless of what the student
already knows.

Every promise in the brief — "it understands me", "this is responding to me",
"you got stronger today" — is unbackable, because there is no evidence and no
baseline to measure a delta against.

**The fix is an ordering change: diagnose → reveal → build the plan from the
evidence.** Everything else in the brief is copy, one adaptation change, and
screens that reuse logic already written.

> **Why this framing rather than "rebuild the study mode":** four of the seven
> brief steps are already shipped, and a fifth is written but unwired. Treating
> this as a rewrite would throw away the dated-schedule work, the node readout,
> and the streaming lesson fix — all of which the brief assumes. The gap is
> ordering, not capability.

### What already exists (do not rebuild)

| Brief step | State | Location |
|---|---|---|
| 1 Upload | done | NDJSON streaming pipeline |
| 2 Diagnose | **built but unwired** | `/study/diagnostic-quiz` (main.py:3741), `plan_diagnostic_quiz` (FastAPICalls.js:1212) — zero callers |
| 3 Reveal | built, wrong place | `buildReadinessSnapshot` (StudyPlanOverview.js:310) — only renders as the Phase 2 CTA, i.e. *after* a 15–20 node plan that 93.6% never finish |
| 4 Teach | done | streamed lessons / audio / flashcards |
| 5 Adapt | partial | between-node drills (nodeReadout.js); the review round re-asks the **same** question |
| 6 Prove | per-node only | NodeTransition.js; no session scale, no baseline |
| 7 Continue | done | studySchedule.js, TodaySessionCard |

---

## 2. Target flow

```
Upload
  └─ PlanOnboarding (3 Qs)                       [unchanged]
       └─ Q3 pre-fires the DIAGNOSTIC             (was: pre-fired the plan)
  └─ DiagnosticStep (5 Qs, unscored, skippable)
       └─ plan Stage A (LLM: topics + candidate units) runs in this window
  └─ KnowledgeMap                                 ← the wow screen
       └─ plan Stage B (deterministic weighting, <50ms, no LLM)
  └─ StudyPlanOverview → Day 1 → NodeTransition → … → SessionReadout
  └─ return: TodaySessionCard names the concept, not the node
```

### Decision: split plan generation into Stage A (LLM) + Stage B (pure Python)

**Why.** Inverting the order normally costs the pre-fire that makes plan
generation feel instant today. Splitting recovers it: Stage A (topic extraction
and the full candidate unit set) has no dependency on the diagnostic, so it runs
*during* the 60–90s the student spends answering. Stage B — deciding how much of
each topic to keep — is the only part that needs the results, and it is pure
arithmetic. No second LLM call, no second wait, no added cost, and it is
unit-testable in a way a prompt never is.

**What would falsify this.** If Stage A regularly takes longer than the
diagnostic, the student hits a loading screen at the worst possible moment. The
existing elapsed-aware loading screen with a 30s escape hatch is the backstop.

---

## 3. The tension in the brief, and how we resolve it

The brief says: *"Instead of asking what they want to study, NurseQuiz quickly
tests them."* Production data says that is the riskiest move in the product:
quiz-first plans complete node 1 at **66.6%** versus **89.0%** for lesson-first,
*with content successfully delivered in both cases*. Opening with a graded test
drives anxious students off.

**We keep the diagnostic anyway.** Two reasons:

1. It is the only way to earn brief steps 3, 5 and 6. Without a baseline,
   "you got stronger" is a claim we cannot substantiate.
2. Quiz-first *survivors* go deeper — 5.25 nodes average versus 3.22. The
   diagnostic selects for engagement as well as measuring knowledge.

**But it must stop reading as a test.** Five specific changes, each aimed at the
emotional cost rather than the mechanical one:

| Change | Why |
|---|---|
| Never scored, never called a quiz or test | The word sets the frame before the first question renders |
| Framed *"5 quick questions so I don't waste your time on what you already know"* | States the benefit **before** the cost. The student is paying 90 seconds; tell them what they are buying |
| "Not sure yet" as a first-class third option | Removes the guess-and-fail loop. Also better data: an honest "no idea" is a cleaner gap signal than a lucky guess |
| One-line rationale revealed immediately per question | The diagnostic teaches while it measures, so the 90 seconds is not dead time |
| Payoff screen within 10s of the last answer | Cost is paid up front; if the reward is late the trade never closes |

**What would falsify this.** Diagnostic completion below ~70%. If most students
do not finish five questions, the frame is not working and we fall back to
lesson-first with the diagnostic as an optional entry point.

---

## 4. Invariants (these break silently)

1. **The diagnostic must never charge quota.** Charging is client-side via
   `consumeGeneration`; `/study/diagnostic-quiz` has no `check_quota` call.
   Do not route the diagnostic through `StudyModeContainer`'s node path, which
   charges at both call sites (StudyModeContainer.js:484 and :638).
   *Why:* a student who burns metered questions before seeing any value is the
   worst possible first experience, and it would be invisible in testing because
   we are all Pro.
2. **The diagnostic must be skippable**, falling back to today's uniform plan.
   *Why:* it is a new drop-off point placed before any value has been delivered.
   An escape hatch converts a hard exit into a soft one.
3. **The first node of every plan is a lesson.** *Why:* 89.0% vs 66.6% node-1
   completion, measured. The diagnostic replaces the current 3-question node-0
   calibration entirely, so this costs nothing.
4. **Weighting is applied in post-processing, not in the prompt.** *Why:* the
   unit pattern is duplicated across `_build_study_path_prompt` and the inline
   prompt in `generate_study_plan` (the StartStudyModal fallback path). A prompt
   change reaches one; post-processing adjacent to `_attach_status_and_exam_nodes`
   reaches both.
5. **`completedAt` stays an ISO string**, never `serverTimestamp()` — Firestore
   rejects sentinel values inside array elements.
6. **`insertNodeAfterCurrent` writes a field whitelist.** `examConfig` and
   `num_questions` persist only because they are listed there. Adaptive drills
   silently lose their format promise otherwise.
7. **Node-size constants stay mirrored**: `STUDY_QUIZ_QUESTIONS` /
   `STUDY_FLASHCARD_CARDS` (main.py:2905) against `QUIZ_QUESTIONS` /
   `FLASHCARD_CARDS` (StudyModeContainer.js:56). They drive `_expectedTotal`, so
   drift produces a progress bar that stalls or completes early.
   `STUDY_DIAGNOSTIC_QUESTIONS` is retired by this work.

---

## 5. Backend work — `NQBackEnd/NQBackEnd2/main.py`

### B1 — Diagnostic hardening
`/study/diagnostic-quiz` (main.py:3741) already returns 5 questions, one per
topic, easy→hard, each with a `topic` tag and a rationale. Changes:
- ⚠️ **Two questions minimum on any topic whose result can skip it.** Cap at 6
  questions total: 2 each on the top 3 topics, 1 each on any remainder.
  **Why — this is the highest-risk decision in the plan.** P2 says solid topics
  get skipped entirely (B2). Skipping a whole topic off **one** question means a
  single lucky guess removes it from the path, and the student walks into the
  exam having been *told* she was strong. Being wrongly reassured is far worse
  than being made to redo something you already know: one costs three minutes,
  the other costs the exam. Two-for-two is still thin evidence, but it is the
  cheapest honest threshold — and it only costs one extra question against the
  "5 quick questions" promise.
  **Consequence for copy:** the map says *"looks solid"*, never *"you've
  mastered"*. The addendum's own wording ("5 concepts already **look** strong")
  already gets this right.
- Accept `hardestTopics` from onboarding and guarantee at least one question on
  each.
  **Why:** it converts the self-report from an assumption into a measurement.
  Students are frequently wrong about their own weak spots, and when the map
  contradicts them ("you said pharmacology, but you're solid there — it's
  fluid balance") that contradiction *is* the "it understands me" moment.
- Return a `topics` array alongside `questions`.
  **Why:** the map should render the topic names the backend used, not names the
  frontend re-derives with a fuzzy matcher. Two derivations will drift.
- No quota gate. Keep it that way (invariant 1).

### B2 — Deterministic plan weighting
⟳ **Rewritten 2026-08-27 after your note.** Two independent inputs, and keeping
them independent is the whole design:

> **Time to exam sets the BUDGET. The diagnostic sets the ORDER.**

Neither input alone is enough. The diagnostic knows what matters; only the
calendar knows how much fits.

New `_weight_path_by_diagnostic(nodes, topic_scores, unique_topics, days_to_exam)`,
called between plan generation and `_attach_status_and_exam_nodes`.

#### Step 1 — Budget from the calendar

`_plan_archetype` already exists (main.py:3336) with `SPRINT_MAX_DAYS = 2` and
`FOCUS_MAX_DAYS = 9`. Reuse it rather than inventing a second time model:

| Archetype | Days | Node budget | Reasoning |
|---|---|---|---|
| sprint | ≤2 | 6–8 | Cannot teach new material. Triage and drill only |
| focus | 3–9 | 10–14 | Shore up weak spots, one review pass |
| master | 10+ | 15–20 | Full units, everything gets covered |

**Why this replaces the flat "cap at 11 nodes" I had.** A fixed cap treats a
student with three weeks the same as one with two days, which is precisely the
mistake the current uniform plan makes — just at a different number. Pruning is
not a universal good; it is **what happens when time is short**. A student with
three weeks should get a big plan, and it is fine that she does.

#### Step 2 — Order and allocate by diagnostic

Spend the budget top-down. Gaps eat first; whatever survives funds the tail.

| Diagnostic result | Position | Unit | Nodes | Exam node? |
|---|---|---|---|---|
| gap (<40%) | **front** | lesson → quiz → audio → flashcard → quiz | 5 | yes |
| shaky (40–79%) | middle | lesson → quiz | 2 | yes |
| untested | middle | lesson → quiz | 2 | yes |
| **solid (≥80%)** | **tail** | **quick review — flashcard → quiz** | **2** | no |

- Node 0 is still the *lesson* of the biggest gap (invariant 3).
- Under a sprint budget the tail collapses to **one mixed review node** covering
  all solid topics together, rather than being dropped.
- If gaps alone exceed the budget, merge the two weakest shaky topics rather than
  truncating a gap unit. **Why:** a complete short unit beats a truncated long
  one — truncating removes the closing quiz, which is the momentum node.
- Pure function, no LLM, unit-tested. **Why:** this rule decides plan length,
  the number the whole activation thesis rests on. It should be assertable in a
  test, not re-negotiated by a model on every generation.

#### ⟳ Why strong topics move to the tail instead of being skipped

This reverses the "skip solid topics entirely" decision from earlier today. Your
version is better for four reasons, and the fourth is the one I had missed:

1. **The plan no longer shrinks dramatically.** P2 asked pruning to read as
   intelligence rather than less value; reordering delivers that without the
   plan ever looking thin. The perceived-value risk in B2 largely disappears.
2. **It kills the wrongly-reassured risk.** My biggest worry was skipping a
   topic off one lucky guess and sending a student into the exam mis-told she
   was strong. Nothing is removed now — only deferred — so a bad diagnostic
   read costs her *ordering*, not *coverage*. **The 2-of-2 evidence rule in B1
   is no longer load-bearing**, though it stays because better data is still
   better data. The "cover it anyway" affordance becomes a lighter **"move this
   up"**.
3. **It gives the plan an ending worth reaching.** Finishing on material she is
   good at means the last thing before the exam is a confidence beat. Ending on
   her weakest topic would send her in rattled.
4. **It is what the app already asks for and does not have.** `getExamPhase`
   (studySchedule.js:101) defines `final` (1–2 days) as *"consolidate, stop
   starting new material"* and `examDay` as *"review only"*. Those phases exist
   and there is **currently no material designed to be consumed in them** — the
   dated plan just keeps serving whatever node is next, including brand-new
   lessons the day before the exam. A tail of strong-topic review is exactly the
   content those phases were built to serve. This also delivers part of the
   "exam-day final review pack" that was deferred out of the dated-plan work.

**The property that makes this robust: front-load by need, back-load by
confidence.** 93.6% of plans are abandoned. Under this ordering, a student who
falls off has lost only the review of material she already knew. Graceful
degradation is worth more here than any completion-rate argument, because the
abandonment is the norm, not the exception.

**Copy consequence.** The skipped-section language changes:
- ~~"5 concepts already look strong. We won't waste your time repeating them."~~
- **"You're solid on these 5 — they move to the end as a quick refresh."**

Still honest, still shows the intelligence, and no longer promises something we
would have to take back if the diagnostic was wrong.

**One inconsistency to fix while here.** The backend calls 8–9 days `focus`
(`FOCUS_MAX_DAYS = 9`) while the frontend calls 8+ days `steady`
(studySchedule.js:105, "no urgency"). A student at 8 days gets a deadline-shaped
plan under copy telling her there is no rush. Align them — I would move the
frontend boundary to 9 to match the plan shape, since the plan is the thing that
actually changes.

**What would falsify this.** Plan *start* rate drops even with the tail present
— meaning the problem was never length. Or the tail is systematically never
reached even by finishers, which would mean the budget is still too generous and
the archetype numbers need to come down.

### B3 — `/study/plan` and `/study/start` accept `diagnostic`
New optional `diagnostic: {topic: pct}` on `StudyPlanRequest` / `StudyStartRequest`.
**Why optional:** absent (skipped diagnostic, or an old client) must reproduce
today's behaviour exactly. That makes B2/B3 shippable before any frontend work
exists, and makes the skip path free rather than a second code path to maintain.

### B4 — Misconception-targeted re-ask
`/study/generate-item` gains `variant_of` (the original question text) and
`missed_concept`, generating a **different question on the same misconception**.
**Why:** the current review round re-queues the identical question, so a student
can pass by remembering the letter they got wrong. That is memorisation of an
answer position, not of a concept — and it makes the mastery numbers optimistic,
which then corrupts the step-6 delta. The brief's step 5 ("target the
misconception → try again") is not implementable without this.
**Failure fallback:** if variant generation fails, return the original. The
review round must never block on it.

### B5 — Upward escalation
Two consecutive strong nodes on a topic → the next node becomes an `exam`
carrying its own `examConfig` with SATA / prioritization.
**Why an exam node rather than a harder quiz:** `StudyQuizCard` renders multiple
choice only, and `/study/generate-item-stream` hardcodes
`question_types=["mcq"]`. SATA and case-study render exclusively in
`StudyExamCard`. This is the same constraint the adaptive drills already work
around, so it is a known-good path rather than a new one.
**Why it matters commercially:** measured on the first paying study-mode user —
89% on MCQ, 21% on SATA, 40% on prioritization. A 7× spread. A student who
only ever sees MCQ is being told she is ready when she is not, and SATA is what
the NCLEX leans on hardest.

### B6 — Session readout
Extend `/study/node-debrief` with `scope: "session"` rather than adding an
endpoint.
**Why extend:** a second endpoint means a second prompt, and the two would drift
in voice. The existing readout already pairs copy and recommended action in one
place (`nodeReadout.js`) precisely so tone and action cannot diverge.

---

## 6. Frontend work

### F1 — `DiagnosticStep` (new, `src/Components/StudyMode/`)
Sits between `handlePlanOnboardingConfirm` (ChatInterface.js:3785) and
`StartStudyModal`. Reuses `StudyQuizCard` in a new unscored mode.
**Why reuse StudyQuizCard rather than build a clean small component:** streaming,
resume, the "I don't know" path, and progress restore are all already solved
there. A parallel implementation would be the second place question rendering
can break.
- Writes `diagnosticBaseline` onto the study doc and seeds `studyPerformance`
  with `source: 'diagnostic'`.
  **Why a separate stored baseline:** step 6 compares *now* against *then*.
  `studyPerformance` is mutated continuously, so by the time we want the delta
  the original numbers are gone. Same reasoning as `preNodeSnapshotRef` in
  NodeTransition, at session scale.
- Skip link → uniform plan (invariant 2).

### F2 — `KnowledgeMap` (new)
The wow screen. Target reaction, stated plainly so we can judge mockups against
it: ***"Holy shit. It actually understands me."***

**P1: this is a revelation, not an analytics dashboard.** No gauges, no donut
charts, no percentage-first layout. If a screenshot of it could be mistaken for
the Progress tab, it has failed. The map's job is to make the personalized plan
feel **inevitable** — by the time the CTA appears, the student should already
have concluded for herself that this is what she should study.

Fixed three-beat structure, in this order:

| Beat | Copy shape |
|---|---|
| 1. **You're strong in** | the concepts she already understands, named |
| 2. **You need to work on** | the specific weak *concepts* — not topic headings |
| 3. **Your path** | *"I built your study path around these."* |

Beat 2 is concept-level on purpose: "Cardiac Pharmacology — 40%" is a grade,
"you're mixing up preload and afterload" is being understood. Same distinction
that makes beat 1 land.

- **Opens with what they know.**
  **Why:** a screen that leads with red repeats the exact emotional mistake the
  graded diagnostic makes, at the moment we are trying to undo it. It is also
  the same zero-state error as the old journey block, which rendered a
  structurally-0% readiness score as the student's biggest number.
- Per topic: name + an evidence line ("you had ACE inhibitors, missed the beta
  blocker").
  **Why:** a coloured bar is scoring. A specific sentence about a specific
  answer is understanding. This one detail carries most of the brief's step 3.
- Reuses the `.wud--{tier}` palettes and `normalizeTopic` from
  `readinessProjection.js`.
  **Why:** two copies of the fuzzy topic matcher will silently drift, which
  shows up as a topic appearing twice in the map under near-identical names.
- Ends with *"Here's what I'd do with your 9 days"* → plan CTA.
  **Why:** the map answers "where do I stand". The student's next question is
  immediately "so what do I do". Ending on inventory rather than a
  recommendation is the mistake the dated-plan pass already corrected once.

### F3 — Plan preview states the reason, and shows what it skipped
⟳ **Expanded by P2.** Two parts, both required:

1. **The reason line**, above the path: *"3 topics you've got, 2 that need work.
   I built your path around those two."*
   **Why:** without it, a pruned plan is indistinguishable from a cheap plan.
   This sentence converts "this is shorter" into "this is targeted", and it is
   the cheapest single item in this document.
2. **The tail section** — ⟳ *was "the skipped section"; rewritten after the
   reordering decision in B2.*
   **"You're solid on these 5 — they move to the end as a quick refresh."**
   A collapsed list of the tail topics, each with a one-tap **"move this up"**
   for a student who disagrees with the diagnostic.
   **Why it is not optional:** the student cannot perceive intelligence in
   ordering she cannot see. Without this line, a plan that opens on her weakest
   topic just looks like a plan; with it, the order becomes visibly *chosen*.
   This is the only place the diagnostic's work is legible as work.
   **Why "move this up" and not "cover it anyway":** nothing is being removed
   any more, so the student is correcting a *priority*, not restoring missing
   content. Lower stakes, and it keeps the tap rate meaningful as a signal —
   see §8.

### F4 — `SessionReadout` (new)
Fires on completion of the day's mission (dated-schedule scale, not per node).

⟳ **P3 restructures this. The story is the product; metrics only corroborate it.**
Fixed three-beat shape, numbers strictly last:

```
You got stronger today.                         ← claim
You were confusing preload and afterload.       ← the misconception, named
Today you told them apart in 3 new scenarios.   ← the evidence
                                    21% → 24%   ← supporting, never leading
```

**Why the order is load-bearing.** "21% → 24%" is a fact about our scoring
system; "you stopped confusing preload and afterload" is a fact about *her*.
Only the second one is worth coming back for. Leading with the percentage also
makes the product look worse than it is — three points sounds like nothing,
while the sentence above it describes exactly the thing she was afraid of, fixed.

#### ⚠️ F4 needs a data change we do not currently have

The narrative above requires knowing **which specific misconception was
resolved**. Today `studyPerformance` stores per-topic counters plus a rolling
`missedConcepts` array (last 20) — enough to say *"you're at 68% on cardiac"*,
**not** enough to say *"you were confusing preload and afterload, and now you
aren't."* We can see what she missed; we cannot see what she has since fixed.

**Required:** a per-concept ledger on `studyPerformance`, written in
`updateStudyPerformance` (StudySessionService.js:909) alongside the existing
counters:

```js
concepts: {
  "preload vs afterload": {
    seen: 5, correct: 3,
    firstMissedAt: "2026-08-27T…",   // ISO — never serverTimestamp() (invariant 5)
    lastCorrectAt:  "2026-08-29T…",
    consecutiveCorrect: 3
  }
}
```

A concept is **resolved** when it was missed at least once and has since been
answered correctly 2+ times in a row. That is the exact claim the readout makes,
computed rather than asserted.

- `result.concept` is already passed into `updateStudyPerformance` on both the
  quiz and flashcard paths, so the write site exists — this is an additive
  schema change, not a new pipeline.
- Cap the map (~50 concepts, LRU) for the same reason `missedConcepts` is capped
  at 20: Firestore documents are not unbounded.
- **Ship this in step 1, not step 6.** It is the only item in this document whose
  value is retroactive — the ledger can only describe sessions it was present
  for, so every day it is not deployed is a day of evidence the readout will
  never be able to cite. It is ~20 lines and has no UI.

Guardrails carried over from `readinessProjection.js`, all three earned the hard way:
- smoothed accuracy prior — `(correct + 7) / (answered + 10)` — so one bad quiz
  does not project a student to zero;
- never project backwards, even when the arithmetic says so — a true but
  demoralising number is a useless nudge;
- suppress sub-1-point deltas — "21% → 21%" with an arrow reads as a bug.

### F5 — Adaptive review round
`StudyQuizCard`'s review round requests variants (B4) instead of re-queuing
originals. `firstAttemptStatuses` remains the scoring truth.
**Why keep first-attempt scoring:** the readout must answer "how did she do
before retrying", or every student scores 100% and the mastery map is worthless.

### F6 — Return copy
`TodaySessionCard` and `StudyReminderService` name the **concept** from
`missedConcepts`, not the node label.
**Why:** "continue node 7" is inventory. "You were stuck on preload vs
afterload" is memory — the brief's step 7 in one substitution.
**Caveat to keep visible:** `StudyReminderService` is localStorage +
Notification API only. It fires while the app is open, plus a catch-up on load.
It is not web push and not email, so a student who closes the tab is not
reminded. Real delivery still needs a service worker + VAPID or an email
provider, and that is not in this plan.

### F7 — Learning-language pass (new work item, from P4)
⟳ **Added by the addendum.** A copy sweep replacing system language with
learning language everywhere the student can see it.

| Never | Instead |
|---|---|
| "Continue Node 7" | "Continue: Preload vs Afterload" |
| "Quiz Complete" | "You fixed one of your weak spots." |
| "Score: 72%" | "You understand the concept, but still struggle when the situation changes." |
| "12 nodes remaining" | "Two topics left before you're covered." |

**Why this is its own item and not incidental polish.** These strings live in
`i18n.js` and are rendered from at least six components (`NodeTransition`,
`StudyQuizCard` completion, `BlockCompleteCard`, `StudyCelebration`,
`TodaySessionCard`, `StudyPlanOverview`). Done piecemeal alongside features, the
voice drifts between screens and the tutor illusion collapses at the first
screen that still says "Node 7" — one leak is enough. Done as a single pass with
the table above as the spec, it is consistent by construction.

**Both locales.** Every string is en + fr. The French must be re-written to the
same principle, not translated from the English — "Nœud 7" would be a literal
translation of a phrase we just decided is wrong.

**One of these lines is already computable.** *"You understand the concept, but
still struggle when the situation changes"* is exactly the format spread already
in `studyPerformance.formats` — 89% MCQ vs 21% SATA vs 40% prioritization on the
first paying study user. So this is not aspirational copy: it is a real
diagnosis we can already make and currently render as a bar chart in
`PerformanceBreakdown`. Gate it on `BREAKDOWN_MIN_SAMPLE` (5) so we never make
the claim off two questions.

---

## 7. Build order

1. **Concept ledger** (F4 data change) — ~20 lines, no UI. ⟳ *Pulled to the front
   from step 6.* It is the only retroactive item: every day it is not deployed is
   a day of evidence the readout can never cite.
2. **B2 + B3** — weighting, behind an absent-diagnostic no-op. Safe, testable alone.
3. **B1 + F1** — diagnostic wired, skippable.
4. **F2 + F3** — reveal, reason, skipped section.
5. **B4 + F5** — misconception re-ask.
6. **B5** — upward escalation.
7. **B6 + F4** — session readout (now has weeks of ledger data behind it).
8. **F6 + F7** — return copy and the learning-language pass.

**Why this order:** each step is independently shippable, and the sequence
front-loads the structural change everything else depends on. Steps 2–4 alone
deliver brief steps 2, 3 and 4 — the largest share of the felt difference — so
the branch can land early if it needs to.

**Why F7 is last and not first**, despite being cheap: the vocabulary is not
fully known until the features exist. "Continue: Preload vs Afterload" needs the
concept ledger; "you fixed one of your weak spots" needs the resolution rule.
Sweeping the copy first would mean sweeping it twice.

---

## 8. Measurement

| Metric | Baseline (2026-08-02) | Watch for |
|---|---|---|
| Diagnostic completion | n/a (new) | **<70% = the diagnostic is too heavy** — the primary risk metric |
| Zero-node rate | 32.5% | should fall hardest; the map is now the first payoff, not a node |
| Node-1 completion | 89.0% lesson-first / 66.6% quiz-first | invariant 3 should hold this near 89% |
| Plan completion | 6.4% | the real target; pruning is the lever |
| **"Move this up" tap rate** | n/a (new) | **>30% sustained = the diagnostic is mis-ordering the plan** (B2) |
| **Tail reached by finishers** | n/a (new) | near 0% = the node budget is still too generous |
| Pro conversion | 4 subscribers | lagging indicator — do not tune on it yet |

**The one qualitative check no metric replaces.** Every screen in §0's north
star has to answer *"how does this help me become more prepared?"*. Read each
finished screen aloud against that question before it merges. The failure mode
is not a bad number — it is a screen that is *accurate* and still describes the
system instead of the student.

**Add `createdAt` to new chats while touching this code.** The funnel query
currently has to bucket on `updatedAt`, which biases every weekly number toward
recent weeks. One field now saves re-deriving the baseline later.

---

## 9. ⚠️ Open decision: pruning changes where the question meter bites

**This surfaced after the "keep the quota as-is" decision was made, and it
partially contradicts it.** Flagging rather than assuming.

"Keep monetization untouched" is only true of the *plan* quota. The **question
meter is the primary commercial gate as of 2026-08-26** (70 units / 7 days), and
plan length is exactly what determines when it fires.

Per-node cost from `generationUnits`: quiz 5 · flashcard 5 · exam 10 ·
lesson / audio / mindmap 1 each.

Unit cost per topic after B2: gap = 17 + 10 exam = **27** · shaky = 6 + 10 exam
= **16** · solid tail review = **10** (flashcard 5 + quiz 5, no exam).

| Plan | Composition | Units |
|---|---|---|
| **Today** (uniform, no diagnostic) | 3 topics × 17 + 3 exams | **~81** |
| **master** (10+ days, 2 gap / 1 shaky / 2 solid) | 27 + 27 + 16 + 10 + 10 | **~90** |
| **focus** (3–9 days, 1 gap / 2 shaky / 2 solid) | 27 + 16 + 16 + 10 + 10 | **~79** |
| **sprint** (≤2 days, 1 gap / 1 shaky / merged tail) | 27 + 16 + 10 | **~53** |

⟳ *Revised again after the reordering decision. Strong topics went 5 units → 0
→ 10, so plans are no longer systematically cheaper than today’s — they are
**time-scaled** instead.*

**This substantially defuses §9.** The earlier worry was that pruning would push
every plan under the 70-unit wall, quietly undoing the 2026-08-26 change. With
the tail restored and the budget scaled by calendar time, master and focus plans
still cross 70 comfortably. What changed is *who* stops short of it: crammers
(≤2 days), who per the conversion data convert worst anyway and whom the
3-hour window used to target exclusively.

Two consequences:

1. **The meter’s bite now tracks time-to-exam, not ignorance.** A student with
   three weeks gets a ~90-unit plan and hits the wall inside it; a two-day
   crammer gets ~53 and does not. That is a **better** target than either the
   old uniform plan or my earlier pruned version, which metered hardest on the
   students who knew least. Students with time are the engaged ones, and they
   hit the wall having already seen the product work.
2. **Crammers stop hitting the wall.** ≤2-day plans now come in around 53
   units. Whether that matters is a judgement call: the 2026-08-26 change was
   made partly *because* the old 3-hour window "could only fire on crammers,
   who convert worst." So losing them from the metered population is closer to
   correcting an old aim than to opening a hole.

**Recommendation: leave `FREE_LIMIT` at 70 and ship.** ⟳ *I raised this as a
blocking question twice; the reordering decision has largely answered it.*
Master and focus plans still cross the wall, so the 2026-08-26 change survives
intact, and it now lands on students with time to study rather than on whoever
happens to be weakest. Nothing here needs a monetization change to work.

**Revisit only if** the share of free users hitting the question wall falls back
toward the ~13% it sat at under the old 3-hour window. That is the number that
would say the 2026-08-26 change had been undone by accident. Do **not** close a
gap by charging for the diagnostic — that violates invariant 1 for a handful of
units.

---

## 10. Deliberately not doing

- **Moving the paywall.** The 3-plan / 30-day quota stays exactly as-is.
  **Why:** this is activation work. 1 Pro user out of 1,729 means optimising the
  paywall tunes a funnel almost nobody enters. The quota also produced the first
  metered conversion (2026-08-26); changing it now would destroy the only clean
  read we have on it while we change everything upstream.
- **Teaching `StudyQuizCard` to render SATA.** Escalation rides `exam` nodes
  instead. **Why:** it is the larger job and the drill path already proves the
  workaround. Revisit if format mix becomes the bottleneck.
- **A week-by-week calendar.** **Why:** the dated schedule is derived per render
  and never persisted, so day 4's contents genuinely are not decided until day 4.
  That is what lets the plan self-heal when a student misses a day.
- **Per-topic illustrations.** **Why:** topics are LLM-generated from arbitrary
  uploads, so the topic space is unbounded and a keyword-matched image looks
  worse when it misses than no image does.
- ~~**The "already solid — skipped for you" section.**~~ ⟳ **Moved into scope by
  P2 — now F3, part 2.** It was parked here as a hedge against pruning reading as
  less value; the addendum makes it the mechanism by which pruning reads as
  intelligence instead. Not optional.
- **Anything outside the loop.** Per the addendum: *do not expand scope until
  this loop feels genuinely excellent.* Exam Pass entitlement, the exam-day
  review pack, and push/email reminder delivery all stay out of this branch even
  though each is a reasonable next thing to build.
