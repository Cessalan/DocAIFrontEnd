# Implementation Plan: Dedicated Quiz Experience with Mascot & Serum Tube

## Overview
Create a new dedicated quiz view component that enhances user engagement through:
1. The mascot tracking user hover on answer options
2. A large animated "Serum Tube" that fills up as users answer correctly

## New Components to Create

### 1. `SerumTube.js` - Gamification Progress Indicator
A science test tube SVG component that visually fills with liquid as the user answers correctly.

**Features:**
- Tall vertical test tube with laboratory aesthetic (glass effect, cork/stopper, measurement marks)
- Liquid fills from bottom to top based on correct answer percentage
- Bubbling animation when liquid rises (on correct answer)
- Glowing effect when full (100% correct)
- Integration with the purple/pink theme from existing quiz styles
- Celebration particles when reaching milestones (25%, 50%, 75%, 100%)

**Props:**
- `correctCount` - number of correct answers
- `totalQuestions` - total questions in quiz
- `isAnimating` - trigger fill animation on correct answer
- `size` - tube dimensions (default ~300px height)

### 2. `DedicatedQuizView.js` - Main Quiz Experience Component
A fullscreen/dedicated quiz page that combines the existing quiz logic with the new interactive elements.

**Layout (Desktop):**
```
┌────────────────────────────────────────────────────────┐
│  Header: "Preview • Serum Tube Gamification"           │
├──────────────────────┬─────────────────────────────────┤
│                      │                                 │
│   ┌──────────────┐   │   Question X of Y               │
│   │              │   │   [Topic Badge]                 │
│   │  SERUM TUBE  │   │                                 │
│   │              │   │   Question text goes here...    │
│   │   ▓▓▓▓▓▓▓▓   │   │                                 │
│   │   ▓▓▓▓▓▓▓▓   │   │   [A] Option one                │
│   │   ▓▓▓▓▓▓▓▓   │   │   [B] Option two                │
│   │   ░░░░░░░░   │   │   [C] Option three   ← MASCOT   │
│   │   ░░░░░░░░   │   │   [D] Option four     LOOKS AT  │
│   └──────────────┘   │                       HOVERED   │
│                      │                                 │
│   MASCOT (heart)     │   [Feedback area when answered] │
│   looking at answers │                                 │
│                      │   [Next Question →]             │
└──────────────────────┴─────────────────────────────────┘
```

**Features:**
- Mascot positioned to the side of quiz, eyes tracking which answer option is hovered
- Mascot expressions: excited when hovering, extra happy on correct, sad shake on incorrect
- Serum tube fills with satisfying animation when answering correctly
- Sound effects (optional, can be toggled)
- Progress tracking persists

### 3. CSS File: `DedicatedQuizView.css`
Styling for the new dedicated view with:
- Dark theme matching screenshot (dark gradient background)
- Glassmorphic answer cards
- Smooth hover transitions
- Responsive layout for mobile (stacks vertically)

## Implementation Details

### Mascot Answer Tracking Logic
```javascript
// State for tracking hovered answer
const [hoveredAnswerIndex, setHoveredAnswerIndex] = useState(null);

// Map answer index to look direction for mascot
const getLookDirection = (answerIndex, totalAnswers) => {
  // Answers are stacked vertically, so mascot looks at different vertical positions
  // A (0) → 'up' or 'down-left'
  // B (1) → 'down-left'
  // C (2) → 'down-center'
  // D (3) → 'down-right'
  const directions = ['up', 'down-left', 'down-center', 'down-right'];
  return directions[answerIndex] || 'center';
};
```

### Serum Tube Fill Calculation
```javascript
const fillPercentage = (correctCount / totalQuestions) * 100;
// Animate from current to new percentage when correct answer given
```

### Integration with Existing Quiz System
- Reuse `ChatQuiz.js` logic for answer handling
- Import `NurseQuizMascot` component
- Use existing quiz state management patterns

## File Structure
```
src/Components/QuizRoom/
├── QuizRoomLanding.js (existing)
├── QuizRoomLanding.css (existing)
├── NurseQuizMascot.js (existing - will use)
├── BrainMascot.js (existing)
├── DedicatedQuizView.js (NEW)
├── DedicatedQuizView.css (NEW)
└── SerumTube.js (NEW)
```

## Implementation Steps

1. **Create SerumTube.js component**
   - SVG test tube with gradient fills
   - Liquid fill animation (CSS transitions + keyframes)
   - Bubble particles on fill
   - Measurement markings
   - Glow effect at milestones

2. **Create DedicatedQuizView.js**
   - Layout structure with mascot sidebar and quiz main area
   - Import and position NurseQuizMascot
   - Wire up answer hover → mascot look direction
   - Integrate SerumTube with correct answer tracking
   - Handle quiz state (current question, answers, score)

3. **Create DedicatedQuizView.css**
   - Dark theme background
   - Glassmorphic answer cards
   - Responsive breakpoints
   - Animation keyframes for tube filling, bubbles, celebrations

4. **Wire up routing/navigation**
   - Add route or modal trigger for dedicated quiz view
   - Pass quiz data to the component

## Visual Design Notes (from screenshot)
- Background: Dark gradient (#0d0d10 → #15151a → #1a1a20)
- Answer cards: Semi-transparent with subtle border
- Active/hover state: Brighter border, slight glow
- Typography: Clean sans-serif, white text
- Topic badge: Small pill-shaped tag above question

## Questions for User (if needed)
1. Should the serum tube have specific milestone rewards (e.g., badges at 50%, 100%)?
2. Should there be sound effects?
3. Where should this dedicated view be accessed from? (Modal from existing quiz, separate route, etc.)
