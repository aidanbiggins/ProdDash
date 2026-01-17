// BottlenecksTab.tsx
// Main tab component for Bottlenecks & SLAs

import React, { useState, useMemo, useCallback } from 'react';
import { useDashboard } from '../../hooks/useDashboardContext';
import { PageHeader } from '../common/PageHeader';
import { GlassPanel } from '../layout/GlassPanel';
import { HelpButton, HelpDrawer } from '../common';
import { CoverageBanner } from './CoverageBanner';
import { BottleneckStagesPanel } from './BottleneckStagesPanel';
import { BreachTable } from './BreachTable';
import { OwnerLeaderboard } from './OwnerLeaderboard';
import { ReqDrilldownDrawer } from './ReqDrilldownDrawer';
import { BOTTLENECKS_PAGE_HELP } from './bottlenecksHelpContent';
import {
  computeBottleneckSummary,
  computeStageDwellMetrics,
  checkCoverageSufficiency,
} from '../../services/slaAttributionService';
import { generateSlaBreachActions } from '../../services/slaActionService';
import {
  BottleneckSummary,
  StageDwellMetric,
  SlaPolicy,
} from '../../types/slaTypes';
import { getSlaPolicies } from '../settings/SlaSettingsTab';
import { DataSnapshot, SnapshotEvent } from '../../types/snapshotTypes';
import { Requisition, User } from '../../types/entities';

interface BottlenecksTabProps {
  onNavigate?: (path: string) => void;
  onCreateActions?: (actions: ReturnType<typeof generateSlaBreachActions>) => void;
}

