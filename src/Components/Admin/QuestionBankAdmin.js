import React, { useState, useEffect } from 'react';
import './QuestionBankAdmin.css';

const API_BASE = process.env.REACT_APP_FASTAPI_URL || 'http://localhost:8080';

/**
 * QuestionBankAdmin - Admin UI for importing questions into the Question Bank
 * Only accessible in development mode
 */
function QuestionBankAdmin() {
  const [jsonInput, setJsonInput] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Fetch stats on mount
  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const response = await fetch(`${API_BASE}/admin/question-bank-stats`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
    setLoadingStats(false);
  };

  const handleImport = async () => {
    setError(null);
    setResult(null);

    // Parse JSON
    let questions;
    try {
      const parsed = JSON.parse(jsonInput);
      // Support both { questions: [...] } and direct array [...]
      questions = Array.isArray(parsed) ? parsed : parsed.questions;

      if (!Array.isArray(questions)) {
        throw new Error('Expected an array of questions or { questions: [...] }');
      }
    } catch (err) {
      setError(`Invalid JSON: ${err.message}`);
      return;
    }

    // Validate questions (metadata is optional)
    const requiredFields = ['question', 'options', 'answer', 'justification', 'topic'];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      for (const field of requiredFields) {
        if (!q[field]) {
          setError(`Question ${i + 1} is missing required field: ${field}`);
          return;
        }
      }
      if (!Array.isArray(q.options) || q.options.length !== 4) {
        setError(`Question ${i + 1}: options must be an array of 4 items`);
        return;
      }
      // Note: metadata is optional - language/difficulty will default to en/medium
    }

    // Send to API
    setImporting(true);
    try {
      const response = await fetch(`${API_BASE}/admin/import-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions })
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
        // Refresh stats after import
        fetchStats();
      } else {
        setError(data.detail || 'Import failed');
      }
    } catch (err) {
      setError(`Network error: ${err.message}`);
    }
    setImporting(false);
  };

  // Sample question matching EXACT LLM output format
  const sampleQuestion = {
    question: "A patient receiving digoxin reports nausea and visual disturbances. What should the nurse do first?",
    options: [
      "A) Continue the medication as prescribed",
      "B) Hold the medication and notify the provider",
      "C) Administer an antiemetic",
      "D) Document the findings and reassess later"
    ],
    answer: "B) Hold the medication and notify the provider",
    justification: "<strong>Option B is correct</strong> because nausea and visual disturbances (seeing yellow-green halos) are classic signs of digoxin toxicity. The nurse should hold the medication and immediately notify the healthcare provider.<br><br><strong>Option A is incorrect</strong> because continuing the medication could worsen toxicity.<br><strong>Option C is incorrect</strong> because antiemetics don't address the underlying issue.<br><strong>Option D is incorrect</strong> because documentation alone is insufficient for this urgent situation.",
    topic: "Cardiac Medications",
    metadata: {
      sourceLanguage: "en",
      topic: "Cardiac Medications",
      category: "nursing",
      difficulty: "medium",
      correctAnswerIndex: 1,
      sourceDocument: "admin_import",
      keywords: ["digoxin", "toxicity", "cardiac", "medication safety"]
    }
  };

  const loadSample = () => {
    setJsonInput(JSON.stringify([sampleQuestion], null, 2));
    setError(null);
    setResult(null);
  };

  return (
    <div className="question-bank-admin">
      <div className="admin-header">
        <h1>Question Bank Admin</h1>
        <span className="dev-badge">DEV MODE</span>
      </div>

      {/* Stats Card */}
      <div className="stats-card">
        <h2>Current Bank Statistics</h2>
        {loadingStats ? (
          <p className="loading">Loading stats...</p>
        ) : stats ? (
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-value">{stats.total_active || 0}</span>
              <span className="stat-label">Total Questions</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{stats.by_language?.en || 0}</span>
              <span className="stat-label">English</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{stats.by_language?.fr || 0}</span>
              <span className="stat-label">French</span>
            </div>
            <div className="stat-item categories">
              <span className="stat-label">By Category:</span>
              <div className="category-list">
                {stats.by_category && Object.entries(stats.by_category).map(([cat, count]) => (
                  <span key={cat} className="category-tag">{cat}: {count}</span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="error">Failed to load stats</p>
        )}
        <button onClick={fetchStats} className="refresh-btn" disabled={loadingStats}>
          Refresh Stats
        </button>
      </div>

      {/* Import Section */}
      <div className="import-card">
        <h2>Import Questions</h2>
        <p className="instructions">
          Paste your AI-generated questions as JSON. Format matches LLM output exactly.
          Required: <code>question</code>, <code>options</code> (array of 4),
          <code>answer</code>, <code>justification</code>, <code>topic</code>.
          Optional: <code>metadata</code> (for language/difficulty).
        </p>

        <div className="action-row">
          <button onClick={loadSample} className="sample-btn">
            Load Sample
          </button>
        </div>

        <textarea
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder='[
  {
    "question": "Your question text...",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "answer": "B) The correct option",
    "justification": "<strong>Option B is correct</strong> because...",
    "topic": "Topic Name",
    "metadata": {
      "sourceLanguage": "en",
      "topic": "Topic Name",
      "category": "nursing",
      "difficulty": "medium",
      "correctAnswerIndex": 1,
      "sourceDocument": "admin_import",
      "keywords": ["keyword1", "keyword2"]
    }
  }
]'
          className="json-input"
          rows={20}
        />

        {error && (
          <div className="error-box">
            {error}
          </div>
        )}

        {result && (
          <div className="result-box">
            <h3>Import Complete</h3>
            <div className="result-stats">
              <span className="result-imported">{result.imported} imported</span>
              <span className="result-duplicates">{result.duplicates} duplicates</span>
              <span className="result-errors">{result.errors?.length || 0} errors</span>
            </div>
            {result.errors?.length > 0 && (
              <div className="error-list">
                {result.errors.map((err, i) => (
                  <p key={i}>{err}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleImport}
          disabled={importing || !jsonInput.trim()}
          className="import-btn"
        >
          {importing ? 'Importing...' : 'Import Questions'}
        </button>
      </div>

      {/* Format Reference */}
      <div className="format-card">
        <h2>Expected Format</h2>
        <pre>{JSON.stringify(sampleQuestion, null, 2)}</pre>
      </div>
    </div>
  );
}

export default QuestionBankAdmin;
