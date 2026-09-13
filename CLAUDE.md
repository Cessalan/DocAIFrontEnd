# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

NurseQuizAI — a Create React App (React 19, JS not TS) frontend for a nursing/NCLEX study tool. Students upload course material, chat with an AI tutor over it, and work through a generated "study plan" of lessons, quizzes, flashcards, mindmaps and exams. Firebase provides auth, Firestore and Storage; a separate FastAPI backend does all AI work.

The backend lives at `C:\Users\Billion\Desktop\NQBackEnd\NQBackEnd2` (`main.py`, uvicorn, its own venv) and is an additional working directory in this session. Several frontend constants are duplicated there by hand — see "Cross-repo contracts" below.

## Commands

```bash
npm start
```
Dev server on :3000. `Services/config.js` auto-detects localhost and points the app at `http://127.0.0.1:8000`; any other hostname uses the deployed Cloud Run backend. There is no env var for this.

```bash
npm run build
```
CRA build, then `scripts/generate-blog-html.js` regenerates `src/data/blogPosts.js`, `src/data/blogContent.js` and prerendered SEO HTML from the markdown in `public/blog/`.

```bash
npx --no-install react-scripts test --watchAll=false --testPathPattern=studySchedule
```
Single test file (Jest via react-scripts). In PowerShell set `$env:CI="true"` first — the bash-style `CI=true npm test` prefix does not work there. `npm test` alone drops into watch mode.

Deploy is Firebase Hosting to project `docai-efb03`: `firebase deploy --only hosting` (and `--only firestore:rules` for `firestore.rules`).

### Verifying large files

`ChatInterface.js` (~5.7k lines) and `StudyModeContainer.js` (~2.1k) are too big for a full build to be a fast feedback loop. Syntax-check them directly instead:

```bash
node -e "const p=require('@babel/parser'),fs=require('fs');const f='src/Components/ChatInerface/ChatInterface.js';p.parse(fs.readFileSync(f,'utf8'),{sourceType:'module',plugins:['jsx']});console.log('OK')"
```

Then run `CI=true npx --no-install react-scripts build` once before committing anything non-trivial.

## Architecture

### Routing and shell

`index.js` wraps everything in `BrowserRouter → AuthProvider → UsageProvider → ProgressProvider`. `App.js` holds all routes and lazy-loads every chunk except the landing page — that one must paint on first byte for logged-out visitors, so keep it out of `lazy()`.

`ProtectedRoute` does **not** redirect: unauthenticated users at `/` are rendered `QuizRoomLanding` in place. `/c/:chatId` is the real app; `ChatLayout` owns the sidebar, the study/chat split and the pending-upload handoff.

### Chat transport — WebSocket, not the fetch stream

`ask_llm_websocket` in [WebSocketManager.js](src/Services/WebSocketManager.js) is the live path (`ws://…/ws/{chatId}`, one long-lived connection per chat, 2-minute keepalive pings). `ask_llm_stream` in `FastAPICalls.js` is the older NDJSON-over-fetch implementation; it is still imported by `ChatInterface.js` but no longer called for chat. Other endpoints (uploads, study generation, exams) still use plain fetch/NDJSON in `FastAPICalls.js`.

Every stream handler takes the same three callbacks: `onStatusUpdate`, `onTokenReceived`, `onStreamEnd`. `onStatusUpdate` is the interesting one — it multiplexes typed payloads (`quiz_complete`, `studysheet_generated`, `study_guide_trigger`, `status: "error"`, …) that decide which card the chat renders.