export function BottlenecksTab({ onNavigate, onCreateActions }: BottlenecksTabProps) {
  const { state, regenerateDemoSnapshots } = useDashboard();
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);
  const [showPageHelp, setShowPageHelp] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ count: number; show: boolean } | null>(null);

  // Check if in demo mode
  const isDemo = state.dataStore.importSource === 'demo';

  // Build maps for quick lookup
  const requisitionMap = useMemo(() => {
    const map = new Map<string, Requisition>();
    state.dataStore.requisitions.forEach((req) => map.set(req.req_id, req));
    return map;
  }, [state.dataStore.requisitions]);

  const userMap = useMemo(() => {
    const map = new Map<string, User>();
    state.dataStore.users.forEach((user) => map.set(user.user_id, user));
    return map;
  }, [state.dataStore.users]);

  // Get snapshot data if available (populated in demo mode for SLA tracking)
  const snapshots: DataSnapshot[] = useMemo(() => {
    return state.dataStore.snapshots ?? [];
  }, [state.dataStore.snapshots]);

  const snapshotEvents: SnapshotEvent[] = useMemo(() => {
    return state.dataStore.snapshotEvents ?? [];
  }, [state.dataStore.snapshotEvents]);

  // Compute date range (last 30 days)
  const dateRange = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return { start, end };
  }, []);

  // Load SLA policies (from localStorage or defaults)
  const slaPolicies = useMemo(() => getSlaPolicies(), []);

  // Check coverage
  const coverage = useMemo(() => {
    return checkCoverageSufficiency(snapshots, dateRange);
  }, [snapshots, dateRange]);

  // Compute bottleneck summary
  const bottleneckSummary: BottleneckSummary | null = useMemo(() => {
    if (!coverage.is_sufficient || snapshotEvents.length === 0) {
      return null;
    }

    return computeBottleneckSummary(
      snapshotEvents,
      snapshots,
      requisitionMap,
      userMap,
      dateRange,
      slaPolicies
    );
  }, [snapshotEvents, snapshots, requisitionMap, userMap, dateRange, coverage.is_sufficient, slaPolicies]);

  // Compute dwell metrics for drilldown
  const dwellMetrics = useMemo(() => {
    if (snapshotEvents.length === 0) return [];
    return computeStageDwellMetrics(
      snapshotEvents,
      requisitionMap,
      userMap,
      slaPolicies
    );
  }, [snapshotEvents, requisitionMap, userMap, slaPolicies]);

  // Get metrics for selected req
  const selectedReqMetrics = useMemo(() => {
    if (!selectedReqId) return [];
    return dwellMetrics.filter((m) => m.req_id === selectedReqId);
  }, [selectedReqId, dwellMetrics]);

  const selectedReq = selectedReqId ? requisitionMap.get(selectedReqId) : null;
  const selectedReqBreach = bottleneckSummary?.top_reqs.find((r) => r.req_id === selectedReqId);

  // Handlers
  const handleReqClick = useCallback((reqId: string) => {
    setSelectedReqId(reqId);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setSelectedReqId(null);
  }, []);

  const handleCreateActions = useCallback(() => {
    if (!bottleneckSummary || !onCreateActions) return;
    const actions = generateSlaBreachActions(bottleneckSummary);
    onCreateActions(actions);

    // Show feedback
    setActionFeedback({ count: actions.length, show: true });
    setTimeout(() => setActionFeedback(null), 5000);
  }, [bottleneckSummary, onCreateActions]);

  const handleViewHMScorecard = useCallback(
    (hmId: string) => {
      if (onNavigate) {
        onNavigate(`/diagnose/hiring-managers?hm=${hmId}`);
      }
    },
    [onNavigate]
  );

  const handleExport = useCallback(() => {
    if (!bottleneckSummary) return;

    // Create CSV content
    const headers = ['Req ID', 'Title', 'Worst Stage', 'Breach Hours', 'Owner', 'Days Open'];
    const rows = bottleneckSummary.top_reqs.map((req) => [
      req.req_id,
      `"${req.req_title.replace(/"/g, '""')}"`,
      req.worst_stage,
      req.worst_breach_hours.toFixed(1),
      req.hiring_manager_name ?? req.recruiter_name ?? 'Unknown',
      req.days_open.toString(),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sla-breaches-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [bottleneckSummary]);

  // If no data at all, show empty state
  const hasNoData = state.dataStore.requisitions.length === 0 && state.dataStore.candidates.length === 0;

  if (hasNoData) {
    return (
      <div className="bottlenecks-tab">
        <PageHeader
          title="Bottlenecks & SLAs"
          subtitle="Track stage dwell time and SLA compliance"
          actions={<HelpButton onClick={() => setShowPageHelp(true)} ariaLabel="Open page help" />}
        />
        <HelpDrawer
          isOpen={showPageHelp}
          onClose={() => setShowPageHelp(false)}
          title="Bottlenecks & SLAs"
          content={BOTTLENECKS_PAGE_HELP}
        />
        <GlassPanel>
          <div
            style={{
              padding: 'var(--space-8)',
              textAlign: 'center',
              color: 'var(--text-secondary)',
            }}
          >
            <i className="bi bi-database" style={{ fontSize: '3rem', opacity: 0.5 }} />
            <h3 style={{ marginTop: 'var(--space-3)' }}>No Data Available</h3>
            <p>Import data to start tracking bottlenecks and SLA compliance.</p>
          </div>
        </GlassPanel>
      </div>
    );
  }

  return (
    <div className="bottlenecks-tab">
      <PageHeader
        title="Bottlenecks & SLAs"
        subtitle="Track stage dwell time and SLA compliance"
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            {bottleneckSummary && onCreateActions && (
              <button
                onClick={handleCreateActions}
                className="btn btn-sm"
                style={{
                  background: 'var(--color-accent-primary)',
                  color: '#fff',
                  border: 'none',
                }}
              >
                <i className="bi bi-plus-circle me-1" />
                Create Actions
              </button>
            )}
            <HelpButton onClick={() => setShowPageHelp(true)} ariaLabel="Open page help" />
          </div>
        }
      />
      <HelpDrawer
        isOpen={showPageHelp}
        onClose={() => setShowPageHelp(false)}
        title="Bottlenecks & SLAs"
        content={BOTTLENECKS_PAGE_HELP}
      />

      {/* Action Creation Feedback */}
      {actionFeedback?.show && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-3) var(--space-4)',
            marginBottom: 'var(--space-3)',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#22c55e',
          }}
        >
          <span>
            <i className="bi bi-check-circle me-2" />
            {actionFeedback.count} action{actionFeedback.count !== 1 ? 's' : ''} created
          </span>
          <button
            onClick={() => onNavigate?.('/')}
            className="btn btn-sm"
            style={{
              background: 'rgba(34, 197, 94, 0.2)',
              color: '#22c55e',
              border: '1px solid rgba(34, 197, 94, 0.3)',
            }}
          >
            View in Command Center <i className="bi bi-arrow-right ms-1" />
          </button>
        </div>
      )}

      {/* Coverage Banner */}
      <CoverageBanner
        coverage={coverage}
        onImportClick={() => onNavigate?.('/settings/data-health')}
        onGenerateDemoSnapshots={isDemo ? regenerateDemoSnapshots : undefined}
        isDemo={isDemo}
      />

      {/* Main Content */}
      {coverage.is_sufficient && bottleneckSummary ? (
        <>
          {/* Top Row: Stages + Summary */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 'var(--space-4)',
              marginBottom: 'var(--space-4)',
            }}
          >
            <BottleneckStagesPanel
              stages={bottleneckSummary.top_stages}
              onStageClick={(stage) => {
                // Could filter breach table by stage
                console.log('Stage clicked:', stage);
              }}
            />
            <OwnerLeaderboard
              owners={bottleneckSummary.top_owners}
              breachByOwnerType={bottleneckSummary.breach_by_owner_type}
              onOwnerClick={(ownerId, ownerType) => {
                if (ownerType === 'HM') {
                  handleViewHMScorecard(ownerId);
                }
              }}
            />
          </div>

          {/* Breach Table */}
          <BreachTable
            breaches={bottleneckSummary.top_reqs}
            onReqClick={handleReqClick}
            onExport={handleExport}
          />

          {/* Req Drilldown Drawer */}
          <ReqDrilldownDrawer
            isOpen={selectedReqId !== null}
            onClose={handleCloseDrawer}
            reqId={selectedReqId ?? ''}
            reqTitle={selectedReq?.req_title ?? selectedReqBreach?.req_title ?? ''}
            recruiterName={
              selectedReq?.recruiter_id
                ? userMap.get(selectedReq.recruiter_id)?.name ?? null
                : selectedReqBreach?.recruiter_name ?? null
            }
            hiringManagerName={
              selectedReq?.hiring_manager_id
                ? userMap.get(selectedReq.hiring_manager_id)?.name ?? null
                : selectedReqBreach?.hiring_manager_name ?? null
            }
            daysOpen={selectedReqBreach?.days_open ?? 0}
            dwellMetrics={selectedReqMetrics}
            onViewHMScorecard={handleViewHMScorecard}
            onCreateAction={(reqId) => {
              // Create action for specific req
              const reqBreach = bottleneckSummary.top_reqs.find((r) => r.req_id === reqId);
              if (reqBreach && onCreateActions) {
                const actions = generateSlaBreachActions({
                  ...bottleneckSummary,
                  top_reqs: [reqBreach],
                });
                onCreateActions(actions);
              }
            }}
          />
        </>
      ) : (
        // Insufficient coverage message
        <GlassPanel>
          <div
            style={{
              padding: 'var(--space-8)',
              textAlign: 'center',
              color: 'var(--text-secondary)',
            }}
          >
            <i
              className="bi bi-exclamation-triangle"
              style={{ fontSize: '3rem', opacity: 0.5, color: '#f59e0b' }}
            />
            <h3 style={{ marginTop: 'var(--space-3)' }}>
              Insufficient Data for SLA Tracking
            </h3>
            <p style={{ maxWidth: '400px', margin: '0 auto' }}>
              SLA tracking requires regular data snapshots to measure how long candidates
              spend in each stage.
            </p>
            <ul
              style={{
                textAlign: 'left',
                maxWidth: '400px',
                margin: 'var(--space-4) auto',
                fontSize: 'var(--text-sm)',
              }}
            >
              {coverage.insufficiency_reasons.map((reason, i) => (
                <li key={i} style={{ marginBottom: 'var(--space-1)' }}>
                  {reason}
                </li>
              ))}
            </ul>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
              Import data snapshots more frequently (at least every 3 days) to enable
              accurate SLA tracking.
            </p>
          </div>
        </GlassPanel>
      )}
    </div>
  );
}

export default BottlenecksTab;
