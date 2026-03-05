# Multi-Phase Study Plan: Phase 2 Review Generation

## Context
Users complete a study plan (lesson/flashcard/quiz nodes per topic). Currently when done, they navigate away. Instead, we want to offer a **second study plan underneath** — a personalized review round based on performance insights (weak topics, missed concepts) from the first plan. This mirrors Duolingo's section system where completing one section reveals the next.

---

## UX Flow
1. User completes the last node of phase 1
2. Overview shows all nodes done + a **celebration card** at the bottom: "Continue with a personalized review?"
3. User clicks the button → loading state → backend generates review plan
4. New nodes appear below a Duolingo-style section banner separator
5. User progresses through phase 2 normally
6. When phase 2 completes → session truly done → navigate away

---

## Data Model (Backward Compatible)

Add optional fields to existing Firestore `chats/{chatId}.study`:
- `currentPhase: 1` (default 1)
- `totalPhases: 1` (default 1)

Each node gains optional `phase: 1|2` field (defaults to 1 if absent). A pseudo-node `{ type: 'section_banner', phase: 2 }` is inserted between phases in the flat nodes array. `completeNodeAndAdvance` skips banner nodes.

**Firestore structure after phase 2 is appended:**
```
chats/{chatId}.study: {
  status: 'active',
  currentPhase: 2,
  totalPhases: 2,
  path: {
    topics: ["Topic A", "Topic B", "Topic C"],
    activeNodeId: "review-abc123",
    totalNodes: 25,
    nodes: [
      // Phase 1 nodes (all done)
      { id: "node_1", type: "lesson", label: "Topic A", phase: 1, status: "done", ... },
      { id: "node_2", type: "flashcard", label: "Topic A", phase: 1, status: "done", ... },
      { id: "node_3", type: "quiz", label: "Topic A", phase: 1, status: "done", ... },
      ...
      // Section banner pseudo-node
      { id: "section_banner_2", type: "section_banner", label: "Weak Topics Review", phase: 2, status: "banner" },
      // Phase 2 nodes (review-focused)
      { id: "review-abc123", type: "lesson", label: "Topic A (Review)", phase: 2, status: "active", ... },
      { id: "review-def456", type: "flashcard", label: "Topic A (Review)", phase: 2, status: "locked", ... },
      ...
    ]
  },
  askedHashes: [...]
}
```

**Performance data location (already exists):**
```
users/{uid}/studyPerformance/{chatId}: {
  topics: {
    "Topic A": {
      questionsCorrect: 2, questionsTotal: 5,
      flashcardsMastered: 3, flashcardsTotal: 6,
      missedConcepts: ["Concept X", "Concept Y"],
      strengthLevel: "weak"
    },
    "Topic B": { ... strengthLevel: "strong" },
    "Topic C": { ... strengthLevel: "developing" }
  }
}
```

---

## Implementation Steps

### Step 1: Backend — `/study/plan-review` endpoint
**File:** `c:\Users\Billion\Desktop\NQBackEnd\NQBackEnd2\main.py` (after `/study/plan` ~line 2812)

New endpoint accepts:
```python
class StudyReviewPlanRequest(BaseModel):
    chat_id: str
    language: str = "en"
    performance: dict   # The full studyPerformance doc from Firestore
    original_topics: List[str] = []
```

**Logic:**
1. Load session & vectorstore (same `chat_id`, same documents)
2. Parse the `performance` data to categorize topics:
   - **Weak** (< 60% accuracy): Full re-teach needed
   - **Developing** (60-84%): Reinforcement needed
   - **Strong** (85%+): Quick confidence check
3. Build a prompt for the LLM:

```
Create a REVIEW study path for a student who just completed their first study round.

PERFORMANCE DATA:
- Topic "Pharmacology": WEAK (40% accuracy). Missed: "ACE inhibitor mechanism", "Beta-blocker side effects"
- Topic "Anatomy": DEVELOPING (70% accuracy). Missed: "Cardiac output calculation"
- Topic "Pathophysiology": STRONG (90% accuracy). No issues.

STRUCTURE RULES:
1. WEAK topics: LESSON → FLASHCARD → QUIZ (full unit, lessons re-explain using different examples, flashcards focus on MISSED CONCEPTS)
2. DEVELOPING topics: FLASHCARD → QUIZ only (reinforce weak spots)
3. STRONG topics: Single QUIZ node (confidence check)
4. Order: weakest topics first, strongest last
5. Total: 6-12 nodes
6. All nodes get tag "review"

CRITICAL: Focus content on the MISSED CONCEPTS listed above.

Return ONLY valid JSON array of nodes.
```

