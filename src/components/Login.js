import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

const Login = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!supabase) {
      setMessage('Error: Application is missing Supabase configuration. Please see setup_supabase.md');
      return;
    }

    setLoading(true);
    setMessage('');

    // Using Magic Link for simplicity, but easy to add Google/Password
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
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