# Adaptive plan: implementation plan

Written 2026-11-01. Follows `READINESS_RECHECK_PLAN.md` and replaces its
"plan update logic" item. The re-check itself is **paused**: build this first,
then read whether same-file re-uploads (baseline 33 students in 30 days) still
happen once plans stay current.

"Verified" means checked against the code on 2026-11-01. Everything else is a
proposal.

## The one-line version

After every scored step, the plan changes **what** comes next, not just the
order, and every changed step says why in her own results:

1. **Fix the mix-up she made**: a short lesson built from the answer she chose.
2. **Change the kind of step**: an upcoming quiz becomes select-all practice
   when select-all is what fails her.
3. **Cut what she has**: an upcoming review on a topic she has proven is
   skipped; its quiz stays.
4. **Bring back what still needs work**: a 2-question check on a topic she
   finished days ago, hasn't seen since, and hadn't fully got.
5. **Re-rank the rest**: upcoming and reserve steps move toward her weakest
   topics.

It shows on the existing step-to-step screen (`PlanAdvance` +
`PlanNextSteps`) as a **proposal she confirms**: heading "Your plan can change
after this quiz", the proposed rows appearing, crossed out or moved, a reason
line only under changed rows, a total ("3 steps added from your answers, 1
removed"), and two buttons: "Update my plan" and "Keep my plan". Nothing is
written to the plan until she says yes. Preview agreed in the session of
2026-11-01; owner decided on confirmation the same day.

---

## What already exists (verified)

| Need | Where | Notes |
|---|---|---|
| Insert a step after the current one | `insertNodeAfterCurrent`, `insertRoundAfterCurrent` in `StudySessionService.js` | `buildInsertedNode` is a field whitelist: any new field must be added there or it is silently dropped |
| Per-answer performance | `updateStudyPerformance` → `users/{uid}/studyPerformance/{chatId}` | `topics` (cumulative), `formats` (per format), `concepts` (ledger, with `firstMissedAt` / `lastCorrectAt` / `lastSeenAt`) |
| Dated per-step results | `appendStudyHistory` → `history[]` | `at`, `topic`, `pct`, `missed` (question text, max 5), capped at 40 rows |
| Readiness check results per topic | `quickChecks/{checkId}` under the same doc, `QuickCheckRecord.topic_results()` in NQBackEnd2 | Already turned into `node.reviewReason` for lessons by `attach_review_evidence` |
| A personalised lesson | NQBackEnd2 `services/quick_check.py`: `load_lesson_review_reason` + `lesson_focus_instruction`, used by `/study/generate-item-stream` | Rebuilt **server-side from validated records**, never trusted from the client node. This is the base for the mix-up step |
| Post-step judgement | `nodeReadout.js` (`buildNodeReadout`, kinds `fix`/`harder`/`walkthrough`/`test`/`continue`), debrief from `/study/node-debrief` | Already builds select-all / prioritization drill node defs (`SKILL_MULTI`, `SKILL_PRIORITY`) |
| Detour cap | `MAX_DETOURS_PER_TOPIC = 1` in `nodeReadout.js` | 60% of active plans never left their first topic when inserts were unbounded (2026-10-13). **This rule binds the whole design** |
| Reserve | `study.reserve.nodes`, `extendWithReserve` in `firstBlock.js` | Moved over in planner order, never re-ranked |
| Step screen | `PlanAdvance.js`, `PlanNextSteps.js` | Has the moving highlight and tick. Rows do **not** animate position changes today |

### Gaps found

- **Her chosen option is not saved.** `StudyQuizCard` sends `selectedIndex` to
  the container, but `updateStudyPerformance` and `saveQuizProgress` don't
  store it for multiple choice. The mix-up step needs it.
- **Older questions have no `concept` label**, and those answers are skipped
  by the ledger. Mix-up steps on older content fall back to the topic.
- **No "skipped" step status exists.** Today a step is `locked`, `active` or
  `done`. 37 status checks across 12 files in `StudyMode/` assume that set.
  Cutting a step adds a fourth state.

---

## Rules (the pure module decides, the screen renders)

New module `StudyMode/planAdaptModel.js` + `planAdaptModel.test.js`, per the
CLAUDE.md convention. Input: current nodes, reserve, the step just finished
(per question: concept, format, correct, chosen option), the performance doc,
the readiness check topic results, the exam date. Output:
`{ nodes, reserve, changes: [{ kind, nodeId, reason }] }`. `reason` is
**data** (counts, dates, her choice), never a sentence. The copy lives in i18n.

Hard limits, applied in this order:

- Finished steps and the current step are never touched.
- **At most 1 added step per topic** (the existing detour cap, shared with the
  readout's "Practice more"). Adding steps must never stop the plan moving to
  the next topic.
- **Net plan length per finished step: at most +1.** A cut can pay for an add.
- Tonight's plan (`archetype: 'sprint'`) is skipped: it already adapts by
  rounds.
- No evidence → no change. A change with no reason is dropped.

| Change | Fires when | Does | Reason shown |
|---|---|---|---|
| Mix-up fix | ≥1 missed question in this step with a concept label and a saved choice; topic under the detour cap | Inserts a `lesson` right after the current step with `reviewReason.source: 'node_result'` | "You chose {her option}." Only her choice is quoted. The explanation of why it's wrong lives inside the lesson, written from her notes |
| Format switch | Format accuracy across the session ≥ `BREAKDOWN_MIN_SAMPLE` (5) answers, ≥25 points under her best format, and the step just finished confirms it | Converts the **next upcoming plain quiz** into that format (`examConfig.questionTypes`). Doesn't add a step | "{n} of {m} on select-all, {a} of {b} on single answer" |
| Cut a review | Upcoming `lesson` on a topic with readiness check all correct (≥3 answered) **and** no miss on that topic since, or topic ≥85% over ≥5 answers | Status `skipped`, `skippedReason`. The topic's quiz stays | "3 of 3 in your readiness check" |
| Topic that still needs work | Topic last seen ≥3 days ago (`history.at`) **and** it still needs work: last result under 85%, or a concept on it missed and not yet resolved in the ledger (`RESOLVE_STREAK`). Any student, exam date or not. Topics she has nailed don't come back | Appends a 2-question quiz (`num_questions: 2`) at the end of the current block, aimed at the unresolved concept when there is one | "Last practised {weekday}: {n} of {m}" |
| Re-rank | Always, after the above | Upcoming and reserve steps, grouped by topic (a lesson stays with its quiz), sorted weakest first. Untested topics keep planner order | "Moved up: {missed}" only when a topic moved ≥2 places |

The mockup's "Right on Monday, missed one today" is a **mix-up**, not a fading
topic: a fresh miss always outranks spacing.

---

## Build steps

### 1. Capture the evidence (frontend, ships alone, safe)

**Built 2026-11-01:** `firstAttemptChoices` in `StudyQuizCard` progress (saved
by `saveQuizProgress`), `missEvidence.js` + test, `misses` on history rows via
`NodeTransition`. Found on the way: the history row's existing `missed` field
is always empty for quizzes (`NodeTransition` passes `result.missedConcepts`,
but the quiz result only sets `missedQuestions`), so use `misses`, not `missed`.

- `StudyModeContainer` answer handler: pass `selectedIndex` and the option
  text through. Keep the first-attempt choice per question in
  `saveQuizProgress` (`firstAttemptChoices`) so the backend can re-grade it
  against the saved quiz message, exactly as quick checks are re-graded.
- Add `misses: [{ concept, format, chosen }]` to the `appendStudyHistory` row
  (max 5, like `missed`).
- No UI change. Ship and let data build up while the rest is written.

### 2. Mix-up lesson (backend first)

**Built 2026-11-01 (NQBackEnd2, uncommitted):** `services/node_result_focus.py`
(`confirmed_misses`, `load_node_result_reason`), hooked into
`load_lesson_review_reason`, `lesson_focus_terms`, `lesson_focus_instruction`;
`lesson_structure` gives mix-up lessons 3 pages and is used by both lesson
prompts in `main.py`; `tests/test_node_result_focus.py` (19 tests). The
contract the frontend must meet in step 4: the inserted lesson node carries
`reviewReason: { source: 'node_result', fromNodeId: <the quiz node id> }`
(add `reviewReason` to `buildInsertedNode`'s whitelist), and its `label` is
what the request sends as `node_label`. The container's lesson placeholder
expects 5 pages (`_expectedTotal: 5`); use 3 for these nodes.

- NQBackEnd2 `services/quick_check.py` → generalise `load_lesson_review_reason`:
  for `reviewReason.source == 'node_result'`, load the source quiz message and
  its saved progress, re-grade the first-attempt choices server-side, and build
  the focus from the misses it confirms. A client-written reason it can't
  confirm is dropped (same rule as today: `chats` is client-writable).
- Extend `lesson_focus_instruction` with the chosen option as data: "she chose
  X; explain from the document why it fits {other condition} and not this one;
  if the document doesn't support a contrast, say so". Short lesson (2 to 3
  pages), not the standard 5.
- Tests next to `tests/test_quick_check.py`.
- **Deploy order:** backend first. An old backend ignores the new source and
  writes a generic lesson under a label promising "the mix-up from this quiz".

### 3. The adapt module (frontend, pure)
- `planAdaptModel.js` + tests for every rule and limit above, including: never
  touches done/current, respects the topic cap shared with the readout, net
  length ≤ +1, no reason → no change, sprint archetype untouched.
- Re-ranking reuses the topic grouping in `topicJourneyModel.js` /
  `nodeTopic.js` instead of a new key.

**Built 2026-11-01:** `planAdaptModel.js` (`adaptPlan`) + 32 tests. Returns
`{ nodes, reserve, changes }` or `null`; new steps arrive fully formed
(`adaptive-mixup-<quizId>`, `adaptive-return-<topic>`, status `locked`), cut
reviews as `status: 'skipped'` with `skippedReason`, switched quizzes as
`type: 'exam'` with `examConfig` and `adaptedFrom` (a quiz node can't force a
format; see `skillDrill` in `nodeReadout.js`). Decisions made while building:
a cut review moves with its topic, so the crossed-out row stays beside the quiz
that remains; a one-place reorder is applied only alongside an explained
change, never proposed on its own; the return check isn't aimed at a concept
yet (the generator has no field for it).

Found on the way, fixed in NQBackEnd2 `load_lesson_review_reason`: the frontend
sends `node.topic || node.label` as `node_label`, but the lookup matched the
label only. Every plan lesson that carries a `topic` therefore streamed
**without** its readiness-check focus. The lookup now accepts the topic too, so
after release those lessons get the focus they were designed to have. That
changes existing lessons, not only new ones.

### 4. Apply it (StudySessionService)
- New `adaptPathAfterNode(chatId, currentNodeId, adapted)`: one `updateDoc`
  writing `path.nodes`, `reserve.nodes`, `activeNodeId`, `totalNodes` and
  `study.lastAdaptation` (`{ at, fromNodeId, changes }`), so the plan and its
  explanation can't disagree. Same shape as `insertRoundAfterCurrent`.
- Add `reviewReason`, `skippedReason`, `adaptedFrom` to the
  `buildInsertedNode` whitelist.
- `planAdaptModel` runs in `handleAdvanceNode` once the step completes, and
  its result is held in component state as a **proposal**. `PlanAdvance`
  renders it. `adaptPathAfterNode` is called only on "Update my plan"; "Keep my
  plan" advances exactly as today and records the decline in
  `study.lastAdaptation` (`declined: true`) so the same proposal isn't shown
  again after the next step.
- While the proposal is on screen, the next step's content isn't prefetched
  yet (the next step depends on her answer). Prefetch starts on her choice.
- The readout's `fix` recommendation stops inserting its own step when the
  proposal already contains one for that topic (one mechanism, not two).

**Built 2026-11-01:** `adaptPathAfterNode` / `declineAdaptation` in
`StudySessionService.js` (+ `PlanAdaptationPersistence.test.js`);
`getStudySession` returns `lastAdaptation`; `completeNodeAndAdvance` steps over
`skipped`. In the container, "Move on" after a quiz goes through
`advanceFromTransition`: `proposeAdaptation` reads the session and performance
fresh, and a proposal stops the advance on `PlanAdvance` until
`handleAcceptAdaptation` / `handleDeclineAdaptation`. A refused (stale) write
falls back to the ordinary advance. `PlanAdvance` has a basic proposal view
(heading, proposed list, the two buttons, "Plan updated" after); step 6 adds
the reasons and motion.

Not needed after all: changes to `buildInsertedNode`'s whitelist (proposed
steps are written whole, not through it), and a readout de-duplication. The
readout's "Practice more" and the proposal are two exits from the same screen:
taking the detour means the next finished quiz is an added step, which never
gets a mix-up, and the detour counts against the topic cap. So the two can't
both add a step for the same miss.

### 5. The `skipped` status
- Treat `skipped` like `done` for progress, the "next step" pick and
  completion, but render it crossed out and never count it as work she did.
  Files to check: `completeNodeAndAdvance`, `studySchedule.js`,
  `missionArc.js`, `StudyPlanOverview.js`, `TodaySessionCard.js`,
  `topicJourneyModel.js`, `PlanNextSteps.js`, plus `Admin/StudyPlanInspector`.
- **Cross-repo:** `email_campaigns.py` quotes step counts to students
  ("about N steps left"). Confirm how it counts and exclude `skipped`, the same
  class of bug as the `banner` / `section_banner` mismatch in CLAUDE.md. Add it
  to "Cross-repo contracts".
- Since she confirms every change, there's no per-row undo in v1. If she wants
  a skipped review back, the plan overview row offers "Do it anyway", which
  restores `locked`.

**Built 2026-11-03:** `isCountedStep` in `firstBlock.js` is the one rule
(real and not skipped); the overview's counts, schedule, minutes and section
completion, the container's step counts, `getStudyProgress`, `topicJourney`
and the admin Pro viewer use it. Skipped rows render crossed out in the
overview and in `PlanNextSteps`, with "Do it anyway" (`restoreSkippedStep`):
a cut review ahead of her goes back where it was; one behind her becomes the
step after the current one, because advancing only moves forward; on a
finished plan it opens at once. `planAdapt.*` strings added in en and fr.

NQBackEnd2 `email_campaigns.py`: `_real_nodes` drops skipped steps. **Found
there, fixed with it:** the module counted a step finished only when its status
was `"completed"`, but the frontend writes `"done"`, so "steps left" was always
the whole plan and `plan_unstarted` treated students halfway through a plan as
unstarted. `_is_finished` now accepts both. Nothing has been mailed yet, so no
student received a wrong number, but it would have been the first mailing.

### 6. The screen
- `PlanAdvance`: when there is a proposal, the heading "Your plan can change
  after this quiz", the total line, and "Update my plan" (primary) / "Keep my
  plan". The rows animate to the proposed order as a preview; on "Keep my
  plan" they animate back. After "Update my plan" the heading becomes "Plan
  updated" and the usual "Preparing…" line takes over.
- `PlanNextSteps`: animate row position (measure before/after, FLIP; the
  highlight already measures rows), fade in added rows, cross out then collapse
  skipped rows, reason line (`plan-next-steps__why`) only on changed rows.
  Reduced-motion: no movement, final state only.
- `StudyPlanOverview`: changed rows keep their reason until she starts them,
  and the plan header says "Updated {time} from your last {n} answers".
- en + fr strings for every heading, reason and total; dark-mode rules for the
  new classes.

### 7. Telemetry
- `funnelEvents` + PostHog: `plan_change_proposed` (`changes` by kind),
  `plan_change_accepted`, `plan_change_declined`, `skipped_step_restored`,
  `adapted_step_started`, `adapted_step_completed`, and
  the score on the step **after** a mix-up lesson on the same concept (did the
  fix work).

**Built 2026-11-03:** `planAdaptTelemetry.js` (+ test) builds the props;
`FUNNEL.PLAN_CHANGE_*`, `SKIPPED_STEP_RESTORED`, `ADAPTED_STEP_*` and
`MIXUP_FOLLOWUP_SCORED` in `FunnelService.js`, which already forwards every row
to Clarity and PostHog. Rows sit outside the upload funnel, so join on
`chatId` + `fromNodeId`, not `funnelId`. Each proposal row carries the source
quiz's first-attempt score (`fromPct`); `mixup_followup_scored` carries the
score on the first scored step after the mix-up lesson on that topic, so
"did the fix work" is `pct - fromPct` per `fromNodeId`. Added
`plan_change_failed` for an accepted change refused as stale. No row carries
her chosen option text: these go to third-party analytics. Started rows repeat
when she reopens a step, so count distinct `nodeId`. The "vs students who got
no lesson" comparison isn't an event: read `history` rows (`nodeId`, `topic`,
`correct`/`total`) after quizzes whose proposal was declined.

