// Main Productivity Dashboard Component

import React, { useState, useEffect, useMemo } from 'react';
import './../dashboard-theme.css'; // Import bespoke theme
import { useDashboard } from '../hooks/useDashboardContext';
import { CSVUpload } from './CSVUpload';
import { FilterBar } from './common/FilterBar';
import { DataHealthPanel } from './common/DataHealthPanel';
import { OverviewTab } from './overview/OverviewTab';
import { RecruiterDetailTab } from './recruiter-detail/RecruiterDetailTab';
import { HMFrictionTab } from './hm-friction/HMFrictionTab';
import { QualityTab } from './quality/QualityTab';
import { SourceEffectivenessTab } from './source-effectiveness/SourceEffectivenessTab';
import { StageMappingModal } from './StageMappingModal';
import { exportAllRawData, calculateSourceEffectiveness, normalizeEventStages } from '../services';

type TabType = 'overview' | 'recruiter' | 'hm-friction' | 'quality' | 'source-mix';

export function ProductivityDashboard() {
  const { state, importCSVs, updateFilters, selectRecruiter, refreshMetrics, updateConfig, reset } = useDashboard();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showStageMapping, setShowStageMapping] = useState(false);

  const hasData = state.dataStore.requisitions.length > 0;
  const isDemo = state.dataStore.importSource === 'demo';
  const needsStageMapping = hasData && !state.dataStore.config.stageMapping.isComplete;

  // Calculate source effectiveness metrics
  const sourceEffectiveness = useMemo(() => {
    if (!hasData) return null;
    const { requisitions, candidates, events, config } = state.dataStore;
    const normalizedEvents = normalizeEventStages(events, config.stageMapping);
    return calculateSourceEffectiveness(candidates, requisitions, normalizedEvents, state.filters);
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

  // If no data, show upload interface
  if (!hasData) {
    return (
      <CSVUpload
        onUpload={importCSVs}
        isLoading={state.isLoading}
      />
    );
  }

  return (
    <div className="container-fluid py-4 bg-light" style={{ minHeight: '100vh' }}>
      <div className="container-xxl"> {/* Centered container for better readability on large screens */}
        {/* Demo Mode Banner */}
        {isDemo && (
          <div className="demo-banner mb-4" role="alert">
            <span className="demo-banner-icon">⚠️</span>
            <div className="demo-banner-text">
              <strong>Demo Mode</strong> — You're viewing sample data. Import your own CSV files to see real metrics.
            </div>
            <button
              className="btn btn-bespoke-secondary btn-sm"
              onClick={reset}
            >
              Import Real Data
            </button>
          </div>
        )}

        {/* Header */}
        <div className="d-flex justify-content-between align-items-end mb-5">
          <div>
            <h6 className="text-uppercase text-muted mb-2" style={{ letterSpacing: '0.1em', fontSize: '0.75rem', fontWeight: 600 }}>Productivity Hub</h6>
            <h1 className="mb-0 display-6 fw-bold text-dark">Recruiting Insights</h1>
            <div className="d-flex gap-3 mt-2 text-muted small">
              <span><i className="bi bi-briefcase"></i> {state.dataStore.requisitions.length} Requisitions</span>
              <span><i className="bi bi-people"></i> {state.dataStore.candidates.length} Candidates</span>
            </div>
          </div>
          <div className="d-flex gap-2">
            <button
              className="btn btn-bespoke-secondary"
              onClick={() => setShowStageMapping(true)}
            >
              Stage Mapping
            </button>
            <button
              className="btn btn-bespoke-secondary"
              onClick={handleExportRawData}
            >
              Export Data
            </button>
            <button
              className="btn btn-bespoke-primary"
              onClick={refreshMetrics}
              disabled={state.isLoading}
            >
              {state.isLoading ? 'Syncing...' : 'Refresh Data'}
            </button>
          </div>
        </div>

        {/* Error Display */}
        {state.error && (
          <div className="alert alert-danger mb-4">
            {state.error}
          </div>
        )}

        {/* Filters */}
        <div className="glass-panel p-3 mb-5">
          <FilterBar
            filters={state.filters}
            requisitions={state.dataStore.requisitions}
            users={state.dataStore.users}
            onChange={updateFilters}
            onRefresh={refreshMetrics}
          />
        </div>

        {/* Main Content */}
        <div className="row g-4"> {/* Increased gutter for more breathing room */}
          {/* Main Area */}
          <div className="col-lg-9">
            {/* Tabs */}
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
            </div>

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
                  />
                )}

                {activeTab === 'hm-friction' && (
                  <HMFrictionTab
                    friction={state.hmFriction}
                    requisitions={state.dataStore.requisitions}
                    events={state.dataStore.events}
                    users={state.dataStore.users}
                  />
                )}

                {activeTab === 'quality' && state.qualityMetrics && (
                  <QualityTab quality={state.qualityMetrics} />
                )}

                {activeTab === 'source-mix' && sourceEffectiveness && (
                  <SourceEffectivenessTab data={sourceEffectiveness} />
                )}
              </>
            )}
          </div>

          {/* Sidebar */}
          <div className="col-lg-3">
            <DataHealthPanel
              health={state.dataStore.dataHealth}
              onConfigureStages={() => setShowStageMapping(true)}
            />

            {/* Quick Stats */}
            <div className="card-bespoke mt-4">
              <div className="card-header">
                <h6>Quick Stats</h6>
              </div>
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center py-2" style={{ borderBottom: '1px solid var(--color-slate-100)' }}>
                  <span className="small" style={{ color: 'var(--color-slate-500)' }}>Recruiters</span>
                  <strong style={{ color: 'var(--color-slate-800)' }}>{state.overview?.recruiterSummaries.length || 0}</strong>
                </div>
                <div className="d-flex justify-content-between align-items-center py-2" style={{ borderBottom: '1px solid var(--color-slate-100)' }}>
                  <span className="small" style={{ color: 'var(--color-slate-500)' }}>Hiring Managers</span>
                  <strong style={{ color: 'var(--color-slate-800)' }}>{state.hmFriction.length}</strong>
                </div>
                <div className="d-flex justify-content-between align-items-center py-2" style={{ borderBottom: '1px solid var(--color-slate-100)' }}>
                  <span className="small" style={{ color: 'var(--color-slate-500)' }}>Open Reqs</span>
                  <strong style={{ color: 'var(--color-slate-800)' }}>
                    {state.dataStore.requisitions.filter(r => r.status === 'Open').length}
                  </strong>
                </div>
                <div className="d-flex justify-content-between align-items-center py-2">
                  <span className="small" style={{ color: 'var(--color-slate-500)' }}>Active Candidates</span>
                  <strong style={{ color: 'var(--color-slate-800)' }}>
                    {state.dataStore.candidates.filter(c => c.disposition === 'Active').length}
                  </strong>
                </div>
              </div>
            </div>

            {/* Last Import Info */}
            {state.dataStore.lastImportAt && (
              <div className="mt-4 p-3 rounded" style={{ background: 'var(--color-slate-50)' }}>
                <small className="text-muted">
                  Last imported: {state.dataStore.lastImportAt.toLocaleString()}
                </small>
              </div>
            )}
          </div>
        </div>

        {/* Stage Mapping Modal */}
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
      </div>
    </div>
  );
}
