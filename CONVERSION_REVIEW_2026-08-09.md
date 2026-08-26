# Drop-off & Conversion Review — 26 Jul to 9 Aug 2026

**Scope:** every chat with `updatedAt` in the last 14 days (252 chats, 122 active users) plus their
message subcollections, joined to `users`. Tier and quota counts read across all 1,766 users.

**Headline:** engagement is healthy where it exists — 77% of every question generated gets answered —
but the study plan is roughly four times longer than anyone finishes, and **neither paywall has ever
fired**.

| Vital | Value | |
|---|---|---|
| Pro conversion | **0.1%** | 1 paying user of 1,766 |
| Users who hit a paywall | **0** | in the entire window |
| Study plans finished | **2.2%** | 3 of 135 sessions |
| Active on one day only | **77.9%** | 95 of 122 users |
| Questions answered | 3,968 | of 5,155 generated (77.0%) |

Billing is not the blocker: Stripe payment links are live in `.env`, and `services/stripe_billing.py`
handles `checkout.session.completed` → sets `usage.tier = 'pro'`. The plumbing works end to end.

---

## Finding 1 — The plan empties out by node 4 of 15

The zero-start problem is gone (100% of plans get opened, versus 32.5% zero-node previously). What
replaced it is a slide.

| Node | Still active | Step drop |
|---:|---:|---:|
| 1 | 100.0% (135) | — |
| 2 | 76.3% (103) | **−23.7%** ← biggest single step |
| 3 | 66.7% (90) | −12.6% |
| 4 | 54.8% (74) | −17.8% |
| 5 | 45.9% (62) | −16.2% |
| 6 | 37.8% (51) | −17.7% |
| 7 | 34.8% (47) | −7.8% |
| 8 | 31.9% (43) | −8.5% |
| 9 | 30.4% (41) | −4.7% |
| 10 | 25.9% (35) | −14.6% |
| 11 | 23.7% (32) | −8.6% |
| 12 | 17.0% (23) | −28.1% |
| 13 | 14.1% (19) | −17.4% |
| 14 | 13.3% (18) | −5.3% |
| 15 | 10.4% (14) | −22.2% |
| 16 | 8.9% (12) | −14.3% |

**Median plan is 15 nodes; the median student finishes 4.** About three-quarters of everything
generated is never opened.

### Plan length is the variable that decides completion

| Plan length | Sessions | Median nodes done | Finished the plan |
|---|---:|---:|---:|
| ≤ 8 nodes | 4 | 3 | **25.0%** |
| 9 – 14 | 23 | 3 | 8.7% |
| 15 – 20 (most common) | 78 | 4 | **0.0%** |
| 21+ | 30 | 9 | **0.0%** |

**Zero of the 108 plans longer than 14 nodes were ever finished.**

### Where sessions die

| Node type they stop on | Share |
|---|---:|
| study_quiz | 54.8% |
| study_lesson | 18.5% |
| study_audio | 11.1% |
| study_exam | 8.1% |
| study_flashcard | 5.9% |
| study_mindmap | 1.5% |

More than half of all sessions end on a quiz node. Whatever happens at the end of a quiz is the most
load-bearing screen in the product.

---

## Finding 2 — Depth follows returning; it does not cause it

> **Correction (9 Aug).** An earlier version of this document claimed "node 3 is where a student
> becomes a returning student," based on the first table below. That table is confounded: it measures
> the deepest point reached *across the whole window*, so a student who came back three times had
> three times the opportunity to go deep. Returning produces depth, not the other way round. Isolating
> day 1 kills the effect entirely. The corrected read is below.

### The confounded view (what it looked like at first)

| Deepest plan depth reached in window | Users | Returned on a 2nd day |
|---|---:|---:|
| 0 nodes | 34 | 5.9% |
| 1 – 2 | 29 | 6.9% |
| 3 – 5 | 27 | 33.3% |
| 6 – 9 | 8 | 50.0% |
| 10 – 14 | 12 | 33.3% |
| 15+ | 12 | 50.0% |

### Day 1 only — the effect disappears

Nodes completed on a student's **first active day**, against whether they were ever active again:

| Nodes on day 1 | Users | Returned |
|---|---:|---:|
| 1 | 33 | 30.3% |
| 2 | 9 | 44.4% |
| 3 | 11 | 27.3% |
| 4 – 5 | 12 | 41.7% |
| 6 – 9 | 7 | 42.9% |
| 10+ | 16 | 37.5% |

Flat. **How much a student does on day 1 does not predict whether they come back.** Measured per
session rather than per user, it is flat-to-negative (day-1 = 3 nodes → 0 of 16 sessions returned).

Practical consequence: "drive them to node 3 on day one" is *not* a retention lever, and shouldn't be
built as one.

### Day-1 question volume — a real but non-monotonic signal

| Questions on day 1 | Users | Returned |
|---|---:|---:|
| 0 | 40 | 22.5% |
| 1 – 9 | 16 | **0.0%** |
| 10 – 29 | 36 | **47.2%** |
| 30 – 99 | 16 | 31.2% |
| 100+ | 7 | 57.1% |

One sharp result survives: **not one of the 16 students who answered between 1 and 9 questions on
day 1 ever came back.** Students who answered 10–29 returned at 47.2%. A first session that stops at
five questions lands squarely in the dead zone. (Small cells — 0 of 16 is unlikely to be noise at
roughly p ≈ 0.003 against a 30% base rate, but treat the shape, not the decimals.)

### What actually correlates with returning: plan length

| Plan length | Sessions | Median nodes on day 1 | Came back |
|---|---:|---:|---:|
| ≤ 14 nodes | 27 | 2 | **29.6%** |
| 15 – 20 | 78 | 3 | 17.9% |
| 21+ | 30 | 5 | 13.3% |

Longer plans produce *more* day-1 activity and *less* returning. Still correlational — plan length
tracks upload size — but it points the same way as the completion data.

---

## Finding 3 — Both meters are set above where the population lives

- **Commercial gate — 3 study plans / rolling 30 days** (shipped 5 Aug). `planUsage` distribution:
  16 users at 1, one user at 2, **none at 3**. Never fired.
- **Backstop — 50 questions / rolling 3h.** Fired for **1 user out of 1,766, ever** (peak observed
  `usage.count` = 51). The 3-hour window resets faster than students study: median session is
  6.7 minutes and 77.9% of users are active on a single day, so the bucket never fills.

### What each possible gate would actually reach

| Gate | Users reached | % of active | Of those, return |
|---|---:|---:|---:|
| 3 study plans / 30d *(live)* | 13 | 10.7% | 84.6% |
| 50 questions / 3h *(live)* | 0 | 0.0% | — |
| 2 study plans | 20 | 16.4% | 85.0% |
| 30 questions / week | 32 | 26.2% | 46.9% |
| 50 questions / week | 21 | 17.2% | 57.1% |
| 100 questions / week | 13 | 10.7% | 69.2% |
| Past node 3 of a plan | 46 | 37.7% | 39.1% |
| Past node 5 of a plan | 32 | 26.2% | 43.8% |
| Past node 8 of a plan | 26 | 21.3% | 46.2% |

### Consumption is extremely concentrated

| Segment | Users | Questions consumed |
|---|---:|---:|
| Answered 30+ q **or** reached 6+ nodes | 38 (31.1%) | 3,562 (**89.8%**) |
| Everyone else | 84 (68.9%) | 406 (10.2%) |

The engaged core has a median of 56 questions each and 44.7% of them return on a second day. None
has ever been shown a paywall.

---

## Five moves, ranked

### 1. CRITICAL — Meter the week, not the three hours

The 3-hour window is why the backstop has fired once in 1,766 users. Students study in one short
burst then leave; the bucket refills before they come back.

> **Move:** change `WINDOW_MS` in `src/Services/UsageService.js` from 3 hours to 7 days and set the
> free allowance to 40–50 questions. Reaches 17–26% of active users, all in the returning cohort.

### 2. CRITICAL — Stop gating on an action most users take once

The plan quota reaches the right people (84.6% of those who hit it are returners) but almost none of
them. Only 10.7% of active users start three plans in two weeks; 55.7% start exactly one. Students
create one plan and study inside it for days — the meter counts an event they rarely repeat.

