# Pro Conversion Review — third monthly subscriber

**Date:** 25 Aug 2026
**Subject:** user `cGj72ztoomXzEP3xle2rtcJd5ub2`
**Sources:** Firebase Auth, Firestore (`users`, `chats`, `messages`, `studyPerformance`), Stripe live API, repo source.
**Contains customer PII** (name, email, study behaviour). Internal only.

**Headline:** she paid **1 minute 43 seconds after signing up**, and **5 seconds after her first
upload finished** — before generating a single item, answering a single question, or typing a single
word into chat. Both metered gates were at **zero**. The only thing standing between her and her
second lecture deck was the **one-upload-per-chat rule**, and 50 seconds after paying she uploaded
that second deck. This is the same gate that converted subscriber #2, firing **nine hours faster**.

| Vital | Value |
|---|---|
| Signup → paid | **1 m 43 s** |
| First upload → checkout opened | **5 s** |
| Checkout opened → paid | **24 s** (Apple Pay) |
| Free allowance used at payment | **0 of 50 questions** |
| Plan allowance used at payment | **0 of 3 plans** |
| **Upload gate** | **Armed** — 1 file in the active chat |
| Messages typed into chat | **0** |
| Items generated before paying | **0** |
| Price | CA$8.33 / month, active |
| Total lifetime session | **14 m 56 s** |

---

## 1. Who she is

| | |
|---|---|
| Name / email | Hailey Hoye — `hoyehailey@gmail.com` (Google sign-in) |
| Stripe | customer `cus_V8NAMLrehZGHgq`, subscription `sub_1U86QMJW0VHDSVXkYvWN0leX` (livemode) |
| Payment | **Apple Pay**, US Visa debit, billing country US, Stripe email `heyhey.hoye@gmail.com` |
| Stage | Semester 2-3 |
| Stated goal | **Course Exam** |
| Stated format preference | **Practice Questions** |
| Typed into onboarding | *"Types of questions slowing down / Med surge"* |
| Exam date | **25 Aug 2026 — the next morning** (entered at 22:37, *after* paying) |

Brand-new account. Firebase Auth `creation_timestamp` and `last_sign_in_timestamp` are the same
instant, no prior account exists under either of her two email addresses, and there are no other
Firestore user docs for her. She had never seen this product before 24 Aug 22:31.

Third subscriber, third profile: Jessica converted on typed conversation, Patricia on a button-driven
study plan after nine hours. Hailey converted on **nothing at all** — she had seen one upload-summary
card when she opened checkout.

---

## 2. The 103 seconds

All times UTC, 24 Aug 2026.

| Time | Event | Free units |
|---|---|---:|
| 22:31:15.9 | Google sign-in — Auth account created | — |
| 22:31:46.6 | Onboarding submitted, user doc written (**30 s** of onboarding) | — |
| 22:32:30.2 | Upload #1 completes: `NR324_Musculoskeletal (2).pptx` → chat `wXeef…` | 0 |
| | *`uploadedFilesList` = 1. The upload gate is now armed.* | |
| **22:32:35** | **Stripe Checkout session opened** — `cs_live_a1ffkh…` (**+5 s**) | **0** |
| **22:32:59** | **Paid** — CA$8.33, Apple Pay (**+24 s in checkout**) | **0** |
| 22:33:00–03 | charge succeeded → invoice paid → `checkout.session.completed` | — |
| 22:33:08.1 | Back on `nursequizai.com`; webhook flips `usage.tier` → `pro` | — |
| **22:33:49.1** | **Upload #2 completes: `NR324_Hematology.pptx`** — 41 s after landing | — |
| 22:37:01.8 | Post-upload action chips rendered | — |
| 22:37:12.7 | Study plan 1 created — Hematology, 6 nodes, est. 57 min; exam date **25 Aug** entered here | — |
| 22:37:18.4 | `node_1` diagnostic generated — **3 plain MCQs** | — |
| 22:37:29.6 | Answers question 1 — **incorrect** | — |
| 22:46:10.6 | Study plan 2 created — Musculoskeletal, 6 nodes, est. 38 min | — |
| 22:46:11.3 | `node_1` diagnostic generated — **2 plain MCQs** | — |
| 22:46:12.0 | **Last write. Nothing since.** | — |

### The meters were untouched, and provably so

