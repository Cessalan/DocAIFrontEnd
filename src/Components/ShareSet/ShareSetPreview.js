import React, { useEffect, useState } from 'react';
import ShareSetOffer, { ShareSetButton } from './ShareSetOffer';
import './ShareSet.css';

/**
 * /dev/share-set — development builds only (App.js does not register the route
 * in production).
 *
 * The classmates note only appears after someone else finishes a shared set,
 * so it cannot be looked at quickly in the real flow. This page shows both with
 * sample data. The link it "creates" is fake: nothing is written to Firestore.
 */
const SAMPLE = Array.from({ length: 10 }, (_, index) => ({
  question: `Sample question ${index + 1}?`, options: ['One', 'Two', 'Three', 'Four'], correctIndex: 1, rationale: 'Sample.',
}));

const fakeLink = () => new Promise((resolve) => {
  window.setTimeout(() => resolve({ shareId: 'devPreviewShareSet01', url: `${window.location.origin}/quiz/devPreviewShareSet01`, totalQuestions: 10 }), 700);
});

export default function ShareSetPreview() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    document.body.classList.toggle('dark-mode', dark);
    return () => document.body.classList.remove('dark-mode');
  }, [dark]);

  return (
    <div style={{ minHeight: '100vh', padding: '40px 16px', background: dark ? '#1a1a1a' : '#fdf8f3', fontFamily: "'Outfit', sans-serif" }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <button type="button" onClick={() => setDark(!dark)} style={{ marginBottom: 20 }}>
          {dark ? 'Light mode' : 'Dark mode'}
        </button>

        <div className="class-note" role="status">
          <span className="class-note__mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </span>
          <div>
            <p className="class-note__title">3 classmates tried your Heart failure set</p>
            <p className="class-note__body">Most missed by the group: “A client with heart failure takes digoxin 0.125 mg daily. Before giving the dose…”</p>
          </div>
        </div>

        <div style={{ padding: 32, borderRadius: 24, background: dark ? '#2f2f2f' : '#fff', boxShadow: '0 8px 32px rgba(0,0,0,.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
            <p style={{ margin: 0, color: dark ? '#aaa' : '#707070', fontSize: 12 }}>Result card stand-in. The button and the offer are the real components.</p>
            <ShareSetButton questions={SAMPLE} topic="Heart failure" chatId="dev" nodeId="dev" />
          </div>
          <ShareSetOffer
            questions={SAMPLE} topic="Heart failure" score={{ got: 8, total: 10 }}
            chatId="dev" nodeId="dev" surface="dev_preview" createLink={fakeLink}
          />
        </div>
      </div>
    </div>
  );
}
