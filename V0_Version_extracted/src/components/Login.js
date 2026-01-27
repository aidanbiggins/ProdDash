import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const Login = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [searchParams] = useSearchParams();

  // Get return URL from query params (for invite redirects, etc.)
  const returnUrl = searchParams.get('returnUrl') || '/';

  // Google Sign-In handler
  const handleGoogleSignIn = async () => {
    if (!supabase) {
      setMessage('Error: Application is missing Supabase configuration.');
      return;
    }

    setGoogleLoading(true);
    setMessage('');

    // Always redirect to onboarding after Google sign-in for org selection
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/onboarding${returnUrl !== '/' ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ''}`,
      },
    });

    if (error) {
      setMessage(`Error: ${error.message}`);
      setGoogleLoading(false);
    }
    // On success, user is redirected to Google, so no need to reset state
  };

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
    // Redirect to onboarding for org selection, then to final destination
    const finalRedirect = returnUrl !== '/' ? `?returnUrl=${encodeURIComponent(returnUrl)}` : '';
    const redirectUrl = `${window.location.origin}/onboarding${finalRedirect}`;

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
      <div className="max-w-7xl mx-auto px-4 flex flex-col items-center justify-center h-screen">
        <div className="bg-bg-glass border border-bad rounded-lg p-8 shadow-sm text-center" style={{ maxWidth: '500px' }}>
          <h1 className="text-xl font-semibold mb-3 text-bad">Setup Required</h1>
          <p className="text-lg">Database connection missing.</p>
          <p>The app cannot persist data or log you in until you connect it to Supabase.</p>
          <hr className="my-4 border-glass-border" />
          <p className="text-sm text-muted-foreground">See <code>setup_supabase.md</code> for instructions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 flex flex-col items-center justify-center h-screen">
      <div className="bg-bg-glass border border-glass-border rounded-lg p-8 shadow-sm" style={{ maxWidth: '400px', width: '100%' }}>
        <h1 className="text-xl font-semibold mb-4 text-center">Recruiting Planner</h1>
        <p className="text-muted-foreground text-center mb-4">Sign in to access shared data</p>

        {/* Google Sign-In Button */}
        <button
          type="button"
          className="inline-flex items-center justify-center w-full px-4 py-2 text-sm font-medium rounded-md bg-transparent text-foreground border border-glass-border hover:bg-white/10 gap-2 mb-3"
          onClick={handleGoogleSignIn}
          disabled={googleLoading || loading}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {googleLoading ? 'Connecting...' : 'Sign in with Google'}
        </button>

        <div className="flex items-center mb-3">
          <hr className="grow border-glass-border" />
          <span className="px-2 text-muted-foreground text-sm">or</span>
          <hr className="grow border-glass-border" />
        </div>

        <form onSubmit={handleLogin}>
          <div className="mb-3">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Email address</label>
            <input
              type="email"
              className="w-full px-3 py-2 text-sm bg-bg-glass border border-glass-border rounded-md focus:border-primary focus:outline-none"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center w-full px-4 py-2 text-sm font-medium rounded-md bg-primary text-background hover:bg-accent-hover"
            disabled={loading || googleLoading}
          >
            {loading ? 'Sending link...' : 'Send Magic Link'}
          </button>
        </form>

        {message && (
          <div className={`mt-3 p-3 rounded-lg border ${message.includes('Error') ? 'bg-bad-bg border-bad/20 text-bad-text' : 'bg-good-bg border-good/20 text-good-text'}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
