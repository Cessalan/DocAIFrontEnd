# Flashcards in main chat

`ChatMessage` renders `FlashcardPractice` for both saved and streamed decks. The old
`ChatFlashcard` remains available to other consumers; the main chat no longer uses
its numbered modal. No generation quota is consumed by reviewing existing cards.

The launch card takes a meaningful topic from the deck or card topics, suppresses
legacy prompt placeholders, and opens a focused, responsive paper view. English
and French copy, reduced motion, focus containment, Escape, and focus restoration
are supported. Long answers use natural height inside a scrolling workspace.

## Review state

`flashcardReview` on the existing message contains `ratings`, `session`, and
card-specific `discussions`. The session saves queue, cursor, revealed state,
first-pass ratings, and a list of cards already repeated. Again/Almost append one
retry at most per round. A retry never replaces the first-pass result.

Again is due in 10 minutes; Almost in one day; Got it in 1, 2, 4… days, capped at
30 days based on consecutive Got it ratings. Due dates are available on returning
to the deck. These are review dates, not scheduled notifications. Ratings are
self-reported recall, not measured quiz correctness or proof of mastery.

Saving resolves legacy document IDs and uses a Firestore transaction to merge
the review and update legacy card review fields without replacing newly streamed
cards or changing the message timestamp. Writes wait until generation finishes.
Failures surface a retry-save action. Another user's chat is preview-only.

## Tutor

`POST /flashcards/tutor` is registered by `services/practice_api.py` in NQBackEnd2.
It verifies Firebase authentication and conversation ownership, resolves the card
from the saved message, and calls `services/flashcard_tutor.py`. Before reveal,
the model receives only the card front and hint/rephrase intent. The answer,
stored hint, and previous discussion are omitted. An output guard replaces
recognizable answer leaks with a process hint. After reveal, the tutor can explain
the saved answer. It does not generate cards or alter allowances.

## Validation

Tests cover recall queues, schedules, serialization/resume, late streamed cards,
answer reveal, tutor identity/context, read-only viewing, legacy topic cleanup,
main-chat rendering, and transaction-safe persistence. The visual fixture at
`node scripts/preview-flashcard-practice.cjs` is explicitly simulated; use the app
on port 3000 for authenticated use. Port 4183 is only for visual review.