Two watchdogs guard against the failure this app has actually seen in production — the socket stays open, the backend accepts the message, and nothing ever comes back: `FIRST_RESPONSE_MS` (45s to the first *substantive* event; the backend's immediate `status:"processing"` ack deliberately does not count) and `STALL_MS` (90s of mid-stream silence). Both must stay well under the server's 300s idle timeout. Backend heartbeat timing and these windows are one contract — change them together.

### Firestore data model

Only two top-level collections matter: `chats/{chatId}` (with a `messages` subcollection) and `users/{uid}`.

A **study session is a chat document**, not a separate collection — `createStudySession` flips `isStudySession: true` on the existing chat and adds a `study` map, so uploads and the vectorstore stay attached. Study state (`path.nodes[]`, node status, per-node content, performance) lives in that map and is mutated through [StudySessionService.js](src/Services/StudySessionService.js), never directly from components.

Messages are discriminated by `type`: `text`, `quiz`, `flashcard`, `mindmap`, `studysheet`, `scenario`, `summary`, `audio`/`audio_player`/`audio_options`, `web_sources`, `post_upload_actions`, `plan_onboarding`, `first_upload_wow`, `checkme_card`, `upload_loading`. Adding a new artifact type means touching both the writer (`FireBaseServiceChats.js`) and the render switch (`ChatMessage.js` for some types, `ChatInterface.js` for others).

`firestore.rules` is deliberately transitional: the database is still broadly open, *except* that `users/{uid}` billing fields (`usage.tier`, `stripeCustomerId`, `stripeSubscriptionId`, the whole `billing` map) and the `billingEvents` subcollection are locked to the backend's Admin SDK. Clients may still write `usage.count` / `usage.windowStart`. The rules file's comments explain the v2 wildcard subtleties — read them before editing it.

### Monetization gate

[UsageService.js](src/Services/UsageService.js) + [UsageContext.js](src/Contexts/UsageContext/UsageContext.js) implement a rolling-window throttle: `FREE_LIMIT = 70` **questions** per 7 days for free users, unlimited for `usage.tier === 'pro'`. The unit is items generated, not calls — derive it with `generationUnits(payload)`.

The gate pattern at every generation site is:

```js
if (!requireQuota()) return;   // opens the upgrade modal and bails
// ...generate...
await consumeGeneration(units);
```

`UsageProvider` renders `<UpgradeModal>` itself, so any component in the tree can raise the paywall. In a dev build, `localStorage.nqDevFreeLimit = 3` fakes a small cap.

This is a **client-side gate only** and is bypassable; real enforcement has to live in NQBackEnd2. A second, mostly-superseded meter tracks study plans per 30 days.

### Outbound email (backend only)

The one channel that can reach a student who is not in the tab. It lives
entirely in NQBackEnd2 — there is no frontend email code — but it reads this
repo's data model and mirrors two of its constants, so it breaks from changes
made here.

- `services/email_sender.py` sends via Resend and holds every guard:
  **disabled unless `EMAIL_ENABLED` is exactly `true`** (anything else is a
  full dry run with the payload logged), suppression checked even in dry run,
  a per-message idempotency key that *is* the `emailLog` document id, and a
  daily cap for domain warm-up. The guards all fail **closed**.
- `services/email_campaigns.py` decides who gets mailed. Its rule: *no student
  is mailed unless we can state something true and specific about her*, so a
  selector returns candidates carrying their own personalisation and drops
  anyone whose evidence is too thin. Four campaigns: `winback_gap`,
  `plan_unstarted`, `exam_countdown`, `announcement`.
- `services/email_announcements.py` is the only **authored** copy — the same
  words to everybody, so nothing in it can be verified per recipient. Content
  is code, not Firestore, partly for review and partly because `emailLog` and
  most of this database are still client-writable. Every announcement carries
  `status`, and **`EMAIL_ENABLED=true` is not enough to send one**: the slug
  must also be flipped to `approved`. The flag and the words are two decisions.
- `tools/email_preview.py` renders every template and every announcement to
  files, sending nothing. It is the fast loop; a browser cannot tell you how
  Outlook renders a table, so send one real test to yourself before any list.
- `tools/email_run.py` is the hand-operated trigger: `--preflight`,
  `--audience [--campaigns]`, `--campaign NAME [--slug S] [--limit N]`. It runs
  the same selectors and guards as the route, and when `EMAIL_ENABLED` is true
  it refuses without `--yes` and tells you what it was about to do.
- Routes: `/api/email/unsubscribe` (public, HMAC token, no login — an opt-out
  that demands a login is not an opt-out), `/api/email/run` (the cron target),
  `/api/email/audience` (counts only, sends nothing), `/api/email/preflight`,
  `/api/email/test`. All but unsubscribe need `x-cron-secret`.

`emailLog` is **backend-only** in `firestore.rules`: it holds every recipient's
address *and* the locks that stop duplicate sends, so a client that could write
it could forge `sent` rows to silence a campaign or delete them to double-mail.

Nothing has been sent yet — as of 2026-09-12 the log is empty and no account
has unsubscribed. Read `/api/email/audience` before turning the flag on.

### Course intelligence (upload → plan)

A study-plan upload no longer goes straight from files to a generated plan. The
flow is `context form → live investigation → report → reveal → plan`, all inside
the `plan_onboarding` chat message:

- **The card is created at upload START**, not at `post_upload_message`. The
  four-field course form (school, course, professor, exam description, exam
  date) runs *concurrently* with document processing, which is what keeps it
  from being a pre-value question screen. `post_upload_message` then fills the
  same message in place — the id is held in `planOnboardingIdRef`.
- `POST /study/course-intelligence` streams the investigation: three concurrent
  Claude web-search passes (course, instructor, public resources) on Haiku 4.5,
  plus exam analysis and concept mapping on Sonnet. Roughly 20s end to end.
  `COURSE_RESEARCH_ENABLED=0` turns the web passes off and the run completes
  from her materials alone — a supported path, not a degraded one.
- **Everything carries a confidence**: `verified` (her upload, or an official
  page we cited), `public` (a credible public source we cited), `inference` (a
  pattern we noticed). `normalizeReport` may demote or drop; it may never
  promote. A researched section that cites nothing is DROPPED, not softened,
  and the instructor schema has no field capable of holding a personality or
  difficulty claim.
- The report's `study_strategy.ordered_topics` is what the planner builds from,
  which is what stops a plan following the order of the uploaded PowerPoint.
  `_order_units_by_priority` applies it, and only when there is no diagnostic —
  a measured gap outranks a predicted one.
- If any of this fails, `PlanOnboarding` falls back to the previous flow
  (`insights → first lesson → quick check → exam date`) intact, including the
  derived diagnostic. That fallback is covered by most of `PlanOnboarding.test.js`.

### Study mode

`StudyModeContainer` orchestrates: a plan is a list of nodes (`lesson`, `quiz`, `flashcard`, `mindmap`, `audio`, `exam`, plus non-node `banner` headers). Only the *first block* of the planner's output goes live (`firstBlock.js`); the rest is held in reserve and appended later, because a plan the student can finish is the point.

Pure logic is deliberately extracted into small tested modules next to the container — `studySchedule.js`, `readinessDelta.js`, `firstBlock.js`, `nodeReadout.js`, `knowledgeMapModel.js`, `coachMessageModel.js`, `studyHistoryModel.js`, `examNudgeModel.js`, `readinessProjection.js`, plus `Services/conceptLedger.js`. **Follow this pattern**: new derivation logic goes in a sibling `*.js` with a `*.test.js`, not inline in the component. The file headers explain *why* each exists, usually citing a specific bug or measured funnel — read the header before changing the maths.

Notably, the dated schedule and readiness numbers are **derived per render, never persisted**, and `conceptLedger` keys on the LLM-produced concept label rather than question text (a missing key is skipped, never fabricated).

## Conventions

- **Logging**: `devLog` / `devWarn` from `Services/devLogger.js` for anything routine — plain `console.log` ships to production. `console.error` is fine for real errors.
- **i18n**: everything user-facing goes through `react-i18next`. All copy lives in one 3.9k-line `src/i18n/i18n.js` with `en` and `fr` resource trees. Adding a string means adding it to **both**; missing French keys silently fall back to English.
- **CSS**: plain CSS files colocated per component, no CSS-in-JS. Colors come from the CSS variables in `src/index.css` (warm coral light palette, lavender dark). Dark mode is a `dark-mode` class on `<body>` observed via `MutationObserver` — every new surface needs its `body.dark-mode .foo` rules.
- **Typo to preserve**: the chat directory is `src/Components/ChatInerface/` (missing "t"). It is imported that way everywhere; don't "fix" it in passing.
- **Commits**: short, lowercase, imperative-ish (`change usage limit`, `show error`). No AI co-author trailer.

## Cross-repo contracts

Changing either side alone will break the UI in ways tests won't catch:

- `QUIZ_QUESTIONS` / `FLASHCARD_CARDS` / `DIAGNOSTIC_QUESTIONS` in `StudyModeContainer.js` mirror `STUDY_QUIZ_QUESTIONS` / `STUDY_FLASHCARD_CARDS` / `STUDY_DIAGNOSTIC_QUESTIONS` in `NQBackEnd2/main.py`. Drift makes progress bars stall short or finish early.
- The upload NDJSON stream's backend heartbeat interval vs the frontend's stall watchdog.
- `PLAN_BUDGETS` / `TIER_UNITS` / `SPRINT_MAX_DAYS` / `FOCUS_MAX_DAYS` / `GAP_MAX_PCT` / `SOLID_MIN_PCT` in `StudyMode/planPreviewModel.js` mirror the same names in `NQBackEnd2/main.py` (`_plan_archetype`, `_apply_budget`, `_weight_path_by_diagnostic`, `_tier_for_score`). This is the worst drift in the list: the model computes the **locked plan preview shown just before the paywall**, so a mismatch quotes a student "14 study sessions", takes her money, and delivers 8.
- `PRIORITY_WEIGHTS` and the `CONFIDENCE` values in `CourseIntelligence/courseIntelligenceModel.js` mirror the same names in `NQBackEnd2/services/course_intelligence.py`. The weights decide which topic the report names as the starting point; if the two sides disagree, the reveal promises one topic and the plan opens on another. A confidence value defined on one side only renders as an unstyled badge.
- The course-intelligence SSE heartbeat: `COURSE_INTELLIGENCE_HEARTBEAT_S` in `NQBackEnd2/main.py` (10s) against `CI_STALL_MS` in `Services/CourseIntelligenceService.js` (45s). Three web searches run concurrently server-side and can be silent for 30s, so the heartbeat is the only thing distinguishing a slow search from a dead backend. Same class of contract as the upload stream above.
- Stripe prices in `src/config/billing.js` are **display only**; the authoritative price is in Stripe. `usage.tier` is flipped exclusively by the backend webhook.
- `NODE_MINUTES` (and its `|| 4` fallback) in `StudyMode/planFormatting.js` mirrors `NODE_MINUTES` / `NODE_MINUTES_DEFAULT` in `NQBackEnd2/services/email_campaigns.py`. The email promises "about 4 minutes" for the first step; if the tables drift, the product contradicts that number on the first screen she lands on. `tests/test_email_campaigns.py` reads the real `planFormatting.js` and fails on drift, so this one is actually enforced — as long as the frontend file stays on the same machine.
- `isRealNode` in `StudyMode/firstBlock.js` (`type !== 'section_banner'`) mirrors `NON_STEP_NODE_TYPES` in `email_campaigns.py`. Step counts quoted in email come from it. The email side originally filtered `"banner"` — a type the planner never emits — so every section header counted as a step and the mail overstated the work to exactly the students who had not started because it looked long.

## Root markdown files

`AMAZING_EXPERIENCE_PLAN.md`, `PRO_CONVERSION_REVIEW_*.md`, `STUDY_PLAN_CONVERSION_PLAN.md`, `PHASE2_PLAN.md` and friends are working design/analysis docs with real production funnel numbers behind many of the decisions above. They are historical records, not specs — check the date before treating one as current.
