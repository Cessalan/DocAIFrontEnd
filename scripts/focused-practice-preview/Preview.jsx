import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import ChatMessage from '../../src/Components/ChatInerface/ChatMessage';
import FocusedQuiz from '../../src/Components/ChatInerface/FocusedQuiz';
import '../../src/index.css';

document.body.classList.toggle('dark-mode', new URLSearchParams(window.location.search).get('theme') === 'dark');

function Preview() {
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState(null);
  const [message, setMessage] = useState({ id: 'preview', role: 'assistant', type: 'quiz', quizTopic: 'Your course practice', expectedTotal: 2,
    quizData: [{ question: 'Which approach helps you check your understanding of a topic before moving on to the next part of your course?', questionType: 'mcq', options: ['Explain the concept in your own words and identify any gaps in your understanding', 'Skip every unfamiliar term and move straight to the next topic', 'Read the same paragraph without checking whether you can explain it', 'Memorize the page layout without considering how the ideas connect'], correctIndex: 0, correctBlurb: 'Explaining a concept helps reveal gaps in understanding.' },
      { question: 'What should you do when part of an explanation is unclear?', questionType: 'mcq', options: ['Ask a focused follow-up question', 'Move on without checking'], correctIndex: 0 }] });
  return <main style={{ position: 'relative', height: '100dvh', background: document.body.classList.contains('dark-mode') ? 'var(--dark-bg-secondary)' : 'var(--bg-cream)' }}>
    <div inert={open ? true : undefined} aria-hidden={open ? true : undefined} style={{ maxWidth: 900, margin: 'auto', padding: '60px 24px' }}>
      <p style={{ fontSize: 13 }}>Local UI preview · Sample content · No account or API calls</p>
      <h1>Your conversation</h1>
      <ChatMessage message={message} onOpenPractice={(id, bounds) => { setOrigin(bounds); setOpen(true); }} />
    </div>
    <FocusedQuiz message={message} chatId="preview" visible={open} launchOrigin={origin} onExit={() => setOpen(false)} onPracticeChange={practice => setMessage(previous => ({ ...previous, practice }))} />
  </main>;
}
createRoot(document.getElementById('root')).render(<Preview />);
