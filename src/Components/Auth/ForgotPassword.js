import { useState } from "react";
import { handlePasswordReset } from "../../Firebase/auth";
import { auth } from "../../Firebase/config";
import { Link } from "react-router-dom";
import './AuthPage.css' // Reuse same styling

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    try {
      setLoading(true);
      await handlePasswordReset(auth, email);    
    } catch (err) {
      //setError(err.message);
     
    } finally {
      setLoading(false);
      // show message no matter what
      setMessage("Password reset email sent! Please check your inbox.");
    }
  };

  return (
    <div className="login-container">
      <h2>Reset Your Password</h2>

      {error && <div className="error-message">{error}</div>}
      {message && <div className="success-message">{message}</div>}

      <form onSubmit={handleSubmit} className="login-form">
        <div className="input-group">
          <label htmlFor="email">Email Address</label>
          <input
            type="email"
            id="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <button type="submit" className="login-button" disabled={loading}>
          {loading ? 'Sending...' : 'Send Reset Email'}
        </button>
      </form>

      <div className="login-links">
        <p>
          Remembered your password? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
