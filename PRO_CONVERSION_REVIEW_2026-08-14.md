# Pro Conversion Review — first monthly subscriber

**Date:** 14 Aug 2026
**Subject:** user `VsiqNt2O95Sswxirb4kMTZWFrAo2`
**Sources:** Firestore (`users`, `chats`, `messages`, `studyPerformance`), Stripe API, repo source.
**Contains customer PII** (name, email, study conversation). Internal only.

**Headline:** she paid **46 minutes after signing up**, having never seen a paywall. What she bought
was not the quiz — it was a 40-minute back-and-forth in which she explained concepts in her own words
and got corrected. That interaction had **no button anywhere in the product**; she found it by typing
into the box.

| Vital | Value |
|---|---|
| Signup → paid | **46 min 43 s** |
| Free allowance used at time of payment | **10 of 50 questions (20%)** |
| Paywalls seen | **0** |
| Price | CA$8.33 / month, active |
| Study plans created | **0** |

---

## 1. Who she is

| | |
|---|---|
| Name / email | Jessica Martin — `jessicamartin@cdrewu.edu` (Charles R. Drew University) |
| Stripe | customer `cus_V4DBP1Yk3J4uIc`, subscription `sub_1U44l1JW0VHDSVXkhhV6uKgb` |
| Country | US |
| Stage | Final Semester / NCLEX Prep |
| Stated goal | General Review |
| Stated format preference | **Practice Questions** |
| Typed into onboarding | *"i struggle with peds, med surg, pharmacology, fundamentals, pysch, maternal heath"* |

---

## 2. The 46 minutes

All times UTC, 13 Aug 2026.

| Time | Event |
|---|---|
| 19:10:54 | Account created |
| 19:11:29 | Uploads `NUR 450 - Fall 2024.docx` — **35 seconds after signup** |
| 19:11:39 | Upload insights returned |
| 19:12:01 | Types *"create me an exam on cardio"* |
| 19:12:28 | 10-question quiz generated (`usage.windowStart` stamped here) |
| 19:13:56 – 19:53:36 | **40 minutes of continuous back-and-forth** |
| 19:56:38 | Opens checkout — 3 min 1 s after the last answer |
| 19:57:38 | **Pays** |

### She was never gated

Free tier is 50 questions per rolling 3 hours (`src/Services/UsageService.js:40`). Her `usage.count`
was **10** — the single cardio quiz — and `windowStart` is stamped 19:12:28, the moment that quiz
generated. She used a fifth of the free allowance.

`openUpgrade` only fires automatically on quota exhaustion, so she must have clicked **Upgrade
voluntarily** from the usage panel or account row. Nothing pushed her. This was a pull conversion,
which makes the 40 minutes before it the whole story.

---

## 3. What actually converted her

Her message pattern is distinctive: **she does not ask questions, she asserts her understanding and
asks to be checked.**

- *"defib is the shock waves"*
- *"you do not give nitro when there is right ventricular infarction?"*
- *"iv fluid support preload by increasing volume to force forward flow?"*
- *"this can also cause fvo"*
- *"ace inhibitors reduce afterload"*

At **19:48:47** she typed a 287-character paragraph laying out her mental model, concluding that ACE
inhibitors mean *"less blood is going to be pumped out."* The product **corrected her**: reduced
afterload means the left ventricle ejects *more*, not less.

Four minutes later: *"so afterload is a systemic circulation thing?"* — she is rebuilding the model.
The answer separated LV afterload (SVR) from RV afterload (PVR).

**Three minutes after that, she paid.**

The quiz was a 30-second on-ramp. The value moment was the product catching a misconception she did
not know she had, phrased in her own words, against her own uploaded course file.

---

## 4. What she never touched

No `exams` subcollection, no `studyPerformance`, no exam date, no study plan. **Study Mode was never
opened.** The Today's Mission, readiness-projection and plan-quota work played no part in this
conversion.

---

## 5. Where she nearly churned

She returned the same night (00:09–04:38, 19 messages, second chat). The last ten minutes:

