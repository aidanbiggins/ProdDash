// Legacy V1 Components Index
// @deprecated Use V2 components from '../v2' for new development
//
// These exports are maintained for backward compatibility with the /v1 route.
// See ./README.md for migration status and approved usage patterns.

/** @deprecated Use AppLayoutV2 from '../v2' */
export { ProductivityDashboard } from './ProductivityDashboard';

// Tab Components - @deprecated, use V2 equivalents where available
/** @deprecated Use OverviewTabV2 from '../v2' */
export { OverviewTab } from './overview/OverviewTab';
/** @deprecated Use RecruiterDetailTabV2 from '../v2' */
export { RecruiterDetailTab } from './recruiter-detail/RecruiterDetailTab';
/** @deprecated Use HMFrictionTabV2 from '../v2' */
export { HMFrictionTab } from './hm-friction/HMFrictionTab';
/** @deprecated Use HiringManagersTabV2 from '../v2' */
export { HiringManagersTab } from './hiring-managers';
/** @deprecated Embedded in DiagnoseTabV2 - no standalone V2 version */
export { BottlenecksTab } from './bottlenecks';
/** @deprecated Embedded in DiagnoseTabV2 - no standalone V2 version */
export { QualityTab } from './quality/QualityTab';
/** @deprecated Embedded in DiagnoseTabV2 - no standalone V2 version */
export { SourceEffectivenessTab } from './source-effectiveness/SourceEffectivenessTab';
/** @deprecated Embedded in DiagnoseTabV2 - no standalone V2 version */
export { VelocityInsightsTab } from './velocity-insights/VelocityInsightsTab';
/** @deprecated Embedded in PlanTabV2 - no standalone V2 version */
export { CapacityTab } from './capacity/CapacityTab';
/** @deprecated Embedded in PlanTabV2 - no standalone V2 version */
export { CapacityRebalancerTab } from './capacity-rebalancer/CapacityRebalancerTab';
/** @deprecated Embedded in PlanTabV2 - no standalone V2 version */
export { ForecastingTab } from './forecasting';
/** @deprecated Embedded in PlanTabV2 - no standalone V2 version */
export { default as ScenarioLibraryTab } from './scenarios/ScenarioLibraryTab';
/** @deprecated Embedded in SettingsTabV2 - no standalone V2 version */
export { DataHealthTab } from './data-health';
/** @deprecated Use CommandCenterV2 from '../command-center' */
export { ControlTowerTab } from './control-tower';
/** @deprecated Use AskPlatoVueV2 from '../v2' */
export { AskPlatoVueTab } from './ask-platovue';
/** @deprecated Use CommandCenterV2 from '../command-center' */
export { CommandCenterView } from './command-center';

// Settings Components - @deprecated, embedded in SettingsTabV2
/** @deprecated Embedded in SettingsTabV2 - no standalone V2 version */
export { SlaSettingsTab } from './settings/SlaSettingsTab';
/** @deprecated Embedded in SettingsTabV2 - no standalone V2 version */
export { AiSettingsTab } from './settings/AiSettingsTab';
/** @deprecated Embedded in SettingsTabV2 - no standalone V2 version */
export { OrgSettingsTab } from './settings/OrgSettingsTab';
