import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard'; // Legacy dashboard
import ComparisonView from './components/ComparisonView'; // Legacy
import { RecruiterProductivityDashboard } from './productivity-dashboard';
import { CommandCenterV2, AppLayoutV2 } from './productivity-dashboard/components/v2';
import { InviteAcceptPage } from './components/InviteAcceptPage';
import OnboardingPage from './components/OnboardingPage';
import { LandingPage } from './components/landing/LandingPage';
import { AboutPage } from './components/landing/AboutPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SERVICE_ROLE_KEY_PRESENT_BUT_DISABLED } from './lib/supabase';

// Developer warning banner - only shows on localhost when service role key is present but disabled
function DevServiceRoleWarning() {
  const [dismissed, setDismissed] = React.useState(false);

  if (!SERVICE_ROLE_KEY_PRESENT_BUT_DISABLED || dismissed) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '1rem',
      right: '1rem',
      backgroundColor: '#dc2626',
      color: '#ffffff',
      padding: '1rem 1.25rem',
      borderRadius: '0.5rem',
      fontSize: '0.875rem',
      maxWidth: '380px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      zIndex: 9999,
      fontFamily: 'system-ui, sans-serif',
      lineHeight: 1.5,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div>
          <div style={{ fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.9375rem' }}>
            ⚠️ Admin Features Disabled
          </div>
          <div>
            Service role key found but not enabled.
            <br />
            <span style={{ opacity: 0.9 }}>
              Set <code style={{
                backgroundColor: 'rgba(255,255,255,0.2)',
                padding: '0.125rem 0.375rem',
                borderRadius: '0.25rem',
                fontFamily: 'monospace',
                fontSize: '0.8125rem'
              }}>REACT_APP_DEV_BYPASS_AUTH=true</code> in .env
            </span>
            <br />
            <span style={{ opacity: 0.9 }}>then run <code style={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              padding: '0.125rem 0.375rem',
              borderRadius: '0.25rem',
              fontFamily: 'monospace',
              fontSize: '0.8125rem'
            }}>npm run build</code> again.</span>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1.25rem',
            color: '#ffffff',
            padding: '0.25rem 0.5rem',
            lineHeight: 1,
            borderRadius: '0.25rem',
          }}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// Login route that redirects logged-in users to returnUrl or home
function LoginRoute() {
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') || '/';

  console.log('[LoginRoute] Render - loading:', loading, 'user:', !!user);

  // Wait for auth to finish loading before deciding
  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (user) {
    console.log('[LoginRoute] User found, redirecting to:', returnUrl);
    return <Navigate to={returnUrl} />;
  }
  console.log('[LoginRoute] No user, showing login');
  return <Login />;
}

// Protected route wrapper
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  console.log('[ProtectedRoute] Render - loading:', loading, 'user:', !!user);

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (!user) {
    console.log('[ProtectedRoute] No user, redirecting to /login');
    return <Navigate to="/login" />;
  }

  return children;
}

// Home route - shows landing page for unauthenticated users, dashboard for authenticated
function HomeRoute() {
  const { user, loading, supabaseUser } = useAuth();

  console.log('[HomeRoute] Render - loading:', loading, 'user:', !!user, 'supabaseUser:', !!supabaseUser);

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  // Unauthenticated users see the landing page
  // Check both user (AuthUser) and supabaseUser to be safe
  if (!user && !supabaseUser) {
    console.log('[HomeRoute] No user, showing landing page');
    return <LandingPage />;
  }

  // Authenticated users see the V2 dashboard
  console.log('[HomeRoute] User found, showing V2 dashboard');
  return <AppLayoutV2 />;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/about" element={<AboutPage />} />

      {/* Invite Accept Page - accessible without login but requires login to accept */}
      <Route path="/invite/:token" element={<InviteAcceptPage />} />

      {/* Onboarding - Post sign-in org selection/creation */}
      <Route path="/onboarding" element={
        <ProtectedRoute>
          <OnboardingPage />
        </ProtectedRoute>
      } />

      {/* Main Route - Landing page for unauthenticated, Dashboard for authenticated */}
      <Route path="/" element={<HomeRoute />} />

      {/* IA Routes - all handled by the V2 dashboard */}
      <Route path="/command-center" element={<HomeRoute />} />
      <Route path="/ops" element={<HomeRoute />} />
      <Route path="/control-tower" element={<Navigate to="/ops" replace />} />
      <Route path="/ask" element={<HomeRoute />} />
      <Route path="/diagnose/*" element={<HomeRoute />} />
      <Route path="/plan/*" element={<HomeRoute />} />
      <Route path="/settings/*" element={<HomeRoute />} />

      {/* Legacy deep links - resolved by V2 routing helpers */}
      <Route path="/overview" element={<HomeRoute />} />
      <Route path="/recruiter" element={<HomeRoute />} />
      <Route path="/hm-friction" element={<HomeRoute />} />
      <Route path="/hiring-managers" element={<HomeRoute />} />
      <Route path="/quality" element={<HomeRoute />} />
      <Route path="/source-mix" element={<HomeRoute />} />
      <Route path="/velocity" element={<HomeRoute />} />
      <Route path="/capacity" element={<HomeRoute />} />
      <Route path="/forecasting" element={<HomeRoute />} />
      <Route path="/data-health" element={<HomeRoute />} />

      {/* Legacy V1 Dashboard - accessible via /v1
          @deprecated Use V0/V2 dashboard at '/' for new development.
          This route is maintained for backward compatibility only.
          See src/productivity-dashboard/components/_legacy/README.md */}
      <Route path="/v1" element={
        <ProtectedRoute>
          <RecruiterProductivityDashboard />
        </ProtectedRoute>
      } />
      <Route path="/v1/*" element={
        <ProtectedRoute>
          <RecruiterProductivityDashboard />
        </ProtectedRoute>
      } />

      {/* Legacy Routes */}
      <Route path="/productivity" element={<Navigate to="/" />} />
      <Route path="/legacy-dashboard" element={
        <ProtectedRoute>
          <Dashboard user={user} socket={null} />
        </ProtectedRoute>
      } />
      <Route path="/compare" element={
        <ProtectedRoute>
          <ComparisonView socket={null} />
        </ProtectedRoute>
      } />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
        <DevServiceRoleWarning />
      </Router>
    </AuthProvider>
  );
}

export default App;