4. Return same format as `/study/plan`: `{ nodes[], topics[], total_nodes, estimated_time_minutes }`

### Step 2: Frontend API call
**File:** `c:\Users\Billion\Desktop\ragfrontend\src\Services\FastAPICalls.js`

Add new function:
```javascript
export const plan_review_path = async (chat_id, performance, original_topics, language = 'en') => {
  const response = await fetch(`${FAST_API_BASE}/study/plan-review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id, performance, original_topics, language })
  });
  if (!response.ok) throw new Error(`Review plan failed: ${response.status}`);
  return await response.json();
};
```

### Step 3: Firestore service changes
**File:** `c:\Users\Billion\Desktop\ragfrontend\src\Services\StudySessionService.js`

**3a. New function `appendPhase2(chatId, reviewPathResult)`:**
- Reads existing nodes from Firestore
- Creates a `section_banner` pseudo-node
- Appends phase 2 nodes (with `phase: 2`, first one `active`, rest `locked`)
- Updates Firestore: `study.status = 'active'`, `currentPhase = 2`, `totalPhases = 2`, new `activeNodeId`
- Returns updated studyState object

**3b. Modify `completeNodeAndAdvance` (~line 291-354):**
When finding the next node index, skip `section_banner` type nodes:
```javascript
let nextIndex = currentIndex + 1;
// Skip section_banner pseudo-nodes
while (nextIndex < nodes.length && nodes[nextIndex].type === 'section_banner') {
  nextIndex++;
}
```
This is backward compatible — existing sessions have no banner nodes, so the loop never executes.

**3c. Modify `getStudySession` return (~line 189-211):**
Include new phase fields with backward-compatible defaults:
```javascript
return {
  ...existingFields,
  currentPhase: data.study?.currentPhase || 1,
  totalPhases: data.study?.totalPhases || 1
};
```

### Step 4: StudyModeContainer — Phase transition logic
**File:** `c:\Users\Billion\Desktop\ragfrontend\src\Components\StudyMode\StudyModeContainer.js`

**New state variables:**
```javascript
const [showPhase2Prompt, setShowPhase2Prompt] = useState(false);
const [isGeneratingPhase2, setIsGeneratingPhase2] = useState(false);
```

**Modify `handleContinue` (~line 503):**
When `result.isComplete`:
- If `currentPhase === 1 && totalPhases === 1`: set `showPhase2Prompt = true`, switch to overview. Do NOT call `onComplete()`.
- If `currentPhase >= 2`: call `onComplete()` (truly done, navigate away)

**New function `handleStartPhase2`:**
```javascript
const handleStartPhase2 = useCallback(async () => {
  setShowPhase2Prompt(false);
  setIsGeneratingPhase2(true);
  try {
    const performance = await getStudyPerformance(chatId);
    if (!performance?.topics || Object.keys(performance.topics).length === 0) {
      onComplete?.(); return;  // No data, skip phase 2
    }
    const reviewPath = await plan_review_path(chatId, performance, studyState?.path?.topics || [], language);
    if (!reviewPath?.nodes?.length) {
      onComplete?.(); return;  // Empty plan, skip
    }
    const updated = await appendPhase2(chatId, reviewPath);
    setNodes(updated.path.nodes);
    setActiveNodeId(updated.path.activeNodeId);
    setIsComplete(false);
  } catch (error) {
    console.error('Phase 2 generation failed:', error);
    onComplete?.();  // Fallback: complete normally
  } finally {
    setIsGeneratingPhase2(false);
  }
}, [chatId, studyState, language, onComplete]);
```

**Pass new props to StudyPlanOverview:**
```jsx
<StudyPlanOverview
  studyState={currentStudyState}
  onNodeSelect={handleNodeSelect}
  onShowInsights={handleMascotClick}
  sidebarOpen={sidebarOpen}
  showPhase2Prompt={showPhase2Prompt}
  isGeneratingPhase2={isGeneratingPhase2}
  onStartPhase2={handleStartPhase2}
