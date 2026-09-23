import React, { useEffect, useState } from 'react';
import { adminRequest } from '../../Services/AdminService';
import './AdminEmail.css';

const post = (path, body) => adminRequest('/admin/workspace/email' + path, { method: 'POST', body: JSON.stringify(body || {}) });
const statuses = { sent: 'Accepted by provider', dry_run: 'Dry run · not sent', draft: 'Preview saved', sending: 'Send requested · outcome pending', failed: 'Failed', skipped: 'Not sent' };

export default function AdminEmail({ uid }) {
  const [email, setEmail] = useState(''), [subject, setSubject] = useState(''), [message, setMessage] = useState('');
  const [designHtml, setDesignHtml] = useState('');
  const [audience, setAudience] = useState('one');
  const [instructions, setInstructions] = useState('');
  const [rewriteCopy, setRewriteCopy] = useState(false);
  const [previousCopy, setPreviousCopy] = useState(null);
  const [draft, setDraft] = useState(null), [history, setHistory] = useState([]), [busy, setBusy] = useState('');
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [mobile, setMobile] = useState(false);
  const refresh = async () => { const data = await adminRequest('/admin/workspace/email'); setHistory(data.items); };
  useEffect(() => { refresh().catch(e => setError(e.message)); }, []);
  useEffect(() => { setDraft(null); setEmail(''); setSubject(''); setMessage(''); setNotice(''); setAudience('one'); setPreviousCopy(null); setDesignHtml(''); }, [uid]);
  const edit = setter => e => { setter(e.target.value); setDraft(null); setNotice(''); };
  const editMessage = e => { setMessage(e.target.value); setDesignHtml(''); setDraft(null); setPreviousCopy(null); setNotice('Copy updated. Design your email again to use the new wording.'); };
  const generate = async () => {
    if (busy || !message.trim()) return;
    setBusy('ai'); setError(''); 
    try {
      const design = await post('/ai-draft', { instructions: instructions.trim() || 'Minimal design, coral accents, generous spacing and clear sections.', subject, message, audience, html: designHtml, rewrite_copy: rewriteCopy });
      const nextSubject = rewriteCopy ? design.subject : subject;
      const nextMessage = rewriteCopy ? design.message : message;
      const rendered = await post('/layout-preview', {subject: nextSubject, message: nextMessage, html: design.html});
      setPreviousCopy({subject, message, html: designHtml, draft});
      setSubject(nextSubject); setMessage(nextMessage); setDesignHtml(design.html); setDraft(rendered);
      setNotice('Design updated. Review it on the right, then confirm recipients before sending.');
    } catch (err) { setError(err.message); } finally { setBusy(''); }
  };
  const preview = async e => {
    e.preventDefault(); setBusy('preview'); setError(''); setNotice(''); setDraft(null);
    const addresses = email.split(/[\s,;]+/).filter(Boolean);
    const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    const ready = subject.trim() && message.trim() && (audience === 'one' ? uid || validEmail(email.trim()) : audience !== 'selected' || (addresses.length && addresses.every(validEmail)));
    try { setDraft(await post(!ready ? '/layout-preview' : audience === 'one' ? '/preview' : '/campaign/preview', !ready ? {subject, message, html: designHtml} : audience === 'one' ? { uid: uid || '', email, subject, message, html: designHtml } : { audience, emails: audience === 'selected' ? addresses : [], subject, message, html: designHtml })); }
    catch (err) { setError(err.message); } finally { setBusy(''); }
  };
  const send = async (campaign = draft) => {
    if (!campaign || campaign.previewOnly || busy) return;
    setBusy('send'); setError('');
    try {
      let result;
      do {
        result = await post('/' + campaign.id + (campaign.kind === 'campaign' ? '/batch' : '/send'));
        setNotice(result.counts ? `${result.counts.sent} sent · ${result.counts.dry_run} dry runs · ${result.counts.skipped} skipped · ${result.counts.failed} failed · ${result.counts.pending} remaining. ${result.reason || ''}` : `${statuses[result.status] || result.status}${result.reason ? ': ' + result.reason : ''}`);
      } while (result.canContinue);
      setDraft(null);
    } catch (err) { setError(err.message); setDraft(null); }
    finally { setBusy(''); refresh().catch(e => setError(e.message)); }
  };
  return <div className="admin-email">
    <p className="email-intro">Send a personal note or share an announcement with your students.</p>
    {error && <p role="alert">{error}</p>}
    {notice && <p className="email-notice" role="status">{notice}</p>}
    <div className="email-studio">
      <form className="email-editor" onSubmit={preview} noValidate>
        <h2>Write your email</h2>
        <fieldset disabled={!!busy}>
          <label>Audience<select aria-label="Audience" value={audience} onChange={edit(setAudience)}><option value="one">One student</option><option value="selected">Several students</option><option value="all">All students</option><option value="pro">Pro members</option><option value="free">Free members</option></select></label>
          {audience === 'one' && (uid ? <p>Recipient selected from your users. Their email will be confirmed in the preview.</p> : <label>To<input aria-label="To" type="email" autoComplete="off" required placeholder="Student’s account email" value={email} onChange={edit(setEmail)} /><small>Use the email of an existing account.</small></label>)}
          {audience === 'selected' && <label>Student emails<textarea aria-label="Student emails" required rows={3} value={email} onChange={edit(setEmail)} placeholder="student@example.com, another@example.com" /><small>Separate with commas or new lines. Up to 100 existing accounts.</small></label>}
          {audience !== 'one' && <p className="email-audience-note">Each student receives a separate email. Unsubscribed accounts are excluded. Preview to review your recipient list.</p>}
          <label>Subject<input required maxLength={180} placeholder="Give your note a clear subject" value={subject} onChange={edit(setSubject)} /></label>
          <label>Message<textarea required rows={8} maxLength={10000} placeholder={'Hi,\n\nHow is your exam prep going?'} value={message} onChange={editMessage} /></label>
          <div className="email-editor-bottom"><small>Your copy stays here. The design appears on the right.</small><small>{message.length.toLocaleString()} / 10,000</small></div>
          <button className="email-primary" type="submit">{busy === 'preview' ? 'Preparing preview…' : 'Preview email'}</button>
        </fieldset>
      </form>
      <section className="email-preview" aria-label="Email preview">
        <div className="email-preview-toolbar"><h2>Inbox preview</h2><div role="group" aria-label="Preview size"><button type="button" aria-pressed={!mobile} onClick={() => setMobile(false)}>Desktop</button><button type="button" aria-pressed={mobile} onClick={() => setMobile(true)}>Mobile</button></div></div>
        <div className="email-ai">
          <label>Design direction<textarea aria-label="AI instructions" disabled={!!busy} rows={2} maxLength={3000} value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Minimal, coral accents, clear sections. Or: less padding, smaller heading…" /></label>
          <label className="email-rewrite-option"><input type="checkbox" disabled={!!busy} checked={rewriteCopy} onChange={e => setRewriteCopy(e.target.checked)} />Also improve my wording</label>
          <button type="button" disabled={!!busy || !message.trim()} onClick={generate}>{busy === 'ai' ? 'Designing your email…' : designHtml ? 'Refine design' : 'Design my email'}</button>
          {!message.trim() && <small>Write your message on the left to get started.</small>}
          {previousCopy && <button type="button" disabled={!!busy} className="email-ai-undo" onClick={() => { setSubject(previousCopy.subject); setMessage(previousCopy.message); setDesignHtml(previousCopy.html); setDraft(previousCopy.draft ? {...previousCopy.draft, previewOnly:true} : null); setPreviousCopy(null); setNotice('Previous design restored.'); }}>Undo design</button>}
        </div>
        {draft ? <>
          <div className="email-envelope"><strong>{draft.subject}</strong><small>From: {draft.from}</small><small>To: {draft.to}</small></div>
          {draft.kind === 'campaign' && <div className="email-audience-review"><strong>{draft.total} recipients</strong><small>{draft.excluded} excluded · {draft.remainingToday} emails available today</small><details><summary>Review recipient list</summary><ul>{draft.recipients.map(r => <li key={r.uid}>{r.to}</li>)}</ul></details><small>Preview shows one recipient’s email. Unsubscribe links are unique to each student.</small></div>}
          <div className={'email-preview-canvas' + (mobile ? ' is-mobile' : '')}><iframe title="Rendered email" sandbox="" srcDoc={draft.html} /></div>
          {draft.previewOnly ? <p className="email-audience-note">Design preview. When you’re ready, confirm your recipients and subject before sending.</p> : <div className="email-send-bar"><p>{draft.sendingEnabled ? `Ready to send to ${draft.to}` : 'Sending is disabled. A dry run records the attempt without sending an email.'}</p>{draft.kind === 'campaign' && <small>Keep this page open while sending. If the daily limit is reached, resume from history later.</small>}<button type="button" disabled={!!busy} onClick={() => send()}>{busy === 'send' ? 'Processing…' : draft.sendingEnabled ? draft.kind === 'campaign' ? `Send to ${draft.total} students` : 'Send email' : 'Record dry run'}</button></div>}
        </> : <div className="email-preview-empty"><span aria-hidden="true">✉</span><h3>See it before you send it</h3><p>Write your message, then preview its layout, sender, recipient, and unsubscribe footer here.</p></div>}
        {designHtml && <details className="email-advanced"><summary>Advanced · edit HTML</summary><label>Email HTML<textarea disabled={!!busy} rows={8} maxLength={50000} value={designHtml} onChange={edit(setDesignHtml)} /></label><small>Preview email again to see your HTML changes.</small></details>}
      </section>
    </div>
    <div className="email-history-heading"><h2>Recent email activity</h2><button type="button" disabled={!!busy} onClick={() => refresh().catch(e => setError(e.message))}>Refresh history</button></div>
    <p className="email-intro">Provider acceptance is recorded here. Delivery and opens are not tracked.</p>
    {!history.length && <p>No email activity yet.</p>}
    {history.map(item => <details className="email-history-item" key={item.id}><summary><span><strong>{item.subject}</strong><small>{item.to} · {new Date(item.createdAt).toLocaleString()}</small></span><span className={'email-status status-' + item.status}>{statuses[item.status] || item.status}</span></summary><p className="email-history-body">{item.message}</p>{item.result?.reason && <p>{item.result.reason}</p>}{item.kind === 'campaign' && <><ul className="email-recipient-results">{item.recipients.map(r => <li key={r.uid}>{r.to} · {statuses[r.status] || r.status}{r.reason ? ' · ' + r.reason : ''}</li>)}</ul>{item.status === 'paused' && <button disabled={!!busy} type="button" onClick={() => send(item)}>Resume remaining recipients</button>}</>}<small>Admin: {item.actor}</small></details>)}
  </div>;
}