| Time | |
|---|---|
| 04:29:14 | *"a review"* → **no reply** |
| 04:29:40 | *"can you make your own?"* → got another **quiz** |
| 04:30:25 | *"i need a review like tutoring/lecture before questions"* → **no reply** |
| 04:33:00 | *"teach me respiratory failure"* → **no reply** |
| 04:34:19 | *"explain organ failure patterns"* → answered properly |
| 04:38:26 | *"how can i get an A my advance med surg course"* → generic listicle |

**Three messages got no response at all.** A one-day-old subscriber asked twice to be taught, was
ignored, and her last quiz was 2/5.

### Root cause

The orchestrator fast-routes on regex before any LLM call (`services/orchestrator.py`). Tracing her
exact messages:

| Message | Matched | Result |
|---|---|---|
| "a review" | nothing | fell to LLM routing → **no reply** |
| "i need a review like tutoring/lecture before questions" | nothing | fell to LLM routing → **no reply** |
| "teach me respiratory failure" | nothing | fell to LLM routing → **no reply** |
| "explain organ failure patterns" | `explain` ✓ | fast path → **answered** |

`CONVERSATIONAL_PATTERNS` contained `explain`, `tell me about`, `what is`, `how does` — but **not**
`teach me`, `review`, `tutor`, `lecture`, `walk me through`. Every message that matched got answered;
every message that fell through to LLM routing died silently. She was one verb away from being served.

The last message was also a textbook intent-to-plan signal ("how can i get an A") answered with a
generic listicle instead of "when's your exam?"

---

## 6. Is she representative? — behavioural data

Scan of **24,319 messages across 4,539 chats**. Onboarding answers ignored entirely.

### Chat surface

| Delivered | Count | Reply within 30 min | Follow-on msgs | Reply speed | Actually used |
|---|---:|---:|---:|---:|---:|
| **Dialogue** (written answer) | 2,664 | **71.3%** | **3** | **72 s** | — |
| Quiz | 1,444 | 45.9% | 2 | 209 s | **71.7%**, ~5 min |
| Study sheet | 331 | 46.2% | 2 | 123 s | not tracked |
| Flashcards | 208 | 47.6% | 2 | 116 s | 41.3%, ~4 min |
| Concept map | 44 | 52.3% | 1 | 79 s | not tracked |
| Audio | 28 | 50.0% | 2 | 196 s | not tracked |

**Artifacts capture attention; dialogue compounds it.** Dialogue is the only delivery that reliably
produces *more* conversation — 71% continuation against 46–52%, three times the follow-on depth, and
the fastest reply of anything.

Quiz is the strongest single object (72% attempted, ~5 minutes of focus) but it is **terminal**: after
a quiz the conversation ends more than half the time. It consumes a session rather than extending one.

**Design consequence: leading with a quiz caps the session; leading with dialogue opens it.**

This holds across 2,664 deliveries, so Jessica is not an n=1 anecdote.

> **Correlation, not causation.** Students who type more get more dialogue by construction.

### Post-upload chip menu — 1,647 shown, 733 clicks (44.5% CTR)

| Chip | Clicks | Share | Distinct users |
|---|---:|---:|---:|
| Quiz me | 346 | 47% | 228 |
| Study sheet | 201 | 27% | 111 |
| Create flashcards | 134 | 18% | 103 |
| Concept map | 51 | 7% | 42 |

### Audio and concept map were in the wrong place, not unpopular

| Artifact | In chat | In Study Mode |
|---|---:|---:|
| Audio | 28 | **1,566** |
| Concept map | 44 | **407** |

---

## 7. Shipped as a result

**Backend — `services/orchestrator.py`**
1. `TEACH_PATTERNS`: `teach me`, `tutor`, `lecture`, `walk me through`, `go over`, `help me learn`,
   `break it down`, `a/the/some review`, `in my own words`, plus French. Checked *after* the artifact
   patterns so `"quiz me to review cardio"` still routes to a quiz. Unanchored and length-independent,
   which her 53-character message required.
2. **Teach guard** — the intent analyzer can no longer answer an explicit "teach me" with a quiz or
   flashcards. Informational tools still pass.
3. **Plural bug fix** — every pattern's trailing `\b` blocked its own plural, so `flashcards`,
   `study sheets`, `practice questions`, `quizzes` and `summaries` never matched. This is the real
   cause of the long-standing "asked for flashcards, got a quiz" bug. Bare "question(s)" deliberately
   left out, as it appears in teaching requests.
