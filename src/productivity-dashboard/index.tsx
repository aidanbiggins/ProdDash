// Productivity Dashboard Entry Point

import React from 'react';
import { DashboardProvider } from './hooks/useDashboardContext';
import { DataMaskingProvider } from './contexts/DataMaskingContext';
import { ProductivityDashboard } from './components/ProductivityDashboard';

export function RecruiterProductivityDashboard() {
  return (
    <DashboardProvider>
      <DataMaskingProvider>
        <ProductivityDashboard />
      </DataMaskingProvider>
    </DashboardProvider>
  );
}

// Also export individual components for flexibility
export * from './types';
export * from './services';
export * from './components';
export { DashboardProvider, useDashboard } from './hooks/useDashboardContext';
