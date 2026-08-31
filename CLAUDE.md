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
- Stripe prices in `src/config/billing.js` are **display only**; the authoritative price is in Stripe. `usage.tier` is flipped exclusively by the backend webhook.

## Root markdown files

`AMAZING_EXPERIENCE_PLAN.md`, `PRO_CONVERSION_REVIEW_*.md`, `STUDY_PLAN_CONVERSION_PLAN.md`, `PHASE2_PLAN.md` and friends are working design/analysis docs with real production funnel numbers behind many of the decisions above. They are historical records, not specs — check the date before treating one as current.