4. **Teach → then test** — after a teaching answer, the existing `suggested_prompts` channel now
   offers "Now quiz me on this" / "Explain this in more depth" / "Make flashcards from this".

**Backend — `main.py`**
5. Post-upload chips cut **6 → 4**, ordered by measured click share:
   `Check my understanding · Quiz me · Study sheet · Create flashcards`. Covers 93% of clicks and fits
   one row. Audio and concept map removed from this menu only — they stay in Study Mode where they are
   heavily used.

**Frontend**
6. **"Check my understanding" chip**, placed first — gives the converting interaction a front door.
   Sends a prompt asking the student to explain in their own words and be corrected.
7. **Session card + progress** — the raw prompt is no longer shown as a chat bubble (it goes out
   hidden). A card stands in with "Concept 1 of N", a progress bar and the topic list. Progress is
   derived from position in the message list, so it survives reload with nothing stored.
8. **Chip selection lock** — after choosing, the chosen chip is checked and bolded, the rest fade and
   all become inert. Persisted, so it survives reload.
9. **Artifact engagement tracking** — study sheets and concept maps stamp `engagedAt` after 8 seconds
   on screen; audio stamps on first play (covering Study Mode too, via the shared player).
10. **`resolveMessageRef`** — message docs are stored under auto-generated ids while the app uses ids
    like `post-upload-1777049804562`. Writes keyed on `message.id` silently failed. Both new writers
    now resolve the real doc first.

---

## 8. Corrections made during this analysis

Recorded because each one changed a recommendation:

- **`reviewFormat` does not affect chat.** It is read only by the study-plan prompt builder
  (`main.py:3022`, `:3520`). The constant quizzing was a router problem, not an onboarding one.
- **Study Mode is well instrumented.** An earlier claim that it "emits no engagement signal" was a bad
  query — the field is `chats.study`, not `chats.studySession`. There are 1,958 study chats all
  carrying `study.lastActionAt` and 7,962 nodes marked `done`. The narrower real gap: only **178 of
  those 7,962** have a `completedAt`, so for 97.8% of completions the timing is unknown. Already
  self-healing for new completions.
- **The quiz already shows one question at a time.** `ChatQuizStream` runs a queue with a "3 / 10"
  counter, a review round and celebrations. A second one-at-a-time surface in chat would add
  confusion for little gain.

---

## 9. Open items

**Not yet built**
- **End-of-quiz hand-off.** 55% of study sessions end on a quiz node, and Jessica's near-churn began
  the moment a quiz ended. Rolling from the score screen straight into "Check my understanding" on the
  questions she missed is the highest-value remaining change.
- Client-side watchdog so no message can vanish silently (no response in ~45 s → error bubble + retry).
- Weak-points panel from `topicStats` with per-topic "Teach me this" buttons — she had to *ask* for
  hers, despite 16 topics already being recorded.
- Exam-date prompt on planning signals.

**Unverified**
- Why the LLM-routing fallback returned nothing for her three messages. Established only that every
  message reaching that path died while every fast-pathed message succeeded. The fix routes her
  phrasing away from that path rather than repairing it — worth checking backend logs.
- **None of the frontend work has been opened in a browser.**

**To settle later**
- `checkme` occupies the first chip slot on n=1 evidence plus the dialogue continuation data. Re-run
  `chip_usage.py` in 2–4 weeks; if it cannot clear ~10% of clicks from first position, drop it.
- Both measurement scripts match prompts by their current i18n text. Reword a prompt without updating
  `SIGNATURES` and the counts silently fall to zero.

---

## Method & caveats

- All Firestore access was read-only.
- "Continuation" = a non-hidden user message within 30 minutes of an assistant delivery; 30 minutes
  also defines the session boundary for depth.
- "Actually used" comes from `updatedAt > timestamp`, which only quiz and flashcard messages wrote
  before item 9 above. Study sheet, concept map and audio are therefore **understated** — the new
  tracking exists to fix exactly this.
- Study-mode interactions do not create user messages, so continuation metrics do not apply to
  `study_*` types. Their near-zero rates in early drafts were a measurement artifact.
- Timings come from Stripe (`created` / `start_date`) and Firestore message timestamps, both UTC.
