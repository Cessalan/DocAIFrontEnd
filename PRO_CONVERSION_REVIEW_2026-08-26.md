# Pro Conversion Review — fourth monthly subscriber

**Date:** 26 Aug 2026
**Subject:** user `egQ5oJwFxaRSqCHFhn7l77PpRv43`
**Sources:** Firebase Auth, Firestore (`users`, `chats`, `messages`, `studyPerformance`), Stripe live API, repo source.
**Contains customer PII** (name, email, study behaviour). Internal only.

**Headline:** this is the **first conversion a metered quota has ever caused.** She burned all
**3 free study plans in 36 minutes**, uploaded a 4th deck, and when the plan gate blocked her she
opened checkout **15 seconds later**. She paid at **3/3 plans and 39/50 questions** — the plan meter
hard-blocked, the question meter did not. 89 seconds after paying she created plan #4, and then
worked for another 45 minutes straight. Her exam was **the next morning**.

| Vital | Value |
|---|---|
| Signup → paid | **45 m 20 s** |
| Plan gate fired → checkout opened | **~15 s** |
| Checkout opened → paid | **1 m 35 s** |
| Plan allowance at payment | **3 of 3 — EXHAUSTED** |
| Question allowance at payment | **39 of 50** (78%, not blocked) |
| Upload gate | never fired — every deck went into a fresh chat |
| Messages typed into chat | **0** |
| Decks uploaded | **5** (4 before paying) |
| Study plans created | **5** (3 free, 2 after paying) |
| Questions answered | **~59** |
| Price | CA$8.33 / month, active |
| Continuous session | **1 h 34 m** (05:07 → 06:42) |

---

## 1. Who she is

| | |
|---|---|
| Name / email | Danielle Lewis — `danilewis0402@gmail.com` (email + password, not Google) |
| Stripe | customer `cus_V8rUISe4CqOj6z`, subscription `sub_1U8ZloJW0VHDSVXkRRc4FIlW` (livemode) |
| Stage | **Pre-Nursing / Semester 1** |
| Stated goal | Course Exam |
| Stated format preference | **Visual Concept Maps** |
| Typed into onboarding | *"test prep"* |
| Exam date | **27 Aug 2026 — the next morning** |

Brand-new account: Auth `creation_timestamp` == `last_sign_in_timestamp` == 05:07:46. Signup was
~1 a.m. Eastern. She was cramming overnight for a morning exam, and she brought her whole course
with her — five separate decks from what is clearly one Fundamentals class:

`1119 Caring Interventions 20225.pptx` · `The Nursing Process-Hill (1).pdf` ·
`Unit 1 Vital Signs .pdf` · `LEGAL-Ethical Fall 25 CANVAS.pptx` · `Unit 1 Safety.pdf`

**This is the multi-subject cohort the plan meter was designed for** — the ~11.6% that the design
note at `UsageService.js:166` predicted would be the only users the cap bites. It bit, and it
converted.

---

## 2. The 45 minutes

All times UTC, 26 Aug 2026.

