import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../Firebase/config';
import './OnboardingViewer.css';

const OnboardingViewer = ({ onClose }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('withText'); // withText, all
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        setLoading(true);
        const snapshot = await getDocs(collection(db, 'users'));
        const rows = snapshot.docs
          .map(doc => {
            const data = doc.data();
            return {
              uid: doc.id,
              email: data.email || '',
              displayName: data.displayName || '',
              onboarding: data.onboarding || null
            };
          })
          .filter(u => u.onboarding);
        setUsers(rows);
      } catch (error) {
        console.error('Error loading onboarding data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadUsers();
  }, []);

  const handleCopy = (text) => {
    navigator.clipboard?.writeText(text || '');
  };

  const handleExport = () => {
    setExporting(true);
    try {
      const onboardingData = users
        .filter(u => u.onboarding)
        .map(u => ({
          odtOfUSer: u.uid,
          onboarding: u.onboarding
        }));

      const jsonString = JSON.stringify(onboardingData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `onboarding-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log(`Exported onboarding data for ${onboardingData.length} users`);
    } catch (error) {
      console.error('Error exporting onboarding data:', error);
      alert('Failed to export onboarding data: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  const filtered = users.filter(u => {
    if (filter === 'withText' && !u.onboarding?.userExpectation?.trim()) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [
        u.uid,
        u.email,
        u.displayName,
        u.onboarding?.userStage,
        u.onboarding?.studyGoal,
        u.onboarding?.reviewFormat,
        u.onboarding?.userExpectation
      ].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const withTextCount = users.filter(u => u.onboarding?.userExpectation?.trim()).length;

  return (
    <div className="onboarding-viewer-overlay" onClick={onClose}>
      <div className="onboarding-viewer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="onboarding-viewer-header">
          <h2>Onboarding Data ({filtered.length}{filter === 'withText' ? ` / ${withTextCount} with text` : ` / ${users.length} total`})</h2>
          <div className="onboarding-viewer-header-actions">
            <button
              className="onboarding-viewer-export"
              onClick={handleExport}
              disabled={exporting || loading || users.length === 0}
              title="Export onboarding data as JSON"
            >
              {exporting ? 'Exporting...' : 'Export JSON'}
            </button>
            <button className="onboarding-viewer-close" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="onboarding-viewer-filters">
          <div className="ov-filter-group">
            <button
              className={`ov-filter-btn ${filter === 'withText' ? 'active' : ''}`}
              onClick={() => setFilter('withText')}
            >
              With typed text
            </button>
            <button
              className={`ov-filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All users
            </button>
          </div>
          <input
            className="ov-search"
            type="text"
            placeholder="Search uid, email, semester, text…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="onboarding-viewer-body">
          {loading ? (
            <div className="ov-loading">Loading onboarding data…</div>
          ) : filtered.length === 0 ? (
            <div className="ov-empty">No matching onboarding entries.</div>
          ) : (
            filtered.map(u => {
              const ob = u.onboarding || {};
              const text = ob.userExpectation?.trim();
              return (
                <div key={u.uid} className="ov-card">
                  <div className="ov-card-row">
                    <div className="ov-field">
                      <label>User ID</label>
                      <div className="ov-value mono">
                        <span>{u.uid}</span>
                        <button className="ov-copy-btn" onClick={() => handleCopy(u.uid)} title="Copy">⧉</button>
                      </div>
                    </div>
                    <div className="ov-field">
                      <label>Email</label>
                      <div className="ov-value">
                        <span>{u.email || <em>—</em>}</span>
                        {u.email && (
                          <button className="ov-copy-btn" onClick={() => handleCopy(u.email)} title="Copy">⧉</button>
                        )}
                      </div>
                    </div>
                    <div className="ov-field">
                      <label>Semester Level</label>
                      <div className="ov-value">{ob.userStage || <em>—</em>}</div>
                    </div>
                  </div>

                  <div className="ov-field ov-text-field">
                    <label>Typed Text (userExpectation)</label>
                    {text ? (
                      <div className="ov-text-block">
                        <p>{text}</p>
                        <button className="ov-copy-btn" onClick={() => handleCopy(text)} title="Copy">⧉</button>
                      </div>
                    ) : (
                      <div className="ov-text-block empty"><em>No text entered</em></div>
                    )}
                  </div>

                  <div className="ov-meta">
                    {ob.studyGoal && <span className="ov-chip">Goal: {ob.studyGoal}</span>}
                    {ob.reviewFormat && <span className="ov-chip">Format: {ob.reviewFormat}</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingViewer;
