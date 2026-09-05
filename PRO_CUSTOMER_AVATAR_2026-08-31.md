# Pro Customer Avatar

**Date:** 31 Aug 2026
**Source:** Firestore `users` (1,930 docs) + `chats` (4,833 docs), production `docai-efb03`.
**Cohort:** August 2026 signups (n=213) — the only cohort that met the current paywall.
All 8 paying users signed up 5–26 Aug. Baseline conversion **3.76%**. Founder account excluded.
**Sample size: 8 paying users.** Directional, not statistically significant. Contains customer quotes — internal only.

---

## The avatar in one paragraph

**She is a mid-program nursing student with one specific exam on a specific date, usually about a
week out. She has her own course material — a professor's PowerPoint, a unit outline — and she does
not want it explained to her. She wants to be *examined* on it, at volume, immediately, and told
where she is weak. She measures the product by how many questions it will give her before it stops.
She converts when it stops.**

She is not buying a study app. She is renting an unlimited examiner for a deadline.

---

## Who she is

| | |
|---|---|
| **Stage** | Mid-program — Semester 2–3 (5 of 8). Not a beginner, not a final-semester NCLEX candidate. |
| **Trigger** | A dated exam, median **~7 days out**. Two of them set a date for *tomorrow*. |
| **Material** | Brings her own source of truth: instructor slide decks, unit learning outcomes, course handouts. 100% of Pro users completed an upload, most within ~1 minute of signing up. |
| **Subject matter** | Fundamentals, physical assessment, vital signs, med-surg, cardio, psych/mental health, infection control. Bread-and-butter early clinical coursework. |
| **Stated goal** | Says "Course Exam" — but so does everyone. See *What doesn't predict*, below. |

---

## What she wants

In priority order, as revealed by behaviour rather than by what she clicked in onboarding:

1. **To be tested, not taught.** She skips every passive format. Relative to engaged free users,
   Pro users consume **7x more exams**, **3.6x more quizzes**, and almost none of the content you
   might assume they came for:

   | Content | Pro | Engaged free | |
   |---|---|---|---|
   | `study_exam` | 11.4% | 1.6% | **7x** |
   | `quiz` | 9.0% | 2.5% | 3.6x |
   | `study_lesson` | 5.2% | 13.6% | **0.4x** |
   | `study_audio` | 2.2% | 8.7% | 0.25x |
   | `study_flashcard` | 0.3% | 4.9% | **0.06x** |
   | `study_mindmap` | 0% | 1.4% | **0x** |

2. **Volume, on demand, matched to the real exam.** The single most repeated request in the entire
   Pro corpus is some variant of *"more questions."*

   > *"I need to know the entire power point for my test on Monday"*
   > *"Give me 50 questions based on the entire PowerPoint"*
   > *"More questions my test will have 50 questions"*
   > *"Make the questions like a case scenario"*
   > — Amanda, Semester 2–3

   > *"more questions please"* · *"15-20 more questions on the same"* ·
   > *"15 questions only on major body cavities"*
   > — Patience, who answered **143 questions**

3. **Coverage of her actual syllabus, not a generic bank.** She pastes her unit outcomes in and asks
   for questions built from them:

   > *"i am going to paste some of the unit outcomes expected from this unit, please come up with
   > questions that will help me get this unit, as many questions [as possible]"*

4. **To be corrected when she is wrong.** The highest-intent users explain concepts back in their own
   words and want the misunderstanding caught:

   > *"ace inhibitors reduces afterload by vasodilating the blood vessels..."*
   > *"so afterload is a systemic circulation thing?"*
   > *"is it like abnormal requires assessment interventions while chronically abnormal require action interventions"*
   > *"what is my weak points?"*
   > — Jessica, who paid 46 minutes after signup having never seen a paywall

5. **A verdict on her readiness.** Not a completion percentage — a diagnosis. Note that
   **0 of 8 Pro users ever finished a study plan.** Plan completion is not the value; being drilled
   and told where she stands is.

---

## How she behaves

- **Fast.** Uploads within ~1 minute of signup. First study plan within ~11 minutes.
- **Broad, then abandons.** Creates **multiple plans** (6 of 8 made ≥2; 4 made ≥4) and finishes none.
  She is not working a curriculum — she is repeatedly aiming the tool at whatever is due next.
- **Talkative.** 9.4 typed messages per user vs 2.9 for engaged free users (3.2x). She drives the
  product by typing at it, not by clicking through it.
- **Returns.** 37.5% have a 3-day login streak, vs 8% of the August cohort.

### Two sub-types — both pay

| | **The Interrogator** | **The Silent Runner** |
|---|---|---|
| Who | Jessica, Amanda, Patience, Patricia | Cyates, Hailey, Brooke, Dani |
| Typed messages | 2–34 | **0** |
| Behaviour | Argues, explains concepts back, demands specific question counts and formats | Never types; fires off 4–5 study plans by button and grinds quizzes |
| Buys because | The tutor caught her misunderstanding | The machine kept producing until it stopped |

Do not optimise for only one of these. Half your revenue never types a word.

---

## What does NOT predict conversion

This is the most useful negative finding, and it invalidates the obvious avatar:

| Declared at signup | Conversion | vs baseline |
|---|---|---|
| Format = "Practice Questions" | 3.72% | **1.0x** |
| Goal = "Course Exam" | 3.40% | 0.9x |
| Stage = "Semester 2-3" | 5.75% | 1.5x |
| Stage = "Final Semester/NCLEX Prep" | 2.78% | 0.7x |

Seven of eight Pro users chose "Practice Questions" — but **88% of all signups do.** It is a base
rate, not a pattern. **The multiple-choice onboarding has essentially zero targeting value.**

The one exception is the free-text box: typing **>60 characters** converts at **14.3% (3.8x)**.
Length of typed intent is a real signal; the buttons are not.

---

## The buying signal

**She tells you her exam date.**

`onboarding.examDate` is written at plan creation (`PlanOnboarding` / `ExamPrepModal`), so it is a
behaviour, not a declaration. Among users who reached plan creation:

| | Conversion |
|---|---|
| Set an exam date | **18.8%** |
| Did not set one | **0.98%** |

That is a **~19x separation at the same funnel stage** — by far the cleanest discriminator in the
dataset. Only **15.5%** of August signups ever set one.

### How to spot her early

1. Sets a real exam date at plan creation ← strongest
2. Types >60 characters of free text in onboarding
3. Creates a second study plan
4. Asks for "more questions" / names a question count
5. Completes an exam node rather than a lesson

---

## Caveats

- **n=8.** The "4 of 4 converted at ≥4 plans" cell is four people. Read lifts as direction only.
- **Reverse causality is only partly ruled out.** `billingEvents` was added recently, so only one
  user has a verified conversion timestamp (Amanda: 3 of 4 plans came *before* she paid). Post-payment
  usage inflates the depth metrics for the other 7. The exam-date and free-text signals are immune,
  since both are set early.
- Pre-August cohorts are excluded deliberately: the onboarding question set changed in March 2026
  and those users largely never met the current paywall.
- The `uploads` subcollection returned empty for all 8 despite `hasCompletedFirstUpload: true` —
  worth checking whether `SaveFileMetaData` is still on the live upload path.
