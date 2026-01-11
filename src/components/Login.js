import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const Login = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [searchParams] = useSearchParams();

  // Get return URL from query params (for invite redirects, etc.)
  const returnUrl = searchParams.get('returnUrl') || '/';

  const handleLogin = async (e) => {
    e.preventDefault();

    // 🔐 Secret dev bypass - just for us!
    if (email.toLowerCase() === 'admin@dev.local') {
      // Create fake session in localStorage
      const fakeSession = {
        access_token: 'dev-bypass-token',
        token_type: 'bearer',
        expires_in: 86400,
        expires_at: Math.floor(Date.now() / 1000) + 86400,
        user: {
          id: 'dev-admin-001',
          email: 'admin@dev.local',
          role: 'admin',
          user_metadata: { name: 'Dev Admin' }
        }
      };
      localStorage.setItem('dev-auth-bypass', JSON.stringify(fakeSession));
      window.location.href = returnUrl;
      return;
    }

    if (!supabase) {
      setMessage('Error: Application is missing Supabase configuration. Please see setup_supabase.md');
      return;
    }

    setLoading(true);
    setMessage('');

    // Using Magic Link for simplicity, but easy to add Google/Password
    // Include returnUrl in the redirect so user goes back to where they came from
    const redirectUrl = returnUrl !== '/'
      ? `${window.location.origin}${returnUrl}`
      : window.location.origin;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage('Magic link sent! Check your email.');
    }
    setLoading(false);
  };

  if (!supabase) {
    return (
      <div className="container d-flex flex-column align-items-center justify-content-center vh-100">
        <div className="card p-5 shadow-sm text-center border-danger" style={{ maxWidth: '500px' }}>
          <h1 className="h3 mb-3 text-danger">Setup Required</h1>
          <p className="lead">Database connection missing.</p>
          <p>The app cannot persist data or log you in until you connect it to Supabase.</p>
          <hr />
          <p className="small text-muted">See <code>setup_supabase.md</code> for instructions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container d-flex flex-column align-items-center justify-content-center vh-100">
      <div className="card p-5 shadow-sm" style={{ maxWidth: '400px', width: '100%' }}>
        <h1 className="h3 mb-4 text-center">Recruiting Planner</h1>
        <p className="text-muted text-center mb-4">Sign in to access shared data</p>

        <form onSubmit={handleLogin}>
          <div className="mb-3">
            <label className="form-label">Email address</label>
            <input
              type="email"
              className="form-control"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary w-100"
            disabled={loading}
          >
            {loading ? 'Sending link...' : 'Send Magic Link'}
          </button>
        </form>

        {message && (
          <div className={`mt-3 alert ${message.includes('Error') ? 'alert-danger' : 'alert-success'}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;