| Time | Event | Plans | Questions |
|---|---|---:|---:|
| 05:07:46.8 | Signup (email/password) | — | — |
| 05:08:21.7 | Onboarding submitted, user doc written | 0/3 | 0/50 |
| 05:08:49.4 | Upload #1 — *Caring Interventions* | | |
| 05:09:46.8 | **Study plan #1** (Mobility & Hygiene) — `planUsage.windowStart` opens here | **1/3** | |
| 05:09:47 → 05:31:33 | Works it hard: 8 nodes, 3 adaptive drills, 1 re-teach lesson, 32 questions | | |
| 05:39:55.5 | Upload #2 — *The Nursing Process* | | |
| 05:40:26.4 | **Study plan #2** (Care Plan) — generates node_1, then abandons it | **2/3** | |
| 05:44:41.4 | Upload #3 — *Unit 1 Vital Signs* | | |
| 05:45:13.8 | **Study plan #3** (Vital Signs) — node_1, then abandons it | **3/3 — WALL** | |
| 05:50:39.4 | Upload #4 — *LEGAL-Ethical Fall 25* → `PlanOnboarding` card renders | | |
| ~05:51:1x | She answers Q3 → `firePlanInBackground` → **`requirePlanQuota()` returns false** | 3/3 | 39/50 |
| | *`setUpgradeReason('plans')` → UpgradeModal, "You've got more exams to prepare for."* | | |
| **05:51:31** | **Stripe Checkout opened** — `cs_live_a10yIcc…` | **3/3** | **39/50** |
| **05:53:06** | **Paid** — CA$8.33 CAD/month (**95 s in checkout**) | | |
| 05:53:12.9 | Back on `nursequizai.com`; webhook flips `usage.tier` → `pro` | | |
| **05:54:35.6** | **Study plan #4 created** (Ethics) — **89 s after paying** | | |
| 05:56:34.0 | Upload #5 — *Unit 1 Safety* | | |
| 05:56:59.6 | **Study plan #5** (Safety / PPE / Infection Control) | | |
| 05:57:05 → 06:42:01 | 45 minutes on the Safety plan: 5 nodes + 3 adaptive branches, 26 questions | | |
| 06:42:01.1 | Last write | | |
| 13:49:10 | Auth token refresh — app reopened on exam morning, no writes | | |

### The plan meter is provably what blocked her

`consumePlanUnit` short-circuits at `tier === 'pro'` (`UsageService.js:259`), so `planUsage.count`
freezes at payment. Her document reads:

```
planUsage: { count: 3, windowStart: 1787720986900 }   // 05:09:46.9 — plan #1
usage:     { tier: "pro", count: 39, windowStart: 1787720988088 }
```

`count: 3` against `FREE_PLANS_PER_WINDOW = 3` means `derivePlanQuota` returned
`remaining: 0, canCreatePlan: false` — she was hard-blocked. She then created plans #4 and #5
without the counter moving, which is only possible post-`pro`. Meanwhile `usage.count: 39` against
`FREE_LIMIT = 50` means the question throttle still had 11 items left and `canGenerate` was true.
**The plan gate fired; the question gate did not.**

### The exact code path

`PlanOnboarding.js:189` — the gate is pre-fired at Q3 (prep-select), before generation, so a blocked
user never burns a path:

```js
if (!requirePlanQuota()) return;
```

`requirePlanQuota` (`UsageContext.js:141`) sets `reason: 'plans'` and opens the modal. Because
`plansRemaining <= 0`, `UpgradeModal.js:182` set `blocked = true` and rendered the plan-gate
headline **"You've got more exams to prepare for."** — the copy variant shipped in `9c70961`.

**This is the first time that variant has been shown to a user who then paid.** It was written for
exactly this person and it worked on its first live firing.

*(Unverified: whether the modal also showed exam-countdown urgency. `onboarding.examDate` is on her
profile now, but it is lifted from a chat only when an existing chat is **loaded**
(`ChatInterface.js:889-897`), and we cannot date that write from a single snapshot.)*

---

## 3. Why she was willing to pay: the free tier proved she was going to fail

She answered ~59 questions. Split by format:

| Format | Correct / total | |
|---|---:|---|
| **MCQ** | **33 / 33** | **100%** |
| SATA | 5 / 15 | 33% |
| Case study | 3 / 10 | 30% |
| Prioritization (drag-order) | 1 / 3 | 33% |

