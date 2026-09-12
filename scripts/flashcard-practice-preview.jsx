// Visual fixture only. The application uses FlashcardPractice through ChatMessage.
import React from 'react';
import { createRoot } from 'react-dom/client';
import FlashcardPractice from '../src/Components/ChatInerface/FlashcardPractice';
import '../src/index.css';

const params = new URLSearchParams(window.location.search);
document.body.classList.toggle('dark-mode', params.get('theme') === 'dark');
const cards = [
  { front: 'What’s the difference between recognition and recall?', back: '**Recognition** means something looks familiar.\n\n**Recall** means you can bring it to mind without seeing the answer.\n\nTry closing your notes and explaining one idea out loud.', topic: 'Learning & memory' },
  { front: 'How can you check whether you understand an idea?', back: 'Explain it in your own words, then check your notes for gaps.', topic: 'Learning & memory' },
  { front: 'When is a short review useful?', back: 'Return after a gap and try retrieving the idea before rereading it.', topic: 'Learning & memory' },
];
if (params.has('long')) cards[0].back = Array(10).fill('A longer explanation should keep its natural height. You can scroll through this answer and still reach the recall choices below.').join('\n\n');
createRoot(document.getElementById('root')).render(<main style={{ maxWidth: 740, margin: '50px auto', padding: 24 }}><p style={{ color: '#888', fontSize: 12 }}>Visual review · sample cards · saves and tutor replies are simulated</p><FlashcardPractice message={{ id: 'visual-deck', flashcardTopic: 'Learning & memory' }} cards={cards} chatId="visual" files={[{ filename: 'Learning notes.pdf' }]} /></main>);
