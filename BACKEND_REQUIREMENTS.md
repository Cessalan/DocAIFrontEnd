# Backend Requirements for Topic-Based Quiz System

## Overview
This document outlines the backend changes required to support the new topic-based quiz analytics feature in the frontend.

## Current Quiz Data Model
```python
{
    "question": str,           # The question text
    "options": List[str],      # Array of 4-6 answer choices
    "answer": str,             # Correct answer text (matches one of options)
    "justification": str,      # HTML explanation of why answer is correct
}
```

## Required Changes

### 1. Enhanced Quiz Data Model
Add a `topic` field to each quiz question:

```python
{
    "question": str,
    "options": List[str],
    "answer": str,
    "justification": str,
    "topic": str  # NEW FIELD - The topic/subject of this question
}
```

### 2. Topic Extraction Logic

#### Implementation Approach
When generating quiz questions, the AI should:

1. **Analyze the source content** to identify key topics/subjects
2. **Assign each question to a specific topic** based on:
   - The content area it tests
   - The knowledge domain it covers
   - The file section it was generated from

#### Example Topics
For a nursing course file about "Cardiovascular System", topics might include:
- "Heart Anatomy"
- "Blood Pressure Regulation"
- "Cardiac Medications"
- "Arrhythmias"
- "Heart Failure"

For a programming course file, topics might include:
- "Data Structures"
- "Algorithms"
- "Object-Oriented Programming"
- "Database Design"
- "API Development"

### 3. LLM Prompt Enhancement

Update the quiz generation prompt to include topic extraction:

```python
# Example prompt modification
prompt = f"""
Generate {num_questions} multiple-choice questions from the following content.

For EACH question, you must:
1. Create the question text
2. Provide 4-6 answer options
3. Specify the correct answer
4. Write a detailed justification
5. **IMPORTANT: Assign a specific topic/subject** that this question tests

Topics should be:
- Specific and descriptive (e.g., "Cardiac Medications" not "Medicine")
- Consistent across related questions
- Limited to 2-4 words maximum
- Based on the actual content being tested

Content:
{file_content}

Return JSON format:
[
  {{
    "question": "...",
    "options": ["A", "B", "C", "D"],
    "answer": "A",
    "justification": "...",
    "topic": "Specific Topic Name"
  }},
  ...
]
"""
```

### 4. WebSocket Streaming Format

Update the WebSocket streaming messages to include the topic field:

#### Current Format
```json
{
  "type": "quiz_question",
  "question": "...",
  "options": ["A", "B", "C", "D"],
  "answer": "A",
  "justification": "..."
}
```

#### New Format
```json
{
  "type": "quiz_question",
  "question": "...",
  "options": ["A", "B", "C", "D"],
  "answer": "A",
  "justification": "...",
  "topic": "Specific Topic Name"
}
```

### 5. File Insights Enhancement

Consider enhancing the file upload insights to include potential quiz topics:

```json
{
  "type": "insight_batch",
  "filename": "cardiovascular_system.pdf",
  "file_id": "...",
  "topics": ["Heart Anatomy", "Blood Pressure", "Cardiac Meds"],
  "concepts": ["..."],
  "document_type": "...",
  "suggested_quiz_topics": [  // NEW FIELD
    "Heart Anatomy",
    "Blood Pressure Regulation",
    "Cardiac Medications"
  ]
}
```

### 6. Topic Quality Guidelines

#### Good Topics
- ✅ "Neural Pathways" (specific, descriptive)
- ✅ "HTTP Methods" (clear, concise)
- ✅ "Cell Division" (focused topic)

#### Bad Topics
- ❌ "General Knowledge" (too broad)
- ❌ "Chapter 5" (not descriptive)
- ❌ "Q1" (meaningless)
- ❌ "Various Topics" (not specific)

### 7. Backward Compatibility

**IMPORTANT**: The frontend is designed to handle both old and new quiz formats:

- **Old quizzes** (without topics): Will display analytics without topic breakdown
- **New quizzes** (with topics): Will display full topic-based analytics

No migration of existing quizzes is required. The frontend will gracefully handle missing `topic` fields by grouping questions under a "General" category.

### 8. API Endpoint Changes

#### POST /chat/generate-quiz

