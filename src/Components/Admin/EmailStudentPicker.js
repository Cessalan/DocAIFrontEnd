import React, { useEffect, useRef, useState } from 'react';
import { adminRequest } from '../../Services/AdminService';

export default function EmailStudentPicker({ selected, onChange, single, disabled }) {
  const [query, setQuery] = useState(''), [items, setItems] = useState([]), [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false), [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    setItems([]); setCursor(null); setLoading(true); setError('');
    const timer = setTimeout(async () => {
      try {
        const data = await adminRequest('/admin/workspace/email/students?q=' + encodeURIComponent(query));
        if (current === generation.current) { setItems(data.items || []); setCursor(data.cursor); }
      } catch (err) { if (current === generation.current) setError(err.message); }
      finally { if (current === generation.current) setLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); generation.current = current + 1; };
  }, [query]);
  const more = async () => {
    const current = generation.current;
    setLoading(true); setError('');
    try {
      const data = await adminRequest('/admin/workspace/email/students?q=' + encodeURIComponent(query) + '&cursor=' + encodeURIComponent(cursor));
      if (current === generation.current) { setItems(old => [...old, ...(data.items || [])]); setCursor(data.cursor); }
    } catch (err) { if (current === generation.current) setError(err.message); }
    finally { if (current === generation.current) setLoading(false); }
  };
  return <div className="email-student-picker">
    <label>Find a student<input type="search" maxLength={100} disabled={disabled} placeholder="Search by name or email" value={query} onChange={e => setQuery(e.target.value)} /></label>
    <div className="email-selected-students" aria-label="Selected students"><strong>{selected.length} {selected.length === 1 ? 'student' : 'students'} selected</strong>{selected.map(student => <button type="button" className="email-student-chip" disabled={disabled} key={student.email} onClick={() => onChange(selected.filter(s => s.email !== student.email))} aria-label={'Remove ' + student.email}>{student.name || student.email} <span aria-hidden="true">×</span></button>)}</div>
    {error && <p role="alert">{error}</p>}
    <div className="email-student-results" role="group" aria-label="Student search results">{items.map(student => {
      const checked = selected.some(s => s.email.toLowerCase() === student.email.toLowerCase());
      return <label key={student.uid}><input type="checkbox" checked={checked} disabled={disabled || (!single && !checked && selected.length >= 100)} onChange={() => onChange(checked ? selected.filter(s => s.email.toLowerCase() !== student.email.toLowerCase()) : single ? [student] : [...selected, student])} /><span><strong>{student.name || student.email}</strong><small>{student.email}</small></span></label>;
    })}</div>
    {loading && <p role="status">Finding students…</p>}
    {!loading && !error && !items.length && <p>No matching students. Try another name or email.</p>}
    {cursor && <button type="button" className="email-secondary" disabled={disabled || loading} onClick={more}>Show more matches</button>}
    <small>{single ? 'Choose one student.' : 'Choose up to 100 students.'} We check their account and email preferences again before sending.</small>
  </div>;
}
