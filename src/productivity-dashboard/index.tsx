// Productivity Dashboard Entry Point

import React from 'react';
import { DashboardProvider } from './hooks/useDashboardContext';
import { ProductivityDashboard } from './components/ProductivityDashboard';

export function RecruiterProductivityDashboard() {
  return (
    <DashboardProvider>
      <ProductivityDashboard />
    </DashboardProvider>
  );
}

// Also export individual components for flexibility
export * from './types';
export * from './services';
export * from './components';
export { DashboardProvider, useDashboard } from './hooks/useDashboardContext';
