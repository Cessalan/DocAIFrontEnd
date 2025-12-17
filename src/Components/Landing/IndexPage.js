import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../Contexts/AuthContext/AuthContext';
import { handleSignOut } from '../../Firebase/auth';

const styles = {
  page: {
    minHeight: '100vh',
    background:
      'radial-gradient(circle at 20% 20%, rgba(139, 92, 246, 0.15), transparent 35%),' +
      'radial-gradient(circle at 80% 0%, rgba(56, 189, 248, 0.15), transparent 32%),' +
      '#0f172a',
    color: '#e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px',
  },
  card: {
    width: '100%',
    maxWidth: '960px',
    background: 'rgba(15, 23, 42, 0.8)',
    border: '1px solid rgba(148, 163, 184, 0.25)',
    borderRadius: '18px',
    padding: '32px',
    boxShadow: '0 25px 80px rgba(0, 0, 0, 0.35)',
    backdropFilter: 'blur(6px)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
  },
  logo: {
    width: '48px',
    height: '48px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 700,
    margin: 0,
  },
  subtitle: {
    color: '#cbd5e1',
    margin: 0,
  },
  lead: {
    margin: '12px 0 20px',
    color: '#cbd5e1',
    fontSize: '16px',
    lineHeight: 1.6,
  },
  ctas: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    marginBottom: '20px',
  },
  primaryBtn: {
    background: '#8b5cf6',
    color: '#ffffff',
    padding: '12px 18px',
    borderRadius: '10px',
    textDecoration: 'none',
    fontWeight: 700,
    border: '1px solid rgba(139, 92, 246, 0.35)',
    boxShadow: '0 12px 30px rgba(139, 92, 246, 0.35)',
  },
  secondaryBtn: {
    background: '#0b1224',
    color: '#e2e8f0',
    padding: '12px 18px',
    borderRadius: '10px',
    textDecoration: 'none',
    fontWeight: 700,
    border: '1px solid rgba(148, 163, 184, 0.35)',
  },
  ghostBtn: {
    background: 'transparent',
    color: '#e2e8f0',
    padding: '12px 18px',
    borderRadius: '10px',
    textDecoration: 'none',
    fontWeight: 700,
    border: '1px dashed rgba(148, 163, 184, 0.45)',
  },
  logoutBtn: {
    background: 'transparent',
    color: '#94a3b8',
    padding: '8px 14px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
  },
  featureList: {
    listStyle: 'none',
    margin: '0 0 12px',
    padding: 0,
    display: 'grid',
    gap: '10px',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  },
  featureItem: {
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-start',
    color: '#cbd5e1',
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    borderRadius: '10px',
    padding: '10px 12px',
  },
  bullet: {
    color: '#8b5cf6',
    fontWeight: 700,
    marginTop: '1px',
  },
  footerNote: {
    color: '#94a3b8',
    fontSize: '14px',
  },
};

const IndexPage = () => {
  const { isUserLoggedIn } = useAuth();

  const featureList = [
    'Turn notes and PDFs into NCLEX-style quizzes',
    'Review rationales and track weaker topics',
    'Practice with AI tutor chat and flashcards',
    'Share or play quizzes with classmates',
  ];

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <img src="/NQWarmLogo.png" alt="NurseQuiz AI logo" style={styles.logo} />
          <div>
            <h1 style={styles.title}>NurseQuiz AI</h1>
            <p style={styles.subtitle}>Turn your notes into NCLEX-ready practice in minutes.</p>
          </div>
        </div>

        <p style={styles.lead}>
          Instantly generate quizzes, get clear rationales, and stay on top of weak areas, whether you are prepping for NCLEX or class exams.
        </p>

        <div style={styles.ctas}>
          {isUserLoggedIn ? (
            <>
              <Link to="/start" style={styles.primaryBtn}>Go to Dashboard</Link>
              <button onClick={handleSignOut} style={styles.logoutBtn}>Log out</button>
            </>
          ) : (
            <>
              <Link to="/signup" style={styles.primaryBtn}>Start free</Link>
              <Link to="/login" style={styles.secondaryBtn}>Log in</Link>
              <Link to="/start" style={styles.ghostBtn}>Try a sample quiz</Link>
            </>
          )}
        </div>

        <ul style={styles.featureList}>
          {featureList.map((item) => (
            <li key={item} style={styles.featureItem}>
              <span style={styles.bullet}>*</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <div style={styles.footerNote}>
          No account yet? Explore public quizzes or sign up for free; your progress syncs when you log in.
        </div>
      </div>
    </div>
  );
};

export default IndexPage;
