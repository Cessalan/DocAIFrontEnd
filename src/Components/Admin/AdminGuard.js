import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { onIdTokenChanged } from 'firebase/auth';
import { auth } from '../../Firebase/config';
import { adminRequest } from '../../Services/AdminService';
import './AdminWorkspace.css';
export default function AdminGuard() {
  const location = useLocation();
  const [state, setState] = useState({ loading: true });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let generation = 0;
    const unsubscribe = onIdTokenChanged(auth, async user => {
      const current = ++generation;
      setState({ loading: true });
      if (!user) { setState({ error: 'Sign in with your admin account.', signIn: true }); return; }
      try { const identity = await adminRequest('/admin/workspace/me'); if (current === generation) setState({ identity }); }
      catch (error) { if (current === generation) setState({ error: error.message, signIn: error.status === 401 }); }
    });
    return () => { generation++; unsubscribe(); };
  }, [attempt]);
  if (state.loading) return <main className="admin-workspace">Checking admin access…</main>;
  if (state.error) return <main className="admin-workspace"><h1>Admin access</h1><p role="alert">{state.error}</p>{state.signIn ? <Link to="/login">Sign in</Link> : <button onClick={() => setAttempt(value => value + 1)}>Retry connection</button>}</main>;
  const pro = new URLSearchParams(location.search).get('plan') === 'pro';
  const tabs = [
    ['/admin/paywall', 'Paywall'], ['/admin?plan=pro', 'Pro members'],
    ['/admin/email', 'Email'], ['/admin', 'Users & usage'],
    ['/admin/exams', 'Upcoming exams'], ['/admin/satisfaction', 'Satisfaction'],
    ['/admin/conversations', 'Conversations'], ['/admin/question-bank', 'Question bank'],
    ...(state.identity.role === 'owner' ? [['/admin/access', 'Admin access']] : []),
  ];
  return <><nav className="admin-navigation" aria-label="Admin sections"><span className="admin-navigation-label">Admin</span><div className="admin-navigation-tabs">{tabs.map(([to, label]) => {
    const active = to.startsWith('/admin?') ? location.pathname === '/admin' && pro : to === '/admin' ? location.pathname === '/admin' && !pro : location.pathname === to;
    return <Link key={to} to={to} aria-current={active ? 'page' : undefined}>{label}</Link>;
  })}</div></nav><Outlet context={state.identity} /></>;
}
