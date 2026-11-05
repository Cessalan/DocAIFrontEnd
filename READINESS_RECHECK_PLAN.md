# Readiness re-check: plan

Written 2026-11-01 as a handoff for a new working session. "Evidence" was
measured on 2026-11-01; "Build" is a proposal not yet checked against the code
unless it says so. Students are anonymised (A, B, C…); the Clarity links open
only with the owner's Clarity login.

## The one-line version

Students re-upload the same notes to get a fresh readiness check and a plan
that matches where they are now. Give them a **"Check my readiness again"**
button on the study plan that runs a new check from the notes already
analysed, shows the change since last time, and **updates the remaining steps
of the same plan**. The first re-check per course is free; more need Pro.

---

## Evidence

### How many
- **33 students** uploaded the same file into a new chat in the 30 days to
  2026-11-01, **7 of them Pro** (owner excluded). Found by matching upload file
  names per user across `chats/{id}/uploads`.
- Earlier read (2026-10-29): 8 of 15 active Pro students re-uploaded; one
  uploaded 4 decks 10 times over 6 days.
- Pooled accuracy of active Pro students: multiple choice 71%, select-all 44%,
  case study 37%, matrix 37%.

### Why: five intents, from Clarity recordings
Jump to the times given; Clarity hides typed text.

