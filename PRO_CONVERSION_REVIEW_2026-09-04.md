# Pro conversion review — Shanice Lowe, 2026-09-04

*Internal. Contains PII. Sources: prod Firestore (`docai-efb03`, Admin SDK) + Stripe live.*

`shanice34.lowe@gmail.com` · uid `eMzhZavHtBTSx50DeZVEZwrQS9j2` · Google sign-in
Paid **2026-09-04 12:43:57 UTC**, US$8.33/month (`sub_1UBwTHJW0VHDSVXkee1qeHRg`, price `price_1UALOsJW0VHDSVXkpmu5lwt0` "USD NQ").

---

## Answer: the 3-plans-per-30-days quota, on exam morning, between two decks for the same exam

Pinned three ways, the same way cyates was pinned:

| evidence | reading |
|---|---|
| `planUsage.count` | **3 of 3** — frozen at payment. `consumePlanUnit` short-circuits on `tier === 'pro'`, so the plan she created 7 min after paying was never charged. She was hard-blocked. |
| `usage.count` | **6 of 70** (8.6%). The question throttle was nowhere near her. |
| upload gate | Impossible. The deck that triggered it (`Pain and Stress F26.pptx.pdf`) went up as a **single file into a brand-new chat** (`vJ4kBACZwO9ZylAgfFoq`), so `uploadedFilesList.length > 0` was false. |

And the negative evidence is unusually strong: **she opened Stripe checkout exactly once in 104 days**, at 12:43:25, and paid 32 seconds later. Zero prior sessions, zero abandons. This is the only paywall event that ever moved her.

### The decisive 12 minutes (all UTC, 2026-09-04)

| time | event |
|---|---|
| 11:00:33 | Exam debrief for her **08-30 exam** fires on app open (5 days after). |
| 11:01:21 | She answers it — *"It went well"* — bot asks a follow-up, she drops it. `turns: 1`. |
| 11:01:53 | Uploads `Chapter 13 Fluid & Electrolytes - Canvas.pptx.pdf` into a fresh chat. |
| 11:10:55 | Starts plan → **planUsage 2 → 3 of 3**. `usage.windowStart` opens at 11:10:57. |
| 11:13:47 | Lesson done. 11:14:04 quiz generated. |
| **12:40:44** | Quiz submitted: **2/5, 40%, "weak"** (MCQ 3/5, SATA 0/1). |
| 12:41:14 | Immediately uploads a **second deck for the same exam** — `Pain and Stress F26.pptx.pdf` — into another new chat. |
| 12:42:40 | Onboarding questionnaire completed (`hardestTopics` written), prep-status step reached. |
| — | `firePlanInBackground` → `requirePlanQuota()` **false** → `reason='plans'` modal. *(PlanOnboarding.js:193)* |
| **12:43:25** | Stripe checkout opened. |
| **12:43:57** | **Paid.** 32 s later. |
| 12:44:10 | Post-redirect lands on a fresh empty chat. 12:44:22 back on the Pain chat. |
| 12:51:11 | Plan #4 created — as Pro, free. 12:52:35 first quiz on it. |

The gate fired exactly where the code comment says it should ("check early, charge late… protecting the STUDENT"). It worked: she was stopped at the last onboarding step rather than after the diagnostic, and paid inside a minute.

---

## Why she is a new archetype: the **per-deck** studier

Every prior subscriber ran roughly **one plan per exam**. Shanice runs **one plan per lecture deck**, and an exam covers four or five decks. Every upload in her history is a single file into a single new chat — 15 chats, 15 one-file uploads, no batching anywhere.

| exam date | plans she ran for it |
|---|---|
| 2026-06-22 | **5** (RAAS/hemodynamics, BP pharm, electrophysiology, MI, heart failure) |
| 2026-07-04 | 1 (antibiotics) |
| 2026-07-13 | **4**, all inside 12.5 h overnight (antivirals, antihypertensives, coagulation, blood) |
| 2026-08-30 | 1 (immune response) |
| 2026-09-02 | 1 (eyes) |
| **2026-09-04** | **2** — fluid & electrolytes, then pain & stress ← **blocked on the second** |

**Her natural rate is ~4.7 plans per exam against a cap of 3 per 30 days.** For the June exam alone she used five. She only escaped the cap for so long because it shipped 08-06, during a 37-day gap in her usage (07-13 → 08-19). Her first metered window opened 08-19 13:13 and held 08-19, 08-20, 09-04 — the fourth was structurally guaranteed to be blocked.

**The quota's unit is wrong, and that is the finding.** It meters *plans*, but the student's unit of work is an *exam*, and the one-file-per-chat UX pushes people to spend one plan unit per deck. cyates batched 6 OB files into one chat and paid 1 unit for that exam; Shanice pays 5 for the same amount of exam. Two students with identical workloads hit the wall at very different times depending only on how they happened to upload. That is arbitrary — but it is also why the cap converts so well, and it fired here at genuinely the highest-intent moment available: exam day, second deck, after a 40% quiz.

---

## She is the heaviest free user ever to convert, and among the quietest