> **Move:** keep the plan quota as a secondary signal; make question volume the primary charge. Price
> what students consume, not how often they set up.

### 3. HIGH — Ship plans at ~6 nodes, then offer to extend

Zero of 108 plans longer than 14 nodes were finished; a quarter of plans at ≤8 nodes were. The median
student completes 4, and 80.7% of study sessions happen on a single day. Against the same behaviour,
a 6-node plan would have been *finished* by 37.8% of sessions instead of 2.2% — the same students,
the same effort, but now with an ending. Shorter plans also correlate with higher return
(29.6% at ≤14 nodes vs 13.3% at 21+).

> **Move:** cap the generated plan at ~6 nodes with an explicit "extend this plan" action — itself a
> natural, earned upgrade moment.
>
> **Do not** expect this to fix retention on its own: day-1 depth doesn't predict returning
> (Finding 2). It buys a completion moment and an upgrade trigger. Day-2 return needs its own
> mechanism.

### 4. HIGH — Use the exam date as a trigger

| Exam timing (129 chats carry an exam date, 51.2% of all chats) | Chats |
|---|---:|
| Within 3 days | **50** |
| 4 – 14 days | 36 |
| 15+ days | 9 |
| Already passed | 34 |

`examDate` already reaches the upgrade modal as copy ([UsageContext.js:56](src/Contexts/UsageContext/UsageContext.js#L56))
but nothing in the gate uses it to decide *when* to make an offer.

> **Move:** trigger a time-boxed offer when the exam is inside 72 hours — unlimited practice through
> exam day. Urgency you didn't manufacture is the cheapest conversion lever available.

### 5. MEDIUM — Retire flashcards, spend it on quiz depth

| Onboarding: "how do you want to review?" | Share |
|---|---:|
| Practice Questions | **89.2%** |
| Visual Concept Maps | 6.7% |
| Flashcards | 1.7% |
| Save scores / track progress | 1.7% |

Behaviour matches the stated preference: **5 of 74 flashcards generated were ever reviewed (6.8%)**,
against 77.0% of 5,155 quiz questions answered.

> **Move:** hide the flashcard surface; put the effort into what happens when a quiz ends.

---

## Supporting detail

### Session shape (252 chats)

| | Count | Share |
|---|---:|---:|
| Study sessions | 135 | 53.6% |
| Plain chats | 117 | 46.4% |
| With an upload | 193 | 76.6% |
| **Zero messages (pure waste)** | 33 | 13.1% |
| Ended on a loading / onboarding / menu screen | 20 | 7.9% |
| Had a stream error | 0 | 0.0% |

The stream-error contract is holding — zero errored messages in 14 days.

### Artifact funnel

| Artifact | Chats | Engagement |
|---|---:|---|
| Quiz | 159 (63.1%) | 76.7% answered ≥1; 45.3% answered all |
| Lesson | 135 (53.6%) | — |
| Flashcards | 15 (6.0%) | 13.3% reviewed ≥1 card |
| Study sheet | 8 (3.2%) | — |

### New users (85 in window)

| | Share |
|---|---:|
| Completed first upload | 92.9% |
| Answered 0 questions | 35.3% |
| Made exactly 1 chat | 65.9% |
| Came back another day | **12.9%** |

First upload works. The gap is what happens immediately after it: a third of new users never answer a
single question, despite 89.2% saying practice questions are what they came for.

---

## Method & caveats

- "Node reached" counts distinct `nodeId`s appearing in a session's messages.
- "Returned" means active on 2+ calendar days inside the window — this **undercounts** anyone whose
  second visit falls after 9 Aug.
- `usage.count` is a rolling-window counter, so it reflects the last window written, not lifetime
  volume. That is the point: a student who answered 430 questions across 14 days may never have had
  50 in any single 3-hour window.
- The 3-plans-per-30-days quota shipped 5 Aug, four days into a 30-day window, so "never fired" partly
  reflects a young feature. The behavioural finding stands independently: only 10.7% of active users
  start three plans in fourteen days, so the gate reaches a minority even at full maturity.
- Small samples are flagged inline (`n=8` for the 6–9 node bucket, `n=4` for plans ≤8 nodes). The
  plan-length conclusion rests on the large cells: 0 of 78 and 0 of 30.