1. **The quick check is what they want.** They redo the whole upload to get a
   new one.
   - Student A (Pro), one night: re-uploaded into 3 new chats to redo the
     check; hit "Check the rest with Pro" and paid during this session.
     [recording](https://clarity.microsoft.com/player/wjgn4x5pp6/1covgvv/n6wumn)
     at 56:00, 1:18:30, 1:35:43 (Pro wall), 1:45:48.
   - Student B (Pro): abandoned a plan at 3/6 steps, re-uploaded the same files
     4 days later, then worked 5/7 steps of the new plan.
     [recording](https://clarity.microsoft.com/player/wjgn4x5pp6/177yhxf/gioaz2)
     at 16:25 and 44:42.
2. **They skip the plan flow to get questions now.** Left the plan screen
   within 1 to 14 minutes, sometimes while the upload was still processing, and
   re-uploaded into plain chat to press "Quiz me".
   - Student C: 52 seconds on the plan screen.
     [recording](https://clarity.microsoft.com/player/wjgn4x5pp6/1va8wcf/ss15fi)
     at 11:00, 11:47, 15:11.
   - Three more students show the same pattern in the data (1, 6, 14 minutes).
3. **Onboarding sent them to generic questions.** Student D chose "NCLEX Prep",
   landed in generic NCLEX practice, waited on "Writing your next question…",
   then went back to her own notes.
   [recording 1](https://clarity.microsoft.com/player/wjgn4x5pp6/1ylpf9d/vnjs8o)
   at 16:38, 17:53, 20:17;
   [recording 2](https://clarity.microsoft.com/player/wjgn4x5pp6/1ylpf9d/19a8y53)
   at 52:43 ("Quiz me" looked stuck), 58:58.
4. **They want harder questions.** Student E finished the check and a lesson,
   then left the plan for case-study questions in chat.
   [recording](https://clarity.microsoft.com/player/wjgn4x5pp6/18dve7a/efo7kw)
   at 06:27, 16:37.
5. **They can't keep material organised.** Student B, first day: clicked
   "No files uploaded" repeatedly, renamed and deleted chats, hunted for decks.
   [recording](https://clarity.microsoft.com/player/wjgn4x5pp6/1v1aklp/qc0sm9)
   01:11 to 13:04.

Some same-minute double uploads look like an accidental double-upload bug, not
intent.

### What they actually want
"Check my readiness again, then tell me what to study **now**." Every
re-uploader redid the check carefully. Whether they want a new plan is mixed:
some worked the new plan, some only wanted questions. The old plan goes stale
after a few days of study or just before the exam, and re-uploading is the
only way to get a current one.

**Confidence:** strong signal from about 10 recordings, not proof. Asking 3 or
4 Pro re-uploaders "why did you upload the same notes again?" would confirm it.

### Why it matters beyond retention
- **Cost.** About 60 gpt-6-luna calls per completed upload (34,705 calls,
  564 completed uploads, October). A re-upload re-runs the chain: page
  analysis, course report, readiness check. A re-check only generates new
  questions.
- **Revenue.** Student A paid inside this loop. The upload gate converts best
  of the blocking gates (13.6%); the question meter worst (3.4%).
- **Retention.** Exam distance decides who returns; this gives a reason to come
  back between uploads.

---

## Decisions made

| Question | Decision | Why |
|---|---|---|
| Where it lives | On the **study plan** (course), not chat | The quick check is part of the plan flow; chat already has "Quiz me" |
| Button text | **"Check my readiness again"** | A verdict they are curious about, not homework; matches the existing "readiness check" language. Rejected: "Test me again" (chore), "Evaluate my level" (placement test), "Re-take the diagnostic" (clinical; the diagnostic screen was removed on purpose) |
| Contextual variants | Exam date known: "Am I ready for my exam?" or "Check my readiness (exam in 3 days)". After study: "See how much you've improved" | Specific beats generic |
| Under the button | "Last check: 2 of 5 on endocrine · 4 days ago" | Frames it as a comparison |
| French | "Revérifier ma préparation"; "Suis-je prête pour mon examen ?" (or "prêt·e") | Every string goes in `en` and `fr` |
| Old plan | **Update the remaining steps, never erase** | History is the evidence of improvement; `conceptLedger`, study performance and readiness numbers depend on it; erasing just automates the re-upload |
| Free vs Pro | First re-check per course free, then "Unlimited readiness checks with Pro" | Pay at the moment of proven value |

---

## The flow

1. **Tap the button.** Free and already used the free re-check on this course:
   show the Pro wall instead. No re-upload, no new course report.
2. **Short wait.** "Writing 5 new questions from your endocrine notes…"
   Questions:
   - never repeat one she has seen (`study.askedHashes` already exists);
   - aim at missed topics and weak formats (from study performance);
   - keep the same mix as the first check (single answer, select-all,
     prioritization, case study), each quoting her notes.
3. **The check.** Same screen as the first readiness check, 5 to 8 questions.
4. **The result.** Before/after, 2 to 4 findings, said once:
   - "Endocrine: 2/5 → 4/5"
   - "Adrenal disorders: now solid"
   - "Diabetes insipidus vs SIADH: still missing this one"
   - "Select-all: 1 of 3, still your weakest format"
5. **The plan updates.** "Your plan now starts with Diabetes insipidus vs
   SIADH. [Start]"
6. **Situational extras.** Exam in 2 days or less: offer Tonight's plan rounds.
   No exam date: ask for it on the result screen (it drives the countdown and
   the `exam_countdown` email).

### How the plan update works
| Part of the plan | What happens |
|---|---|
| Finished steps | Untouched, still done, same ids |
| The step in progress | Untouched |
| Upcoming steps (locked, not started) | Reordered or replaced toward what she still misses; topics now right move down or drop |
| Reserve steps (held back after the first block) | Re-ranked the same way |
| Plan already finished | Append a new block; never reopen old steps |

She sees a note at the top: "Plan updated from your new check: starts with …"

---

## Build

### Already exists (check each before relying on it)
- Readiness check UI and formats: `CourseIntelligence/CourseStudyBrief`,
  `CourseIntelligence/courseCalibrationModel.js` (`READINESS_QUESTION_CAP`,
  `CHECK_FORMATS`, `hasValidShape`).
- Question generation from her notes:
  `NQBackEnd2/services/course_question_preview.py` (`READINESS_QUESTIONS`,
  `KIND_FORMAT`, `_resolve_quote`). Today it runs **with the investigation**;
  the re-check needs it to run from saved material alone.
- Asked-question tracking: `chats/{id}.study.askedHashes`.
- Before/after maths: `StudyMode/readinessDelta.js`,
  `StudyMode/readinessProjection.js`.
- Plan structure: `study.path.nodes`, reserve (`firstBlock.js`), insertion
  (`insertRoundAfterCurrent`, used by Tonight's plan).
- Plan writes: only through `Services/StudySessionService.js`.
- Paywall and quota: `UsageService.js` / `UsageContext.js` (`requireQuota`,
  `consumeGeneration`); the modal renders from `UsageProvider`.

### New
1. **Backend endpoint** to generate a re-check from saved analysis, without
   re-running the upload pipeline or the course report. Inputs: chat id,
   asked hashes, weak topics and formats. Output: the same question shape as
   today's readiness check, so the frontend renders it unchanged.
   *Open question:* where the analysed material is stored and whether
   `course_question_preview` can be called on it directly. Start here.
2. **Free/Pro limit**: count re-checks per course (e.g. `study.rechecks`);
   enforce it server-side too (`usage_guard.py` pattern), since the client
   gate is bypassable.
3. **Result screen** comparing with the previous check (new pure module +
   test, per the `*.js` + `*.test.js` convention in CLAUDE.md).
4. **Plan update logic** as a pure module with tests: input = current nodes +
   new result; output = nodes with finished/in-progress unchanged and the rest
   re-ranked. Then apply through `StudySessionService.js`.
5. **Button + copy** on the plan (en + fr), with the last-check line.
6. **Telemetry**: `readiness_recheck_started`, `_completed`,
   `_paywall_viewed`, `plan_updated_from_recheck` in `funnelEvents` (and
   PostHog, live since 2026-11-01).

### Order and deploy
1. Confirm the backend can generate from saved material (read-only spike).
2. Backend endpoint + server-side limit. **Ship the backend first**: a frontend
   calling a new route on an old backend 404s (2026-09-11 incident in
   CLAUDE.md).
3. Plan-update module + tests, result screen, button, en/fr copy.
4. Telemetry, then frontend deploy.
5. Tell students who re-uploaded in the last 30 days about it, in-app.

### Related, smaller, separate
- After an upload, offer **"Quiz me now"** next to **"Build my study plan"**
  (intent 2).
- Onboarding "NCLEX Prep" should not pull someone uploading notes away from
  their notes (intent 3).
- Fix the same-minute double upload.
- Later: a "My courses" view listing files, last result and the button
  (intent 5).

---

## How to know it worked (4 weeks after launch)
- Same-file re-uploads fall (baseline: 33 students in 30 days).
- Re-checks per student and active days per student rise.
- Upgrades from the re-check wall beat the question meter (3.4%).
- gpt-6-luna calls per active student fall (baseline: about 60 per completed
  upload; 34,705 calls in October).

## Context for a fresh session
- Frontend: this repo, branch `studysessionflow`, remote `Cessalan`.
- Backend: NQBackEnd2, branch `Side_Updates` (the deployed branch). The
  mindmap-removal commit there is pushed but not deployed yet.
- Production data reads: see the `reference_firestore_admin_read` memory.
- Clarity has no user-id filter: find recordings by chat id in the page URL.
