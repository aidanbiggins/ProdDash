// Main Productivity Dashboard Component

import React, { useState, useEffect, useMemo } from 'react';
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
import { exportAllRawData, calculateSourceEffectiveness, normalizeEventStages, calculateVelocityMetrics } from '../services';
import { useDataMasking } from '../contexts/DataMaskingContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { useUrlState } from '../hooks/useUrlState';
import { useAuth } from '../../contexts/AuthContext';
import { OrgSwitcher, CreateOrgModal } from './OrgSwitcher';
import { OrgSettings } from './OrgSettings';
import { SuperAdminPanel } from './SuperAdminPanel';
import { createOrganization } from '../services/organizationService';

type TabType = 'overview' | 'recruiter' | 'hm-friction' | 'hiring-managers' | 'quality' | 'source-mix' | 'velocity' | 'forecasting' | 'data-health';

export function ProductivityDashboard() {
  const { state, importCSVs, updateFilters, selectRecruiter, refreshMetrics, updateConfig, reset, clearPersistedData, generateEvents, needsEventGeneration, canImportData, clearOperations } = useDashboard();
  const [showProgressPanel, setShowProgressPanel] = useState(false);
  const { isMasked, toggleMasking } = useDataMasking();
  const { currentOrg, user, refreshMemberships, supabaseUser } = useAuth();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showStageMapping, setShowStageMapping] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [demoDismissed, setDemoDismissed] = useState(false);
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [showOrgSettings, setShowOrgSettings] = useState(false);
  const [showSuperAdminPanel, setShowSuperAdminPanel] = useState(false);

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
    await createOrganization({ name }, supabaseUser.id);
    // Don't await - let the modal close immediately while memberships refresh
    refreshMemberships().catch(err => {
      console.error('Failed to refresh memberships:', err);
    });
  };

  const handleClearDataConfirm = async () => {
    setIsClearing(true);
    try {
      const result = await clearPersistedData();
      if (result.success) {
        setShowClearConfirm(false);
        // Success handled by state reset
      }
    } finally {
      setIsClearing(false);
    }
  };

  // Handle event generation
  const handleGenerateEvents = async () => {
    setIsGeneratingEvents(true);
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
        setEventGenDismissed(true); // Auto-dismiss on success
        console.log(`[UI] Event generation complete: ${result.eventsGenerated} events`);
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
            onClick={() => { refreshMetrics(); setShowMobileMenu(false); }}
          >
            Refresh Data
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
    <div className={`container-fluid ${isMobile ? 'py-2 px-2' : 'py-4'}`} style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      <div className={isMobile ? '' : 'container-xxl'}>
        {/* Mobile Menu Overlay */}
        {isMobile && <MobileMenu />}

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
        {needsEventGeneration && !eventGenDismissed && !isDemo && (
          <div
            className="mb-3 rounded"
            style={{
              backgroundColor: isGeneratingEvents ? 'var(--color-slate-900, #1a1a2e)' : 'var(--color-warning-light, #fff3cd)',
              border: isGeneratingEvents ? '1px solid var(--color-slate-700, #333)' : '1px solid var(--color-warning, #ffc107)',
              overflow: 'hidden',
              transition: 'all 0.3s ease'
            }}
          >
            {isGeneratingEvents ? (
              // Fun animated progress UI
              <div className="p-4">
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <div>
                    <h5 className="mb-1 text-white d-flex align-items-center gap-2">
                      <span className="spinner-grow spinner-grow-sm" style={{ color: '#ffc107' }} />
                      {persistProgress?.phase === 'persisting' ? 'Saving to Database' : 'Generating Events'}
                    </h5>
                    <p className="mb-0 text-white-50">
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
                <div className="d-flex justify-content-between text-white-50 small">
                  <div>
                    <span className="text-white fw-bold">
                      {(persistProgress?.eventsGenerated || eventGenProgress?.eventsGenerated || 0).toLocaleString()}
                    </span>
                    {' '}events generated
                  </div>
                  <div>
                    {persistProgress?.phase === 'generating' ? (
                      <>
                        <span className="text-white fw-bold">
                          {persistProgress.current.toLocaleString()}
                        </span>
                        {' / '}
                        {persistProgress.total.toLocaleString()} candidates processed
                      </>
                    ) : persistProgress?.phase === 'persisting' ? (
                      <>
                        <span className="text-white fw-bold">
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
                  <strong>Events Not Generated</strong>
                  <div className="small text-muted">
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
                />
              </div>
            )}
          </div>
        )}

        {/* Header */}
        {isMobile ? (
          // Mobile Header - compact with hamburger
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h1 className="fs-5 fw-bold mb-0">Recruiting Insights</h1>
              <small className="text-muted">{state.dataStore.requisitions.length} Reqs · {state.dataStore.candidates.length} Candidates</small>
            </div>
            <button
              className="btn btn-light"
              onClick={() => setShowMobileMenu(true)}
              style={{ padding: '0.5rem' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
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
            <div className="dashboard-header-actions">
              <button
                className={`btn ${isMasked ? 'btn-bespoke-primary' : 'btn-bespoke-secondary'}`}
                onClick={toggleMasking}
                title={isMasked ? 'Click to show real names' : 'Click to mask PII'}
              >
                {isMasked ? '🔒 PII Masked' : '🔓 Show PII'}
              </button>
              {/* Progress indicator pill */}
              {state.loadingState.operations.length > 0 && (
                <ProgressPill
                  loadingState={state.loadingState}
                  onClick={() => setShowProgressPanel(true)}
                />
              )}
              <button
                className="btn btn-bespoke-primary"
                onClick={refreshMetrics}
                disabled={state.isLoading}
              >
                {state.isLoading ? 'Syncing...' : 'Refresh Data'}
              </button>
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
                    className="btn btn-bespoke-secondary"
                    onClick={() => setShowHeaderMenu(!showHeaderMenu)}
                    title="Admin options"
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

        {/* Mobile: Tabs FIRST so user can see what's available */}
        {isMobile && (
          <div className="nav-pills-bespoke mb-2" style={{ overflowX: 'auto', whiteSpace: 'nowrap', WebkitOverflowScrolling: 'touch' }}>
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
            {/* Desktop Tabs */}
            {!isMobile && (
              <div className="nav-pills-bespoke mb-4">
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
                />
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
  );
}