A perfect MCQ score and a 1-in-3 rate on everything else. The plain multiple-choice questions told
her she knew the material; the SATA, case studies, and priority-ordering told her she did not — the
night before the exam. That gap **is** the product demo, and it is the same evidence that sold
Patricia (subscriber #2).

It also lands on the standing complaint from the last review: study-plan *quizzes* are hardcoded
`question_types=["mcq"]` (`NQBackEnd2/main.py:4484`). She only met the hard formats because the
**adaptive exam branches** ignore that hardcoding — `adaptive-*` nodes carry their own `examConfig`
with `questionTypes: ["sata"]` / `["casestudy"]`. The adaptive layer is doing the selling; the
primary quiz path is not.

Her weak concepts, verbatim from `studyPerformance`: Hendrich II fall-risk prioritization, SBAR-R
sequencing, side-rail levels, RACE fire safety, standard precautions, body mechanics, dangling.

---

## 4. What did *not* convert her

- **The upload gate** (`ChatInterface.js` `openFileUploadDialog`) — it never fired. Every one of her
  five decks went into a **brand-new chat**, so `uploadedFilesListRef.current.length` was always 0
  at attach time. The gate that drove subscribers #2 and #3 was structurally invisible to a user who
  works this way. The "just open a new chat" bypass is not theoretical; she used it four times
  without ever knowing it was a bypass.
- **The question throttle** — 39/50, never blocked. Still 0 for 4 on conversions.
- **Chat.** Zero user-typed messages across six chats. She is a pure button-driven user, like
  Patricia. Two of our four subscribers have never typed a word into the chat box.
- **Concept maps.** She asked for *"Visual Concept Maps"* in onboarding and never received one —
  she was routed into quizzes and exams end to end. See the open concept-map routing gap.

---

## 5. Scoreboard, four subscribers

| | Jessica (08-13) | Patricia (08-20) | Hailey (08-24) | **Danielle (08-26)** |
|---|---|---|---|---|
| Signup → paid | 46 min | 9 h 37 m | 1 m 43 s | **45 m 20 s** |
| Decisive gate | opened modal herself | **upload** | **upload** | **plan quota (3/3)** |
| Questions at payment | 10/50 | 40/50 | 0/50 | **39/50** |
| Plans at payment | 0 | 1/3 | 0/3 | **3/3** |
| Typed messages | yes | 0 | 0 | **0** |
| Engagement at payment | — | 9 h | 15 min lifetime | **44 min, still going** |

**Two gates now convert: the upload gate (2) and the plan quota (1).** The question throttle has
converted nobody in four tries — a rolling 3-hour window refills faster than students burn it, and
Danielle is the closest anyone has come (39/50) while still not being stopped by it.

**Danielle is our best-engaged subscriber by a wide margin.** Hailey paid in 103 seconds and had a
15-minute lifetime. Danielle paid at 45 minutes after 32 questions of real work, then did 26 more.
Speed of conversion continues to be inversely correlated with quality of customer.

---

## 6. Actions

1. **Keep the plan cap at 3.** It just paid for itself. Do not weaken it, and do not "generously"
   raise it — the design note at `UsageService.js:160-178` predicted this outcome and was right.
2. **Fix the upload-gate bypass, but understand what it costs.** Four new chats = four free uploads.
   Closing it would have gated Danielle at deck #2 (05:39, ~13 minutes earlier). That is a real
   conversion lever, but it would also have cut short the 32-question session that convinced her the
   product works. Gate on the *second plan's* upload, not the second upload.
3. **Route `reviewFormat: "Visual Concept Maps"` somewhere.** Stated format preferences are
   collected and then ignored. The concept-map button still returns a studysheet.
4. **Push SATA / case-study / prioritization earlier.** They are the only thing that has ever shown a
   student she is not ready. The primary quiz path is MCQ-only, and MCQ is where she scored 100%.
5. **Still no paywall telemetry.** Fourth review in a row reconstructing the decisive click from
   Firestore write timestamps and Stripe. The 05:51:1x gate firing is inferred from
   `planUsage.count == 3` plus the 15-second gap to `cs_live_…`, not observed. One
   `paywall_shown { reason, remaining }` event would make this a query instead of an investigation.
6. **Win-back.** She reopened the app at 13:49 (exam morning) and wrote nothing. Her plan #5 is
   still `active` with 6 reserve nodes and an `adaptive-23a10427` SATA drill sitting unfinished. We
   have no mechanism that tells her that.
