import React from 'react';
import './ChatSendButton.css';

export default function ChatSendButton({ disabled, busy = false, label }) {
  return <button type="submit" className={`send-button-icon chat-send-control ${busy ? 'send-button-busy' : ''}`} disabled={disabled || busy} title={label} aria-label={label} aria-busy={busy}>
    {busy ? <span className="chat-send-dots" aria-hidden="true"><span /><span /><span /></span> :
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
      </svg>}
  </button>;
}
