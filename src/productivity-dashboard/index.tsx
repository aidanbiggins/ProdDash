// Productivity Dashboard Entry Point
//
// V0/V2 Architecture:
// - Active: AppLayoutV2 at '/' - see ./components/v2/
// - Legacy: RecruiterProductivityDashboard at '/v1' - see ./components/_legacy/
//
// New development should use V2 components. Legacy components are fenced
// in _legacy/ and maintained only for backward compatibility.

import React from 'react';
import { DashboardProvider } from './hooks/useDashboardContext';
import { DataMaskingProvider } from './contexts/DataMaskingContext';
import { ProductivityDashboard } from './components/_legacy/ProductivityDashboard';

/**
 * @deprecated Use AppLayoutV2 from './components/v2' for new development.
 * This component is maintained for backward compatibility with the /v1 route.
 */
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
