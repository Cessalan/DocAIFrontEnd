# NurseQuizAI — current upload flow (as built, 2026-09-05)

A self-contained description of what happens from "user wants to add their notes" to
"user is studying". Written to be pasted into another tool for a second opinion, so it
assumes no access to the repo.

---

## 0. Product context

NurseQuizAI is a study tool for nursing / NCLEX students. A student uploads their course
material (lecture slides, PDFs), and the app generates a **study plan** — an ordered path
of nodes (lesson → quiz → mindmap → audio → exam) built from that document, plus quizzes,
flashcards and an AI tutor chat over the same material.

- **Frontend**: Create React App, React 19, plain JS. Firebase for auth + Firestore + Storage.
- **Backend**: a separate FastAPI service that does all AI work (document parsing, topic
  extraction, question generation, plan generation).
- **Business model**: free tier with three separate limits; Pro is US$8.33/month.
  - 70 generated questions per rolling 7 days
  - 3 study plans per rolling 30 days
  - **1 upload per chat** (no quota — a hard block, see §2)

A "study session" is not a separate entity: it is a chat document with `isStudySession: true`
and a `study` map holding the plan.

---

## 1. Entry points — five paths, one handler

Everything converges on a single function, `handleFileSelect`. What differs is whether a
global flag `window._pendingStudyJourney` gets set on the way in, because **that flag alone
decides whether the user gets the study-plan questionnaire or a menu of buttons.**

| # | Entry point | Sets `_pendingStudyJourney`? |
|---|---|---|
| 1 | Landing page while logged out → files parked → login → handoff | yes, if a `goToStudyMode` flag was set |
| 2 | Empty-chat CTA "Upload notes" | **yes** |
| 3 | "Paste notes" modal — pasted text is turned into a `.txt` File object | **yes** |
| 4 | Paperclip / attach button (`openFileUploadDialog`) | **no** |
| 5 | "Start exam" button | **no** |

The landing-page path is indirect: the files are held in a `pendingUploadFiles` prop, and a
React effect waits for the user to be logged in, then constructs a **synthetic event object**
and calls the real handler with it:

```js
const fakeEvent = { target: { files: pendingUploadFiles, value: null } };
handleFileSelect(fakeEvent);
```

`_pendingStudyJourney` is a mutable global on `window`, written by 3 call sites and cleared
at the point of consumption.

---

## 2. The paywall fires before the file picker opens

```js
// Free plan: one upload per chat — pitch Pro instead of opening the picker.
if (!isPro && uploadedFilesListRef.current.length > 0) {
  openUpgrade(null, { topic: currentChatTitleRef.current });
  return;
}
documentFileInputRef.current?.click();
```

This check exists **twice** — once before opening the file dialog, once again after files
are selected (to catch the paths that bypass the dialog).

Notes:
- It consults **no quota counter**. If the current chat already holds a file and the user is
  free, clicking attach opens the upgrade modal instead of a file picker.
- It is trivially bypassed by starting a new chat. In practice most heavy users do exactly
  that — they put each lecture deck in its own fresh chat, so this gate never fires for them.
- The upgrade modal is called with `reason = null`, and there is **no `reason='upload'`
  variant**, so it renders generic aspirational copy rather than naming what was blocked.

---

## 3. Validation and chat creation

1. Files are filtered by `isFileTypeSupported` — MIME type, then a file-extension regex
   fallback, then a deliberate escape hatch: a file with **neither** a MIME type nor an
   extension is allowed through (iOS Safari / iCloud produce these), letting the backend
   reject it instead of silently blocking a valid document.
2. If some files are unsupported the flow continues with the rest and shows a toast; if all
   are unsupported it aborts.
3. `ensureChatExists` creates the chat document if this is a brand-new conversation, and
   syncs the URL and sidebar selection.

---

## 4. Optimistic loading message

Before the network call, an `upload_loading` message is appended to local state so the UI
reacts instantly:

```js
const loadingMessage = {
  id: loadingMsgId,
  role: 'assistant',
  type: 'upload_loading',
  content: 'upload_analyzing',
  isLoading: true,
  insights: [],
  summary: null,
  fileCount: files.length,
  filenames: files.map(f => f.name),
  language: currentLanguage
};
```