- **104 days** signup → paid (2026-05-23 → 2026-09-04). Previous record: cyates at 22 days.
- **2 min 39 s** account creation → first completed upload. **Fastest activation on record** (Sarina was 3 min). Activation speed and conversion speed are fully decoupled — she is the proof.
- **17 study sessions** (≥3 chats since deleted), **363 questions answered at 71.6%**, **79/80 flashcards mastered**, 37 topics tracked (16 strong / 14 developing / 7 weak). Sarina paid after ~98 questions; cyates after ~94. Shanice did **363 free**.
- **148 messages across 15 chats, zero of them hers.** Verified exhaustively: `role` is the only identity field present on any message and it is `'assistant'` on all 148; no `isUser`/`sender`/`from` variant exists in the union of message fields.

**Four of ten subscribers have now paid without ever typing into chat.** The button/study-plan path is not "also a path" — it is the path.

### The one place she did type

Her only free-text input in 104 days is inside the **exam debrief**: *"It went well."* The conversational debrief (shipped 08-31) got words out of a user the chat interface never did, on its first contact with her. It also gave up immediately — one turn, every `insights` field null, no `preparedness`, no `gapTags`. It asked *"What part of the exam did you feel most solid on?"* and she left to go study.

That is worth reading as a success and a miss. The surface reaches her; the second question doesn't. She was on her way to an exam that same day — a debrief that had opened with the forward-looking half (*"you have another one today — want to start on it?"*) would have been answering the question she actually had.

---

## Standing bugs this run confirms

1. **⚠️ Still no paywall telemetry.** Fifth review, same blocker. Everything above is reconstructed from frozen counters, Firestore write timestamps and Stripe. The block itself writes nothing — `requirePlanQuota()` returns `false` before any Firestore write. One `paywall_shown { reason, remaining }` event makes this a one-line query instead of a two-hour dig.
2. **`onboarding.examDate` is stale-by-design and was wrong for her too.** Her profile said `2026-09-04`; her actual exams were 06-22, 07-04, 07-13, 08-30, 09-02, 09-04. The per-chat `examDate` tracks reality, the per-user one is whatever was last lifted from a loaded chat. Anything reading the profile field for urgency copy is unreliable — same as Patience.
3. **Her stated `reviewFormat` is "Visual Concept Maps"** — same as Danielle. Her June/July plans did include `mindmap` nodes and she completed them. Her 09-04 plans have none: the **sprint archetype** (`_apply_budget`, `main.py:3612`) collapses the tail into a single review quiz when the exam is 0-2 days out. That is defensible on its own terms, but it means the format a student asked for is dropped precisely at the moment she is most likely to pay. Worth a look, not a bug.
4. **Node `status` sticks at `active` again.** `REfjNHYu4TRiInwNTUpO/node_1` shows `status: 'active'` but has a `history` entry (2/5, 40%, 12:40:44). Second confirmed instance after Sarina's — cross-check `studyPerformance.history[].nodeId` before calling anything abandoned.

---

## ⚠️ Roster correction: there are 10 subscribers, not 7

Firestore has **11 users at `usage.tier === 'pro'`**; one is the owner account (`fatsyram@gmail.com`). Two paying subscribers were missed by the 09-01 review:

| | paid | `usage.count` | `planUsage.count` |
|---|---|---|---|
| `bbstephenson1@buffs.wtamu.edu` (`ZeEv6wXeYucg…`) | 2026-08-30 00:47 | 27 / 70 | **3 / 3** |
| `mandy2113@gmail.com` (`FBiG8k5DxpeZ…`) | 2026-08-31 05:36 | **74 / 70** | **3 / 3** |

Sarina was labelled "#7"; chronologically she is **#9**, and Shanice is **#10**. Neither of the two above has been reviewed — the counters alone say both were sitting on the plan wall at payment, and mandy was over the question limit as well, but that needs the same timeline work before it's a claim.

**With that correction, the plan quota is the dominant gate, not a minor one.** Five of ten subscribers — cyates, Danielle, Benjamin, mandy, Shanice — were at `planUsage.count == 3` exactly at checkout. **Keep the cap at 3.**

Also: `billing.proSince` is absent for Benjamin (08-30 00:47) and present for mandy (08-31 05:36), so the webhook's stamping shipped between those two payments, not on 08-27.

---

## What to do

1. **Ship `paywall_shown`.** Fifth ask. Everything else here is guesswork insurance.
2. **Decide what a plan unit means.** Either meter per exam (group plans sharing an `examDate`), or make batching decks obvious in the upload UI. Right now the cap charges a per-deck studier 4-5× what it charges a batcher for identical work.
3. **Give the debrief its second question.** It reached a user four months of chat never did, then asked a retrospective question to someone with an exam in six hours.
4. **She is the best retention setup in the roster and it is live right now.** She paid on exam morning with two decks half-finished: `REfjNHYu4TRiInwNTUpO` quiz at 40% ("weak" on fluid/electrolyte balance — ADH, hyponatremia, potassium ECG changes) and `vJ4kBACZwO9ZylAgfFoq` sitting on its first quiz. Both plans stop at 4 nodes with `reserve: 0`. She has a 104-day habit and a 5-day streak record. There is still no win-back or "welcome back" surface, and it has to live in the study panel, not chat — she will never see a message.
5. **Review Benjamin and mandy** before the next roster claim.
