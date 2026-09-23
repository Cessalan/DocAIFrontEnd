import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useOutletContext } from 'react-router-dom';
import { adminRequest } from '../../Services/AdminService';
import AdminEmail from './AdminEmail';
const api = (path, body, method = 'POST') => adminRequest('/admin/workspace' + path, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
const date = value => value ? new Date(value).toLocaleString() : 'Not recorded';
export default function AdminWorkspace() {
  const identity = useOutletContext();
  const location = useLocation();
  const tab = location.pathname.split('/')[2] || 'users';
  const [items, setItems] = useState([]), [cursor, setCursor] = useState(null), [days, setDays] = useState(30);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [search, setSearch] = useState(''), [tier, setTier] = useState('all');
  const [detail, setDetail] = useState(null), [email, setEmail] = useState('');

  const uid = new URLSearchParams(location.search).get('uid');
  const plan = new URLSearchParams(location.search).get('plan');
  useEffect(() => { setTier(plan === 'pro' ? 'pro' : 'all'); }, [plan, tab]);
  const load = useCallback(async () => {
    if (tab === 'email') return;
    setBusy(true); setError(''); setItems([]); setDetail(null);
    try {
      const path = tab === 'exams' ? `/exams?days=${days}` : tab === 'access' ? '/admins' : tab === 'email' ? '/email' : '/users';
      const data = await adminRequest('/admin/workspace' + path);
      setItems(data.items); setCursor(data.cursor);
      if (data.truncated) setError('This report reached its scan limit and may be incomplete.');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }, [tab, days]);
  useEffect(() => { load(); }, [load]);

  const action = async fn => { setBusy(true); setError(''); try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const filtered = items.filter(item => (tier === 'all' || (item.usage?.tier || 'free') === tier) && `${item.email} ${item.name} ${item.uid}`.toLowerCase().includes(search.toLowerCase()));
  return <main className="admin-workspace">
    <header><p>ADMIN WORKSPACE · {identity.email}</p><h1>{tab === 'users' && plan === 'pro' ? 'Pro members' : { users: 'Users & usage', exams: 'Upcoming exams', email: 'Email', access: 'Manage admins' }[tab]}</h1></header>
    {error && <p role="alert">{error}</p>}{busy && <p role="status">Working…</p>}
    {(tab === 'users' || tab === 'exams') && <>
      <div className="admin-controls"><input aria-label="Search loaded users" placeholder="Search loaded users by name or email" value={search} onChange={e => setSearch(e.target.value)} /><select aria-label="Plan" value={tier} onChange={e => setTier(e.target.value)}><option value="all">All plans</option><option value="free">Free</option><option value="pro">Pro</option></select>{tab === 'exams' && <select aria-label="Exam window" value={days} onChange={e => setDays(Number(e.target.value))}>{[7,14,30,90].map(n => <option key={n} value={n}>Next {n} days</option>)}</select>}</div>
      <p>{filtered.length} shown · {items.length} loaded. Usage is the stored generation count for each user’s usage window, not lifetime activity.</p>
      <div className="admin-table"><table><thead><tr><th>User</th><th>Plan</th><th>Usage</th><th>{tab === 'exams' ? 'Exam' : 'Last activity'}</th><th>Actions</th></tr></thead><tbody>{filtered.map(item => <tr key={item.uid + (item.id || '')}><td>{item.email || item.uid}<small>{item.name}</small></td><td>{item.usage?.tier || 'free'}</td><td>{item.usage?.count ?? '—'}</td><td>{tab === 'exams' ? <>{item.date}<small>{item.source}</small></> : date(item.lastActive)}</td><td><button disabled={busy} onClick={() => action(async () => setDetail({ email: item.email, ...await adminRequest('/admin/workspace/users/' + encodeURIComponent(item.uid)) }))}>View activity</button> <Link to={'/admin/email?uid=' + encodeURIComponent(item.uid)}>Write email</Link></td></tr>)}</tbody></table></div>
      {!busy && !filtered.length && <p>No matching users.</p>}
      {cursor && tab === 'users' && <button disabled={busy} onClick={() => action(async () => { const data = await adminRequest('/admin/workspace/users?cursor=' + encodeURIComponent(cursor)); setItems(old => [...old, ...data.items]); setCursor(data.cursor); })}>Load more users</button>}
      {detail && <section><h2>{detail.email} · Activity</h2>{detail.truncated && <p>Showing up to 100 exams and conversations.</p>}<h3>Exams</h3>{detail.exams.map(exam => <p key={exam.id}>{exam.name || exam.subject} · {date(exam.date)}</p>)}<h3>Conversations</h3>{detail.chats.map(chat => <p key={chat.id}>{chat.title || 'Untitled'} · {date(chat.updatedAt || chat.createdAt)}</p>)}</section>}
    </>}
    {tab === 'access' && identity.role === 'owner' && <><form onSubmit={e => { e.preventDefault(); action(async () => { await api('/admins', { email }); setEmail(''); await load(); }); }}><label>Existing account email<input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></label><button disabled={busy}>Grant admin access</button></form>{items.map(item => <p key={item.uid}>{item.email} · {item.role} · {item.active ? 'Active' : 'Revoked'} {item.role !== 'owner' && item.active && <button disabled={busy} onClick={() => action(async () => { await api('/admins/' + item.uid, null, 'DELETE'); await load(); })}>Revoke access</button>}</p>)}</>}
    {tab === 'email' && <AdminEmail uid={uid} />}
  </main>;
}