Later stream events mutate this same message in place (by id) rather than appending new ones.

---

## 5. The upload itself — NDJSON stream

`upload_files_with_progress` does a multipart POST to `/chat/upload-files` carrying
`files`, `chat_id`, `user_id`, `language`, and reads a newline-delimited JSON stream back.

Event types on the stream:

| event | meaning |
|---|---|
| `heartbeat` | keep-alive only, deliberately not surfaced to the UI |
| `file_complete` | one file parsed; carries `word_count` |
| `all_complete` | whole batch done; carries `message`, `topics`, `filenames`, `actions` |
| `error` | carries `code` (e.g. `capacity` when the LLM provider is over quota) |

Three `AbortController` timers guard it, because the observed production failure is a socket
that stays open while nothing comes back:

```js
const UPLOAD_FIRST_BYTE_TIMEOUT_MS = 120000;  // 2 min to first byte
const UPLOAD_STALL_TIMEOUT_MS      = 45000;   // 45 s of mid-stream silence
const UPLOAD_OVERALL_TIMEOUT_MS    = 300000;  // 5 min hard ceiling
```

The 45 s stall window and the backend's heartbeat interval are a single contract — changing
one without the other causes false aborts.

---

## 6. On `all_complete` — a five-way branch, first match wins

This is the decision that shapes the entire experience.

| # | Condition | Result |
|---|---|---|
| 1 | drill mode active | navigate away to `/drill/:chatId` |
| 2 | **`window._pendingStudyJourney`** | render **`plan_onboarding`** — the 3-question card (§7) |
| 3 | a study action was pre-selected before uploading | render `post_upload_actions` with buttons hidden, then auto-fire that action |
| 4 | user's **first ever upload** AND their signup answers map to a config | render `first_upload_wow` — a personalised single-CTA card |
| 5 | otherwise | render **`post_upload_actions`** — a 4-button menu |

**Branch 4** keys off two onboarding answers collected at signup, `studyGoal` and
`reviewFormat`, mapped like this:

```js
if (reviewFormat === 'Flashcards')          return { actionId: 'flashcards',   ... };
if (reviewFormat === 'Practice Questions')  return { actionId: 'studyjourney', ... };
if (reviewFormat === 'Visual Concept Maps') return { actionId: 'mindmap',      ... };
if (reviewFormat === 'Audio Summaries')     return { actionId: 'audio',        ... };
```

**Branch 5** is the default and shows four choices with no recommendation:

- 💬 Check my understanding
- 🧪 Quiz me on these topics
- 📝 Break it down for me
- 📇 Create flashcards to study

---

## 7. PlanOnboarding — the 3-question card (branch 2 only)

Four panes with a back button and a progress-dot row.

| pane | question | options |
|---|---|---|
| **q1** | "When's the exam?" — *"I'll size the plan to fit."* | Today / Tomorrow / This week / Next week / 2+ weeks / Pick a date |
| **q2** | "Which feels hardest right now?" — *"Pick up to 2 — I'll lead the plan there."* | up to 2 of the topics extracted from the document |
| **q3** | "And where are you in your prep?" | Haven't started / Just getting started / Making progress / Cramming |
| **confirm** | summary card with an "Edit answers" link back to q1 | |

### The plan paywall lives inside q3

Selecting a prep status triggers:

```js
const firePlanInBackground = useCallback((finalPrepStatus) => {
  if (!chatId) return;
  // Plan gate. The diagnostic itself is never metered, so the gate is no longer
  // protecting a generation call here — it is protecting the STUDENT, who would
  // otherwise answer six questions, watch her knowledge map assemble, and only
  // then be told she cannot have a plan. Check early, charge late.
  if (!requirePlanQuota()) return;

  clear_in_flight_study_journey(chatId);
  const prefs = buildUserPreferences({ prepStatus: finalPrepStatus });
  // Pre-fire the DIAGNOSTIC, not the plan — generating the plan takes less time
  // than she spends answering, so it hides inside the diagnostic.
  diagnosticHandleRef.current = plan_diagnostic_quiz(chatId, [], language, prefs);
}, [chatId, language, buildUserPreferences, requirePlanQuota]);
```