Her `usage` map contains **only** `{ tier: "pro" }`. There is no `count` field, and no `planUsage`
map anywhere on the document. `consumeGeneration` and `consumePlanUnit` write those keys on first
use, and both short-circuit once `tier === 'pro'` — so their absence is positive evidence that **she
never consumed a free unit of anything.** She paid at 0/50 questions and 0/3 plans.

`requireQuota()` and `requirePlanQuota()` only fire at `remaining <= 0`. **Neither metered gate was
reachable.** Whatever opened the paywall was not a meter.

---

## 3. What actually converted her

The honest answer, stated plainly: **almost nothing in the product converted her.** She had seen one
screen of generated output when she opened checkout. There was no accumulated value to pay for.

| | |
|---|---|
| **The value** | ~2 minutes: an upload summary naming 3 topics and 5 concepts from her own deck |
| **The trigger** | the upload gate, blocking deck 2 |
| **The stakes** | Med-Surg exam the next morning, two decks to get through, CA$8.33 |
| **The lubricant** | **Apple Pay** — 24 seconds from modal to charge, no card typed |

### 3.1 The trigger — the upload gate again

Free users get **one upload per chat**, checked in two places, neither of them metered:

```js
// ChatInterface.js:4207-4211 — fires on the attach button, before the picker opens
const openFileUploadDialog = () => {
  if (!isPro && uploadedFilesListRef.current.length > 0) {
    openUpgrade(null, { topic: currentChatTitleRef.current });
    return;
  }
  documentFileInputRef.current?.click();
};
```

