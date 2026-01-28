'use client';

// BottlenecksTabV2.tsx
// Main tab component for Bottlenecks & SLAs (V2 version)

import React, { useState, useMemo, useCallback } from 'react';
import { useDashboard } from '../../../hooks/useDashboardContext';
import { SubViewHeader } from '../SubViewHeader';
import { CoverageBannerV2 } from './CoverageBannerV2';
import { BottleneckStagesPanelV2 } from './BottleneckStagesPanelV2';
import { BreachTableV2 } from './BreachTableV2';
import { OwnerLeaderboardV2 } from './OwnerLeaderboardV2';
import { ReqDrilldownDrawerV2 } from './ReqDrilldownDrawerV2';
import { BOTTLENECKS_PAGE_HELP } from '../../_legacy/bottlenecks/bottlenecksHelpContent';
import {
  computeBottleneckSummary,
  computeStageDwellMetrics,
  checkCoverageSufficiency,
} from '../../../services/slaAttributionService';
import { generateSlaBreachActions } from '../../../services/slaActionService';
import {
  BottleneckSummary,
  StageDwellMetric,
  SlaPolicy,
} from '../../../types/slaTypes';
import { getSlaPolicies } from '../../_legacy/settings/SlaSettingsTab';
import { DataSnapshot, SnapshotEvent } from '../../../types/snapshotTypes';
import { Requisition, User } from '../../../types/entities';

interface BottlenecksTabV2Props {
  onNavigate?: (path: string) => void;
  onCreateActions?: (actions: ReturnType<typeof generateSlaBreachActions>) => void;
}

export function BottlenecksTabV2({ onNavigate, onCreateActions }: BottlenecksTabV2Props) {
  const { state, regenerateDemoSnapshots } = useDashboard();
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);
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
        <SubViewHeader
          title="Bottlenecks & SLAs"
          subtitle="Track stage dwell time and SLA compliance"
          helpContent={BOTTLENECKS_PAGE_HELP}
        />
        <div className="glass-panel p-4">
          <div className="py-8 text-center text-muted-foreground">
            <i className="bi bi-database text-5xl opacity-50" />
            <h3 className="mt-3 text-lg font-semibold text-foreground">No Data Available</h3>
            <p className="text-sm">Import data to start tracking bottlenecks and SLA compliance.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bottlenecks-tab">
      <SubViewHeader
        title="Bottlenecks & SLAs"
        subtitle="Track stage dwell time and SLA compliance"
        helpContent={BOTTLENECKS_PAGE_HELP}
        actions={
          bottleneckSummary && onCreateActions && (
            <button
              onClick={handleCreateActions}
              className="px-3 py-1 text-sm rounded-md text-white bg-accent-primary hover:opacity-90 transition-opacity"
            >
              <i className="bi bi-plus-circle mr-1" />
              Create Actions
            </button>
          )
        }
      />

      {/* Action Creation Feedback */}
      {actionFeedback?.show && (
        <div className="flex items-center justify-between p-3 mb-3 rounded-md bg-green-500/10 border border-green-500/30 text-green-500">
          <span>
            <i className="bi bi-check-circle mr-2" />
            {actionFeedback.count} action{actionFeedback.count !== 1 ? 's' : ''} created
          </span>
          <button
            onClick={() => onNavigate?.('/')}
            className="px-3 py-1 text-sm rounded-md bg-green-500/20 text-green-500 border border-green-500/30 hover:bg-green-500/30 transition-colors"
          >
            View in Command Center <i className="bi bi-arrow-right ml-1" />
          </button>
        </div>
      )}

      {/* Coverage Banner */}
      <CoverageBannerV2
        coverage={coverage}
        onImportClick={() => onNavigate?.('/settings/data-health')}
        onGenerateDemoSnapshots={regenerateDemoSnapshots}
        isDemo={isDemo}
        hasCandidateData={state.dataStore.candidates.length > 0}
      />

      {/* Main Content */}
      {coverage.is_sufficient && bottleneckSummary ? (
        <>
          {/* Top Row: Stages + Summary */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <BottleneckStagesPanelV2
              stages={bottleneckSummary.top_stages}
              onStageClick={(stage) => {
                // Could filter breach table by stage
                console.log('Stage clicked:', stage);
              }}
            />
            <OwnerLeaderboardV2
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
          <BreachTableV2
            breaches={bottleneckSummary.top_reqs}
            onReqClick={handleReqClick}
            onExport={handleExport}
          />

          {/* Req Drilldown Drawer */}
          <ReqDrilldownDrawerV2
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
        <div className="glass-panel p-4">
          <div className="py-8 text-center text-muted-foreground">
            <i className="bi bi-exclamation-triangle text-5xl opacity-50 text-amber-500" />
            <h3 className="mt-3 text-lg font-semibold text-foreground">
              Insufficient Data for SLA Tracking
            </h3>
            <p className="max-w-[400px] mx-auto text-sm">
              SLA tracking requires regular data snapshots to measure how long candidates
              spend in each stage.
            </p>
            <ul className="text-left max-w-[400px] mx-auto mt-4 text-sm space-y-1">
              {coverage.insufficiency_reasons.map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground/70 mt-4">
              Import data snapshots more frequently (at least every 3 days) to enable
              accurate SLA tracking.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default BottlenecksTabV2;