**Request** (no changes):
```json
{
  "chat_id": "string",
  "filename": "string",
  "quiz_type": "mcq",
  "num_questions": 15,
  "language": "en"
}
```

**Response** (enhanced with topics):
```json
{
  "quiz_data": [
    {
      "question": "What is the primary function of the left ventricle?",
      "options": [
        "Pumps blood to the body",
        "Receives blood from lungs",
        "Pumps blood to lungs",
        "Receives blood from body"
      ],
      "answer": "Pumps blood to the body",
      "justification": "<p>The left ventricle pumps oxygenated blood to the systemic circulation...</p>",
      "topic": "Heart Anatomy"
    },
    {
      "question": "Which medication is a beta-blocker?",
      "options": ["Metoprolol", "Aspirin", "Warfarin", "Lisinopril"],
      "answer": "Metoprolol",
      "justification": "<p>Metoprolol is a selective beta-1 adrenergic blocker...</p>",
      "topic": "Cardiac Medications"
    }
  ]
}
```

## Implementation Checklist

- [ ] Update LLM prompt to request topic assignment for each question
- [ ] Add `topic` field to quiz question model/schema
- [ ] Update WebSocket streaming to include topic in each question
- [ ] Test topic extraction quality with various document types
- [ ] Ensure topic names are consistent across related questions
- [ ] Add validation to ensure topics are not empty strings
- [ ] Update API documentation
- [ ] Test with existing frontend (confirm backward compatibility)

## Testing Recommendations

### Test Cases

1. **Single Topic Document**
   - Upload a file about one specific topic
   - Verify all questions get the same or related topic names

2. **Multi-Topic Document**
   - Upload a comprehensive file covering multiple topics
   - Verify questions are distributed across appropriate topics
   - Check topic names are meaningful and distinct

3. **Backward Compatibility**
   - Test that old quizzes (without topics) still work
   - Verify frontend displays "General" for questions without topics

4. **Topic Quality**
   - Review generated topics for clarity and specificity
   - Ensure topics are not generic ("General", "Various", etc.)
   - Check topics are consistent in naming

5. **Edge Cases**
   - Very short documents (1-2 pages)
   - Very long documents (100+ pages)
   - Documents with unclear structure

## Expected Benefits

1. **Personalized Learning**
   - Students can identify specific weak areas
   - Targeted practice on problematic topics

2. **Better Insights**
   - Visual breakdown of performance by topic
   - Clear understanding of strengths and weaknesses

3. **Improved Engagement**
   - More actionable feedback
   - Motivating to see progress in specific areas

4. **Data-Driven Practice**
   - AI can generate quizzes focused on weak topics
   - Adaptive learning based on performance

## Example Output

For a cardiovascular system quiz, the backend should generate:

```json
[
  {
    "question": "What is the normal resting heart rate for adults?",
    "options": ["60-100 bpm", "40-60 bpm", "100-120 bpm", "120-140 bpm"],
    "answer": "60-100 bpm",
    "justification": "<p>The normal resting heart rate for adults ranges from 60 to 100 beats per minute...</p>",
    "topic": "Vital Signs"
  },
  {
    "question": "Which chamber receives oxygenated blood from the lungs?",
    "options": ["Left atrium", "Right atrium", "Left ventricle", "Right ventricle"],
    "answer": "Left atrium",
    "justification": "<p>The left atrium receives oxygenated blood from the pulmonary veins...</p>",
    "topic": "Heart Anatomy"
  },
  {
    "question": "What is the mechanism of action of ACE inhibitors?",
    "options": [
      "Block conversion of angiotensin I to II",
      "Block beta receptors",
      "Increase calcium excretion",
      "Dilate blood vessels directly"
    ],
    "answer": "Block conversion of angiotensin I to II",
    "justification": "<p>ACE inhibitors prevent the conversion of angiotensin I to angiotensin II...</p>",
    "topic": "Cardiac Medications"
  }
]
```

## Questions or Issues?

If you encounter any questions during implementation, please refer to:
- Frontend component: `QuizResultsAnalytics.js`
- Data model expectations: This document
- WebSocket handling: `WebSocketManager.js` in frontend

---

**Last Updated**: 2025-11-22
**Frontend Version**: Latest (with topic support)
**Status**: Ready for Backend Implementation
