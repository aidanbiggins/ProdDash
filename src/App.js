import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard'; // Legacy dashboard
import ComparisonView from './components/ComparisonView'; // Legacy
import { RecruiterProductivityDashboard } from './productivity-dashboard';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Protected route wrapper
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="d-flex justify-content-center align-items-center vh-100">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return children;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />

      {/* Main Dashboard - Protected */}
      <Route path="/" element={
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
      </Router>
    </AuthProvider>
  );
}

export default App;