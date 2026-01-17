// Main Productivity Dashboard Component

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './../dashboard-theme.css'; // Import bespoke theme
import { useDashboard, PersistenceProgress } from '../hooks/useDashboardContext';
import { CSVUpload } from './CSVUpload';
import { FilterBar } from './common/FilterBar';
import { DataHealthBadge } from './common/DataHealthBadge';
import { ProgressIndicator, ProgressPill } from './common/ProgressIndicator';
import { TabSkeleton, KPISkeleton, ChartSkeleton, TableSkeleton } from './common/Skeletons';
import { ClearDataConfirmationModal } from './common/ClearDataConfirmationModal';
import { OverviewTab } from './overview/OverviewTab';
import { RecruiterDetailTab } from './recruiter-detail/RecruiterDetailTab';
import { HMFrictionTab } from './hm-friction/HMFrictionTab';
import { QualityTab } from './quality/QualityTab';
import { SourceEffectivenessTab } from './source-effectiveness/SourceEffectivenessTab';
import { StageMappingModal } from './StageMappingModal';
import { HiringManagersTab } from './hiring-managers';
import { VelocityInsightsTab } from './velocity-insights/VelocityInsightsTab';
import { ForecastingTab } from './forecasting';
import { DataHealthTab } from './data-health';
import { ControlTowerTab } from './control-tower';
import { CapacityTab } from './capacity/CapacityTab';
import { AskProdDashTab } from './ask-proddash';
import ScenarioLibraryTab from './scenarios/ScenarioLibraryTab';
import { exportAllRawData, calculateSourceEffectiveness, normalizeEventStages, calculateVelocityMetrics } from '../services';
import { ClearProgress } from '../services/dbService';
import { calculatePendingActions } from '../services/hmMetricsEngine';
import { buildHMFactTables } from '../services/hmFactTables';
import { DEFAULT_HM_RULES } from '../config/hmRules';
import { useDataMasking } from '../contexts/DataMaskingContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { useUrlState } from '../hooks/useUrlState';
import { useAuth } from '../../contexts/AuthContext';
import { OrgSwitcher, CreateOrgModal } from './OrgSwitcher';
import { OrgSettings } from './OrgSettings';
import { SuperAdminPanel } from './SuperAdminPanel';
import { createOrganization } from '../services/organizationService';
import { AiProviderSettings } from './settings/AiProviderSettings';
import { useAiKeys } from '../hooks/useAiVault';
import { AiProvider, DEFAULT_AI_CONFIG } from '../types/aiTypes';
import { TopNav } from './navigation';
import { useNewNavigation } from '../hooks/useNewNavigation';
import { getPathFromTab, getTabFromPath, TabType } from '../routes';
import '../components/layout/layout.css';
import '../components/navigation/navigation.css';
import { AiSettingsTab } from './settings/AiSettingsTab';
import { OrgSettingsTab } from './settings/OrgSettingsTab';
import { ActionItem } from '../types/actionTypes';

