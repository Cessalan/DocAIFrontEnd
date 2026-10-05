import React, { useLayoutEffect, useRef, useState } from 'react';

export const escapeEmailText = value => String(value || '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
export const textToEmailHtml = value => value ? value.split('\n\n').map(paragraph => `<p>${escapeEmailText(paragraph).replace(/\n/g, '<br>')}</p>`).join('') : '';

// The browser's editing commands preserve selection and its native undo history.
// Pasted content is plain text; the backend sanitizes all saved/rendered HTML.
export default function EmailMessageEditor({ html, onChange, disabled }) {
  const editor = useRef(null), selection = useRef(null);
  const [linkOpen, setLinkOpen] = useState(false), [url, setUrl] = useState(''), [linkError, setLinkError] = useState('');
  useLayoutEffect(() => {
    if (editor.current && editor.current.innerHTML !== html) editor.current.innerHTML = html || '';
  }, [html]);
  const changed = () => onChange(editor.current.innerText || editor.current.textContent || '', editor.current.innerHTML);
  const format = (command, value) => {
    editor.current.focus();
    document.execCommand(command, false, value);
    changed();
  };
  const showLink = () => {
    const current = window.getSelection();
    selection.current = current?.rangeCount && editor.current.contains(current.anchorNode) ? current.getRangeAt(0).cloneRange() : null;
    setLinkOpen(true); setUrl(''); setLinkError('');
  };
  const addLink = () => {
    let address;
    try { address = new URL(url.trim()); } catch { setLinkError('Enter a complete website address, starting with https://.'); return; }
    if (address.protocol !== 'https:') { setLinkError('Use a secure website address starting with https://.'); return; }
    editor.current.focus();
    const current = window.getSelection();
    if (selection.current) { current.removeAllRanges(); current.addRange(selection.current); }
    if (selection.current && !selection.current.collapsed) format('createLink', address.href);
    else format('insertHTML', `<a href="${escapeEmailText(address.href)}">${escapeEmailText(address.href)}</a>`);
    setLinkOpen(false);
  };
  return <div className="email-rich-editor">
    <div className="email-format-toolbar" role="toolbar" aria-label="Message formatting">
      <button type="button" disabled={disabled} onMouseDown={e => e.preventDefault()} onClick={() => format('bold')}><b>Bold</b></button>
      <button type="button" disabled={disabled} onMouseDown={e => e.preventDefault()} onClick={() => format('insertUnorderedList')}>Bullet list</button>
      <button type="button" disabled={disabled} onMouseDown={e => e.preventDefault()} onClick={showLink}>Add link</button>
      <button type="button" disabled={disabled} onMouseDown={e => e.preventDefault()} onClick={() => format('undo')}>Undo</button>
    </div>
    {linkOpen && <div className="email-link-form"><label>Website address<input type="url" value={url} disabled={disabled} onChange={e => setUrl(e.target.value)} placeholder="https://example.com" /></label>{linkError && <p role="alert">{linkError}</p>}<button type="button" disabled={disabled} onClick={addLink}>Insert link</button><button type="button" disabled={disabled} onClick={() => setLinkOpen(false)}>Cancel</button></div>}
    <div ref={editor} className="email-message-input" role="textbox" aria-label="Message" aria-multiline="true" aria-disabled={disabled} contentEditable={!disabled} suppressContentEditableWarning
      onInput={changed} onDrop={e => e.preventDefault()} onPaste={e => { e.preventDefault(); if (!disabled) format('insertText', e.clipboardData.getData('text/plain')); }} />
  </div>;
}
