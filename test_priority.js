
const testLogic = (quizData) => {
    return quizData.map(q => {
        // Determine correctIndex - multiple strategies
        let correctIndex = -1;

        // Get the answer field
        const answerValue = q.answer ?? q.correct_answer ?? q.correctAnswer;

        // Strategy 0: Exact Text Match (Highest Priority to match ChatQuiz.js)
        if (q.options && answerValue) {
            const answerStr = String(answerValue).trim();
            const exactMatch = q.options.findIndex(opt => String(opt).trim() === answerStr);
            if (exactMatch !== -1) {
                correctIndex = exactMatch;
                return { strategy: 'Exact Match', correctIndex };
            }
        }

        // Strategy 1: If correctIndex is already provided as a number
        if (typeof q.correctIndex === 'number') {
            correctIndex = q.correctIndex;
            return { strategy: 'Explicit correctIndex', correctIndex };
        }
        // Strategy 2: If correct_index is provided (snake_case from backend)
        else if (typeof q.correct_index === 'number') {
            correctIndex = q.correct_index;
            return { strategy: 'Explicit correct_index', correctIndex };
        }
        // Strategy 3: If answer is a number or numeric string (0-indexed)
        else if (answerValue !== undefined && !isNaN(parseInt(answerValue)) && parseInt(answerValue) < (q.options?.length || 0)) {
            correctIndex = parseInt(answerValue);
            return { strategy: 'Numeric Answer', correctIndex };
        }
        // Strategy 4: Robust Letter Parsing ("Option A", "A")
        else if (typeof answerValue === 'string') {
            const trimmed = answerValue.trim();

            // Pattern 1: Explicit "Option X" or "Answer X" format
            const explicitMatch = trimmed.match(/^(?:Option|Answer)[:\s]+([A-F])(?:\b|$)/i);

            // Pattern 2: Standalone letter with optional punctuation "A", "A.", "(A)", "[A]"
            const standaloneMatch = trimmed.match(/^[\(\[]?([A-F])[\.\)\]]?$/i);

            if (explicitMatch) {
                correctIndex = explicitMatch[1].toUpperCase().charCodeAt(0) - 65;
                return { strategy: 'Letter Parse (Explicit)', correctIndex };
            } else if (standaloneMatch) {
                correctIndex = standaloneMatch[1].toUpperCase().charCodeAt(0) - 65;
                return { strategy: 'Letter Parse (Standalone)', correctIndex };
            }
        }

        // Strategy 5: Fuzzy text match (lowest priority)
        if (correctIndex === -1 && q.options && answerValue) {
            const answerStr = String(answerValue).trim();

            const normalizeText = (text) => {
                return String(text)
                    .trim()
                    .toLowerCase()
                    .replace(/^[a-f][\)\.\:\s]+\s*/i, '') // Remove letter prefix like "A) "
                    .replace(/\s+/g, ' ')
                    .replace(/[^\w\s]/g, '');
            };

            const normalizedAnswer = normalizeText(answerStr);

            if (normalizedAnswer.length >= 2) {
                correctIndex = q.options.findIndex(opt => {
                    const normalizedOpt = normalizeText(opt);
                    return normalizedOpt === normalizedAnswer ||
                        normalizedOpt.includes(normalizedAnswer) ||
                        (normalizedAnswer.length > 5 && normalizedAnswer.includes(normalizedOpt)) ||
                        (normalizedAnswer.length > 10 && normalizedOpt.substring(0, 50) === normalizedAnswer.substring(0, 50));
                });
                if (correctIndex !== -1) return { strategy: 'Fuzzy Match', correctIndex };
            }
        }

        return { strategy: 'None', correctIndex: -1 };
    });
};

const mockData = [
    {
        question: "Conflict Case: Exact Match vs Wrong Index",
        options: ["Correct Answer Text", "Wrong Answer Text"],
        answer: "Correct Answer Text",
        correctIndex: 1, // Wrong index provided by backend
        description: "Should return 0 (Exact Match)"
    },
    {
        question: "Normal Case: Option A",
        options: ["Alpha", "Beta"],
        answer: "Option A",
        description: "Should return 0 (Letter Parse)"
    }
];

console.log(JSON.stringify(mockData.map(d => ({ case: d.description, result: testLogic([d])[0] })), null, 2));
