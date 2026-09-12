# Completed practice review

Closing an owned focused quiz requests a review only when all loaded questions have submitted answers, the permitted question total is reached, and no question batch is pending. Early exits and read-only previews do not request it.

`FocusedQuiz` flushes its queued practice save before `ChatInterface` calls authenticated `POST /quiz/debrief` with `chat_id`, `message_id`, and `language`. The main chat shows a temporary review message while waiting, or a retry action on failure. A chat switch prevents a response from appearing in the wrong conversation.

The backend reads the saved quiz and validates ownership and completion. It uses saved first answers/first-attempt statuses separately from corrected answers and tutor discussions. Older sessions without first-attempt evidence show a plain score without claiming it was the first attempt. The numeric score is computed in code. When the score is above zero, the model returns Good, Review, and Next time. At zero, the backend drops Good and shows only Review and Next time, even if the model returns a positive claim. A deterministic fallback follows the same rule.

A deterministic Firestore document ID identifies the quiz document plus question count. A transaction publishes only one assistant review for that completed question set. Reopening and closing the same set reuses the saved review. Completing an extended set permits a new review.

Although Firestore timestamps a newly generated review at the time it is created, the chat display groups it directly after its `sourceQuizId`. This keeps reviews for older quizzes beside the relevant quiz without changing the order of other conversation messages. If the source quiz is unavailable, the review remains in chronological order.

Review my mistake expands existing feedback without generating questions. Practice this topic routes an explicit request through the normal metered chat flow. Debrief generation itself does not reserve question quota.

Verification: FocusedQuiz.test.js, PracticeDebrief.test.js, ChatMessage.practice.test.js; backend tests/test_practice_debrief_evidence.py. The local preview uses sample review text and no account/API calls; it does not validate live model output.
