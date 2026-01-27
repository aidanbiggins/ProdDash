// V2 Component Exports
import React from 'react';
import { DashboardProvider } from '../../hooks/useDashboardContext';
import { DataMaskingProvider } from '../../contexts/DataMaskingContext';
import { CommandCenterV2 as CommandCenterV2Inner } from './CommandCenterV2';
import { AppLayoutV2 as AppLayoutV2Inner } from './AppLayoutV2';

// Core Components
export { KPICardV2 } from './KPICardV2';
export { FilterBarV2 } from './FilterBarV2';
export { BottleneckPanelV2 } from './BottleneckPanelV2';
export { RequisitionsTableV2 } from './RequisitionsTableV2';
export { TeamCapacityPanelV2 } from './TeamCapacityPanelV2';
export { PipelineFunnelV2 } from './PipelineFunnelV2';

// Navigation
export { TopNavV2 } from './TopNavV2';
export type { TabId } from './TopNavV2';

// Inner components (without providers)
export { CommandCenterV2Inner };
export { AppLayoutV2Inner };

// Wrapped version with providers for standalone use
export function CommandCenterV2() {
  return (
    <DashboardProvider>
      <DataMaskingProvider>
        <CommandCenterV2Inner />
      </DataMaskingProvider>
    </DashboardProvider>
  );
}

// App Layout with providers for standalone use
export function AppLayoutV2() {
  return (
    <DashboardProvider>
      <DataMaskingProvider>
        <AppLayoutV2Inner />
      </DataMaskingProvider>
    </DashboardProvider>
  );
}

// Types
export * from './types';
