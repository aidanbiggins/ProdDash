// Main Productivity Dashboard Component (LEGACY V1)
// @deprecated Use AppLayoutV2 from '../v2' for new development.
// This component is maintained for backward compatibility with the /v1 route.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import '../../dashboard-theme.css'; // Import bespoke theme
import '../../platovue-ui.css'; // Import PlatoVue V2 UI styles
import { useDashboard, PersistenceProgress } from '../../hooks/useDashboardContext';
import { CSVUpload } from '../CSVUpload';
import { FilterBar } from '../common/FilterBar';
import { DataHealthBadge } from '../common/DataHealthBadge';
import { ProgressIndicator, ProgressPill } from '../common/ProgressIndicator';
import { TabSkeleton, KPISkeleton, ChartSkeleton, TableSkeleton } from '../common/Skeletons';
import { ClearDataConfirmationModal } from '../common/ClearDataConfirmationModal';
import { LogoSpinner } from '../common/LogoSpinner';
import { OverviewTab } from './overview/OverviewTab';
import { RecruiterDetailTab } from './recruiter-detail/RecruiterDetailTab';
import { HMFrictionTab } from './hm-friction/HMFrictionTab';
import { QualityTab } from './quality/QualityTab';
import { SourceEffectivenessTab } from './source-effectiveness/SourceEffectivenessTab';
import { StageMappingModal } from '../StageMappingModal';
import { HiringManagersTab } from './hiring-managers';
import { BottlenecksTab } from './bottlenecks';
import { VelocityInsightsTab } from './velocity-insights/VelocityInsightsTab';
import { ForecastingTab } from './forecasting';
import { DataHealthTab } from './data-health';
import { ControlTowerTab } from './control-tower';
import { CommandCenterView } from './command-center';
import { CapacityTab } from './capacity/CapacityTab';
import { CapacityRebalancerTab } from './capacity-rebalancer/CapacityRebalancerTab';
import { AskPlatoVueTab } from './ask-platovue';
import ScenarioLibraryTab from './scenarios/ScenarioLibraryTab';
import { exportAllRawData, calculateSourceEffectiveness, normalizeEventStages, calculateVelocityMetrics } from '../../services';
import { ClearProgress } from '../../services/dbService';
import { calculatePendingActions } from '../../services/hmMetricsEngine';
import { buildHMFactTables } from '../../services/hmFactTables';
import { DEFAULT_HM_RULES } from '../../config/hmRules';
import { useDataMasking } from '../../contexts/DataMaskingContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useUrlState } from '../../hooks/useUrlState';
import { useAuth } from '../../../contexts/AuthContext';
import { OrgSwitcher, CreateOrgModal } from '../OrgSwitcher';
import { OrgSettings } from '../OrgSettings';
import { ImportReview } from '../ImportReview';
import { SuperAdminPanel } from '../SuperAdminPanel';
import { createOrganization } from '../../services/organizationService';
import { AiProviderSettings } from './settings/AiProviderSettings';
import { useAiKeys } from '../../hooks/useAiVault';
import { AiProvider, DEFAULT_AI_CONFIG } from '../../types/aiTypes';
import { TopNav } from '../navigation';
import { useNewNavigation } from '../../hooks/useNewNavigation';
import { getPathFromTab, getTabFromPath, TabType } from '../../routes';
import '../layout/layout.css';
import '../navigation/navigation.css';
import { AiSettingsTab } from './settings/AiSettingsTab';
import { OrgSettingsTab } from './settings/OrgSettingsTab';
import { SlaSettingsTab } from './settings/SlaSettingsTab';
import { ActionItem } from '../../types/actionTypes';
import { useCapabilityEngine } from '../../hooks/useCapabilityEngine';
import { CoverageBanner } from '../common/CoverageBanner';
import { CoverageMapPanel } from '../common/CoverageMapPanel';