If the user is at 3/3 plans for the rolling 30 days, `requirePlanQuota()` returns `false`,
opens the upgrade modal, and the flow **stops there** — three questions answered, no plan,
nothing generated. This is currently the single most productive paywall in the product.

If it passes, the diagnostic is pre-fired in the background so its latency hides behind the
time the user spends on the confirm screen.

There is also a **Skip** control, which swaps the `plan_onboarding` card in place for a
`post_upload_actions` card — i.e. skipping the questions drops you into branch 5's menu.

### After confirm

confirm → a modal opens with the merged preferences and the in-flight diagnostic promise →
**3-question diagnostic** (question types `["mcq", "sata"]`) → the backend generates the
full plan, of which only the **first block of ~6 nodes** goes live (the rest is parked in
`study.reserve` and appended later) → the first node auto-launches.

The backend also fits the plan to the calendar using the q1 exam date. If the exam is 0–2
days away it applies a "sprint" archetype that collapses the tail of the plan into a single
review quiz.

---

## 8. What production data says about this flow

Measured across all chats (n = 4,938 chats, 1,974 free users, 10 paying subscribers):

| step | count | % of uploads |
|---|---|---|
| upload completed in a chat | 3,208 | 100% |
| → a study plan was created | 2,113 | **65.9%** |
| → at least one node completed | 1,449 | 45.2% |
| exam date captured (q1 answered) | 853 | **26.6%** |
| hardest topics captured (q2 answered) | 845 | 26.3% |

Other findings:

- **62% of plans (1,317 of 2,113) have no `hardestTopics`** — they were created without
  going through the questionnaire. Plausibly historical (predating the card), unconfirmed.
- **Only 31 of 2,113 plans are ≤4 nodes**, i.e. the exam-date-driven "sprint" plan shape
  fires on ~1.5% of plans — because 73% of plans have no exam date to trigger it.
- **All 10 paying subscribers supplied an exam date**, against a 26% base rate. Selection
  bias is possible, but it is also the best qualifying signal currently collected.
- Of subscribers whose trigger can be traced, **5 of 10 were blocked by the 3-plan quota at
  the moment they paid** — i.e. they hit q3 of this questionnaire and could not continue.
- Per-format performance across the free base (n = 106 users, ~1,300 questions):
  **MCQ 88% · SATA 43% · case study / prioritisation 21%.** Every traceable conversion
  happened within minutes of a student meeting that gap. Quiz nodes currently generate
  `["mcq", "sata"]` only — case study is reachable only via exam nodes and adaptive branches.

---

## 9. Known problems with this flow

1. **`window._pendingStudyJourney` is a global mutable flag** set by three call sites and
   read once. It determines the entire post-upload experience, and two of the five entry
   points (paperclip, exam button) silently opt out of the study-plan path.
2. **The default branch is a menu, not an action.** 34% of completed uploads never become a
   plan, and the four-button card at peak motivation is the prime suspect.
3. **The questionnaire sits between upload and any value.** Three questions are asked before
   the student sees a single piece of generated content.
4. **The paywall is inside q3**, so a blocked user answers three questions and receives
   nothing.
5. **The one-upload-per-chat gate consults no quota and is bypassed by opening a new chat**,
   so it fires unpredictably — hardest on the users least likely to know the workaround.
6. **There is no paywall telemetry.** No event is emitted when the upgrade modal is shown,
   so which gate fired for which user has to be reconstructed after the fact from Firestore
   write timestamps and Stripe session logs.

---

## 10. The open question

Should the exam-date questionnaire stay ahead of the first piece of content, move behind it,
or be removed entirely?

Arguments in tension:

- It is friction at the moment of peak motivation, and only 26% of uploads complete it.
- But it powers the exam countdown, the dated schedule, the sprint plan shape and the
  post-exam debrief — and every paying user has answered it.
- A measured result in the backend says the **first node of a plan should be a lesson, not a
  quiz**: lesson-first plans complete their first node 89.0% of the time, quiz-first 66.6%.
  So "skip straight to testing them" is contraindicated by the app's own data.
