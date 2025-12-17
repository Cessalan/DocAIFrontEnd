import { useState, useEffect } from "react";
import { Navigate, Link, useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { handleCreateUserWithEmailAndPassword, handleSignInWithGoogleAccount, handleSignInWithAppleAccount } from "../../Firebase/auth";
import { useAuth } from "../../Contexts/AuthContext/AuthContext";
import { auth } from "../../Firebase/config";
import ThemeToggle, { useDarkMode } from '../Common/ThemeToggle';
import NurseQuizMascot from '../QuizRoom/NurseQuizMascot';

import './AuthPage.css' // Reuse the same styles

// translation
import { useTranslation } from 'react-i18next';

const Signup = () => {
  // State for form inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // State for errors and loading
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { isUserLoggedIn } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Theme
  const [isDarkMode] = useDarkMode();

  // Get redirect parameters - support both search params and location state
  const returnTo = location.state?.returnTo || searchParams.get('returnTo');
  const returnMessage = location.state?.message;
  const prompt = searchParams.get('prompt');
  const quizTopic = searchParams.get('quizTopic');

  // translation
  const { t } = useTranslation();

  // Store quiz context in sessionStorage for post-login redirect
  useEffect(() => {
    if (prompt && quizTopic) {
      sessionStorage.setItem('pendingQuizPrompt', prompt);
      sessionStorage.setItem('pendingQuizTopic', quizTopic);
    }
  }, [prompt, quizTopic]);

  // Handle redirect after successful signup (same logic as Login)
  useEffect(() => {
    if (isUserLoggedIn && returnTo) {
      // ------------------------------------------
      // CASE 1: Check for pending quiz state (from quiz page)
      // ------------------------------------------
      const pendingQuizState = sessionStorage.getItem('pendingQuizState');
      if (pendingQuizState) {
        try {
          const quizState = JSON.parse(pendingQuizState);
          // Check if the session is still valid (less than 30 minutes old)
          const isValid = Date.now() - quizState.timestamp < 30 * 60 * 1000;
          if (isValid) {
            // Navigate back to quiz with restored state
            // Include returningFromLogin flag to bypass refresh protection
            navigate(returnTo, {
              state: {
                chatId: quizState.chatId,
                title: quizState.title,
                isGameMode: quizState.isGameMode,
                fromUpload: quizState.fromUpload,
                returningFromLogin: true  // Important: tells quiz page this is not a refresh
              },
              replace: true
            });
            // Clear the pending state after using it
            sessionStorage.removeItem('pendingQuizState');
            return;
          }
        } catch (e) {
          console.error('Failed to restore quiz state:', e);
        }
        // Clear invalid session
        sessionStorage.removeItem('pendingQuizState');
      }

      // ------------------------------------------
      // CASE 2: Check for pending upload (from landing page)
      // If user was trying to upload a file before signing up,
      // navigate to /c - since user is now logged in, the ChatLayout
      // will render and the pending upload will be handled
      // ------------------------------------------
      const pendingUploadState = sessionStorage.getItem('pendingUploadState');
      if (pendingUploadState) {
        // Navigate to /c - the upload will be restored there
        navigate('/c', { replace: true });
        return;
      }

      // ------------------------------------------
      // CASE 3: Default - just navigate to returnTo
      // ------------------------------------------
      navigate(returnTo, { replace: true });
    }
  }, [isUserLoggedIn, returnTo, navigate]);

  const handleSubmit = async (e) => {

    e.preventDefault();

    if (password !== confirmPassword) {
      return setError("Passwords do not match");
    }

    try {
      setError('');
      setLoading(true);

      console.log("Creating user with Firebase" , email, password);
      // Create user with Firebase
      await  handleCreateUserWithEmailAndPassword (auth,email, password);

    } catch (err) {
      console.error("Error signing up:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const onGoogleSignIn = async () => {
    try {
      setError('');
      setLoading(true);
      await handleSignInWithGoogleAccount();
      navigate('/c');
    } catch (error) {
      console.error("Error signing in with Google:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

    // Apple Sign-In handler
  const onAppleSignIn = async() => {
    try{
      setError('');
      setLoading(true);
      await handleSignInWithAppleAccount();
      navigate('/c');
    }catch(error){
      console.error("Error signing in with Apple:", error);
      setError(error.message);
    }finally{
      setLoading(false);
    }
  }

  return (
    <div className={`auth-page ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>
      {/* Only redirect to home if logged in AND no returnTo specified */}
      {/* If returnTo is set, the useEffect will handle the redirect with restored state */}
      {isUserLoggedIn && !returnTo && <Navigate to="/c" replace={true} />}

      {/* Scattered doodle decorations for organic feel */}
      <div className="doodle-elements" aria-hidden="true">
        <span className="star-doodle star-doodle-1">✦</span>
        <span className="star-doodle star-doodle-2">✧</span>
        <span className="star-doodle star-doodle-3">✦</span>
      </div>

      {/* Theme toggle in corner */}
      <div className="auth-theme-toggle">
        <ThemeToggle />
      </div>

      <div className="login-container">
        {/* Mascot */}
        <div className="auth-mascot">
          <NurseQuizMascot size={90} isExcited={true} />
        </div>

        {/* Show return message if present */}
        {returnMessage && !isUserLoggedIn && (
          <div className="return-message">
            {returnMessage}
          </div>
        )}

        <h2>{t("signup.title")}</h2>

        {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit} className="login-form">
        <div className="input-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder={t("login.emailPlaceHolder")}
          />
        </div>

        <div className="input-group">
          <label htmlFor="password">{t("login.password")}</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder={t("login.passwordPlaceHolder")}
            minLength="6"
          />
        </div>

        <div className="input-group">
          <label htmlFor="confirm-password">{t("signup.passwordConfirm")}</label>
          <input
            type="password"
            id="confirm-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            placeholder={t("login.passwordPlaceHolder")}
            minLength="6"
          />
        </div>

        <button type="submit" className="login-button" disabled={loading}>
          {loading ? 'Signing up...' : t("signup.signup")}
        </button>
      </form>

      <button
        type="button"
        className="google-login-button"
        onClick={onGoogleSignIn}
        onTouchEnd={(e) => { e.preventDefault(); onGoogleSignIn(); }}
        disabled={loading}
      >
        <img 
          src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
          alt="Google logo" 
          className="google-logo"
        />
        <span>{t("signup.signupGoogle")}</span>
      </button>

           {/* <button 
            type="button"
            className="apple-login-button social-button"
            onClick={onAppleSignIn}
            disabled={loading}
          >
            <svg 
              className="social-logo apple-logo" 
              viewBox="0 0 24 24" 
              width="20" 
              height="20"
            >
              <path fill="currentColor" 
              d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            <span>{t('login.apple')}</span>
      </button> */}

        <div className="login-links">
          <p>
            {t("signup.haveAccount")} <Link to="/login">{t("signup.login")} </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