export function ProductivityDashboard() {
  const { state, importCSVs, updateFilters, selectRecruiter, refreshMetrics, refetchData, updateConfig, reset, clearPersistedData, generateEvents, needsEventGeneration, canImportData, clearOperations, aiConfig, setAiConfig, isAiEnabled } = useDashboard();
  const [showProgressPanel, setShowProgressPanel] = useState(false);
  const { isMasked, toggleMasking } = useDataMasking();
  const { currentOrg, user, refreshMemberships, supabaseUser, session, canManageMembers, signOut } = useAuth();
  const isMobile = useIsMobile();
  const { showNewNav, useLegacyNav, toggleLegacyNav } = useNewNavigation();
  const [activeTab, setActiveTab] = useState<TabType>('control-tower');
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

  // AI Keys - auto-load on sign-in
  const { keyState, loadKeys, getEffectiveKey } = useAiKeys();
  const [aiKeysLoaded, setAiKeysLoaded] = useState(false);

  // Shared manual actions state - persisted to localStorage
  const [manualActions, setManualActions] = useState<ActionItem[]>(() => {
    try {
      const stored = localStorage.getItem('proddash_manual_actions');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Persist manual actions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('proddash_manual_actions', JSON.stringify(manualActions));
    } catch (e) {
      console.warn('Failed to persist manual actions:', e);
    }
  }, [manualActions]);

  // Handler to add manual actions (from Ask ProdDash)
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
      const wasCleared = localStorage.getItem('proddash_ai_cleared') === 'true';
      if (wasCleared) {
        return; // User cleared config, don't auto-restore
      }

      // Check if user has explicitly disabled AI mode
      const storedAiEnabled = localStorage.getItem('proddash_ai_enabled');
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
          <button className="btn-close" onClick={() => setShowMobileMenu(false)} />
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
          <hr />
          <button
            className="mobile-menu-item"
            onClick={() => { reset(); setShowMobileMenu(false); }}
          >
            Back to Import
          </button>
          <button
            className="mobile-menu-item text-danger"
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
        />
      )}

      <div className={`container-fluid ${isMobile ? 'py-2 px-2' : 'py-4'}`} style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      <div className={isMobile ? '' : 'container-xxl'}>
        {/* Mobile Menu Overlay - only show with legacy nav */}
        {isMobile && !showNewNav && <MobileMenu />}

        {/* Demo Mode Banner - compact on mobile */}
        {isDemo && !demoDismissed && (
          <div className={`demo-banner ${isMobile ? 'demo-banner-mobile' : ''} mb-3`} role="alert">
            {isMobile ? (
              <>
                <span className="small">⚠️ Demo Mode - Sample Data</span>
                <button
                  className="btn-close btn-close-sm ms-auto"
                  onClick={() => setDemoDismissed(true)}
                  style={{ fontSize: '0.6rem' }}
                />
              </>
            ) : (
              <>
                <span className="demo-banner-icon">⚠️</span>
                <div className="demo-banner-text">
                  <strong>Demo Mode</strong> — You're viewing sample data. Import your own CSV files to see real metrics.
                </div>
                <button className="btn btn-bespoke-secondary btn-sm me-2" onClick={reset}>
                  Back to Import
                </button>
                <button className="btn btn-outline-danger btn-sm" onClick={() => setShowClearConfirm(true)}>
                  Clear Database
                </button>
              </>
            )}
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
              <div className="p-3 d-flex align-items-center gap-3" style={{ color: '#ffffff' }}>
                <span style={{ fontSize: '1.5rem' }}>✅</span>
                <div className="flex-grow-1">
                  <strong style={{ color: '#10b981' }}>Events Generated Successfully!</strong>
                  <div className="small" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    Created {eventGenComplete.eventsGenerated.toLocaleString()} stage transition events from your candidate data.
                  </div>
                </div>
                <button
                  className="btn-close"
                  onClick={() => { setEventGenDismissed(true); setEventGenComplete(null); }}
                  title="Dismiss"
                  style={{ filter: 'invert(1) grayscale(100%) brightness(200%)' }}
                />
              </div>
            ) : isGeneratingEvents ? (
              // Fun animated progress UI
              <div className="p-4" style={{ color: '#ffffff' }}>
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <div>
                    <h5 className="mb-1 d-flex align-items-center gap-2" style={{ color: '#ffffff' }}>
                      <span className="spinner-grow spinner-grow-sm" style={{ color: '#ffc107' }} />
                      {persistProgress?.phase === 'persisting' ? 'Saving to Database' : 'Generating Events'}
                    </h5>
                    <p className="mb-0" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      {getCurrentMessage(persistProgress)}
                    </p>
                  </div>
                  <span className="badge bg-warning text-dark fs-6">
                    {getTimeRemaining(persistProgress)}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="progress mb-3" style={{ height: '12px', backgroundColor: 'rgba(255,255,255,0.1)' }}>
                  <div
                    className="progress-bar"
                    style={{
                      width: `${persistProgress ? (persistProgress.current / Math.max(persistProgress.total, 1)) * 100 : 0}%`,
                      background: 'linear-gradient(90deg, #ffc107, #ff9800)',
                      transition: 'width 0.3s ease'
                    }}
                  />
                </div>

                {/* Stats row */}
                <div className="d-flex justify-content-between small" style={{ color: 'rgba(255,255,255,0.6)' }}>
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
              <div className="p-3 d-flex align-items-center gap-3">
                <span style={{ fontSize: '1.5rem' }}>⚡</span>
                <div className="flex-grow-1">
                  <strong style={{ color: '#ffc107' }}>Events Not Generated</strong>
                  <div className="small" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    Your data was imported without stage events. Generate events to enable HM Friction, Quality Guardrails, and activity tracking.
                  </div>
                </div>
                <button
                  className="btn btn-warning btn-sm"
                  onClick={handleGenerateEvents}
                >
                  Generate Events
                </button>
                <button
                  className="btn-close"
                  onClick={() => setEventGenDismissed(true)}
                  title="Dismiss"
                  style={{ filter: 'invert(1) grayscale(100%) brightness(200%)' }}
                />
              </div>
            )}
          </div>
        )}

        {/* Header */}
        {isMobile ? (
          // Mobile Header - compact (hamburger only shown with legacy nav)
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h1 className="fs-5 fw-bold mb-0">Recruiting Insights</h1>
              <small className="text-muted">{state.dataStore.requisitions.length} Reqs · {state.dataStore.candidates.length} Candidates</small>
            </div>
            {!showNewNav && (
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
            )}
          </div>
        ) : (
          // Desktop Header
          <div className="dashboard-header mb-5">
            <div className="dashboard-header-title">
              <div className="d-flex align-items-center gap-3 mb-2">
                <OrgSwitcher
                  onCreateOrg={() => setShowCreateOrgModal(true)}
                  onOrgSettings={() => setShowOrgSettings(true)}
                />
              </div>
              <h1 className="mb-0" style={{ color: '#ffffff', fontSize: '1.75rem', fontWeight: 700 }}>Recruiting Insights</h1>
              <div className="d-flex flex-wrap gap-3 mt-2 align-items-center" style={{ color: '#F8FAFC', fontSize: '0.875rem' }}>
                <span style={{ color: '#F8FAFC' }}>{state.dataStore.requisitions.filter(r => {
                  // Flexible open req detection
                  if (r.status === 'Open') return true;
                  const statusLower = r.status?.toLowerCase() || '';
                  if (statusLower.includes('open') || statusLower === 'active') return true;
                  if (r.status !== 'Closed' && !r.closed_at) return true;
                  return false;
                }).length} Open Reqs</span>
                <span style={{ color: '#a1a1aa' }}>•</span>
                <span style={{ color: '#F8FAFC' }}>{state.dataStore.candidates.filter(c => c.disposition === 'Active').length} Active Candidates</span>
                <span style={{ color: '#a1a1aa' }}>•</span>
                <span style={{ color: '#F8FAFC' }}>{state.overview?.recruiterSummaries.length || 0} Recruiters</span>
                <span style={{ color: '#a1a1aa' }}>•</span>
                <span style={{ color: '#F8FAFC' }}>{state.hmFriction.length} Hiring Managers</span>
                {state.dataStore.lastImportAt && (
                  <>
                    <span style={{ color: '#a1a1aa' }}>•</span>
                    <span className="d-flex align-items-center gap-1" style={{ color: '#F8FAFC' }}>
                      <i className="bi bi-clock-history" style={{ fontSize: '0.7rem' }}></i>
                      {state.dataStore.lastImportAt.toLocaleString()}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="dashboard-header-actions" style={{ gap: '0.5rem' }}>
              {/* Progress indicator pill */}
              {state.loadingState.operations.length > 0 && (
                <ProgressPill
                  loadingState={state.loadingState}
                  onClick={() => setShowProgressPanel(true)}
                />
              )}
              {/* Compact action button group */}
              <div className="d-flex" style={{ gap: '2px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '2px' }}>
                {/* PII Toggle */}
                <button
                  className="btn d-flex align-items-center justify-content-center"
                  onClick={toggleMasking}
                  title={isMasked ? 'Click to show real names' : 'Click to mask PII'}
                  style={{
                    width: '36px',
                    height: '36px',
                    padding: 0,
                    background: isMasked ? 'rgba(45, 212, 191, 0.15)' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    color: isMasked ? '#2dd4bf' : '#94a3b8',
                  }}
                >
                  <i className={`bi bi-${isMasked ? 'eye-slash' : 'eye'}`} style={{ fontSize: '1rem' }}></i>
                </button>
                {/* AI Settings */}
                <button
                  className={`btn d-flex align-items-center justify-content-center ${isAiEnabled ? 'ai-enabled-glow' : ''}`}
                  onClick={() => setShowAiSettings(true)}
                  title={isAiEnabled ? 'AI enabled - click to configure' : 'Configure AI provider'}
                  style={{
                    width: '36px',
                    height: '36px',
                    padding: 0,
                    background: isAiEnabled ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                    border: isAiEnabled ? '1px solid rgba(139, 92, 246, 0.4)' : 'none',
                    borderRadius: '6px',
                    color: isAiEnabled ? '#a78bfa' : '#94a3b8',
                    boxShadow: isAiEnabled ? '0 0 12px rgba(139, 92, 246, 0.4)' : 'none',
                    transition: 'all 0.3s ease',
                  }}
                >
                  <i className={`bi ${isAiEnabled ? 'bi-stars' : 'bi-robot'}`} style={{ fontSize: '1rem' }}></i>
                </button>
                {/* Refresh */}
                <button
                  className="btn d-flex align-items-center justify-content-center"
                  onClick={refetchData}
                  disabled={state.isLoading}
                  title={state.isLoading ? 'Syncing data...' : 'Refresh data from database'}
                  style={{
                    width: '36px',
                    height: '36px',
                    padding: 0,
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#94a3b8',
                  }}
                >
                  {state.isLoading ? (
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  ) : (
                    <i className="bi bi-arrow-clockwise" style={{ fontSize: '1rem' }}></i>
                  )}
                </button>
              </div>
              <DataHealthBadge
                health={state.dataStore.dataHealth}
                onConfigureStages={() => setShowStageMapping(true)}
                onExportData={handleExportRawData}
                onClearDatabase={() => setShowClearConfirm(true)}
              />
              {/* Super Admin menu - only show when user is super admin */}
              {isSuperAdmin && (
                <div className="position-relative">
                  <button
                    className="btn btn-bespoke-secondary d-flex align-items-center justify-content-center"
                    onClick={() => setShowHeaderMenu(!showHeaderMenu)}
                    title="Admin options"
                    style={{ width: '42px', height: '42px', padding: 0 }}
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                      <circle cx="10" cy="4" r="1.5" />
                      <circle cx="10" cy="10" r="1.5" />
                      <circle cx="10" cy="16" r="1.5" />
                    </svg>
                  </button>
                  {showHeaderMenu && (
                    <>
                      <div
                        className="position-fixed top-0 start-0 w-100 h-100"
                        style={{ zIndex: 1000 }}
                        onClick={() => setShowHeaderMenu(false)}
                      />
                      <div
                        className="position-absolute end-0 mt-2 py-2 rounded-3 shadow-lg"
                        style={{ zIndex: 1001, minWidth: '180px', backgroundColor: '#141414', border: '1px solid #3f3f46' }}
                      >
                        <button
                          className="dropdown-item px-3 py-2 d-flex align-items-center gap-2 w-100 text-start border-0 bg-transparent text-danger"
                          onClick={() => { setShowSuperAdminPanel(true); setShowHeaderMenu(false); }}
                          style={{ cursor: 'pointer' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-slate-100)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          Super Admin Panel
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error Display */}
        {state.error && (
          <div className="alert alert-danger mb-3">
            {state.error}
          </div>
        )}

        {/* Mobile: Tabs FIRST so user can see what's available - hidden when new nav is active */}
        {isMobile && !showNewNav && (
          <div className="nav-pills-bespoke mb-2" style={{ overflowX: 'auto', whiteSpace: 'nowrap', WebkitOverflowScrolling: 'touch' }}>
            <button
              className={`nav-link ${activeTab === 'control-tower' ? 'active' : ''}`}
              onClick={() => { selectRecruiter(null); setActiveTab('control-tower'); }}
            >
              Control Tower
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
        <div className={`glass-panel ${isMobile ? 'p-2 mb-2' : 'p-3 mb-5'}`}>
          <FilterBar
            filters={state.filters}
            requisitions={state.dataStore.requisitions}
            users={state.dataStore.users}
            onChange={updateFilters}
            onRefresh={refreshMetrics}
          />
        </div>

        {/* Main Content */}
        <div className="row g-4">
          {/* Main Area - Full width now that sidebar is removed */}
          <div className="col-12">
            {/* Desktop Tabs - hidden when new nav is active */}
            {!isMobile && !showNewNav && (
              <div className="nav-pills-bespoke mb-4">
                <button
                  className={`nav-link ${activeTab === 'control-tower' ? 'active' : ''}`}
                  onClick={() => { selectRecruiter(null); setActiveTab('control-tower'); }}
                >
                  Control Tower
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

            {/* Tab Content - Progressive rendering with skeletons */}
            <>
              {/* Control Tower Tab */}
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

              {/* Ask ProdDash Tab */}
              {activeTab === 'ask' && (
                state.loadingState.hasOverviewMetrics && state.overview ? (
                  <AskProdDashTab
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

              {/* Capacity Tab */}
              {activeTab === 'capacity' && (
                <CapacityTab />
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

              {/* AI Settings Tab */}
              {activeTab === 'ai-settings' && (
                <AiSettingsTab />
              )}

              {/* Organization Settings Tab */}
              {activeTab === 'org-settings' && (
                <OrgSettingsTab />
              )}
            </>
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
            localStorage.setItem('proddash_ai_enabled', String(enabled));
            // Also update the current config if it exists
            if (aiConfig) {
              setAiConfig({ ...aiConfig, aiEnabled: enabled });
            }
          }}
        />

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
