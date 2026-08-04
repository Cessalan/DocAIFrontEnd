# Study Plan — Conversion & Retention Implementation Plan

Goal: turn the study plan from a single-session tool into a multi-day, measurable,
exam-dated commitment — and move the paywall from an interruption to an offer.

Ordered by conversion impact per hour of work. Waves are independently shippable;
nothing in Wave 2 blocks on Wave 1 landing, but the sequence is deliberate.

---

## Success metrics

Instrument these before Wave 1 so every later change has a baseline:

| Metric | Definition | Why |
|---|---|---|
| **First-plan completion rate** | % of new study sessions where the last node reaches `status: 'done'` | The aha moment. Everything downstream depends on it. |
| **D1 / D3 / D7 return rate** | % of plan owners who open a study node on day N | Wave 2's whole justification |
| **Paywall → checkout rate** | `startCheckout` clicks ÷ `UpgradeModal` opens, split by trigger reason | Wave 1's whole justification |
| **Paywall → "I'll wait" rate** | Close-without-click, split by `blocked` vs proactive | The metric Wave 1 item 1.2 is designed to move |
| **Nodes per session** | Nodes completed per continuous visit | Detects whether the throttle is cutting sessions short |

Add a thin `trackEvent(name, props)` wrapper (or reuse whatever
`handleTransitionAnalytics` at [StudyModeContainer.js:972](src/Components/StudyMode/StudyModeContainer.js#L972)
already feeds) and emit: `plan_created`, `node_completed`, `plan_completed`,
`paywall_shown`, `paywall_dismissed`, `checkout_started`.

---

## Wave 1 — Conversion hygiene

Small, contained, no schema migration. Ship as one PR per item.

### 1.1 Never wall the first plan

**Problem:** free users hit the 30-question / 3-hour wall roughly 3–4 nodes into
their very first plan, before they have experienced the product working. We trade
a likely conversion for nothing.

**Approach:** grant the user's *first* study session an unmetered pass until it
completes. Generation still charges quota (so the counter stays honest) but
`requireQuota` does not block inside the grace session.

**Changes:**

- `src/Services/UsageService.js`
  - Add `graceChatId` to the usage map read/write helpers. `deriveQuota(usage, now, ctx)`
    gains an optional `ctx = { chatId }`; when `ctx.chatId === usage.graceChatId`,
    return `canGenerate: true` regardless of `count`.
  - Keep `remaining` honest — only `canGenerate` is overridden, so the badge still
    shows the real number and the value of Pro stays visible.
- `src/Services/StudySessionService.js` → `createStudySession` ([line 39](src/Services/StudySessionService.js#L39))
  - After the chat update succeeds, set `users/{uid}.usage.graceChatId = chatId`
    **only if the field is absent** (transaction or `setDoc(..., {merge:true})`
    guarded by a read). First plan wins; never overwritten.
- `src/Contexts/UsageContext/UsageContext.js`
  - `requireQuota(ctx)` ([line 91](src/Contexts/UsageContext/UsageContext.js#L91))
    forwards `ctx` into `deriveQuota`.
- `src/Components/StudyMode/StudyModeContainer.js`
  - Both gate points — exam branch (~line 254) and the general node gate (~line 267) —
    pass `{ chatId }`.
- Clear the grace when the plan completes: in `completeNodeAndAdvance`
  ([line 294](src/Services/StudySessionService.js#L294)), when `isComplete` and this
  chat is the grace chat, unset `graceChatId`.

**⚠️ Firestore rules:** `users/{uid}` currently allows client writes to
`usage.count` / `usage.windowStart` but locks `tier` and the Stripe fields. Adding
`usage.graceChatId` requires the rules in `firestore.rules` to permit it. Verify
and redeploy, or the write silently fails and the grace never activates.
This is a hard prerequisite — test it explicitly.

**Acceptance:** a brand-new free account can complete an entire generated plan
end-to-end without seeing `UpgradeModal`; their second plan is throttled normally;
the usage badge counts down truthfully throughout.

**Effort:** ~½ day + rules verification.

---

### 1.2 Contextual paywall, de-emphasized countdown

**Problem:** [UpgradeModal.js:142-149](src/Components/Common/UpgradeModal.js#L142-L149)
renders the countdown prominently above the plans — advertising the free
alternative at the moment of decision. And the copy is generic ("unlimited
practice") when the app knows exactly what the user is 2 nodes away from finishing.

**Changes:**

- `src/Contexts/UsageContext/UsageContext.js`
  - Add `upgradeContext` state. `requireQuota(ctx)` and `openUpgrade(ctx)` stash
    `{ reason, sectionName, nodesLeftInSection, topicName, planDayIndex }`.
  - Pass it into `<UpgradeModal context={upgradeContext} />`.
- `src/Components/StudyMode/StudyModeContainer.js`
  - At both gate points, build the context from the node being started: its
    section name (reuse `getBaseTopic` / `buildSections` output), how many nodes
    remain in that section, and the plan day once Wave 2 lands.
- `src/Components/Common/UpgradeModal.js`
  - New headline/subtitle branch when `context.reason === 'study_node'`:
    *"You're 2 nodes from finishing Antibiotics."* / *"Pro finishes the section now."*
  - **Countdown demotion:** when `examSoon` (already computed at
    [line 106](src/Components/Common/UpgradeModal.js#L106)) is true, render the
    countdown as a small inline link *below* the plan buttons instead of the
    current `.upgrade-countdown` block. When the exam is inside 72h, "wait 3 hours"
    is not a real option and giving it equal weight costs conversions.
  - Keep the full comparison table — it's good and stays.
- `src/i18n/i18n.js` — new keys under `upgrade.*` for the contextual variants, en + fr.

**Acceptance:** blocking mid-section shows the section name and remaining node
count; with an exam <72h away the countdown is visually subordinate to the plans.
`paywall_shown` events carry the trigger reason.

**Effort:** ~1 day including fr copy.

---

### 1.3 Surface the readiness score as a *forward projection*

**Problem:** `buildReadinessSnapshot` ([StudyPlanOverview.js:318](src/Components/StudyMode/StudyPlanOverview.js#L318))
computes a coverage-aware `overallPct` that is never rendered — the dashboard
deliberately flattens to binary "Locked in / Ready to explore"
([line 917](src/Components/StudyMode/StudyPlanOverview.js#L917)). The empathy
intent is right; removing the *gap* entirely also removes the purchase motive.

**Approach:** show the number, but forward-framed. Current predicted score +
projected score if the plan is finished. Never "you are weak at X".

**Changes:**

- New `src/Components/StudyMode/ReadinessCard.jsx` + `.css`
  - Renders: **"Predicted: 68%"** with an arc/bar, and **"→ 84% if you finish your plan"**
    as a ghosted target on the same track.
  - Projection model (keep it simple and defensible): assume each remaining
    untested topic lands at the mean of the user's measured topics, and each
    measured topic below target gains a fixed delta per remaining node targeting it.
    Cap the projection at 92% so it never overpromises.
- `src/Components/StudyMode/StudyPlanOverview.js`
  - Render `ReadinessCard` above `WarmUrgencyDashboard`. Keep the dashboard —
    it does the emotional work; the card does the *measurement* work.
  - **Apply the honesty guard:** `MIN_QUESTIONS_THRESHOLD` at
    [line 150](src/Components/StudyMode/StudyPlanOverview.js#L150) is currently
    declared and never used. Gate the card on
    `snap.totalQuestions >= MIN_QUESTIONS_THRESHOLD`; below that show
    "Answer a few more questions to see your predicted score" — which is itself
    a pull into the next node.
- `src/Components/Common/UpgradeModal.js`
  - When the modal opens from study mode, include the projection in the pitch:
    *"You're on track for 84% — Pro keeps you moving."*

**Acceptance:** card hidden below 10 answered questions; visible and stable after;
projection always ≥ current and ≤ 92%; no deficit vocabulary anywhere in the copy.

**Effort:** ~1–1.5 days.

---

### 1.4 Plan-page polish (cheap, compounding)

All in `src/Components/StudyMode/StudyPlanOverview.js` / `StudyMode.css`:

- **Retire the padlocks.** [line 556](src/Components/StudyMode/StudyPlanOverview.js#L556)
  and the section-level lock at [line 658](src/Components/StudyMode/StudyPlanOverview.js#L658)
  put 🔒 on every not-yet-reached node. In a freemium app that reads as *paywalled*,
  so a fully-free plan looks 80% locked. Replace with a dimmed step number chip
  ("Step 4") — same sequencing signal, no false paywall.
- **Show time per section.** `getNodeEstimate` at
  [line 124](src/Components/StudyMode/StudyPlanOverview.js#L124) is dead code.
  Sum it per section and render "~18 min" in `.sov3-card__summary` for active and
  locked sections. Students schedule around minutes.
- **Name the plan.** The title falls back to `topics[0]`
  ([line 865](src/Components/StudyMode/StudyPlanOverview.js#L865)). Render
  `"{planName} · {examDate}"` — e.g. "Pharm Final · Aug 11". Store `study.planName`
  on the chat doc, defaulting to the current derivation, editable inline later.

**Effort:** ~½ day total.

---

## Wave 2 — The retention engine

This is the wave that justifies a *subscription* rather than a one-time purchase.

### 2.1 Dated, day-by-day plan

**Problem:** `examDate` is captured in [PlanOnboarding.js:44](src/Components/ChatInerface/PlanOnboarding.js#L44)
and only switches copy tone via `computeTier`
([WarmUrgencyDashboard.js:39](src/Components/StudyMode/WarmUrgencyDashboard.js#L39)).
The plan itself is an undated list.

**Good news:** `examDate` already reaches `StudyModeContainer` from the chat doc
([line 102](src/Components/StudyMode/StudyModeContainer.js#L102)) and flows to
`StudyPlanOverview`. **The schedule is a pure client-side derivation over existing
nodes — no backend change required.**

**Changes:**

- New `src/Components/StudyMode/planSchedule.js`
  - `buildSchedule(nodes, examDate, opts)` → `[{ dayIndex, date, nodeIds, estMinutes, status }]`
  - Algorithm: total estimated minutes ÷ days remaining, packed greedily into days
    with a soft daily cap (default 30 min; 45 when `tier === 'urgent'`), never
    splitting a section across more days than it has nodes, and reserving the final
    day for mini-tests/review. Degrades to a single "Today" bucket when `examDate`
    is null — the component must not require a date.
  - Recompute on load rather than persisting, so a missed day re-packs automatically
    instead of leaving the student behind a stale schedule. Persist only
    `study.schedule.dayCompletions` (`{ [isoDate]: nodeIdsDone }`) for streaks.
- `src/Components/StudyMode/StudyPlanOverview.js`
  - Group `renderOrder` by schedule day. Day headers: **"Today · Day 3 of 9 · 18 min"**.
    Future days collapsed by default, past days collapsed with a completion summary.
  - Today's group auto-expands and takes the `activeSectionRef` scroll target
    (replacing the current active-section scroll at [line 448](src/Components/StudyMode/StudyPlanOverview.js#L448)).
- `src/Components/StudyMode/StartStudyModal.js` → `PlanPreviewPane` ([line 363](src/Components/StudyMode/StartStudyModal.js#L363))
  - Change the pitch from "N steps · about M min total" to
    **"Your 9-day plan — 18 min a day, done by Aug 11."** This is the single
    highest-value copy change in the document; it reframes the product at the
    moment of commitment.

**Acceptance:** a plan with an exam 9 days out renders 9 day-groups summing to all
nodes; a plan with no exam date renders one "Today" group and nothing breaks;
skipping two days re-packs the remainder without orphaning nodes.

**Effort:** ~2–3 days. Highest-risk item in the document — the packing algorithm
needs real fixtures (1-day cram, 3-day, 30-day, no-date) before it ships.

---

### 2.2 Return nudge

**Changes:**

- `src/Services/StudyReminderService.js` (new)
  - On plan creation, ask for `Notification` permission *after* the first node is
    completed — never on load; a cold permission prompt burns the grant.
  - Schedule a local notification for the next incomplete day.
- Email fallback for the majority who decline the browser prompt: a scheduled
  backend job in `NQBackEnd2` that queries study sessions with an incomplete day
  older than 24h and an exam still ahead, and sends "Day 3 is ready — 15 min on
  Cardiac." Requires an email provider decision (Resend/SendGrid) — **flagged as an
  open decision below.**
- Add a "Remind me" toggle to the plan header so it's user-controlled and revocable.

**Acceptance:** opting in produces a notification on the next incomplete day; the
toggle genuinely stops all sends; no reminders after the exam date passes.

**Effort:** ~1 day client-side; backend email is a separate ~2-day task gated on
the provider decision.

---

## Wave 3 — Pro value & growth

### 3.1 Exam-day pack (Pro-gated)

A one-page printable PDF generated from data you already store: weakest topics from
`getStudyPerformance` ([StudySessionService.js:904](src/Services/StudySessionService.js#L904)),
`missedConcepts` (already captured, capped at 20 per topic), and high-yield facts
per topic.

- New backend endpoint `/study/exam-pack` in `NQBackEnd2/main.py` returning
  structured sections; render client-side to PDF (`react-pdf` or print stylesheet).
- Gate behind `isPro`; free users see a blurred preview of page 1 with the real
  topic names visible — the tease has to be genuinely theirs to work.

**Why it converts:** the pack is the first thing in the product a student *keeps*.
It also converts at a different moment than the throttle does — the night before
the exam, when willingness to pay peaks.

**Effort:** ~3 days.

### 3.2 Share card + study group

- **Share card:** render the readiness projection as an image
  ("78% ready for my Pharm final · 4 days out") with a link back. Reuse whatever
  `ShareQuizButton` already does for quiz sharing.
- **Study group:** invite links that let a small cohort see each other's topic
  coverage on a shared plan. Nursing students study in cohorts — this is the
  cheapest distribution available to you, into exactly the population already
  adopting the product organically.

**Effort:** share card ~1 day; groups are a genuine feature, ~1 week+. Scope groups
separately after Wave 2 data comes in.

---

## Cross-cutting prerequisites

1. **Currency display — verified OK, no action.** Both plans declare
   `symbol: 'CA$'` / `currency: 'CAD'` in [billing.js:18-45](src/config/billing.js#L18-L45),
   and the `upgrade.perMonthSave` key renders `CA$` in en and `$ CA` in fr. The
   UpgradeModal fallback `{plan.symbol || '$'}` never fires with the current plan
   list. Listed here only to close out a previously-open launch blocker.
2. **Firestore rules** must permit `usage.graceChatId` (1.1) and
   `study.schedule.*` / `study.planName` (2.1) before those writes will land.
3. **i18n:** every string above needs en + fr. The codebase is consistently
   `t(key, fallback)` — follow it.
4. **Analytics** (see Success metrics) before Wave 1 merges.

---

## Open decisions

These need your call; I've noted the default I'd take.

| # | Decision | My default |
|---|---|---|
| 1 | Email provider for reminders (2.2) | Resend — cheapest to wire, good deliverability |
| 2 | Does the readiness projection cap at 92% or show 100%? | 92%. Never promise a perfect score. |
| 3 | Daily minute cap for scheduling (2.1) | 30 min normal, 45 min urgent, user-adjustable later |
| 4 | Does the first-plan grace apply per-account or per-plan? | Per-account, first plan only |
| 5 | Ship 3.2 groups at all, or watch Wave 2 retention first? | Wait for Wave 2 data |

---

## Suggested sequencing

```
Week 1   analytics · 1.1 first-plan grace · 1.4 polish
Week 2   1.2 contextual paywall · 1.3 readiness card
Week 3-4 2.1 dated plan  ← measure D1/D3/D7 before and after
Week 5   2.2 reminders (client) · backend email if provider decided
Week 6+  3.1 exam pack, then reassess 3.2 on retention data
```

Wave 1 should move paywall→checkout rate and first-plan completion within days of
shipping. If Wave 1 does not move first-plan completion, do not build Wave 2 —
the problem is upstream in plan quality, not in scheduling.