/>
```

### Step 5: StudyPlanOverview — Banner + Prompt card
**File:** `c:\Users\Billion\Desktop\ragfrontend\src\Components\StudyMode\StudyPlanOverview.js`

**5a. Handle `section_banner` node type in `nodes.map()`:**
```jsx
if (node.type === 'section_banner') {
  return (
    <div key={node.id} className="study-section-banner">
      <div className="study-section-banner__badge">SECTION 2</div>
      <h2 className="study-section-banner__title">{t('study.reviewRound', 'Review Round')}</h2>
      <p className="study-section-banner__subtitle">{node.label}</p>
    </div>
  );
}
```

**5b. After the nodes list, render phase 2 prompt or loading:**
```jsx
{/* Phase 2 prompt — shown when phase 1 completes */}
{showPhase2Prompt && (
  <div className="study-phase2-prompt">
    <div className="study-phase2-prompt__celebration">🎉</div>
    <h3>{t('study.planComplete', 'Study Plan Complete!')}</h3>
    <p>{t('study.reviewDescription', "Based on your performance, I've prepared a personalized review to strengthen your weak areas.")}</p>
    <button onClick={onStartPhase2}>
      {t('study.continueWithReview', 'Continue with Review')}
    </button>
  </div>
)}

{/* Phase 2 generating state */}
{isGeneratingPhase2 && (
  <div className="study-phase2-loading">
    <div className="study-loading-spinner" />
    <p>{t('study.generatingReviewPlan', 'Creating your personalized review...')}</p>
  </div>
)}
```

### Step 6: CSS
**File:** `c:\Users\Billion\Desktop\ragfrontend\src\Components\StudyMode\StudyMode.css`

- **Section banner**: Duolingo-style gradient banner (warm terracotta/coral), rounded corners, white text, `SECTION 2` badge, title, subtitle. Dark mode variant.
- **Phase 2 prompt card**: Centered card with celebration icon, description text, CTA button (warm gradient). Appears after last phase 1 node.
- **Phase 2 loading**: Spinner + text below the path.

### Step 7: i18n
**File:** `c:\Users\Billion\Desktop\ragfrontend\src\i18n\i18n.js`

**English:**
```
reviewRound: "Review Round",
planComplete: "Study Plan Complete!",
reviewDescription: "Based on your performance, I've prepared a personalized review to strengthen your weak areas.",
continueWithReview: "Continue with Review",
generatingReviewPlan: "Creating your personalized review...",
sectionLabel: "SECTION {{number}}"
```

**French:**
```
reviewRound: "Tour de révision",
planComplete: "Plan d'étude terminé !",
reviewDescription: "Selon ta performance, j'ai préparé une révision personnalisée pour renforcer tes points faibles.",
continueWithReview: "Continuer avec la révision",
generatingReviewPlan: "Création de ta révision personnalisée...",
sectionLabel: "SECTION {{number}}"
```

---

## Critical Files Summary

| File | What Changes |
|------|-------------|
| `NQBackEnd2/main.py` | New `/study/plan-review` endpoint with performance-aware prompt |
| `src/Services/FastAPICalls.js` | New `plan_review_path()` function |
| `src/Services/StudySessionService.js` | New `appendPhase2()`, modify `completeNodeAndAdvance` (skip banners), update `getStudySession` |
| `src/Components/StudyMode/StudyModeContainer.js` | `handleStartPhase2`, modify `handleContinue`, new state vars |
| `src/Components/StudyMode/StudyPlanOverview.js` | Render section banners, phase 2 prompt card, loading state |
| `src/Components/StudyMode/StudyMode.css` | Banner, prompt card, loading styles |
| `src/i18n/i18n.js` | EN + FR keys for phase 2 UI |

---

## Verification Checklist
- [ ] Complete a study session (all nodes done) → celebration + "Continue with Review?" prompt appears
- [ ] Click prompt → loading spinner → review plan generates → section banner + new nodes appear below
- [ ] Phase 2 nodes are weighted toward weak topics (verify backend prompt/response)
- [ ] Progress through phase 2 normally (start nodes, answer questions, etc.)
- [ ] Complete phase 2 → navigates away (truly done)
- [ ] Reload browser mid-phase-2 → resumes correctly from Firestore
- [ ] Load an old completed session → no errors, no phase 2 prompt (backward compat)
- [ ] Existing active sessions unaffected (no `phase` field = treated as phase 1)

---

## Edge Cases
- **No performance data** (e.g. viewOnly mode): Skip phase 2, complete normally
- **All topics strong**: Backend still generates a short confidence-check plan (quiz-only nodes). If truly empty, skip phase 2.
- **Backend error**: Catch error, fallback to normal completion
- **User exits mid-generation**: On reload, detect incomplete state and either retry or show prompt again
