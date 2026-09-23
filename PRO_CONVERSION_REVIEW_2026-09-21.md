# Pro conversion review — candr2, 2026-09-21

*Internal. Contains PII. Sources: prod Firestore (`docai-efb03`, Admin SDK): `users`, `chats`, `studyPerformance`, `funnelEvents`, `billingEvents`.*

`candr2@stu.mcphs.edu` · uid `uH8Wj960KXXXPC2tzxNynlUmc2z2` · MCPHS
Paid **2026-09-21 20:49:07 UTC**, **US$40.17 Semester Pass** (`sub_1UIE98JW0VHDSVXkNc9D2kjJ`, `cus_VIpoPI1rjjr9ML`).
Subscriber **#21** (excluding the owner account). **Second Semester Pass ever sold**, four days after the first.

**This is the first conversion with the paywall telemetry actually working.** Every prior
review reconstructed the decisive click from write timestamps. This one has a
`paywall_viewed` event naming the gate, 46 seconds before the charge.

---

## Answer: the upload gate — the one with no quota behind it

```
20:48:00  lastLoginDate                  (she opens the app)
20:48:21  paywall_viewed   trigger=upload_gate  reason=upload  blocked=true
          tier=free  questionsUsed=0/40  plansUsed=1/3  examDaysAway=null
          path=/c/fYRO7gLXytYQZaCuV2Dn   ← the chat she made 8 days earlier
20:48:30  intelligence_started           (retry, no files attached)
20:48:33  intelligence_failed  empty_report
20:48:36  examDebrief "date:2026-09-18" dismissed
20:48:48  checkout_started  plan=semester  reason=upload
20:49:07  PAID  $40.17
```

**21 seconds from login to wall. 27 seconds from wall to checkout. 46 seconds from wall to paid.**

The evidence pins it three ways, and all three say the same thing:

| evidence | reading |
|---|---|
| `paywall_viewed.trigger` | `upload_gate`, `blocked: true` — the event names the gate directly. No inference needed. |
| `questionsUsed` | **0 of 40.** Her 7-day window had rolled over (`windowStart` = 09-13 15:03, +8.2 days). She had a *completely untouched* question allowance at the moment she was blocked. |
| `plansUsed` | **1 of 3.** The plan quota was nowhere near her either. |

She came back the night before her exam, went to the chat that already held her
hygiene PDF, clicked attach to add her new asepsis material, and got a wall
instead of a file picker. Both metered gates were wide open. The gate that
took her money is the one that **consults no quota at all**
(`ChatInterface.js:2888` / `:4549`).

### What the modal could not tell her

`examDaysAway` logged **null**, though `onboarding.examDate` is
`2026-09-22T04:00Z` — her exam was **the next morning**. On 09-13 the same
event logged `examDaysAway: 5` correctly, twenty minutes into a session; here
it fired 21 seconds after login, before `userProfile` hydrated.

So `examSoon` was false and she got the generic branch:

> **Bring all your notes.**
> Free covers one upload per chat. Pro lets you add every lecture, slide deck
> and handout for the same exam — and practise across all of them at once.

instead of the `bodyUploadExam` variant that ends *"Your exam is tomorrow."*
She paid anyway. The other 19 students who hit this gate and did not pay did
not get that sentence either. This is bug #2 from the 08-26 review, still open,
and it is now demonstrably costing the copy its single strongest line at the
single highest-converting gate.

---

## Her eight days

**Day 1 — 2026-09-13, 15:00 to 15:27 (27 minutes), free.**

| time | event |
|---|---|
| 15:00:21 | Account created. |
| 15:00:50 | First upload: `Hygiene and Personal Care - Tagged.pdf`. |
| 15:01:16 | Course intelligence done (no web research), 3 topics, report shown. |
| 15:03:29 | Readiness check: **6 answered**, 3 topics scored. Start topic accepted unchanged. |
| 15:03:44 | Plan preview: 8 nodes, archetype `focus`, **`locked: false`**. |
| 15:03:51 | **Plan #1 started.** `planUsage` 0 → 1. |
| 15:06–15:22 | Lesson, quiz 4/5, exam **10/10**, harder drill 1/2, lesson, quiz 5/5, harder drill 1/2. |
| 15:05:28 | *(in parallel)* Second upload — `Pharmacokinetics and dynamics - Tagged.pdf` — **into a new chat**, so the upload gate never fired. |
| **15:20:37** | **Opens the paywall herself** — `trigger: badge`, `blocked: false`, 26/70 questions, 1/3 plans, exam 5 days out. |
| 15:21:17 | Dismisses it. 40 seconds of looking. |
| 15:22–15:27 | Back to the pharm chat. Readiness check, reveal, **plan preview (10 nodes, `locked: false`) at 15:24:20 — and she never presses start.** |
| 15:27 | Leaves. |

