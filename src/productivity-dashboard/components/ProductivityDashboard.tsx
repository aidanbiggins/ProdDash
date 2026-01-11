// Main Productivity Dashboard Component

import React, { useState, useEffect, useMemo } from 'react';
import './../dashboard-theme.css'; // Import bespoke theme
import { useDashboard } from '../hooks/useDashboardContext';
import { CSVUpload } from './CSVUpload';
import { FilterBar } from './common/FilterBar';
import { DataHealthPanel } from './common/DataHealthPanel';
import { ClearDataConfirmationModal } from './common/ClearDataConfirmationModal';
import { OverviewTab } from './overview/OverviewTab';
import { RecruiterDetailTab } from './recruiter-detail/RecruiterDetailTab';
import { HMFrictionTab } from './hm-friction/HMFrictionTab';
import { QualityTab } from './quality/QualityTab';
import { SourceEffectivenessTab } from './source-effectiveness/SourceEffectivenessTab';
import { StageMappingModal } from './StageMappingModal';
import { HiringManagersTab } from './hiring-managers';
import { VelocityInsightsTab } from './velocity-insights/VelocityInsightsTab';
import { exportAllRawData, calculateSourceEffectiveness, normalizeEventStages, calculateVelocityMetrics } from '../services';
import { useDataMasking } from '../contexts/DataMaskingContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { useUrlState } from '../hooks/useUrlState';
import { useAuth } from '../../contexts/AuthContext';
import { OrgSwitcher, CreateOrgModal } from './OrgSwitcher';
import { OrgSettings } from './OrgSettings';
import { SuperAdminPanel } from './SuperAdminPanel';
import { createOrganization } from '../services/organizationService';

type TabType = 'overview' | 'recruiter' | 'hm-friction' | 'hiring-managers' | 'quality' | 'source-mix' | 'velocity';

