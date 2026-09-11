import { useState, useEffect } from "react";
import { Navigate, Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { handleSignInWithEMailAndPassword,handleSignInWithGoogleAccount, handleSignInWithAppleAccount } from "../../Firebase/auth";
import { useAuth } from "../../Contexts/AuthContext/AuthContext";
import { safeReturnTo } from '../../utils/safeReturnTo';
import ThemeToggle, { useDarkMode } from '../Common/ThemeToggle';
import NurseQuizMascot from '../QuizRoom/NurseQuizMascot';
import './AuthPage.css'

// translation
import { useTranslation } from 'react-i18next';
import { hasPendingFiles } from '../../utils/pendingUploadStore';

const Login = () => {
  // State for form inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // State for handling errors
  const [error, setError] = useState('');

  // State for tracking login process
  const [loading, setLoading] = useState(false);

  // Get authentication context
  const { isUserLoggedIn } = useAuth();

  // Theme
  const [isDarkMode] = useDarkMode();

  // Get location for return redirect
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Also accept ?returnTo= so the static SEO landing pages in public/ can hand
  // off intent (e.g. /login?returnTo=/nclex). Sanitised: the value arrives from
  // a URL anyone can craft, so it must never reach navigate() unchecked.
  const returnTo = safeReturnTo(location.state?.returnTo || searchParams.get('returnTo'));
  const returnMessage = location.state?.message;

  // translation
  const { t } = useTranslation();

  const handleSubmit = async(e) => {
    
    e.preventDefault();

    if(!isUserLoggedIn){

      try{
        // Reset error state on new attempt
       setError('');

       // Set loading state to show spinner/disable button
       setLoading(true);

       // Attempt to sign in with Firebase
       // This will trigger the onAuthStateChanged listener
       await handleSignInWithEMailAndPassword(email, password);

       // Navigate to the chat interface after successful login
       navigate(returnTo || '/c');
     
      }catch(error)
      {
          console.error("Error signing in with email and password:", error);
          setError(error.message);
      }
      finally{
          setLoading(false);
      } 
    }
 
  }

  const onGoogleSignIn = async() => {
    try{
      setError('');
      setLoading(true);
      await handleSignInWithGoogleAccount();

      // Navigate to the chat interface after successful login
      navigate(returnTo || '/c');

    }catch(error){
      console.error("Error signing in with Google:", error);
      setError(error.message);
    }finally{
      setLoading(false);
    }
  }


  // Apple Sign-In handler
  const onAppleSignIn = async() => {
    try{
      setError('');
      setLoading(true);
      await handleSignInWithAppleAccount();
      navigate(returnTo || '/c');
    }catch(error){
      console.error("Error signing in with Apple:", error);
      setError(error.message);
    }finally{
      setLoading(false);
    }
  }

  // Handle redirect after successful login
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
      // If user was trying to upload a file before logging in,
      // navigate to /c - since user is now logged in, the ChatLayout
      // will render and the pending upload will be handled
      // ------------------------------------------
      if (hasPendingFiles()) {
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

  return (
    <div className={`auth-page ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>
      {/* Only redirect to home if logged in AND no returnTo specified */}
      {isUserLoggedIn && !returnTo && <Navigate to="/c" replace = {true} />}

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

        <h2>{t('login.title')}</h2>

        {/* Display error message if there is one */}
        {error && <div className="error-message">{error}</div>}
  
      <form onSubmit={handleSubmit} className="login-form">
        <div className="input-group">
          <label htmlFor="email">{t('login.email')}</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder={t('login.emailPlaceHolder')}
          />
        </div>
  
        <div className="input-group">
          <label htmlFor="password">{t('login.password')}</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder={t('login.passwordPlaceHolder')}
            minLength="6"
          />
        </div>
  
        <button 
          type="submit" 
          className="login-button" 
          disabled={loading}
        >
          {loading ? t('login.loading') : t('login.login')}
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
        <span>{t('login.google')}</span>
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
  
        {/* Additional links */}
        <div className="login-links">
          <p>
            {t('login.noAccount')} <a href="/signup"> {t('login.signup')} </a>
          </p>
          <p>
            <a href="/forgot-password">{t('login.forgotPassword')}</a>
          </p>
        </div>
      </div>
    </div>
  );
  

}

export default Login;