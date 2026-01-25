import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard'; // Legacy dashboard
import ComparisonView from './components/ComparisonView'; // Legacy
import { RecruiterProductivityDashboard } from './productivity-dashboard';
import { InviteAcceptPage } from './components/InviteAcceptPage';
import OnboardingPage from './components/OnboardingPage';
import { LandingPage } from './components/landing/LandingPage';
import { AboutPage } from './components/landing/AboutPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';

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

  // Authenticated users see the dashboard
  console.log('[HomeRoute] User found, showing dashboard');
  return <RecruiterProductivityDashboard />;
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

      {/* New IA Routes - all handled by the dashboard */}
      <Route path="/control-tower" element={<HomeRoute />} />
      <Route path="/ask" element={<HomeRoute />} />
      <Route path="/diagnose/*" element={<HomeRoute />} />
      <Route path="/plan/*" element={<HomeRoute />} />
      <Route path="/settings/*" element={<HomeRoute />} />

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
      </Router>
    </AuthProvider>
  );
}

export default App;