export function ProductivityDashboard() {
  const { state, importCSVs, updateFilters, selectRecruiter, refreshMetrics, refetchData, updateConfig, reset, clearPersistedData, generateEvents, needsEventGeneration, canImportData, clearOperations, aiConfig, setAiConfig, isAiEnabled } = useDashboard();
  const [showProgressPanel, setShowProgressPanel] = useState(false);
  const { isMasked, toggleMasking } = useDataMasking();
  const { currentOrg, user, refreshMemberships, supabaseUser, session, canManageMembers, signOut } = useAuth();
  const isMobile = useIsMobile();
  const { showNewNav, useLegacyNav, toggleLegacyNav } = useNewNavigation();
  const [activeTab, setActiveTab] = useState<TabType>('command-center');
  const [showStageMapping, setShowStageMapping] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [clearProgress, setClearProgress] = useState<ClearProgress | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [demoDismissed, setDemoDismissed] = useState(false);
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [showOrgSettings, setShowOrgSettings] = useState(false);
  const [showSuperAdminPanel, setShowSuperAdminPanel] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showImportReview, setShowImportReview] = useState(false);
  const [showCoverageMap, setShowCoverageMap] = useState(false);

  // Dev warning for legacy dashboard usage
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[ProdDash] You are using the legacy V1 dashboard (/v1). ' +
        'For new development, use the V0/V2 dashboard at /. ' +
        'See components/_legacy/README.md for migration status.'
      );
    }
  }, []);

  // Capability Engine - single source of truth for feature gating
  const capability = useCapabilityEngine(state.dataStore.coverageMetrics);

  // AI Keys - auto-load on sign-in
  const { keyState, loadKeys, getEffectiveKey } = useAiKeys();
  const [aiKeysLoaded, setAiKeysLoaded] = useState(false);

  // Shared manual actions state - persisted to localStorage
  const [manualActions, setManualActions] = useState<ActionItem[]>(() => {
    try {
      const stored = localStorage.getItem('platovue_manual_actions');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Persist manual actions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('platovue_manual_actions', JSON.stringify(manualActions));
    } catch (e) {
      console.warn('Failed to persist manual actions:', e);
    }
  }, [manualActions]);

  // Handler to add manual actions (from Ask PlatoVue)
  const handleAddManualActions = useCallback((actions: ActionItem[]) => {
    setManualActions(prev => {
      const existingIds = new Set(prev.map(a => a.action_id));
      const newActions = actions.filter(a => !existingIds.has(a.action_id));
      return [...prev, ...newActions];
    });
  }, []);

  // Auto-load AI keys when user is authenticated
  useEffect(() => {
    if (user?.id && !aiKeysLoaded) {
      loadKeys(currentOrg?.id ?? null).then(() => {
        setAiKeysLoaded(true);
      });
    }
  }, [user?.id, currentOrg?.id, aiKeysLoaded, loadKeys]);

  // Set aiConfig from loaded keys when keys are loaded
  // Respects the user's stored aiEnabled preference
  useEffect(() => {
    if (aiKeysLoaded && !keyState.isLoading && !aiConfig) {
      // Check if user has explicitly cleared the config (don't restore)
      const wasCleared = localStorage.getItem('platovue_ai_cleared') === 'true';
      if (wasCleared) {
        return; // User cleared config, don't auto-restore
      }

      // Check if user has explicitly disabled AI mode
      const storedAiEnabled = localStorage.getItem('platovue_ai_enabled');
      const aiEnabled = storedAiEnabled === null ? true : storedAiEnabled === 'true';

      // Try to get the effective key for default provider (openai)
      const providers: AiProvider[] = ['openai', 'anthropic', 'gemini', 'openai_compatible'];
      for (const provider of providers) {
        const key = getEffectiveKey(provider);
        if (key) {
          setAiConfig({
            ...DEFAULT_AI_CONFIG,
            provider,
            apiKey: key.apiKey,
            model: key.model || DEFAULT_AI_CONFIG.model,
            baseUrl: key.baseUrl,
            aiEnabled, // Respect stored preference
          });
          break;
        }
      }
    }
  }, [aiKeysLoaded, keyState.isLoading, aiConfig, getEffectiveKey, setAiConfig]);

  // Data hygiene state - req IDs to exclude from metrics
  const [excludedReqIds, setExcludedReqIds] = useState<Set<string>>(new Set());

  const handleToggleExclusion = (reqId: string) => {
    setExcludedReqIds(prev => {
      const next = new Set(prev);
      if (next.has(reqId)) {
        next.delete(reqId);
      } else {
        next.add(reqId);
      }
      return next;
    });
  };

  // Event generation state
  const [isGeneratingEvents, setIsGeneratingEvents] = useState(false);
  const [eventGenProgress, setEventGenProgress] = useState<{ processed: number; total: number; eventsGenerated: number } | null>(null);
  const [eventGenDismissed, setEventGenDismissed] = useState(false);
  const [persistProgress, setPersistProgress] = useState<PersistenceProgress | null>(null);
  const [eventGenComplete, setEventGenComplete] = useState<{ eventsGenerated: number; timestamp: number } | null>(null);

  // Fun encouraging messages for progress UI
  const encouragingMessages = [
    "Building your recruiting timeline... 🚀",
    "Generating interview events... 📅",
    "Processing candidate journeys... 🎯",
    "Almost there, stay caffeinated! ☕",
    "Your data is looking great! ✨",
    "Creating stage transitions... 🔄",
    "Mapping hiring manager activity... 📊",
    "This is totally worth the wait... 💪",
    "Crunching those numbers... 🔢",
    "Brewing insights from your data... 🍵"
  ];

  // Get current encouraging message based on progress
  const getCurrentMessage = (progress: PersistenceProgress | null): string => {
    if (!progress) return encouragingMessages[0];
    const messageIndex = Math.floor((progress.current / Math.max(progress.total, 1)) * (encouragingMessages.length - 1));
    return encouragingMessages[Math.min(messageIndex, encouragingMessages.length - 1)];
  };

  // Calculate time remaining estimate
  const getTimeRemaining = (progress: PersistenceProgress | null): string => {
    if (!progress || progress.current === 0) return 'Calculating...';
    const elapsed = Date.now() - progress.startTime;
    const rate = progress.current / elapsed; // items per ms
    const remaining = progress.total - progress.current;
    const msRemaining = remaining / rate;

    if (msRemaining < 1000) return 'Almost done!';
    if (msRemaining < 60000) return `~${Math.ceil(msRemaining / 1000)}s remaining`;
    return `~${Math.ceil(msRemaining / 60000)}m remaining`;
  };

  const isSuperAdmin = user?.isSuperAdmin || false;

  // Sync URL to tab state when new navigation is enabled
  useEffect(() => {
    if (!showNewNav) return;

    // Set initial tab from URL on mount
    const initialTab = getTabFromPath(window.location.pathname);
    if (initialTab !== activeTab) {
      setActiveTab(initialTab);
    }

    // Handle browser back/forward navigation
    const handlePopState = () => {
      const tab = getTabFromPath(window.location.pathname);
      setActiveTab(tab);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
    // Only run on showNewNav change, not on activeTab change (to avoid loops)
  }, [showNewNav]);

  const hasData = state.dataStore.requisitions.length > 0;
  const isDemo = state.dataStore.importSource === 'demo';
  // Only show stage mapping modal on fresh imports, not on data loaded from DB
  const needsStageMapping = hasData && !state.dataStore.config.stageMapping.isComplete && state.dataStore.importSource !== null;

  // Sync filters and tab with URL for shareable links
  useUrlState({
    filters: state.filters,
    activeTab,
    onFiltersChange: updateFilters,
    onTabChange: (tab) => setActiveTab(tab as TabType)
  });

  // Calculate source effectiveness metrics - ONLY when on source-mix tab
  const sourceEffectiveness = useMemo(() => {
    if (!hasData || activeTab !== 'source-mix') return null;
    const { requisitions, candidates, events, config } = state.dataStore;
    const normalizedEvents = normalizeEventStages(events, config.stageMapping);
    return calculateSourceEffectiveness(candidates, requisitions, normalizedEvents, state.filters);
  }, [hasData, activeTab, state.dataStore.requisitions, state.dataStore.candidates, state.dataStore.events, state.dataStore.config.stageMapping, state.filters]);

  // Calculate velocity metrics for decay analysis - ONLY when on velocity tab
  const velocityMetrics = useMemo(() => {
    if (!hasData || activeTab !== 'velocity') return null;
    const { requisitions, candidates, events, users } = state.dataStore;
    return calculateVelocityMetrics(candidates, requisitions, events, users, state.filters);
  }, [hasData, activeTab, state.dataStore.requisitions, state.dataStore.candidates, state.dataStore.events, state.dataStore.users, state.filters]);

  // NOTE: Removed redundant useEffect that was calling refreshMetrics on dateRange change
  // The context's debounced effect already handles this

  // Stage mapping modal can be opened manually from the header menu
  // Auto-popup disabled as config isn't persisted and would show on every page load

  // Handle recruiter selection
  const handleSelectRecruiter = (recruiterId: string) => {
    selectRecruiter(recruiterId);
    setActiveTab('recruiter');
  };

  const handleBackFromRecruiter = () => {
    selectRecruiter(null);
    setActiveTab('overview');
  };

  const handleExportRawData = () => {
    exportAllRawData(
      state.dataStore.requisitions,
      state.dataStore.candidates,
      state.dataStore.events,
      state.dataStore.users
    );
  };

  const handleCreateOrg = async (name: string) => {
    if (!supabaseUser?.id) throw new Error('Not authenticated');
    if (!session) throw new Error('Session expired. Please log in again.');
    await createOrganization({ name }, supabaseUser.id);
    // Don't await - let the modal close immediately while memberships refresh
    refreshMemberships().catch(err => {
      console.error('Failed to refresh memberships:', err);
    });
  };

  const handleClearDataConfirm = async () => {
    setIsClearing(true);
    setClearProgress(null);
    try {
      const result = await clearPersistedData((progress) => {
        setClearProgress(progress);
      });
      if (result.success) {
        setShowClearConfirm(false);
        // Success handled by state reset
      }
    } finally {
      setIsClearing(false);
      setClearProgress(null);
    }
  };

  // Handle event generation
  const handleGenerateEvents = async () => {
    setIsGeneratingEvents(true);
    setEventGenComplete(null);
    setEventGenProgress({ processed: 0, total: state.dataStore.candidates.length, eventsGenerated: 0 });
    setPersistProgress(null);

    try {
      const result = await generateEvents(
        // Generation progress callback
        (progress) => {
          setEventGenProgress({
            processed: progress.processed,
            total: progress.total,
            eventsGenerated: progress.eventsGenerated
          });
        },
        // Persistence progress callback
        (progress) => {
          setPersistProgress(progress);
        }
      );

      if (result.success) {
        // Show success state for 4 seconds before dismissing
        setEventGenComplete({ eventsGenerated: result.eventsGenerated, timestamp: Date.now() });
        console.log(`[UI] Event generation complete: ${result.eventsGenerated} events`);
        setTimeout(() => {
          setEventGenDismissed(true);
          setEventGenComplete(null);
        }, 4000);
      } else {
        console.error('[UI] Event generation failed:', result.error);
      }
    } finally {
      setIsGeneratingEvents(false);
      setEventGenProgress(null);
      setPersistProgress(null);
    }
  };

  // If no data, show upload interface
  if (!hasData) {
    return (
      <CSVUpload
        onUpload={importCSVs}
        isLoading={state.isLoading}
      />
    );
  }

  // Mobile menu component
  const MobileMenu = () => (
    <div
      className={`mobile-menu-overlay ${showMobileMenu ? 'show' : ''}`}
      onClick={() => setShowMobileMenu(false)}
    >
      <div
        className="mobile-menu-drawer"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mobile-menu-header">
          <h6 className="mb-0">Menu</h6>
          <button className="text-white/60 hover:text-white" aria-label="Close" onClick={() => setShowMobileMenu(false)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="mobile-menu-content">
          <button
            className={`mobile-menu-item ${isMasked ? 'active' : ''}`}
            onClick={() => { toggleMasking(); setShowMobileMenu(false); }}
          >
            {isMasked ? '🔒 PII Masked' : '🔓 Show Real Names'}
          </button>
          <button
            className="mobile-menu-item"
            onClick={() => { setShowStageMapping(true); setShowMobileMenu(false); }}
          >
            Stage Mapping
          </button>
          <button
            className="mobile-menu-item"
            onClick={() => { handleExportRawData(); setShowMobileMenu(false); }}
          >
            Export Data
          </button>
          <button
            className="mobile-menu-item"
            onClick={() => { refetchData(); setShowMobileMenu(false); }}
          >
            Reload from Database
          </button>
          {canImportData && (
            <button
              className="mobile-menu-item"
              onClick={() => { setShowImportModal(true); setShowMobileMenu(false); }}
            >
              Import Data
            </button>
          )}
          <hr />
          <button
            className="mobile-menu-item"
            onClick={() => { reset(); setShowMobileMenu(false); }}
          >
            Back to Import
          </button>
          <button
            className="mobile-menu-item text-bad"
            onClick={() => { setShowClearConfirm(true); setShowMobileMenu(false); }}
          >
            Clear Database
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* New Navigation - shown when feature flag enabled and not using legacy */}
      {showNewNav && (
        <TopNav
          useLegacyNav={useLegacyNav}
          onToggleLegacy={toggleLegacyNav}
          activeTab={activeTab}
          onNavigate={(tab) => {
            if (tab === 'recruiter') {
              // Don't clear selection when navigating to recruiter tab
            } else {
              selectRecruiter(null);
            }
            setActiveTab(tab);
          }}
          userEmail={user?.email || supabaseUser?.email}
          onSignOut={signOut}
          onCreateOrg={() => setShowCreateOrgModal(true)}
          onOrgSettings={() => setShowOrgSettings(true)}
          onImportData={() => setShowImportModal(true)}
          onImportReview={() => setShowImportReview(true)}
          aiEnabled={isAiEnabled}
        />
      )}

      <div className={`w-full ${isMobile ? 'py-2 px-2' : 'py-4'}`} style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
        <div className={isMobile ? '' : 'max-w-screen-2xl mx-auto'}>
          {/* Mobile Menu Overlay - only show with legacy nav */}
          {isMobile && !showNewNav && <MobileMenu />}

          {/* Demo Mode Banner - mobile only (desktop uses inline chip) */}
          {isDemo && !demoDismissed && isMobile && (
            <div className="demo-banner demo-banner-mobile mb-2" role="alert">
              <span className="text-sm">⚠️ Demo Mode - Sample Data</span>
              <button
                className="ml-auto text-white/60 hover:text-white"
                aria-label="Dismiss demo banner"
                onClick={() => setDemoDismissed(true)}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}

          {/* Event Generation Banner */}
          {(needsEventGeneration || eventGenComplete) && !eventGenDismissed && !isDemo && (
            <div
              className="mb-3 rounded"
              style={{
                backgroundColor: isGeneratingEvents ? 'var(--color-slate-900, #1a1a2e)' : eventGenComplete ? 'var(--color-success-bg, #0d3320)' : 'rgba(255, 193, 7, 0.15)',
                border: isGeneratingEvents ? '1px solid var(--color-slate-700, #333)' : eventGenComplete ? '1px solid var(--color-success, #10b981)' : '1px solid rgba(255, 193, 7, 0.4)',
                overflow: 'hidden',
                transition: 'all 0.3s ease'
              }}
            >
              {eventGenComplete ? (
                // Success completion state
                <div className="p-3 flex items-center gap-3" style={{ color: '#ffffff' }}>
                  <span style={{ fontSize: '1.5rem' }}>✅</span>
                  <div className="grow">
                    <strong style={{ color: '#10b981' }}>Events Generated Successfully!</strong>
                    <div className="small" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      Created {eventGenComplete.eventsGenerated.toLocaleString()} stage transition events from your candidate data.
                    </div>
                  </div>
                  <button
                    className="text-white/60 hover:text-white"
                    onClick={() => { setEventGenDismissed(true); setEventGenComplete(null); }}
                    title="Dismiss"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ) : isGeneratingEvents ? (
                // Fun animated progress UI
                <div className="p-4" style={{ color: '#ffffff' }}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h5 className="mb-1 flex items-center gap-2" style={{ color: '#ffffff' }}>
                        <LogoSpinner size={24} />
                        {persistProgress?.phase === 'persisting' ? 'Saving to Database' : 'Generating Events'}
                      </h5>
                      <p className="mb-0" style={{ color: 'rgba(255,255,255,0.6)' }}>
                        {getCurrentMessage(persistProgress)}
                      </p>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-base font-medium bg-warn text-white">
                      {getTimeRemaining(persistProgress)}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-3 rounded-full bg-white/10 mb-3">
                    <div
                      className="h-3 rounded-full transition-all duration-300"
                      style={{
                        width: `${persistProgress ? (persistProgress.current / Math.max(persistProgress.total, 1)) * 100 : 0}%`,
                        background: 'linear-gradient(90deg, #ffc107, #ff9800)'
                      }}
                    />
                  </div>

                  {/* Stats row */}
                  <div className="flex justify-between small" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    <div>
                      <span style={{ color: '#ffffff', fontWeight: 'bold' }}>
                        {(persistProgress?.eventsGenerated || eventGenProgress?.eventsGenerated || 0).toLocaleString()}
                      </span>
                      {' '}events generated
                    </div>
                    <div>
                      {persistProgress?.phase === 'generating' ? (
                        <>
                          <span style={{ color: '#ffffff', fontWeight: 'bold' }}>
                            {persistProgress.current.toLocaleString()}
                          </span>
                          {' / '}
                          {persistProgress.total.toLocaleString()} candidates processed
                        </>
                      ) : persistProgress?.phase === 'persisting' ? (
                        <>
                          <span style={{ color: '#ffffff', fontWeight: 'bold' }}>
                            {persistProgress.current.toLocaleString()}
                          </span>
                          {' / '}
                          {persistProgress.total.toLocaleString()} chunks saved
                        </>
                      ) : (
                        'Starting...'
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                // Static prompt to generate events
                <div className="p-3 flex items-center gap-3">
                  <span style={{ fontSize: '1.5rem' }}>⚡</span>
                  <div className="grow">
                    <strong style={{ color: '#ffc107' }}>Events Not Generated</strong>
                    <div className="small" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      Your data was imported without stage events. Generate events to enable HM Friction, Quality Guardrails, and activity tracking.
                    </div>
                  </div>
                  <button
                    className="px-3 py-1.5 text-xs font-medium rounded bg-warn text-white hover:bg-warn/90"
                    onClick={handleGenerateEvents}
                  >
                    Generate Events
                  </button>
                  <button
                    className="text-white/60 hover:text-white"
                    onClick={() => setEventGenDismissed(true)}
                    title="Dismiss"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Minimal Status Bar - Progress indicator + Demo chip */}
          {(state.loadingState.operations.length > 0 || (isDemo && !demoDismissed)) && (
            <div className="flex items-center gap-2 mb-3">
              {state.loadingState.operations.length > 0 && (
                <ProgressPill
                  loadingState={state.loadingState}
                  onClick={() => setShowProgressPanel(true)}
                />
              )}
              {isDemo && !demoDismissed && (
                <span className="demo-chip" onClick={() => setDemoDismissed(true)} title="Demo Mode - Click to dismiss">
                  Demo
                </span>
              )}
            </div>
          )}

          {/* Mobile Legacy Nav Hamburger - only show when using legacy nav */}
          {isMobile && !showNewNav && (
            <div className="flex justify-end mb-2">
              <button
                className="btn"
                onClick={() => setShowMobileMenu(true)}
                style={{
                  padding: '0.5rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: 'var(--text-primary, #F8FAFC)'
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
            </div>
          )}

          {/* Error Display */}
          {state.error && (
            <div className="p-3 rounded-lg bg-bad/10 border border-bad/20 text-bad mb-3">
              {state.error}
            </div>
          )}

          {/* Mobile: Tabs FIRST so user can see what's available - hidden when new nav is active */}
          {isMobile && !showNewNav && (
            <div className="nav-pills-bespoke mb-2" style={{ overflowX: 'auto', whiteSpace: 'nowrap', WebkitOverflowScrolling: 'touch' }}>
              <button
                className={`nav-link ${activeTab === 'command-center' ? 'active' : ''}`}
                onClick={() => { selectRecruiter(null); setActiveTab('command-center'); }}
              >
                Command Center
              </button>
              <button
                className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => { selectRecruiter(null); setActiveTab('overview'); }}
              >
                Overview
              </button>
              <button
                className={`nav-link ${activeTab === 'recruiter' ? 'active' : ''}`}
                onClick={() => setActiveTab('recruiter')}
              >
                Recruiter
              </button>
              <button
                className={`nav-link ${activeTab === 'hm-friction' ? 'active' : ''}`}
                onClick={() => setActiveTab('hm-friction')}
              >
                HM Friction
              </button>
              <button
                className={`nav-link ${activeTab === 'quality' ? 'active' : ''}`}
                onClick={() => setActiveTab('quality')}
              >
                Quality
              </button>
              <button
                className={`nav-link ${activeTab === 'source-mix' ? 'active' : ''}`}
                onClick={() => setActiveTab('source-mix')}
              >
                Sources
              </button>
              <button
                className={`nav-link ${activeTab === 'hiring-managers' ? 'active' : ''}`}
                onClick={() => setActiveTab('hiring-managers')}
              >
                HMs
              </button>
              <button
                className={`nav-link ${activeTab === 'capacity' ? 'active' : ''}`}
                onClick={() => setActiveTab('capacity')}
              >
                Capacity
              </button>
              <button
                className={`nav-link ${activeTab === 'velocity' ? 'active' : ''}`}
                onClick={() => setActiveTab('velocity')}
              >
                Velocity
              </button>
              <button
                className={`nav-link ${activeTab === 'forecasting' ? 'active' : ''}`}
                onClick={() => setActiveTab('forecasting')}
              >
                Forecast
              </button>
              <button
                className={`nav-link ${activeTab === 'data-health' ? 'active' : ''}`}
                onClick={() => setActiveTab('data-health')}
              >
                Health
              </button>
            </div>
          )}

          {/* Filters - more compact on mobile */}
          <div className={`glass-panel ${isMobile ? 'p-2 mb-2' : 'p-3 mb-3'}`}>
            <FilterBar
              filters={state.filters}
              requisitions={state.dataStore.requisitions}
              users={state.dataStore.users}
              onChange={updateFilters}
            />
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-12 gap-4">
            {/* Main Area - Full width now that sidebar is removed */}
            <div className="col-span-12">
              {/* Desktop Tabs - hidden when new nav is active */}
              {!isMobile && !showNewNav && (
                <div className="nav-pills-bespoke mb-4">
                  <button
                    className={`nav-link ${activeTab === 'command-center' ? 'active' : ''}`}
                    onClick={() => { selectRecruiter(null); setActiveTab('command-center'); }}
                  >
                    Command Center
                  </button>
                  <button
                    className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`}
                    onClick={() => { selectRecruiter(null); setActiveTab('overview'); }}
                  >
                    Overview
                  </button>
                  <button
                    className={`nav-link ${activeTab === 'recruiter' ? 'active' : ''}`}
                    onClick={() => setActiveTab('recruiter')}
                  >
                    Recruiter Detail
                  </button>
                  <button
                    className={`nav-link ${activeTab === 'hm-friction' ? 'active' : ''}`}
                    onClick={() => setActiveTab('hm-friction')}
                  >
                    HM Friction
                  </button>
                  <button
                    className={`nav-link ${activeTab === 'quality' ? 'active' : ''}`}
                    onClick={() => setActiveTab('quality')}
                  >
                    Quality Guardrails
                  </button>
                  <button
                    className={`nav-link ${activeTab === 'source-mix' ? 'active' : ''}`}
                    onClick={() => setActiveTab('source-mix')}
                  >
                    Source Mix
                  </button>
                  <button
                    className={`nav-link ${activeTab === 'hiring-managers' ? 'active' : ''}`}
                    onClick={() => setActiveTab('hiring-managers')}
                  >
                    Hiring Managers
                  </button>
                  <button
                    className={`nav-link ${activeTab === 'capacity' ? 'active' : ''}`}
                    onClick={() => setActiveTab('capacity')}
                  >
                    Capacity
                  </button>
                  <button
                    className={`nav-link ${activeTab === 'velocity' ? 'active' : ''}`}
                    onClick={() => setActiveTab('velocity')}
                  >
                    Velocity Insights
                  </button>
                  <button
                    className={`nav-link ${activeTab === 'forecasting' ? 'active' : ''}`}
                    onClick={() => setActiveTab('forecasting')}
                  >
                    Forecasting
                  </button>
                  <button
                    className={`nav-link ${activeTab === 'data-health' ? 'active' : ''}`}
                    onClick={() => setActiveTab('data-health')}
                  >
                    Data Health
                  </button>
                </div>
              )}

              {/* Coverage Banner - shows data status */}
              {state.dataStore.lastImportAt && capability.summary && (
                <CoverageBanner
                  summary={capability.summary}
                  onViewCoverageMap={() => setShowCoverageMap(true)}
                />
              )}

              {/* Coverage Map Panel (overlay) */}
              {showCoverageMap && (
                <CoverageMapPanel
                  result={capability.result}
                  onClose={() => setShowCoverageMap(false)}
                />
              )}

              {/* Tab Content - Progressive rendering with skeletons */}
              <div key={activeTab} className="tab-content-fade">
                {/* Command Center (default landing) */}
                {activeTab === 'command-center' && (
                  state.loadingState.hasOverviewMetrics && state.overview ? (
                    <CommandCenterView
                      requisitions={state.dataStore.requisitions}
                      candidates={state.dataStore.candidates}
                      events={state.dataStore.events}
                      users={state.dataStore.users}
                      overview={state.overview}
                      hmFriction={state.hmFriction}
                      hmActions={(() => {
                        const factTables = buildHMFactTables(
                          state.dataStore.requisitions,
                          state.dataStore.candidates,
                          state.dataStore.events,
                          state.dataStore.users,
                          state.dataStore.config.stageMapping,
                          state.dataStore.lastImportAt || new Date()
                        );
                        return calculatePendingActions(factTables, state.dataStore.users, DEFAULT_HM_RULES);
                      })()}
                      filters={state.filters}
                      config={state.dataStore.config}
                      coverage={state.dataStore.coverageMetrics}
                      onNavigateToTab={(tab) => setActiveTab(tab as TabType)}
                      onNavigateToReq={(reqId) => {
                        selectRecruiter(null);
                        setActiveTab('recruiter');
                      }}
                    />
                  ) : (
                    <TabSkeleton showKPIs showChart={false} showTable kpiCount={4} tableRows={6} />
                  )
                )}

                {/* Control Tower Tab (Ops view at /ops) */}
                {activeTab === 'control-tower' && (
                  state.loadingState.hasOverviewMetrics && state.overview ? (
                    <ControlTowerTab
                      requisitions={state.dataStore.requisitions}
                      candidates={state.dataStore.candidates}
                      events={state.dataStore.events}
                      users={state.dataStore.users}
                      overview={state.overview}
                      hmFriction={state.hmFriction}
                      hmActions={(() => {
                        // Calculate HM pending actions for Control Tower
                        const factTables = buildHMFactTables(
                          state.dataStore.requisitions,
                          state.dataStore.candidates,
                          state.dataStore.events,
                          state.dataStore.users,
                          state.dataStore.config.stageMapping,
                          state.dataStore.lastImportAt || new Date()
                        );
                        return calculatePendingActions(factTables, state.dataStore.users, DEFAULT_HM_RULES);
                      })()}
                      config={state.dataStore.config}
                      filters={state.filters}
                      dataHealth={state.dataStore.dataHealth}
                      importSource={state.dataStore.importSource}
                      lastImportAt={state.dataStore.lastImportAt}
                      onNavigateToReq={(reqId) => {
                        selectRecruiter(null);
                        setActiveTab('recruiter');
                        // Note: Could enhance to select specific req in future
                      }}
                      onNavigateToHM={(hmUserId) => {
                        setActiveTab('hiring-managers');
                      }}
                      onNavigateToTab={(tab) => setActiveTab(tab as TabType)}
                      externalManualActions={manualActions}
                    />
                  ) : (
                    <TabSkeleton showKPIs showChart={false} showTable kpiCount={5} tableRows={6} />
                  )
                )}

                {/* Ask PlatoVue Tab */}
                {activeTab === 'ask' && (
                  state.loadingState.hasOverviewMetrics && state.overview ? (
                    <AskPlatoVueTab
                      requisitions={state.dataStore.requisitions}
                      candidates={state.dataStore.candidates}
                      events={state.dataStore.events}
                      users={state.dataStore.users}
                      overview={state.overview}
                      hmFriction={state.hmFriction}
                      hmActions={(() => {
                        const factTables = buildHMFactTables(
                          state.dataStore.requisitions,
                          state.dataStore.candidates,
                          state.dataStore.events,
                          state.dataStore.users,
                          state.dataStore.config.stageMapping,
                          state.dataStore.lastImportAt || new Date()
                        );
                        return calculatePendingActions(factTables, state.dataStore.users, DEFAULT_HM_RULES);
                      })()}
                      config={state.dataStore.config}
                      filters={state.filters}
                      dataHealth={state.dataStore.dataHealth}
                      aiEnabled={isAiEnabled}
                      aiConfig={aiConfig}
                      onNavigateToTab={(tab) => setActiveTab(tab as TabType)}
                      existingActions={manualActions}
                      onAddActions={handleAddManualActions}
                      snapshots={state.dataStore.snapshots}
                      snapshotEvents={state.dataStore.snapshotEvents}
                    />
                  ) : (
                    <TabSkeleton showKPIs={false} showChart={false} showTable={false} />
                  )
                )}

                {/* Overview Tab */}
                {activeTab === 'overview' && (
                  state.loadingState.hasOverviewMetrics && state.overview ? (
                    <OverviewTab
                      overview={state.overview}
                      weeklyTrends={state.weeklyTrends}
                      dataHealth={state.dataStore.dataHealth}
                      filters={state.filters}
                      onSelectRecruiter={handleSelectRecruiter}
                      candidates={state.dataStore.candidates}
                      requisitions={state.dataStore.requisitions}
                      users={state.dataStore.users}
                      events={state.dataStore.events}
                      hmFriction={state.hmFriction}
                      config={state.dataStore.config}
                      onUpdateConfig={updateConfig}
                    />
                  ) : (
                    <TabSkeleton showKPIs showChart showTable kpiCount={5} tableRows={8} />
                  )
                )}

                {/* Recruiter Tab */}
                {activeTab === 'recruiter' && (
                  state.loadingState.hasRecruiterMetrics && state.overview ? (
                    <RecruiterDetailTab
                      recruiterSummaries={state.overview.recruiterSummaries}
                      selectedRecruiterId={state.selectedRecruiterId}
                      onSelectRecruiter={selectRecruiter}
                      requisitions={state.dataStore.requisitions}
                      candidates={state.dataStore.candidates}
                      events={state.dataStore.events}
                      users={state.dataStore.users}
                      config={state.dataStore.config}
                      priorPeriod={state.overview.priorPeriod}
                      recruiterPriorPeriods={state.overview.recruiterPriorPeriods}
                      filters={state.filters}
                    />
                  ) : (
                    <TabSkeleton showKPIs={false} showChart={false} showTable tableRows={10} tableColumns={6} />
                  )
                )}

                {/* HM Friction Tab */}
                {activeTab === 'hm-friction' && (
                  state.loadingState.hasHMMetrics ? (
                    <HMFrictionTab
                      friction={state.hmFriction}
                      requisitions={state.dataStore.requisitions}
                      events={state.dataStore.events}
                      users={state.dataStore.users}
                      filters={state.filters}
                    />
                  ) : (
                    <TabSkeleton showKPIs showChart={false} showTable kpiCount={4} tableRows={6} />
                  )
                )}

                {/* Quality Tab */}
                {activeTab === 'quality' && (
                  state.loadingState.hasQualityMetrics && state.qualityMetrics ? (
                    <QualityTab quality={state.qualityMetrics} />
                  ) : (
                    <TabSkeleton showKPIs showChart showTable kpiCount={3} chartType="pie" tableRows={5} />
                  )
                )}

                {/* Source Mix Tab */}
                {activeTab === 'source-mix' && (
                  sourceEffectiveness ? (
                    <SourceEffectivenessTab data={sourceEffectiveness} />
                  ) : (
                    <TabSkeleton showKPIs={false} showChart showTable chartType="bar" tableRows={6} />
                  )
                )}

                {/* Hiring Managers Tab */}
                {activeTab === 'hiring-managers' && (
                  <HiringManagersTab
                    requisitions={state.dataStore.requisitions}
                    candidates={state.dataStore.candidates}
                    events={state.dataStore.events}
                    users={state.dataStore.users}
                    stageMappingConfig={state.dataStore.config.stageMapping}
                    lastImportAt={state.dataStore.lastImportAt}
                    filters={state.filters}
                  />
                )}

                {/* Bottlenecks & SLAs Tab */}
                {activeTab === 'bottlenecks' && (
                  <BottlenecksTab
                    onNavigate={(path: string) => {
                      // Navigate to the path and update active tab
                      window.history.pushState({}, '', path);
                      const tab = getTabFromPath(path);
                      setActiveTab(tab);
                    }}
                    onCreateActions={handleAddManualActions}
                  />
                )}

                {/* Capacity Tab */}
                {activeTab === 'capacity' && (
                  <CapacityTab />
                )}

                {/* Capacity Rebalancer Tab */}
                {activeTab === 'capacity-rebalancer' && (
                  <CapacityRebalancerTab />
                )}

                {/* Velocity Tab */}
                {activeTab === 'velocity' && (
                  velocityMetrics ? (
                    <VelocityInsightsTab
                      metrics={velocityMetrics}
                      requisitions={state.dataStore.requisitions}
                      candidates={state.dataStore.candidates}
                      events={state.dataStore.events}
                      users={state.dataStore.users}
                      hmFriction={state.hmFriction}
                      config={state.dataStore.config}
                      filters={state.filters}
                      onUpdateConfig={updateConfig}
                      aiConfig={aiConfig}
                    />
                  ) : (
                    <TabSkeleton showKPIs showChart showTable={false} kpiCount={4} chartType="line" />
                  )
                )}

                {/* Forecasting Tab */}
                {activeTab === 'forecasting' && (
                  <ForecastingTab
                    requisitions={state.dataStore.requisitions}
                    candidates={state.dataStore.candidates}
                    events={state.dataStore.events}
                    users={state.dataStore.users}
                    config={state.dataStore.config}
                    hmFriction={state.hmFriction}
                    hmActions={(() => {
                      // Calculate HM pending actions for pre-mortem analysis
                      const factTables = buildHMFactTables(
                        state.dataStore.requisitions,
                        state.dataStore.candidates,
                        state.dataStore.events,
                        state.dataStore.users,
                        state.dataStore.config.stageMapping,
                        state.dataStore.lastImportAt || new Date()
                      );
                      return calculatePendingActions(factTables, state.dataStore.users, DEFAULT_HM_RULES);
                    })()}
                  />
                )}

                {/* Scenarios Tab */}
                {activeTab === 'scenarios' && (
                  <ScenarioLibraryTab />
                )}

                {/* Data Health Tab */}
                {activeTab === 'data-health' && (
                  <DataHealthTab
                    requisitions={state.dataStore.requisitions}
                    candidates={state.dataStore.candidates}
                    events={state.dataStore.events}
                    users={state.dataStore.users}
                    excludedReqIds={excludedReqIds}
                    onToggleExclusion={handleToggleExclusion}
                  />
                )}

                {/* SLA Settings Tab */}
                {activeTab === 'sla-settings' && (
                  <SlaSettingsTab />
                )}

                {/* AI Settings Tab */}
                {activeTab === 'ai-settings' && (
                  <AiSettingsTab />
                )}

                {/* Organization Settings Tab */}
                {activeTab === 'org-settings' && (
                  <OrgSettingsTab />
                )}
              </div>
            </div>

          </div>

          <StageMappingModal
            isOpen={showStageMapping}
            onClose={() => setShowStageMapping(false)}
            config={state.dataStore.config}
            candidates={state.dataStore.candidates}
            events={state.dataStore.events}
            onSave={(newConfig) => {
              updateConfig(newConfig);
              setShowStageMapping(false);
              refreshMetrics();
            }}
          />

          {/* Clear Data Confirmation Modal */}
          <ClearDataConfirmationModal
            isOpen={showClearConfirm}
            onCancel={() => setShowClearConfirm(false)}
            onConfirm={handleClearDataConfirm}
            isClearing={isClearing}
            clearProgress={clearProgress}
          />

          {/* Create Organization Modal */}
          <CreateOrgModal
            isOpen={showCreateOrgModal}
            onClose={() => setShowCreateOrgModal(false)}
            onCreate={handleCreateOrg}
          />

          {/* Organization Settings Modal */}
          <OrgSettings
            isOpen={showOrgSettings}
            onClose={() => setShowOrgSettings(false)}
          />

          {/* Super Admin Panel */}
          <SuperAdminPanel
            isOpen={showSuperAdminPanel}
            onClose={() => setShowSuperAdminPanel(false)}
          />

          {/* AI Provider Settings Modal */}
          <AiProviderSettings
            isOpen={showAiSettings}
            onClose={() => setShowAiSettings(false)}
            currentConfig={aiConfig}
            onSave={setAiConfig}
            onClear={() => setAiConfig(null)}
            orgId={currentOrg?.id}
            userId={user?.id}
            canSetOrgKey={canManageMembers}
            onAiEnabledChange={(enabled) => {
              // Persist AI enabled preference to localStorage
              localStorage.setItem('platovue_ai_enabled', String(enabled));
              // Also update the current config if it exists
              if (aiConfig) {
                setAiConfig({ ...aiConfig, aiEnabled: enabled });
              }
            }}
          />

          {/* Import Data Modal */}
          {showImportModal && (
            <div
              className="modal-overlay"
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.85)',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem'
              }}
              onClick={() => setShowImportModal(false)}
            >
              <div
                className="import-modal-content"
                style={{
                  maxWidth: '900px',
                  maxHeight: '90vh',
                  width: '100%',
                  overflow: 'auto',
                  borderRadius: '12px',
                  backgroundColor: 'var(--surface-primary, #1a1a1a)'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowImportModal(false)}
                    style={{
                      position: 'absolute',
                      top: '1rem',
                      right: '1rem',
                      zIndex: 10,
                      background: 'rgba(255,255,255,0.1)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '36px',
                      height: '36px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: 'var(--text-secondary, #888)'
                    }}
                    title="Close"
                  >
                    <i className="bi bi-x-lg" />
                  </button>
                  <CSVUpload
                    onUpload={async (reqCsv, candCsv, eventCsv, userCsv, isDemo, onProgress, shouldAnonymize) => {
                      const result = await importCSVs(reqCsv, candCsv, eventCsv, userCsv, isDemo, onProgress, shouldAnonymize);
                      if (result.success) {
                        setShowImportModal(false);
                      }
                      return result;
                    }}
                    isLoading={state.isLoading}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Import Review Modal */}
          {showImportReview && (
            <ImportReview onClose={() => setShowImportReview(false)} />
          )}

          {/* Progress Indicator Panel */}
          {showProgressPanel && (
            <ProgressIndicator
              loadingState={state.loadingState}
              onDismiss={() => {
                setShowProgressPanel(false);
                if (state.loadingState.isFullyReady) {
                  clearOperations();
                }
              }}
            />
          )}
        </div>
      </div>
    </>
  );
}
