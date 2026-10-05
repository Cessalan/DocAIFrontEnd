import React from 'react';

export default function StudyInspectorLink({ chatId, children = 'Open plan timeline ↗', className }) {
  if (!chatId) return null;
  const href = '/admin/study-plans/' + encodeURIComponent(chatId);
  return <a className={className} href={href} target="_blank" rel="noopener noreferrer"
    onClick={event => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      window.open(href, '_blank', 'popup,width=1440,height=960,noopener,noreferrer');
    }}>{children}</a>;
}