Found in the live test, fixed with it: select-all saves option **texts**, which
`missEvidence` couldn't read (the backend could), and quizzes begun before
release had no `firstAttemptChoices`. `firstChoices` now also reads the older
`firstAttemptAnswers[i].selection` on both sides, and option letters are
stripped from the quote.

---

## Order and deploy

**One release, the whole feature** (owner, 2026-11-01): no partial deploys.
Steps 1 to 7 are built and tested first, then shipped the same day:

1. Backend (`Side_Updates`): step 2, plus the `skipped` handling in
   `email_campaigns.py` from step 5.
2. Frontend right after: steps 1, 3 to 7.

Backend first, because a frontend that inserts a mix-up lesson on an old
backend gets a generic review under a title promising "the mix-up from this
quiz". Nothing is lost by holding step 1 back: every quiz finished after the
release has her choices saved, and those are the only quizzes the feature acts
on.

## Decisions (owner, 2026-11-01)

- **She confirms every change.** The plan proposes; nothing is written until
  "Update my plan".
- **Free and Pro both get it.** Adapting isn't gated. The steps it adds are
  generated content, so they count against the question meter like any step
  does today (`requireQuota` before generation, `consumeGeneration` after).

- **Topics come back on need, not on the exam date.** A topic returns after 3
  days only if it still needs work (under 85% last time, or a missed concept
  not yet fixed), for every student, with or without an exam date.

## How to know it worked (4 weeks)

- Same-file re-uploads fall (baseline 33 students / 30 days).
- Plans leaving their first topic: no worse than today (the detour trap guard).
- Score on the next question about a concept after its mix-up lesson, vs.
  students who got no lesson.
- Proposals accepted: over half. Under that, the proposals aren't convincing
  or the rules are wrong; read declines by change kind.
- Skipped reviews restored: under 15%; above that, the cut rule is wrong.
- Active days per plan rise.
