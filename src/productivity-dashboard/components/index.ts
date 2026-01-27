// Components index - V0/V2 is the active design system

// Active V2 components
export * from './common';
export * from './CSVUpload';
export * from './StageMappingModal';

// Legacy V1 re-exports for backward compatibility
// @see ./_legacy/README.md for migration status
/** @deprecated Use V2 components from './v2' */
export * from './_legacy/overview';
/** @deprecated Use V2 components from './v2' */
export * from './_legacy/recruiter-detail';
/** @deprecated Use V2 components from './v2' */
export * from './_legacy/hm-friction';
/** @deprecated Use V2 components from './v2' */
export * from './_legacy/quality';
/** @deprecated Use AppLayoutV2 from './v2' for new development */
export * from './_legacy/ProductivityDashboard';
