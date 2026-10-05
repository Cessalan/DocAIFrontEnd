import React, { useEffect, useRef, useState } from 'react';
import { adminRequest } from '../../Services/AdminService';
import EmailMessageEditor, { textToEmailHtml } from './EmailMessageEditor';
import EmailStudentPicker from './EmailStudentPicker';
import './AdminEmail.css';

const base = '/admin/workspace/email';
const post = (path, body) => adminRequest(base + path, { method: 'POST', body: JSON.stringify(body || {}) });
const statuses = { composing: 'Saved draft', draft: 'Ready to review', sent: 'Sent to email service', dry_run: 'Practice only', sending: 'Sending · check back shortly', failed: 'Could not send', skipped: 'Not sent', paused: 'Waiting to continue', completed: 'Finished' };
const blank = () => ({audience:'one', uid:'', email:'', pasted:'', selected:[], subject:'', message:'', html:''});
const addresses = form => [...new Set([...form.selected.map(s => s.email), ...form.pasted.split(/[\s,;]+/)].map(s => s.trim().toLowerCase()).filter(Boolean))];
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export default function AdminEmail({ uid, actorUid }) {
  const [view, setView] = useState(uid ? 'compose' : 'home');
  const [form, setForm] = useState(() => ({...blank(), uid:uid || ''}));
  const [savedId, setSavedId] = useState(''), [dirty, setDirty] = useState(false);
  const [draft, setDraft] = useState(null), [settings, setSettings] = useState(null);
  const [history, setHistory] = useState([]), [templates, setTemplates] = useState([]);
  const [filter, setFilter] = useState('all'), [busy, setBusy] = useState('');
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [mobile, setMobile] = useState(false), [testResult, setTestResult] = useState(null);
  const [templateName, setTemplateName] = useState(''), [instructions, setInstructions] = useState('');
  const [rewrite, setRewrite] = useState(false), [previous, setPrevious] = useState(null);
  const title = useRef(null);
  const refresh = async () => { const data = await adminRequest(base); setHistory(data.items || []); };
  const loadTemplates = async () => { const data = await adminRequest(base + '/templates'); setTemplates(data.items || []); };
  useEffect(() => {
    refresh().catch(e => setError(e.message));
    loadTemplates().catch(e => setError(e.message));
    adminRequest(base + '/settings').then(setSettings).catch(e => setError(e.message));
  }, []);
  useEffect(() => {
    if (uid) { setForm({...blank(), uid}); setView('compose'); setDraft(null); setSavedId(''); setDirty(false); }
  }, [uid]);
  useEffect(() => { title.current?.focus(); }, [view]);
  useEffect(() => {
    const warn = event => { if (dirty || busy === 'send') { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, busy]);
  const change = updates => { setForm(old => ({...old, ...updates})); setDraft(null); setDirty(true); setNotice(''); };
  const start = (kind, template) => {
    const message = template?.message || (kind === 'announcement' ? 'Hi everyone,\n\n' : 'Hi,\n\n');
    setForm({...blank(), audience:kind === 'announcement' ? 'all' : 'one', subject:template?.subject || '', message, html:template?.html || textToEmailHtml(message)});
    setSavedId(''); setDraft(null); setPrevious(null); setInstructions(''); setRewrite(false); setTemplateName(''); setDirty(true); setError(''); setNotice(''); setView('compose');
  };
  const payload = () => ({...form, emails:addresses(form), source_draft_id:savedId});
  const save = async () => {
    if (busy) return;
    if (form.message.length > 10000 || form.html.length > 50000) { setError('This email is too long. Shorten it before saving.'); return; }
    if (addresses(form).length > 100) { setError('Choose up to 100 unique student emails.'); return; }
    setBusy('save'); setError('');
    try { const result = await post('/drafts', {...payload(), draft_id:savedId}); setSavedId(result.id); setDirty(false); setView('home'); setNotice('Draft saved. You can finish it whenever you’re ready.'); await refresh(); }
    catch (err) { setError(err.message); } finally { setBusy(''); }
  };
  const restore = item => {
    const campaign = item.kind === 'campaign';
    const audience = item.audience || 'one';
    setForm({...blank(), audience, uid:campaign ? '' : item.uid || '', email:item.email || (!campaign ? item.to || '' : ''),
      pasted:(item.emails || (campaign && audience === 'selected' ? item.recipients.map(r => r.to) : [])).join('\n'),
      subject:item.subject || '', message:item.message || '', html:item.html || textToEmailHtml(item.message || '')});
    setSavedId(item.status === 'composing' ? item.id : ''); setDirty(false); setDraft(null); setPrevious(null); setError(''); setNotice(''); setView('compose');
  };
  const review = async event => {
    event.preventDefault(); if (busy) return;
    setError(''); setNotice('');
    if (!form.subject.trim() || !form.message.trim()) { setError('Add a subject and write your message before reviewing.'); return; }
    if (form.message.length > 10000 || form.html.length > 50000) { setError('This email is too long. Shorten it before reviewing.'); return; }
    if (form.audience === 'one' && !form.uid && !validEmail(form.email.trim())) { setError('Choose a student or enter their account email.'); return; }
    const list = addresses(form);
    if (form.audience === 'selected' && (!list.length || list.some(address => !validEmail(address)) || list.length > 100)) { setError('Choose between 1 and 100 students and check that each email address is valid.'); return; }
    setBusy('preview');
    try {
      const result = await post(form.audience === 'one' ? '/preview' : '/campaign/preview', payload());
      setDraft(result); setTestResult(null); setDirty(false); setView('review'); await refresh();
    } catch (err) { setError(err.message); } finally { setBusy(''); }
  };
  const resume = async item => {
    setBusy('review'); setError(''); setNotice('');
    try { setDraft(await adminRequest(base + '/' + item.id + '/preview')); setTestResult(null); setView('review'); }
    catch (err) { setError(err.message); } finally { setBusy(''); }
  };
  const test = async () => {
    if (!draft || busy) return;
    setBusy('test'); setError('');
    try {
      const result = await post('/' + draft.id + '/test'); setTestResult(result);
      if (result.status === 'sent') setNotice(`Test sent to ${result.to}. Check your inbox, including spam. Your students have not been emailed.`);
      else setError('The test could not be sent. ' + (result.reason || 'Ask the account owner to check email setup.'));
    } catch (err) { setError(err.message); } finally { setBusy(''); }
  };
  const send = async () => {
    if (!draft || busy) return;
    setBusy('send'); setError(''); setNotice('');
    try {
      let result;
      do {
        result = await post('/' + draft.id + (draft.kind === 'campaign' ? '/batch' : '/send'));
        setNotice(result.counts ? `${result.counts.sent} sent · ${result.counts.dry_run} practice emails (not sent) · ${result.counts.skipped} not sent · ${result.counts.failed} unsuccessful · ${result.counts.pending} remaining. ${result.reason || ''}` : result.status === 'dry_run' ? 'Practice complete. No email was sent.' : `${statuses[result.status] || result.status}${result.reason ? ': ' + result.reason : ''}`);
      } while (result.canContinue);
      setDraft(null); setView('home');
    } catch (err) { setError(err.message); setDraft(null); setView('home'); }
    finally { setBusy(''); refresh().catch(e => setError(e.message)); }
  };
  const saveTemplate = async () => {
    setBusy('template'); setError('');
    try { await post('/templates', {name:templateName,subject:form.subject,message:form.message,html:form.html}); await loadTemplates(); setTemplateName(''); setNotice('Template saved. Choose it next time you write an email.'); }
    catch (err) { setError(err.message); } finally { setBusy(''); }
  };
  const design = async () => {
    setBusy('design'); setError('');
    try {
      const result = await post('/ai-draft', {instructions:instructions || 'Simple, readable layout with soft coral accents.',subject:form.subject,message:form.message,html:form.html,audience:form.audience,rewrite_copy:rewrite});
      setPrevious(form); change({subject:result.subject,message:result.message,html:result.html}); setNotice('Design updated. Review your message before continuing.');
    } catch (err) { setError(err.message); } finally { setBusy(''); }
  };
  const reviewedSources = new Map(history.filter(item => item.sourceDraftId).map(item => [item.sourceDraftId, item.createdAt]));
  const visible = history.filter(item => !(item.status === 'composing' && reviewedSources.has(item.id) && new Date(reviewedSources.get(item.id)) >= new Date(item.updatedAt || item.createdAt))).filter(item => filter === 'all' || (filter === 'draft' ? ['composing','draft'].includes(item.status) : filter === 'sent' ? item.status === 'sent' || item.result?.counts?.sent > 0 : ['paused','failed','sending'].includes(item.status) || item.result?.counts?.failed > 0));
  const total = draft?.kind === 'campaign' ? draft.status === 'paused' ? draft.recipients.filter(r => r.status === 'pending').length : draft.total : 1;
  const live = settings?.enabled && settings?.ready;
  const blocked = !settings || (draft?.sendingEnabled && !live);
  return <div className="admin-email email-flow">
    <div className="email-flow-heading"><div><p className="email-eyebrow">NURSEQUIZAI · STUDENT EMAIL</p><h2 ref={title} tabIndex={-1}>{({home:'Your emails',start:'Start a new email',compose:'Write your email',review:'One last look before sending'})[view]}</h2><p className="email-intro">{({home:'Personal notes and announcements, all in one place.',start:'Choose a starting point. You can change the wording and recipients.',compose:'Choose your students and write your message. You’ll review everything next.',review:'Check the message and student list. You decide when it goes out.'})[view]}</p></div>{view === 'home' && <button className="email-primary" disabled={!!busy} onClick={() => { setView('start'); setError(''); setNotice(''); }}>Write an email</button>}</div>
    {settings && (!settings.enabled || !settings.ready) && <div className="email-setup" aria-label="Sending setup"><strong>{settings.enabled ? 'Sending setup incomplete' : 'Practice mode — no emails will be sent'}</strong><p>You can save and preview emails. Ask the account owner to finish setup before sending.</p><details><summary>Setup details for the account owner</summary><small>From: {settings.from} · Daily allowance: {settings.dailyCap}</small><ul>{settings.issues?.map(issue => <li key={issue}>{issue}</li>)}</ul></details></div>}
    {error && <p role="alert">{error}</p>}{notice && <p className="email-notice" role="status">{notice}</p>}
    {view === 'home' && <>
      <div className="email-history-heading"><div className="email-history-filters" role="group" aria-label="Filter email history">{[['all','All emails'],['draft','Saved drafts'],['sent','Sent emails'],['attention','Emails needing attention']].map(([value,label]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div><button className="email-secondary" disabled={!!busy} onClick={() => refresh().catch(e => setError(e.message))}>Refresh</button></div>
      {!visible.length && <div className="email-home-empty"><span aria-hidden="true">✉</span><h3>{filter === 'attention' ? 'Nothing needs attention' : filter === 'draft' ? 'No saved drafts yet' : filter === 'sent' ? 'No sent emails yet' : 'A little note can go a long way'}</h3><p>{filter === 'all' ? 'Start an email to support a student or share news with a group.' : 'Matching emails will appear here.'}</p></div>}
      {visible.map(item => <article className="email-history-card" key={item.id}><div className="email-history-summary"><div><h3>{item.subject || 'Untitled draft'}</h3><p>{item.to || 'Students not chosen yet'} · {item.createdAt ? new Date(item.updatedAt || item.createdAt).toLocaleString() : ''}</p></div><span className={'email-status status-' + item.status}>{statuses[item.status] || item.status}</span></div><div className="email-history-actions">{item.actor === actorUid && ['composing','draft'].includes(item.status) && <button type="button" disabled={!!busy} onClick={() => restore(item)}>Continue writing</button>}{item.actor === actorUid && item.status === 'paused' && <button type="button" disabled={!!busy} onClick={() => resume(item)}>Review remaining students</button>}<details><summary>View details</summary><p className="email-history-body">{item.message}</p>{item.result?.counts && <p>{item.result.counts.sent} sent · {item.result.counts.pending} still to send · {item.result.counts.failed} unsuccessful</p>}{item.result?.reason && <p>{item.result.reason}</p>}{item.recipients && <ul className="email-recipient-results">{item.recipients.map(r => <li key={r.uid}>{r.to} · {statuses[r.status] || r.status}</li>)}</ul>}</details></div></article>)}
      <small>“Sent” means the email service accepted the message. Delivery and opens are not confirmed.</small>
    </>}
    {view === 'start' && <><button className="email-secondary" onClick={() => setView('home')}>Back to your emails</button><div className="email-template-grid"><button className="email-template-card" onClick={() => start('personal')}><span aria-hidden="true">✉</span><strong>Personal message</strong><small>Check in with one student.</small></button><button className="email-template-card" onClick={() => start('announcement')}><span aria-hidden="true">☷</span><strong>Announcement</strong><small>Share news with a group of students.</small></button>{templates.map(template => <button className="email-template-card" key={template.id} onClick={() => start('personal',template)}><span>Saved template</span><strong>{template.name}</strong><small>{template.subject || 'Choose recipients and make it your own.'}</small></button>)}</div><p className="email-audience-note">Save a message as a template while writing to use it again later. Templates never include student addresses.</p></>}
    {view === 'compose' && <form onSubmit={review} noValidate>
      <div className="email-flow-steps"><strong>1 · Write</strong><span>2 · Review & send</span></div>
      <div className="email-compose-grid"><section className="email-recipient-panel"><h3>Who is it for?</h3><label>Send to<select aria-label="Audience" value={form.audience} disabled={!!busy} onChange={e => change({audience:e.target.value, ...(e.target.value === 'one' ? {selected:[],uid:'',email:''} : {})})}><option value="one">One student</option><option value="selected">Choose students</option><option value="all">All students</option><option value="pro">Pro members</option><option value="free">Free members</option></select></label>
        {form.audience === 'one' && form.uid && !form.selected.length ? <p>A student is selected from your users. Their address will be checked at review. <button type="button" className="email-secondary" disabled={!!busy} onClick={() => change({uid:'',email:''})}>Choose someone else</button></p> : ['one','selected'].includes(form.audience) && <EmailStudentPicker single={form.audience === 'one'} selected={form.selected} disabled={!!busy} onChange={selected => change({selected,uid:form.audience === 'one' ? selected[0]?.uid || '' : '',email:form.audience === 'one' ? selected[0]?.email || '' : form.email})} />}
        {form.audience === 'one' && !form.uid && <details><summary>Enter an email address instead</summary><label>Student email<input type="email" disabled={!!busy} value={form.email} onChange={e => change({email:e.target.value,selected:[],uid:''})} /></label></details>}
        {form.audience === 'selected' && <details><summary>Paste a list of email addresses</summary><label>Student emails<textarea disabled={!!busy} rows={3} value={form.pasted} onChange={e => change({pasted:e.target.value})} placeholder="One email per line" /></label><small>{addresses(form).length} unique addresses selected in total</small></details>}
        {!['one','selected'].includes(form.audience) && <p>We’ll show the exact student count and addresses on the review screen.</p>}<p className="email-audience-note">Each student gets a separate email. Unsubscribed students are left out.</p>
      </section><section className="email-writing-panel"><h3>Your message</h3><label>Subject<input maxLength={180} disabled={!!busy} value={form.subject} onChange={e => change({subject:e.target.value})} placeholder="What is your email about?" /></label><p className="email-message-label">Message</p><EmailMessageEditor html={form.html} disabled={!!busy} onChange={(message,html) => { change({message,html}); setPrevious(null); }} /><small>{form.message.length.toLocaleString()} / 10,000 characters</small>
        <details className="email-ai"><summary>Help me style my email <span>Optional · your message is ready to use without this</span></summary><label>How should it look?<textarea disabled={!!busy} maxLength={3000} value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Simple and friendly, with a soft coral heading" /></label><label className="email-rewrite-option"><input type="checkbox" disabled={!!busy} checked={rewrite} onChange={e => setRewrite(e.target.checked)} />Also improve my wording</label><button type="button" disabled={!!busy || !form.message.trim()} onClick={design}>{busy === 'design' ? 'Updating design…' : 'Style my email'}</button>{previous && <button type="button" disabled={!!busy} onClick={() => { setForm(previous); setPrevious(null); setDirty(true); }}>Undo design</button>}</details>
        <details className="email-save-template"><summary>Save this message as a template</summary><label>Template name<input maxLength={80} disabled={!!busy} value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="For example: Weekly check-in" /></label><button type="button" disabled={!!busy || !templateName.trim() || !form.message.trim()} onClick={saveTemplate}>Save template</button><small>Only the subject and message are saved. You choose students each time.</small></details>
      </section></div><div className="email-flow-footer"><button type="button" className="email-secondary" disabled={!!busy} onClick={save}>{busy === 'save' ? 'Saving…' : 'Save draft & close'}</button><small>{dirty ? 'You have unsaved changes.' : 'Draft saved.'} Reviewing does not send your email.</small><button type="submit" disabled={!!busy}>{busy === 'preview' ? 'Checking your email…' : 'Review email'}</button></div>
    </form>}
    {view === 'review' && draft && <>
      <div className="email-flow-steps"><span>1 · Write</span><strong>2 · Review & send</strong></div>
      <div className="email-review-grid"><section className="email-preview" aria-label="Email preview"><div className="email-preview-toolbar"><h3>Your email</h3><div role="group" aria-label="Preview size"><button type="button" aria-pressed={!mobile} onClick={() => setMobile(false)}>Computer</button><button type="button" aria-pressed={mobile} onClick={() => setMobile(true)}>Phone</button></div></div><div className="email-envelope"><strong>{draft.subject}</strong><small>From: {draft.from}</small></div><div className={'email-preview-canvas' + (mobile ? ' is-mobile' : '')}><iframe title="Rendered email" sandbox="" srcDoc={draft.html} /></div></section>
      <aside className="email-review-summary"><h3>{total} {total === 1 ? 'student' : 'students'} {draft.status === 'paused' ? 'still to contact' : 'selected'}</h3><p>{draft.kind === 'campaign' ? `${draft.excluded || 0} left out after checking accounts and email preferences.` : draft.to}</p>{draft.kind === 'campaign' && <details><summary>See student email addresses</summary><ul className="email-recipient-results">{draft.recipients.map(r => <li key={r.uid}>{r.to}{draft.status === 'paused' && ` · ${r.status === 'pending' ? 'Still to send' : statuses[r.status] || r.status}`}</li>)}</ul></details>}
        <div className="email-test-box"><h3>Check it in your own inbox</h3><p>A test goes only to {settings?.testEmail || 'your signed-in admin email'}. Your students won’t receive it.</p><button type="button" className="email-secondary" disabled={!!busy || !live || !draft.sendingEnabled || testResult?.status === 'sent'} onClick={test}>{busy === 'test' ? 'Sending your test…' : testResult?.status === 'sent' ? 'Test sent to your inbox' : 'Send myself a test'}</button>{!live && <small>Finish email setup to receive a real test email.</small>}</div>
        <div className="email-send-bar"><strong>{draft.sendingEnabled ? 'Ready when you are' : 'This is a practice email'}</strong><p>{draft.sendingEnabled ? `The button below sends this email to ${total} ${total === 1 ? 'student' : 'students'}.` : 'No student will receive an email in practice mode.'}</p>{draft.kind === 'campaign' && <small>Keep this page open while sending. If today’s allowance runs out, continue later from Your emails.</small>}<button type="button" disabled={!!busy || blocked} onClick={send}>{busy === 'send' ? 'Sending… keep this page open' : draft.sendingEnabled ? `Send to ${total} ${total === 1 ? 'student' : 'students'}` : 'Try a practice send'}</button></div>
      </aside></div><div className="email-flow-footer">{draft.status !== 'paused' && <button type="button" className="email-secondary" disabled={!!busy} onClick={() => { setView('compose'); setDraft(null); setNotice(''); }}>Back to editing</button>}<button type="button" className="email-secondary" disabled={!!busy} onClick={() => { setView('home'); setNotice('Your email is saved. Find it in Your emails when you’re ready.'); }}>Back to your emails</button></div>
    </>}
  </div>;
}
