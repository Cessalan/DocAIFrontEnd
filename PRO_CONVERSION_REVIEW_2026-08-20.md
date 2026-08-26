# Pro Conversion Review — second monthly subscriber

**Date:** 20 Aug 2026
**Subject:** user `yTujE4TmTzL00wIs3rWsKCgKdLv1`
**Sources:** Firestore (`users`, `chats`, `messages`, `studyPerformance`), Stripe live API, repo source.
**Contains customer PII** (name, email, study behaviour). Internal only.

**Headline:** she was **hard-blocked from uploading her second document** by a gate nobody counts as
a paywall — the *one-upload-per-chat* rule — and paid 71 seconds later. Her question meter (40/50)
and plan meter (1/3) were both still open, so the modal she saw rendered its *voluntary, aspirational*
copy and told her not to let a **question limit** slow her down. She had not hit a question limit.
She had hit an upload limit, and the product never said so.

| Vital | Value |
|---|---|
| Signup → paid | **9 h 37 m 06 s** |
| Free allowance used at payment | **40 of 50 questions (80%)** — not blocking |
| Plan allowance used at payment | **1 of 3 plans** — not blocking |
| **Upload gate** | **BLOCKING** — 1 upload already in the active chat |
| Messages typed into chat | **0** |
| Price | CA$8.33 / month, active |

---

## 1. Who she is

| | |
|---|---|
| Name / email | Patricia Ntumba — `patriciantumba25@gmail.com` |
| Stripe | customer `cus_V6l5Riu3EPBIjy`, subscription `sub_1U6XZRJW0VHDSVXkKBL018vd` (livemode) |
| Stage | Semester 2-3 |
| Stated goal | NCLEX Prep |
| Stated format preference | **Practice Questions** |
| Exam date entered | **21 Aug 2026 — the next day** |
| Typed into onboarding | *(blank)* |

She is the opposite profile to the first subscriber. Jessica Martin converted through 40 minutes of
typed conversation. Patricia **never typed a single chat message**. Every one of the 24 messages
across her five chats has `role: "assistant"`. She converted entirely through the button-driven
study-plan flow.

---

## 2. The 9 hours 37 minutes

All times UTC, 20 Aug 2026.

| Time | Event | Free units |
|---|---|---:|
| 05:30:50 | Account created | — |
| 05:46:22 | Uploads `Chapter 47 - Bowel Elimination - Lecture - TD.pdf` (**15 m 32 s** after signup) | — |
| 05:47:37 | Study plan 1 created — 6 nodes, est. 68 min (`planUsage.count` → 1) | — |
| 05:48:02 | `node_1` mini-test (10 q) generated | — |
| | *— 8 h 44 m gap; the old quota window expires unused —* | |
| 14:32:45 | Returns, completes `node_1` | — |
| 14:33:14 | `node_2` drill (5 q) — **new quota window opens** | 5 |
| 14:37:21 | `exam_1` (10 q) | 15 |
| 14:42:42 | `node_3` mini-test (10 q) | 25 |
| 14:51:29 | `node_4` drill (5 q) | 30 |
| 14:58:05 | `exam_2` (10 q) — **last free generation** | **40** |
| 15:05:50 | Last answer on `exam_2` — abandoned, still `active` today | 40 |
| 15:06:06 | Clicks **New chat** → empty chat | 40 |
| 15:06:18 | Clicks **New chat** again → second empty chat | 40 |
| **15:07:17** | **Opens checkout** | 40 |
| **15:07:56** | **Pays** — CA$8.33 | 40 |
| 15:08:39 | Uploads `Chapter 41 - Oxygenation Lecture - TD.pdf` — 43 s after paying | — |
| 15:10:03 | Study plan 2 created (free of charge — Pro skips the meter) | — |
| 18:03 – 23:05 | Works plan 2: 3 nodes, a lesson, an exam, a retake | — |

