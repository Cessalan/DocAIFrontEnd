import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { handleSignInWithEMailAndPassword,handleSignInWithGoogleAccount, handleSignInWithAppleAccount } from "../../Firebase/auth";
import { useAuth } from "../../Contexts/AuthContext/AuthContext";
import './AuthPage.css'

// translation
import { useTranslation } from 'react-i18next';

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

  // translation
  const { t, i18n } = useTranslation();

  // Add this to see what's happening
console.log('Detected language:', i18n.language);
console.log('Browser language:', navigator.language);
console.log('Available languages:', Object.keys(i18n.store.data));

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

       // Navigate to the home page after successful login
       Navigate('/');
     
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
      await handleSignInWithGoogleAccount();

      // Navigate to the home page after successful login
      Navigate('/');

    }catch(error){
      console.error("Error signing in with Google:", error);
    }
  }


  // Apple Sign-In handler
  const onAppleSignIn = async() => {
    try{
      setError('');
      setLoading(true);
      await handleSignInWithAppleAccount();
      Navigate('/');
    }catch(error){
      console.error("Error signing in with Apple:", error);
      setError(error.message);
    }finally{
      setLoading(false);
    }
  }

  return (
    <div className="login-container">

      {isUserLoggedIn && <Navigate to="/" replace = {true} />}
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
  );
  

}

export default Login;