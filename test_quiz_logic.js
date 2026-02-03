
const testLogic = (quizData) => {
    return quizData.map(q => {
        // Determine correctIndex - multiple strategies
        let correctIndex = -1;

        // Get the answer field - could be 'answer', 'correct_answer', or 'correctAnswer'
        const answerValue = q.answer ?? q.correct_answer ?? q.correctAnswer;

        // Strategy 1: If correctIndex is already provided as a number
        if (typeof q.correctIndex === 'number') {
            correctIndex = q.correctIndex;
        }
        // Strategy 2: If correct_index is provided (snake_case from backend)
        else if (typeof q.correct_index === 'number') {
            correctIndex = q.correct_index;
        }
        // Strategy 3: If answer is a number or numeric string (0-indexed)
        else if (answerValue !== undefined && !isNaN(parseInt(answerValue)) && parseInt(answerValue) < (q.options?.length || 0)) {
            correctIndex = parseInt(answerValue);
        }
        // Strategy 4: Robust Letter Parsing
        else if (typeof answerValue === 'string') {
            const trimmed = answerValue.trim();

            // Pattern 1: Explicit "Option X" or "Answer X" format
            const explicitMatch = trimmed.match(/^(?:Option|Answer)[:\s]+([A-F])(?:\b|$)/i);

            // Pattern 2: Standalone letter with optional punctuation "A", "A.", "(A)", "[A]"
            const standaloneMatch = trimmed.match(/^[\(\[]?([A-F])[\.\)\]]?$/i);

            if (explicitMatch) {
                correctIndex = explicitMatch[1].toUpperCase().charCodeAt(0) - 65;
            } else if (standaloneMatch) {
                correctIndex = standaloneMatch[1].toUpperCase().charCodeAt(0) - 65;
            }
        }

        // Strategy 5: Full text match (if not found by letter)
        if (correctIndex === -1 && q.options && answerValue) {
            const answerStr = String(answerValue).trim();

            // Try exact match first
            const exactMatch = q.options.findIndex(opt => String(opt).trim() === answerStr);
            if (exactMatch !== -1) {
                correctIndex = exactMatch;
            } else {
                // Strategy 6: Normalize both and compare
                const normalizeText = (text) => {
                    return String(text)
                        .trim()
                        .toLowerCase()
                        .replace(/^[a-f][\)\.\:\s]+\s*/i, '') // Remove letter prefix like "A) " or "A. "
                        .replace(/\s+/g, ' ') // Normalize whitespace
                        .replace(/[^\w\s]/g, ''); // Remove punctuation
                };

                const normalizedAnswer = normalizeText(answerStr);

                // Only proceed with fuzzy match if we have enough content
                // This prevents "A" from matching "Apple" via includes()
                if (normalizedAnswer.length >= 2) {
                    correctIndex = q.options.findIndex(opt => {
                        const normalizedOpt = normalizeText(opt);
                        // Check various matching strategies
                        return normalizedOpt === normalizedAnswer ||
                            normalizedOpt.includes(normalizedAnswer) ||
                            (normalizedAnswer.length > 5 && normalizedAnswer.includes(normalizedOpt)) ||
                            // Also try matching first 50 chars in case of truncation
                            (normalizedAnswer.length > 10 && normalizedOpt.substring(0, 50) === normalizedAnswer.substring(0, 50));
                    });
                }
            }
        }

        return {
            question: q.question,
            answerValue,
            calculatedIndex: correctIndex
        };
    });
};

const mockData = [
    {
        question: "Test 1: Single letter",
        options: ["Option 1", "Option 2", "Option 3", "Option 4"],
        answer: "A"
    },
    {
        question: "Test 2: Option A string",
        options: ["Option 1", "Option 2", "Option 3", "Option 4"],
        answer: "Option A"
    },
    {
        question: "Test 3: A. string",
        options: ["Option 1", "Option 2", "Option 3", "Option 4"],
        answer: "A."
    },
    {
        question: "Test 4: Answer: A",
        options: ["Option 1", "Option 2", "Option 3", "Option 4"],
        answer: "Answer: A"
    },
    {
        question: "Test 4b: Answer A",
        options: ["Option 1", "Option 2", "Option 3", "Option 4"],
        answer: "Answer A"
    },
    {
        question: "Test 5: Full text match",
        options: ["To enhance the health...", "To regulate...", "To provide...", "To conduct..."],
        answer: "To enhance the health..."
    },
    {
        question: "Test 6: Option A is correct",
        options: ["To enhance the health...", "To regulate...", "To provide...", "To conduct..."],
        answer: "Option A is correct"
    },
    {
        question: "Test 7: (A)",
        options: ["To update...", "To regulate...", "To provide...", "To conduct..."],
        answer: "(A)"
    },
    // Negative test cases
    {
        question: "Test 8: 'A' shouldn't match 'Apple'",
        options: ["Apple", "Banana", "Cherry", "Date"],
        answer: "A"
    }

];

console.log(JSON.stringify(testLogic(mockData), null, 2));