At 22:32:30 her upload completed and `setUploadedFilesList` pushed one file into the list
([ChatInterface.js:2819](src/Components/ChatInerface/ChatInterface.js#L2819)). From that instant, in
that chat, **the attach button could only ever produce the paywall.**

She had two decks for one exam. The `FirstUploadWowCard` she was looking at offers exactly **one**
action — *"Begin My Study Journey"* — and no way to add a second document. The only affordance for
deck 2 is the paperclip, and the paperclip was a paywall.

The behavioural signature is decisive:

| Time | | |
|---|---|---|
| 22:32:30 | Upload #1 lands — gate arms | |
| 22:32:35 | **Checkout opens** | +5 s |
| 22:32:59 | **Pays** | +24 s |
| 22:33:08 | Redirected back to the site | +9 s |
| 22:33:49 | **Uploads deck #2** | +41 s |

She paid, and the *first thing she did on the other side* was the exact action she had been blocked
from. Same shape as Patricia on 20 Aug — pay, then immediately upload the next chapter.

**Confidence.** *Certain:* the gate was armed, both metered gates were unreachable, and the only
checkout session ever created on this account is the one she paid. *Inferred:* that the attach click
is what opened the modal at 22:32:33-35. The only other surfaces that open the same `reason=null`
modal are the usage badge (which would have read **"50/50 questions"** — a full meter) and the
account menu's upgrade row. Both require her to have gone hunting for a paywall 5 seconds after her
first upload, with nothing spent and nothing seen. The upload gate requires only that she wanted to
add her second lecture deck — which she demonstrably did, 50 seconds later.

### 3.2 The modal could not name the block — and this time it could not use the exam either

`openUpgrade(null, …)` passes `reason = null`, so `blocked` derives from the *question* quota, which
was full. She got the voluntary, aspirational branch:

> ### Ace your course exam
> Master every topic, find your weak spots faster, and walk into your exam ready.
>
> **CA$8.33 / month** — Cancel anytime. No commitments.
> **🔒 Continue studying with Pro →**

Note what is missing. Patricia at least got exam urgency (*"your exam is tomorrow"*). Hailey did
**not** — and could not have. `UpgradeModal` reads the exam date from
`userProfile?.onboarding?.examDate` ([UsageContext.js:56](src/Contexts/UsageContext/UsageContext.js#L56)),
but the date is captured onto the **chat** by `StartStudyModal`, and lifted to the profile only when
an existing chat is later *loaded* ([ChatInterface.js:890-897](src/Components/ChatInerface/ChatInterface.js#L890-L897)).

At 22:32:35 she had not created a plan yet, so there was no exam date anywhere. She entered
*25 August — the next morning* at 22:37, four minutes after paying, and it went onto the chat. Her
profile still has no `onboarding.examDate` today.

**The exam-countdown urgency copy is effectively dead on the first session** — which is precisely
when all three of our subscribers converted. It can only appear on a *return* visit, after reloading
a chat that already carries a date. So the modal that converted her named neither the real block
(uploads) nor the real stake (an exam in nine hours). She bought against generic marketing copy.

### 3.3 Apple Pay is doing real work

24 seconds from opening the payment link to a completed charge, with no card entered. Both previous
conversions took longer at this step. This is the one part of the funnel that is unambiguously
working, and it is worth protecting: whatever else changes, the checkout must stay one-touch on
mobile Safari.

Also worth noting: **monthly is the default** in the modal (`annualSelected` initialises to `false`),
and annual sits behind a "Save 55%" swap button. All three subscribers took monthly. Annual is marked
`recommended: true` in [billing.js](src/config/billing.js#L28) and is never the pre-selected option —
we are choosing CA$8.33 over CA$45 by default, three times out of three.

---

## 4. What she got for her money

Almost nothing, and that is now the urgent problem.

| Measure | Value |
|---|---|
| Time from first sign-in to last write | **14 m 56 s** |
| Study plans created | 2 (both would have been **free** — she had 3) |
| Questions generated | **5** |
| Questions answered | **1** |
| Questions correct | **0** |
| Chat messages typed | **0** |
| Plan nodes completed | **0 of 12** |
| Return visits since | **none** |

Both plans are frozen identically: `node_1` still `active`, every other node `locked`. She opened the
Hematology diagnostic, got question 1 wrong, and left it mid-quiz. Nine minutes later she started a
second plan on her other deck, generated its diagnostic, and **never answered a single question in
it.** Her only recorded performance is one line:

> Hematologic Disorders — Quick Check: **0/1**, strength `weak`

Her exam was the following morning. Auth reports no sign-in since 22:31 on 24 Aug. **She paid
CA$8.33, studied for fifteen minutes, and has not come back.** The renewal date is 24 Sep.

### 4.1 The product ignored the only thing she told us

Her single piece of free text, typed into onboarding:

> **"Types of questions slowing down / Med surge"**

Her `reviewFormat` is **"Practice Questions"**. She is telling us, in her own words, that *question
formats* are what she struggles with. What the product served her:

- **5 plain multiple-choice questions.** Not by accident — study-plan quiz nodes are hardcoded
  `question_types=["mcq"]` at `NQBackEnd2/main.py:4484`. **A quiz node cannot produce SATA or
  priority-ordering, ever.**
- **Every one of them shipped `rationale: ""`** with a one-line `correctBlurb` — the exact MCQ
  teaching gap flagged in the 20 Aug review and still unfixed.

The 20 Aug review established that **SATA and priority-ordering are what sold subscriber #2** — 51
questions that told her something she did not know about herself. Hailey's plans are structurally
incapable of showing her either format, and the one question she answered wrong taught her a single
sentence about erythropoietin.

She said "question types are slowing me down." We hardcoded her to one type, with the empty
explanation field.

### 4.2 Minor defects observed

- The Musculoskeletal diagnostic returned **2 questions** where `STUDY_DIAGNOSTIC_QUESTIONS = 3` was
  requested — a silent generation shortfall.
- Both chat documents carry `description: "Nouvelle conversation"` for an `en-US` user. A French
  default string is leaking into English accounts.

---

## 5. The instrumentation gap — now three for three

**We still cannot see paywall impressions, badge clicks, or upgrade opens.** This is the third
consecutive conversion review that has had to reconstruct the decisive click from Firestore write
timestamps and Stripe. It was flagged P0 on 20 Aug and has not shipped.

For Hailey it matters more than before: her entire conversion happened inside a **5-second window**
in which the product wrote nothing to Firestore. There is no telemetry at all for the single most
valuable moment in her account's history. We are inferring our best-performing surface from the
absence of alternatives.

---

## 6. Strategy — what to build

### P0 — Instrument the paywall. Third time asking.

`badge_view`, `badge_click`, `upgrade_open` (with `reason`), `checkout_open`, `checkout_paid`. Every
item below is unmeasurable without it, and we have now spent three reviews on forensic reconstruction.

### P0 — Give the upload gate its own copy (`reason='upload'`)

Carried over from 20 Aug, still not shipped — and it has now plausibly converted **two of our three
subscribers**. Add `reason='upload'` at both call sites
([:2719](src/Components/ChatInerface/ChatInterface.js#L2719),
[:4209](src/Components/ChatInerface/ChatInterface.js#L4209)) and a branch that names the actual block:
*"You've used your free upload for this chat. Pro uploads every deck you're studying."*

### P0 — Fix the exam-date lift so urgency copy can fire on session one

Write `onboarding.examDate` at the moment `StartStudyModal` captures it, not on a later chat load.
Today the highest-urgency copy in the paywall is unreachable during the first session — the only
session any of our three subscribers had before paying.

### P0 — Unhardcode `question_types` in study quiz nodes

`NQBackEnd2/main.py:4484` pins every plan quiz to `["mcq"]`. Mix in SATA and priority-ordering,
driven by the student's `reviewFormat` where it is set. This is the format the 20 Aug review
identified as the product's actual differentiator, and the study-plan path — the primary path —
cannot emit it.

### P0 — Fix MCQ rationales

Also carried over from 20 Aug. `rationale: ""` on every plain MCQ. Since plan quizzes are 100% MCQ
(above), **the study-plan path currently ships zero teaching content.** These two defects compound;
fix them together.

### P1 — "Add another document" belongs on the wow card

She had two decks and the card offered one button. The gate she hit exists only because there is no
sanctioned way to bring in a second document. Put it on the card, and let the gate be a deliberate
decision rather than the only available exit.

### P1 — Win back a paid user who never activated

She has paid CA$8.33, used the product for fifteen minutes, missed her exam window, and renews on
24 Sep. Both her plans are one node in with 22 nodes locked behind them. This is the first subscriber
we can still save before renewal, and there is currently no mechanism — no email, no re-engagement,
nothing. A "your Hematology plan is 1/6 done" nudge is the minimum.

### P2 — Make annual the default, or decide not to

Three subscribers, three monthly plans, zero annual. Annual is `recommended: true` in config and
pre-selected nowhere. CA$45/yr vs CA$99.96/yr is a real LTV question we have never actually tested.

---

## 7. The pattern across all three subscribers

| | Jessica (13 Aug) | Patricia (20 Aug) | **Hailey (24 Aug)** |
|---|---|---|---|
| Signup → paid | 46 min | 9 h 37 m | **1 m 43 s** |
| Path in | Typed conversation | Button-driven study plan | **Upload, then nothing** |
| Chat messages typed | Many | 0 | **0** |
| Questions used at payment | 10 / 50 | 40 / 50 | **0 / 50** |
| Plans used at payment | 0 / 3 | 1 / 3 | **0 / 3** |
| Metered gates fired | 0 | 0 | **0** |
| Upload gate implicated | No | **Yes** | **Yes** |
| Exam proximity | None stated | Next day | **Next morning** |
| Value seen before paying | 40 min of tutoring | 33 min, 51 questions | **~2 min, 0 questions** |
| Still active | — | — | **No — 0 returns** |

**Three subscribers. Zero metered-gate conversions.** The question throttle and the plan quota — the
two gates we designed, built, tuned and put a badge on — have now failed to convert anyone, three
times running. The gate that keeps appearing is the one-upload-per-chat rule, which was written as a
throwaway soft block, has no copy of its own, and is not instrumented.

The 20 Aug review closed by saying we were converting by accident rather than on purpose. Hailey is
that sentence taken to its limit: she paid **before the product had shown her anything**, on an
undesigned gate, against copy meant for a different situation, and then never came back.

The read across all three is now clear enough to act on. **What sells is a student mid-momentum
hitting a wall on work that matters.** The wall we keep hitting them with is the upload gate, and it
fires on the highest-intent action in the entire product — *a student bringing in the next thing they
have to learn.* That is the moment to design for, and we still have not designed for it.

But Hailey adds something the first two did not, and it is the more important half of this review:
**conversion speed is not activation.** A 103-second purchase looks like the best funnel number we
have ever recorded, and it produced our least-engaged customer — one who paid, answered one question
wrong, and left before the value the other two bought had any chance to land. Patricia bought after
51 questions proved the product worked. Hailey bought before question one.

If the upload gate keeps converting people this fast, we will keep selling subscriptions to students
who have not yet seen the product work — and we will find out on 24 September what that is worth.