`usage.count` is **exactly 40**, and 5 + 10 + 10 + 5 + 10 = 40. The arithmetic confirms the reading:
these five generations are the entire free-tier spend, and `consumeGeneration` stops incrementing the
moment `tier === 'pro'` ([UsageService.js](src/Services/UsageService.js)), so 40 is frozen at the
instant she paid.

### The two *metered* gates were never close to firing

`requireQuota()` only blocks when `remaining <= 0`. At checkout she had **10 remaining**. The plan
gate was at **1 of 3**. Neither metered gate fired.

Stronger than that: the window is *rolling 3 hours*. Her window opened 14:33 and would have refilled
at **17:33**. Her next generation after `exam_2` came at **18:04** — after the refill. Replaying her
real pacing against the meters, **she never hits zero on any generation she actually made.**

Which is exactly why the thing that *did* stop her was so easy to miss.

---

## 3. What actually converted her

Three separable things. Confusing them is why the first pass of this review got it wrong.

| | |
|---|---|
| **The value** | 33 minutes that proved the product could find her weak spots in her own notes |
| **The trigger** | the upload gate, blocking chapter 2 |
| **The stakes** | exam the next morning, one chapter left, CA$8.33 |

The trigger without the value and she closes the tab. The value without the trigger and she keeps
studying free. The exam is what made eight dollars not worth thinking about.

### 3.1 The value — the 33 minutes that sold it

Her first session (05:30–05:48) converted nothing. She signed up, uploaded, generated a plan and a
first node, **answered zero questions**, and left for nearly nine hours. The plan itself did not sell
her.

She came back at 14:32 and answered **51 questions in 33 minutes**. That burst is the whole sale, and
what she got in it was genuinely good:

- Questions generated from **her own** `Chapter 47` lecture PDF, not a generic bank.
- Real NCLEX formats — `["mcq", "sata", "casestudy"]` — including full clinical vignettes
  (*"Mrs. Evelyn Carter, 72, admitted following left knee arthroplasty… no bowel movement in 3 days"*)
  with priority-ordering answers.
- On the hard ones, a **proper teaching explanation of every option**, right and wrong:
  *"D is incorrect since screening colonoscopy for average-risk adults is recommended every 10 years,
  not annually."*

And she was **not good at them**. Her `missedConcepts` are not random — they cluster hard:

> colonoscopy screening **(SATA)** · normal bowel sounds **(SATA)** · psyllium administration
> **(priority order)** · high-fiber diet **(SATA)** · post-op ileus **(SATA)** · bulk-forming laxative
> therapy **(priority order)** · newly discharged ileostomy **(priority order)** · opioid analgesics
> **(SATA)** · Bristol Stool Form Scale **(SATA)**

The same pattern repeats in her respiratory session: huff cough **(SATA)**, ABG priority ordering,
pursed-lip breathing **(SATA)**.

**Select-all-that-apply and priority-ordering are the two formats that decide NCLEX outcomes, and
they are exactly where she was failing.** In 33 minutes the product told a Semester 2-3 student, the
day before her exam, something she did not know about herself — and then taught her the ones she
missed. That is what she was buying.

Note the asymmetry in what it teaches: SATA and case-study items carry a rich `justification`, while
plain MCQs ship `rationale: ""` and a one-line `correctBlurb`. The product happens to explain best
exactly where she was weakest. That is luck, not design — and it is worth making deliberate.

### 3.2 The trigger — the upload gate