export function ProductivityDashboard() {
  const { state, importCSVs, updateFilters, selectRecruiter, refreshMetrics, updateConfig, reset, clearPersistedData, canImportData } = useDashboard();
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

  const isSuperAdmin = user?.isSuperAdmin || false;

  const hasData = state.dataStore.requisitions.length > 0;
  const isDemo = state.dataStore.importSource === 'demo';
  const needsStageMapping = hasData && !state.dataStore.config.stageMapping.isComplete;

  // Sync filters and tab with URL for shareable links
  useUrlState({
    filters: state.filters,
    activeTab,
    onFiltersChange: updateFilters,
    onTabChange: (tab) => setActiveTab(tab as TabType)
  });

  // Calculate source effectiveness metrics
  const sourceEffectiveness = useMemo(() => {
    if (!hasData) return null;
    const { requisitions, candidates, events, config } = state.dataStore;
    const normalizedEvents = normalizeEventStages(events, config.stageMapping);
    return calculateSourceEffectiveness(candidates, requisitions, normalizedEvents, state.filters);
  }, [hasData, state.dataStore, state.filters]);

  // Calculate velocity metrics for decay analysis
  const velocityMetrics = useMemo(() => {
    if (!hasData) return null;
    const { requisitions, candidates, events, users } = state.dataStore;
    return calculateVelocityMetrics(candidates, requisitions, events, users, state.filters);
  }, [hasData, state.dataStore, state.filters]);

  // Refresh metrics when filters change or data is imported
  useEffect(() => {
    if (hasData) {
      refreshMetrics();
    }
  }, [hasData, state.filters.dateRange, refreshMetrics]);

  // Show stage mapping modal if needed
  useEffect(() => {
    if (needsStageMapping) {
      setShowStageMapping(true);
    }
  }, [needsStageMapping]);

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
    <div className={`container-fluid bg-light ${isMobile ? 'py-2 px-2' : 'py-4'}`} style={{ minHeight: '100vh' }}>
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
              <h1 className="mb-0 display-6 fw-bold text-dark">Recruiting Insights</h1>
              <div className="d-flex gap-3 mt-2 text-muted small">
                <span>{state.dataStore.requisitions.length} Requisitions</span>
                <span>{state.dataStore.candidates.length} Candidates</span>
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
              <button
                className="btn btn-bespoke-primary"
                onClick={refreshMetrics}
                disabled={state.isLoading}
              >
                {state.isLoading ? 'Syncing...' : 'Refresh Data'}
              </button>
              <div className="position-relative">
                <button
                  className="btn btn-bespoke-secondary"
                  onClick={() => setShowHeaderMenu(!showHeaderMenu)}
                  title="More options"
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
                      className="position-absolute end-0 mt-2 py-2 bg-white rounded-3 shadow-lg"
                      style={{ zIndex: 1001, minWidth: '180px', border: '1px solid var(--color-slate-200)' }}
                    >
                      <button
                        className="dropdown-item px-3 py-2 d-flex align-items-center gap-2 w-100 text-start border-0 bg-transparent"
                        onClick={() => { setShowStageMapping(true); setShowHeaderMenu(false); }}
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-slate-100)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        Stage Mapping
                      </button>
                      <button
                        className="dropdown-item px-3 py-2 d-flex align-items-center gap-2 w-100 text-start border-0 bg-transparent"
                        onClick={() => { handleExportRawData(); setShowHeaderMenu(false); }}
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-slate-100)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        Export Data
                      </button>
                      <hr className="my-2" />
                      <button
                        className="dropdown-item px-3 py-2 d-flex align-items-center gap-2 w-100 text-start border-0 bg-transparent text-danger"
                        onClick={() => { setShowClearConfirm(true); setShowHeaderMenu(false); }}
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-slate-100)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        Clear Database
                      </button>
                      {isSuperAdmin && (
                        <>
                          <hr className="my-2" />
                          <button
                            className="dropdown-item px-3 py-2 d-flex align-items-center gap-2 w-100 text-start border-0 bg-transparent text-danger"
                            onClick={() => { setShowSuperAdminPanel(true); setShowHeaderMenu(false); }}
                            style={{ cursor: 'pointer' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-slate-100)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            Super Admin Panel
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
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
          {/* Main Area */}
          <div className={isMobile ? 'col-12' : 'col-lg-9'}>
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
              </div>
            )}

            {/* Tab Content */}
            {state.isLoading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" />
                <p className="mt-2 text-muted">Calculating metrics...</p>
              </div>
            ) : (
              <>
                {activeTab === 'overview' && state.overview && (
                  <OverviewTab
                    overview={state.overview}
                    weeklyTrends={state.weeklyTrends}
                    dataHealth={state.dataStore.dataHealth}
                    filters={state.filters}
                    onSelectRecruiter={handleSelectRecruiter}
                    candidates={state.dataStore.candidates}
                    requisitions={state.dataStore.requisitions}
                    users={state.dataStore.users}
                  />
                )}

                {activeTab === 'recruiter' && state.overview && (
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
                )}

                {activeTab === 'hm-friction' && (
                  <HMFrictionTab
                    friction={state.hmFriction}
                    requisitions={state.dataStore.requisitions}
                    events={state.dataStore.events}
                    users={state.dataStore.users}
                    filters={state.filters}
                  />
                )}

                {activeTab === 'quality' && state.qualityMetrics && (
                  <QualityTab quality={state.qualityMetrics} />
                )}

                {activeTab === 'source-mix' && sourceEffectiveness && (
                  <SourceEffectivenessTab data={sourceEffectiveness} />
                )}

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

                {activeTab === 'velocity' && velocityMetrics && (
                  <VelocityInsightsTab metrics={velocityMetrics} />
                )}
              </>
            )}
          </div>

          {/* Sidebar - hidden on mobile for cleaner experience, hidden in print */}
          {!isMobile && (
            <div className="col-lg-3 sidebar-column">
              <DataHealthPanel
                health={state.dataStore.dataHealth}
                onConfigureStages={() => setShowStageMapping(true)}
              />

              {/* Quick Stats */}
              <div className="card-bespoke mt-4">
                <div className="card-header border-0 bg-transparent pt-3 px-3 pb-0">
                  <h6 className="mb-0 fw-bold">Quick Stats</h6>
                </div>
                <div className="card-body p-3">
                  <div className="d-flex justify-content-between align-items-center py-2 border-bottom border-light">
                    <span className="small text-muted">Recruiters</span>
                    <strong className="text-dark">{state.overview?.recruiterSummaries.length || 0}</strong>
                  </div>
                  <div className="d-flex justify-content-between align-items-center py-2 border-bottom border-light">
                    <span className="small text-muted">Hiring Managers</span>
                    <strong className="text-dark">{state.hmFriction.length}</strong>
                  </div>
                  <div className="d-flex justify-content-between align-items-center py-2 border-bottom border-light">
                    <span className="small text-muted">Open Reqs</span>
                    <strong className="text-dark">
                      {state.dataStore.requisitions.filter(r => r.status === 'Open').length}
                    </strong>
                  </div>
                  <div className="d-flex justify-content-between align-items-center py-2">
                    <span className="small text-muted">Active Candidates</span>
                    <strong className="text-dark">
                      {state.dataStore.candidates.filter(c => c.disposition === 'Active').length}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Last Import Info */}
              {state.dataStore.lastImportAt && (
                <div className="mt-4 p-3 rounded" style={{ background: 'var(--color-bg-base)', border: '1px solid var(--color-slate-200)' }}>
                  <small className="text-muted d-flex align-items-center gap-2">
                    <i className="bi bi-clock-history"></i>
                    Last synced: {state.dataStore.lastImportAt.toLocaleString()}
                  </small>
                </div>
              )}
            </div>
          )}
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
      </div>
    </div>
  );
}