Day 1 scores (hygiene chat): **MCQ 19/21 (90%), SATA 3/4, case study 3/5.**
25/30 overall. *The product looked easy.*

The pharm chat is the interesting failure. She ran the investigation, answered
the check (**MCQ 4/10 — 40%, her real weak subject**), saw a 10-node plan with
nothing locked, and walked. Between 15:22 and 15:27 the funnel shows
`intelligence_started` **five times** and `diagnostic_started` **seven times**,
three of them with `questionCount: 0`. She was going round the
report/reveal loop repeatedly. Whatever that is, it is the last thing she did
before leaving for eight days, and the plan she abandoned was the one measuring
a 40% score.

**Day 2 — 2026-09-21, 20:48, the night before the exam.** Blocked, paid in 46
seconds, then studied for **1 hour 53 minutes** (20:56 → 22:49) on a fresh
12-node `sprint` plan, and is still in it.

Day 2 scores (asepsis chat, all post-payment):

| format | score | |
|---|---|---|
| MCQ | 28/32 | **88%** |
| matrix | 11/18 | 61% |
| case study | 4/7 | 57% |
| SATA | 7/17 | **41%** |

**Format difficulty holds for a ninth consecutive subscriber.** Her readiness
check, before the plan, was the sharpest version of it yet: **MCQ 3/3, case
study 1/1, SATA 0/3** (all three SATA scored `partial` — she had part of every
answer and the whole of none). `weakness_insight_viewed` fired with
`findingKeys: "formatGap,topic,topic"`, so the product named the format gap to
her face. That happened at 20:56:21 — **seven minutes after she had already
paid.**

---

## Cohort: what actually converts (21 subscribers, 6,742 funnel events)

### Conversion by the gate that first *blocked* a student

| first blocking gate | uids blocked | → checkout | → paid | pay rate |
|---|---|---|---|---|
| **upload_gate** | 22 | 6 | **3** | **13.6%** |
| question_throttle | 29 | 5 | 1 | **3.4%** |
| plan_ready | 3 | 1 | 1 | 33% *(n=3)* |
| badge (blocked) | 1 | 1 | 1 | *(n=1)* |

Counting every uid who ever *saw* each trigger, blocked or not: upload_gate
13.2%, account_menu 12.0%, question_throttle 8.8%, badge 6.7%.

**The upload gate converts four times better than the question throttle, and
the question throttle blocks the most people.**

### But the dominant mode is still pull, not push

**15 of 21 subscribers were never blocked by any gate.** Only 6 of 21 hit a
wall first. 149 uids have seen a paywall; 24 opened checkout (16%); 10 paid.
Of the 55 uids a gate has hard-blocked, 13 opened checkout (24%) and 6 paid (11%).

### The rest of the journey (distinct uids)

| step | uids | of uploaders | paid |
|---|---|---|---|
| upload_started | 329 | 100% | 16 |
| upload_completed | 219 | 67% | 15 |
| plan_preview_viewed | 204 | 62% | 12 |
| **plan_started** | 176 | 54% | 11 → **6.2%** |
| **readiness_check_started** | 28 | 8.5% | 5 → **17.9%** |
| weakness_insight_viewed | 18 | 5.5% | 3 → 16.7% |
| checkout_started | 24 | 7.3% | 10 → **42%** |

Plan preview → plan started is **86.8%**. The preview is not a leak, and
`locked: true` has fired exactly **15 times out of 319** — the plan wall is
barely a live gate any more.

---

## What to do, ranked by what the data supports

### 1. Move the upload gate later. It is the best gate and it fires at the worst moment.

**11 of the 22 students it blocked had `questionsUsed: 0`** — it stopped them
before they had generated a single thing. It converts at 13.6% anyway, which
says the *offer* is right and the *timing* is wrong.

The aftermath log is the clearest UX finding in the dataset. The modal is opened
and dismissed two to six times inside a minute by most people who hit it:

```
3Z6gYOVDU6Ym  00:40:57 → dismiss → view → dismiss → view → dismiss   (4 opens / 65 s)
iRMngBQevMNc  22:09:49 → dismiss → view → dismiss → view → dismiss   (4 opens / 66 s)
CVzijfNTusOD  00:09:18 → dismiss → view → dismiss → view → dismiss   (3 opens / 30 s)
C2LJbDLp18Wg  15:01:21 → dismiss → view → dismiss → view → dismiss   (4 opens / 5 min)
```

That is not deliberation. That is a student pressing the attach button, getting a
sales page, closing it, and pressing attach again. Several then do
`upload_started` minutes later — they eventually find the new-chat bypass on
their own.

Concretely: allow the **second** file in a chat free and gate the **third**, or
gate on the second *plan's* upload (the 08-26 recommendation, still unimplemented).
And give the dismissed state a next action — "start a new chat for this subject"
is what they work out anyway.

### 2. Fix `examDaysAway` hydration before touching anything else.

One-line class of fix, and it restores the strongest sentence in the copy
(`bodyUploadExam`, `bodyBlockedExam`, `bodyPlanReadyExam`) at the exact moment
students hit a wall. Our subscriber's exam was **the next morning** and the
modal could not say so. The gate fires ~20 seconds after login for returning
students, which is precisely when `userProfile` is least likely to be loaded.

### 3. The question throttle is the worst-converting gate and it was just tightened.

34 students blocked, **29 of them dismiss the modal as their very next action**,
2 opened checkout, 1 paid. `FREE_LIMIT` went 70 → 40 on 09-16, which puts *more*
students into the gate with the lowest pay rate and the highest bounce. Worth
reverting to a higher cap and letting the upload and plan gates do the selling.

### 4. Widen the readiness check. It is the strongest positive signal here.

**17.9% of the 28 students who started a readiness check are now paying**,
against 6.2% of the 176 who started a plan. Only **27 of the 126 students who
uploaded since 09-16** ever reached it (21%), because it needs course
intelligence to complete. Getting it in front of the other 79% is a bigger lever
than any new gate.

Related: our subscriber saw the format-gap finding **seven minutes after paying**.
On day 1 she saw a 40% pharm check result and left. Surfacing the SATA/case-study
gap *before* the plan, not after, is the thing that makes the free tier sell.

### 5. `paywall_cta_clicked` is wired to one surface out of five.

It only fires from `LockedPlanPreview.js:119`. 149 uids have seen a paywall; 4
have ever logged a CTA click, 28 of the 30 events are the owner account. The
step between "modal shown" and "checkout opened" — plan selection, the price
reaction — is invisible. Add it to `UpgradeModal` where the plan is picked.

### 6. Abandoned checkout is still untouched.

24 uids opened checkout, 10 paid. **14 named near-misses**, including
`1ZkD9xa9kQRlCUJytsLJLouvnnU2` who opened it three times in three minutes on
09-15 (monthly → semester → monthly) and `325zk1E8axcx` who opened it twice on
09-15, 51 minutes apart, both times off the upload gate. Same finding as
2026-08-27, unchanged since.

---

## Notes and non-findings

- **Zero typed messages, again.** All 33 messages across her three chats are
  `role: 'assistant'`. Four-plus subscribers have now paid without ever talking
  to the AI. The button/study-plan path is the revenue path.
- **Course intelligence is healthy now.** 187 of 237 lifetime
  `intelligence_failed` events are the `404 Not Found` burst of 09-10/09-11
  (183 of them). Current failures are `course_intelligence_timeout` (5 on 09-20,
  1 on 09-21) and `empty_report` (2 on 09-21, both hers, both retries with no
  files attached).
- **upload_started → upload_completed is 67% lifetime**, but 32/35 on 09-21 and
  39/62 on 09-20. One bad day stands out: **2026-09-18, 45 started / 5 completed**,
  with no matching `intelligence_failed` spike. Worth a look before treating the
  lifetime ratio as a standing leak.
- **`satisfactionSignals` is empty for her.** No rating on any of 14 completed
  nodes across two sessions.
- **Retention setup is good.** She bought ~11 hours before her exam and stayed
  in the plan for nearly two hours. `exam_2` sits `active` at 45% and six nodes
  are still locked. Nothing exists to bring her back to them.