There is a **third gate**, and it is not metered, not counted, and not mentioned in either previous
review. Free users get **one upload per chat**
([ChatInterface.js:4207-4211](src/Components/ChatInerface/ChatInterface.js#L4207-L4211), and again at
[:2718](src/Components/ChatInerface/ChatInterface.js#L2718) as the authoritative check):

```js
const openFileUploadDialog = () => {
  // Free plan: one upload per chat — pitch Pro instead of opening the picker.
  if (!isPro && uploadedFilesListRef.current.length > 0) {
    openUpgrade(null, { topic: currentChatTitleRef.current });
    return;
  }
  documentFileInputRef.current?.click();
};
```

No quota is consulted. If a free user's active chat already holds one file, clicking the attach
button **does not open a file picker** — it opens the paywall. Unconditionally.

**Her bowel-elimination chat held exactly one upload** (`Chapter 47`). At 15:05:50 she finished that
subject. Her exam was the next morning and her next chapter was `Chapter 41 - Oxygenation`. To study
it she had to upload it. In that chat, that click could only ever produce the paywall.

The 90 seconds read as one continuous action:

| Time | | |
|---|---|---|
| 15:05:50 | Last answer in the bowel chat (1 upload present) | |
| 15:06:06 | **New chat** — casting about for a way in | +16 s |
| 15:06:18 | **New chat** again | +12 s |
| 15:07:17 | **Checkout opens** | +59 s |
| 15:07:56 | **Pays** | +39 s |
| 15:08:39 | **Uploads `Chapter 41`** | +43 s |

She paid, and 43 seconds later did the exact thing she had been trying to do. That is the shape of a
blocked user buying her way past a wall — not of someone browsing an offer.

### The modal told her the wrong reason

The upload gate calls `openUpgrade(null, …)` — `reason` is **null**. `blocked` in
[UpgradeModal.js](src/Components/Common/UpgradeModal.js#L193-L222) is derived from the *question*
quota, which was fine. So the modal took the branch its own comment describes as *"goal-based
aspiration when they opened this themselves"*:

> ### Pass your NCLEX with room to spare
> Your exam is **tomorrow** — don't let a **question limit** slow your final push.

She had not reached a question limit. She had reached an upload limit. **The modal has no
`reason='upload'` variant at all** — the gate that actually converted our second subscriber is the one
the paywall cannot describe. She bought anyway, on exam urgency alone, against copy that was talking
about something else.

### The "just open a new chat" workaround is not reliable

The gate is documented internally as a soft one, bypassable via a new chat. In practice the bypass
races. Switching chats does **not** clear the file list synchronously — the effect at
[ChatInterface.js:1060-1066](src/Components/ChatInerface/ChatInterface.js#L1060-L1066) early-returns
on a falsy `currentChatID` and otherwise waits on an async `loadFilesForChat` round-trip before
`setUploadedFilesList([])` lands. Until that resolves, `uploadedFilesListRef.current` still holds the
**previous chat's** files and the gate keeps firing in the new, empty chat.

That is consistent with what she did: two New-chat clicks 12 seconds apart, neither of which received
an upload, then checkout. Her successful upload at 15:08:39 did not land in any of those three empty
chats — it created a *fourth* chat via `ensureChatExists`, meaning `currentChatID` was null, i.e. she
was on the post-Stripe landing page after the redirect.

### Confidence

**Certain:** the gate exists, is a hard block, fires on attach-click whenever a free user's chat holds
≥1 file, and renders copy that misstates the reason. Her chat held exactly one file. Her next act
after paying was that upload.

**Inferred:** that she hit it at ~15:06 specifically. There is no impression telemetry (§5). But the
alternative — that she spontaneously opened the badge at the precise moment she needed a second
upload, and the guaranteed block never occurred — requires more coincidence than the direct reading.

---

## 4. What her experience was actually like

### 4.1 "New chat" is the wrong door for a second subject

Three of her five chats are empty shells created by the New-chat button (15:06:06, 15:06:18,
15:10:29), against two real ones auto-created by the upload flow. She clicked New chat twice in 12
seconds and got nothing useful, then clicked it a third time *after* starting plan 2. Starting a
second subject has no first-class entry point; the discoverable button produces a blank chat that
does not lead anywhere, and — per §3 — may still be carrying the previous chat's upload gate when it
gets there. She found the working path by accident both times.

### 4.2 Her one moment of self-expression was misread

The single piece of free text she typed in nine hours, into the node-transition box:

> **"give nclex hard style"**

`/study/interpret-request` returned a **`lesson` at `difficulty: 1`** — the easiest teaching content
in the catalogue, in response to an explicit request for harder NCLEX-style questions.

The cause is in the prompt at `NQBackEnd2/main.py:3969`. The rules block does say *"make it harder" →
harder quiz*, but the JSON template underneath it hardcodes the answer:

```json
"node": { "type": "lesson", "...": "...", "difficulty": 1 }
```

`gpt-4.1-mini` at temperature 0.3 copies the shape it is shown. There is no difficulty scale defined
anywhere in the prompt, and every example says `1`. This is template anchoring, and it is a one-line
class of fix.

**What it cost:** she spent 19 minutes on that lesson (18:22:55 → 18:42:07), started `exam_1` at
18:43, answered **2 of 10 questions**, and vanished for three and a half hours. Her deepest
disengagement of the day follows immediately from the product misreading her only stated preference —
from a user whose onboarding `reviewFormat` is literally **"Practice Questions"**.

### 4.3 Neither plan is finished

| Plan | Nodes | Completed | State |
|---|---:|---:|---|
| Bowel Elimination | 6 | 5 | `exam_2` still `active` since 15:05 |
| Oxygenation | 8 | 5 | retake `active`, 5 reserve nodes unopened |

Her measured performance is genuinely middling — Bowel mini-test **25/36 (69%)**, Respiratory quick
check **14/22 (64%)**, drills 87% — with an exam the next morning. She has real weak spots (SATA and
priority-ordering questions dominate her `missedConcepts`), and the product has not told her that.

---

## 5. The instrumentation gap

**We cannot see paywall impressions, badge clicks, or upgrade opens.** Firebase Analytics is
initialised in [config.js](src/Firebase/config.js) and never used for custom events;
[StudyModeContainer.js:1072](src/Components/StudyMode/StudyModeContainer.js#L1072) still reads
`// TODO: forward to real analytics when provider is added`.

Both conversion reviews have had to reconstruct the decisive moment from Firestore write timestamps
and Stripe. That worked twice at n=1. It will not scale, and it means **the highest-performing
surface in the product is the one we have zero data on.** This is now the top blocker on making
conversion repeatable rather than anecdotal.

---

## 6. Strategy — what to build

Ranked by evidence strength from these two conversions.

### P0 — Instrument the paywall (unblocks everything else)

Fire events for `badge_view`, `badge_click`, `upgrade_open` (with `reason`), `checkout_open`,
`checkout_paid`. Without these, every item below is unmeasurable. Half a day of work.

### P0 — Fix the interpret-request anchor

Remove the hardcoded `"type": "lesson", "difficulty": 1` from the JSON template in
`NQBackEnd2/main.py:3969`; use a placeholder (`"<lesson|quiz|flashcard|audio|mindmap>"`), define the
difficulty scale explicitly, and add a `"make it harder" → quiz, difficulty 3` worked example. This
is the only place in the product where students speak in their own words, and it is currently biased
to ignore them.

### P0 — Give the upload gate its own paywall copy

This gate converted our second subscriber and the modal could not name it. Add `reason='upload'` at
both call sites and a matching branch: *"You've used your free upload for this chat. Pro uploads every
chapter you're studying — and your exam is tomorrow."* Naming the real block is the single
highest-leverage copy change available, because it is the only one we have evidence a paying user
actually needed.

### P0 — Fix the new-chat bypass race

Clear `uploadedFilesList` synchronously when `currentChatID` changes, instead of waiting on
`loadFilesForChat`. Today the documented workaround for the upload gate can fail for a round-trip,
which walls users in a chat that is provably empty. If the gate is meant to be soft, it has to
actually be soft.

### P1 — Give "second subject" a real front door

Replace the dead New-chat button in the study context with **"Add another subject"** that goes
straight to upload → plan. Both her plan-2 attempt *and* her checkout happened inside 90 seconds of
that button failing her. This is simultaneously the biggest UX gap and the highest-intent conversion
moment observed.

### P1 — Decide what the upload gate is *for*, then aim it

One-upload-per-chat is the only gate in the product that has ever demonstrably blocked a paying user,
and it was designed as a throwaway soft gate. It fires on the exact action that signals highest
intent: *a student bringing in their next chapter.* That is a real conversion moment — but right now
it lands as an unexplained wall in the middle of exam week, and it is trivially bypassed by anyone who
knows about the New-chat trick, so it charges the confused and waves through the informed. Either
make it a deliberate, well-worded gate (P0 above) or drop it and let the plan quota do the work.

### P2 — Reconsider the rolling question window

The replay shows the question meter is close to unable to bite a student who studies in spaced
sessions — the refill outruns them. It is doing signalling work, not gating work. Either accept that
and design it as a signal, or change the shape to daily so the number on the badge means what students
think it means. What it should **not** do is keep absorbing credit for conversions the upload gate is
actually driving.

### P0 — Say the thing that sold her, out loud

She had to *infer* from 51 questions that she was weak on SATA and priority-ordering. The product
already knows — `missedConcepts` is stored per topic and the format is on every question. Show it:
**"You missed 15 of your 19 Select-All-That-Apply questions, and 9 of 79 multiple-choice. That's the
format that fails people on the NCLEX."**

(Those counts are exact. Percentages are not currently derivable: exam nodes don't persist
per-question first-attempt status, so `correct` per format could only be bounded, not measured —
which is precisely the gap the `formats` counter below closes.)

That single sentence is the demonstrated value proposition of this product, delivered in the 33
minutes that actually converted her, and today it is never spoken. Put it on the results screen for
free users and it becomes the reason to upgrade *before* they hit any wall — which is the only way
this stops depending on an accidental gate.

### P1 — Fix MCQ rationales

`rationale: ""` with a one-line `correctBlurb` on every plain MCQ, against multi-paragraph
`justification` on SATA and case studies. The teaching quality that sold her is inconsistent by
question type. Bring MCQs up.

### P2 — Close the loop before the exam

She had 64–69% on two topics with an exam in under 12 hours and was never told which concepts to fix.
A "your weakest 5 concepts, drill them now" surface is the natural Pro payoff and the reason to
*stay* subscribed past month one.

---

## 7. The pattern across both subscribers

| | Jessica (13 Aug) | Patricia (20 Aug) |
|---|---|---|
| Signup → paid | 46 min | 9 h 37 m |
| Path in | Typed conversation | Button-driven study plan |
| Chat messages typed | Many | **0** |
| Question allowance used | 10 / 50 (20%) | 40 / 50 (80%) |
| Metered gates fired | **0** | **0** |
| Upload gate fired | 0 (single doc) | **Yes — the trigger** |
| Exam proximity | NCLEX prep, no date | **Next day** |
| Study plans at payment | **0** | 1 |

Two opposite journeys, and the honest read is that they converted for **different** reasons — which
is itself the finding. Jessica bought on *pull*: 40 minutes of a tutor demonstrably understanding her,
with 80% of her free allowance untouched. Patricia bought on *push*: a hard block on the one action
she needed, 71 seconds before checkout, with an exam the next morning.

What they share is not the mechanism but the moment: **each was mid-momentum on work that mattered,
and the product interrupted at the point where the value was most concrete.** Jessica's interruption
was self-generated; Patricia's was a wall we built and forgot we had built.

The lesson is not "gates don't sell." It is that **the gate that sold is the one nobody designed, in a
place nobody instrumented, wearing copy meant for a different situation.** Fix the wording, fix the
race, and instrument it — then we will be converting on purpose instead of by accident.
