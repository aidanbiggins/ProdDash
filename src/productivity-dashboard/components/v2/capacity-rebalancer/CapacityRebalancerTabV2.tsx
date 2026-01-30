/**
 * CapacityRebalancerTabV2
 *
 * Main page for capacity rebalancing analysis and recommendations.
 * V2 version using SubViewHeader, glass-panel, and Tailwind tokens.
 *
 * Answers three key questions:
 * 1. Who is overloaded vs has slack?
 * 2. Which req moves reduce delay the most?
 * 3. What is the predicted improvement?
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle,
  Download,
  Info,
  MinusCircle,
  Users,
} from 'lucide-react';
import { useDashboard } from '../../../hooks/useDashboardContext';
import { useDataMasking } from '../../../contexts/DataMaskingContext';
import { SubViewHeader } from '../SubViewHeader';
import { RecruiterUtilizationTableV2 } from './RecruiterUtilizationTableV2';
import { SuggestedMoveCardV2 } from './SuggestedMoveCardV2';
import { RecruiterWorkloadDrawerV2 } from './RecruiterWorkloadDrawerV2';
import { MoveDetailDrawerV2 } from './MoveDetailDrawerV2';
import { REBALANCER_PAGE_HELP } from './rebalancerHelpContent';
import {
  suggestReassignments,
  simulateMoveImpact,
  RebalancerInput,
} from '../../../services/capacityRebalancerService';
import {
  RecruiterUtilizationRow,
  ReassignmentSuggestion,
  RebalancerResult,
  PrivacyMode,
  ReassignmentCandidate,
} from '../../../types/rebalancerTypes';
import { generateActionId } from '../../../types/actionTypes';
import { saveActionState } from '../../../services/actionQueueService';

const statusBgColors: Record<string, string> = {
  critical: 'bg-bad',
  overloaded: 'bg-warn',
  balanced: 'bg-good',
  available: 'bg-primary',
  underutilized: 'bg-muted-foreground',
};

const statusTextColors: Record<string, string> = {
  critical: 'text-bad',
  overloaded: 'text-warn',
  balanced: 'text-good',
  available: 'text-primary',
  underutilized: 'text-muted-foreground',
};

const confidenceBadgeStyles: Record<string, string> = {
  HIGH: 'bg-good/20 text-good',
  MED: 'bg-warn/20 text-warn',
  LOW: 'bg-bad/20 text-bad',
  INSUFFICIENT: 'bg-muted text-muted-foreground',
};

export function CapacityRebalancerTabV2() {
  const { state } = useDashboard();
  const { dataStore } = state;
  const { requisitions, candidates, events, users, lastImportAt } = dataStore;
  const { isMasked } = useDataMasking();

  // State
  const [selectedRecruiter, setSelectedRecruiter] = useState<RecruiterUtilizationRow | null>(
    null
  );
  const [selectedSuggestion, setSelectedSuggestion] =
    useState<ReassignmentSuggestion | null>(null);
  const [appliedPlanIds, setAppliedPlanIds] = useState<Set<string>>(new Set());

  // Privacy mode
  const privacyMode: PrivacyMode = isMasked ? 'anonymized' : 'full';

  // Generate dataset ID for localStorage persistence
  const datasetId = useMemo(() => {
    return `ds_${requisitions.length}_${candidates.length}_${lastImportAt?.getTime() || 0}`;
  }, [requisitions.length, candidates.length, lastImportAt]);

  // Build rebalancer input
  const rebalancerInput: RebalancerInput | null = useMemo(() => {
    if (!requisitions.length) return null;

    const dateRange = {
      start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
      end: new Date(),
    };

    return {
      candidates,
      requisitions,
      events,
      users,
      dateRange,
    };
  }, [candidates, requisitions, events, users]);

  // Run rebalancer analysis
  const result: RebalancerResult | null = useMemo(() => {
    if (!rebalancerInput) return null;
    return suggestReassignments(rebalancerInput);
  }, [rebalancerInput]);

  // Handle Apply Plan
  const handleApplyPlan = useCallback(
    (suggestions: ReassignmentSuggestion[]) => {
      if (!datasetId) return;

      const newAppliedIds = new Set(appliedPlanIds);

      for (const suggestion of suggestions) {
        const actionId = generateActionId(
          'TA_OPS',
          'ta_ops_team',
          suggestion.reqId,
          'REASSIGN_REQ'
        );

        // Save as OPEN (creates if doesn't exist)
        saveActionState(datasetId, actionId, 'OPEN');
        newAppliedIds.add(actionId);

        // Also create HM notification action
        const notifyActionId = generateActionId(
          'TA_OPS',
          'ta_ops_team',
          suggestion.reqId,
          'NOTIFY_HM_REASSIGN'
        );
        saveActionState(datasetId, notifyActionId, 'OPEN');
        newAppliedIds.add(notifyActionId);
      }

      setAppliedPlanIds(newAppliedIds);
    },
    [appliedPlanIds, datasetId]
  );

  // Simulate move impact
  const selectedMoveImpact = useMemo(() => {
    if (!selectedSuggestion || !rebalancerInput) return null;

    const move: ReassignmentCandidate = {
      reqId: selectedSuggestion.reqId,
      reqTitle: selectedSuggestion.reqTitle,
      fromRecruiterId: selectedSuggestion.fromRecruiterId,
      fromRecruiterName: selectedSuggestion.fromRecruiterName,
      toRecruiterId: selectedSuggestion.toRecruiterId,
      toRecruiterName: selectedSuggestion.toRecruiterName,
      reqDemand: selectedSuggestion.reqDemand,
      totalCandidates: Object.values(selectedSuggestion.reqDemand).reduce(
        (a, b) => a + b,
        0
      ),
    };

    return simulateMoveImpact(move, rebalancerInput);
  }, [selectedSuggestion, rebalancerInput]);

  // No data state
  if (!result) {
    return (
      <div className="space-y-6">
        <SubViewHeader
          title="Capacity Rebalancer"
          subtitle="Identify overloaded recruiters and suggest workload rebalancing"
          helpContent={REBALANCER_PAGE_HELP}
        />
        <div className="glass-panel p-8 text-center">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h5 className="text-lg font-semibold text-foreground mb-2">No Data Available</h5>
          <p className="text-muted-foreground">
            Load data to view capacity rebalancing analysis.
          </p>
        </div>
      </div>
    );
  }

  const { utilizationResult, suggestions, isBalanced, confidence, hedgeMessage } = result;

  return (
    <div className="space-y-6">
      <SubViewHeader
        title="Capacity Rebalancer"
        subtitle="Identify overloaded recruiters and suggest workload rebalancing"
        helpContent={REBALANCER_PAGE_HELP}
        actions={
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${confidenceBadgeStyles[confidence]}`}
          >
            {confidence}
          </span>
        }
      />

      {/* Degraded Mode Banner */}
      {utilizationResult.dataQuality.recruiterIdCoverage < 0.5 && (
        <div className="p-4 rounded-lg bg-warn/10 border border-warn/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warn flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-foreground">Limited Data Coverage</div>
              <p className="text-muted-foreground text-sm mt-1 mb-0">
                Only {Math.round(utilizationResult.dataQuality.recruiterIdCoverage * 100)}%
                of requisitions have recruiter_id assigned. Map the "Owner" or "Recruiter"
                column during import to unlock full analysis.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Overview Summary */}
      <div className="glass-panel p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Capacity Overview
          </div>
          <span className="text-muted-foreground text-sm">{hedgeMessage}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Total Demand
            </div>
            <div className="font-mono text-2xl font-bold text-foreground">
              {utilizationResult.summary.totalDemand}
            </div>
            <span className="text-muted-foreground text-xs">candidates in flight</span>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Team Capacity
            </div>
            <div className="font-mono text-2xl font-bold text-foreground">
              {Math.round(utilizationResult.summary.totalCapacity)}
            </div>
            <span className="text-muted-foreground text-xs">per week</span>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Utilization
            </div>
            <div
              className={`font-mono text-2xl font-bold ${statusTextColors[utilizationResult.summary.overallStatus]}`}
            >
              {Math.round(utilizationResult.summary.overallUtilization * 100)}%
            </div>
            <span className="text-muted-foreground text-xs">
              {utilizationResult.summary.overallStatus}
            </span>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Status
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {utilizationResult.summary.criticalCount > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-bad text-white">
                  {utilizationResult.summary.criticalCount} Critical
                </span>
              )}
              {utilizationResult.summary.overloadedCount > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-warn text-white">
                  {utilizationResult.summary.overloadedCount} Overloaded
                </span>
              )}
              {utilizationResult.summary.availableCount > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-primary text-white">
                  {utilizationResult.summary.availableCount} Available
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Utilization Table */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Recruiter Utilization
            </span>
          </div>
          <div className="glass-panel">
            <RecruiterUtilizationTableV2
              rows={utilizationResult.rows}
              privacyMode={privacyMode}
              onRowClick={setSelectedRecruiter}
              selectedRecruiterId={selectedRecruiter?.recruiterId}
            />
            {utilizationResult.dataQuality.reqsWithoutRecruiter > 0 && (
              <div className="text-muted-foreground text-xs p-3 border-t border-border flex items-center gap-1">
                <Info className="w-3.5 h-3.5" />
                {utilizationResult.dataQuality.reqsWithoutRecruiter} reqs missing
                recruiter_id (not shown)
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Suggested Moves */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Suggested Moves
            </span>
            {suggestions.length > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-primary text-primary-foreground">
                {suggestions.length}
              </span>
            )}
          </div>
          <div className="glass-panel p-4">
            {isBalanced ? (
              <div className="text-center py-6">
                <CheckCircle className="w-12 h-12 text-good mx-auto mb-3" />
                <h6 className="text-good font-semibold mb-1">Capacity Balanced</h6>
                <p className="text-muted-foreground text-sm mb-0">
                  No recruiters are currently overloaded. All recruiters are operating
                  within capacity.
                </p>
              </div>
            ) : suggestions.length === 0 ? (
              <div className="py-4">
                <div className="text-center mb-4">
                  <AlertTriangle className="w-10 h-10 text-warn mx-auto mb-2" />
                  <h6 className="text-foreground font-semibold mb-1">Team is Over Capacity</h6>
                  <p className="text-muted-foreground text-sm mb-0">
                    Rebalancing redistributes work between recruiters, but everyone is already overloaded.
                    The issue isn't distribution—it's total capacity.
                  </p>
                </div>

                {/* Actionable recommendations */}
                <div className="border-t border-border pt-4 mt-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Recommended Actions
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2 p-2 rounded bg-muted/30">
                      <span className="text-primary font-bold">1.</span>
                      <div>
                        <span className="text-sm font-medium text-foreground">Hire more recruiters</span>
                        <span className="text-muted-foreground ml-1">
                          — Team needs ~{Math.ceil(utilizationResult.summary.totalDemand / 10)} recruiters
                          at current demand (you have {utilizationResult.rows.length})
                        </span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-2 rounded bg-muted/30">
                      <span className="text-primary font-bold">2.</span>
                      <div>
                        <span className="text-sm font-medium text-foreground">Reduce demand</span>
                        <span className="text-muted-foreground ml-1">
                          — Pause or close low-priority reqs to bring utilization under 100%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-2 rounded bg-muted/30">
                      <span className="text-primary font-bold">3.</span>
                      <div>
                        <span className="text-sm font-medium text-foreground">Outsource or use agencies</span>
                        <span className="text-muted-foreground ml-1">
                          — Temporarily offload sourcing for high-volume roles
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-3">
                  {suggestions.map((suggestion) => (
                    <SuggestedMoveCardV2
                      key={`${suggestion.reqId}-${suggestion.toRecruiterId}`}
                      suggestion={suggestion}
                      privacyMode={privacyMode}
                      onViewDetails={() => setSelectedSuggestion(suggestion)}
                      isApplied={appliedPlanIds.has(
                        generateActionId(
                          'TA_OPS',
                          'ta_ops_team',
                          suggestion.reqId,
                          'REASSIGN_REQ'
                        )
                      )}
                    />
                  ))}
                </div>

                <div className="flex gap-2 mt-4 pt-3 border-t border-border">
                  <button
                    type="button"
                    className="flex-1 px-4 py-3 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors min-h-[48px] flex items-center justify-center gap-2 disabled:opacity-50"
                    onClick={() => handleApplyPlan(suggestions)}
                    disabled={suggestions.every((s) =>
                      appliedPlanIds.has(
                        generateActionId('TA_OPS', 'ta_ops_team', s.reqId, 'REASSIGN_REQ')
                      )
                    )}
                  >
                    <Check className="w-4 h-4" />
                    Apply Plan
                  </button>
                  <button
                    type="button"
                    className="px-4 py-3 rounded-md text-sm font-medium border border-border text-foreground hover:bg-muted transition-colors min-h-[48px] flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </button>
                </div>

                <p className="text-muted-foreground text-xs mt-3 mb-0 flex items-start gap-1">
                  <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>
                    {hedgeMessage}. Apply Plan creates action items in the Unified Action
                    Queue.
                  </span>
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Recruiter Workload Drawer */}
      {selectedRecruiter && (
        <RecruiterWorkloadDrawerV2
          recruiter={selectedRecruiter}
          requisitions={requisitions}
          candidates={candidates}
          privacyMode={privacyMode}
          onClose={() => setSelectedRecruiter(null)}
        />
      )}

      {/* Move Detail Drawer */}
      {selectedSuggestion && selectedMoveImpact && (
        <MoveDetailDrawerV2
          suggestion={selectedSuggestion}
          impact={selectedMoveImpact}
          privacyMode={privacyMode}
          onClose={() => setSelectedSuggestion(null)}
          onApply={() => {
            handleApplyPlan([selectedSuggestion]);
            setSelectedSuggestion(null);
          }}
          isApplied={appliedPlanIds.has(
            generateActionId(
              'TA_OPS',
              'ta_ops_team',
              selectedSuggestion.reqId,
              'REASSIGN_REQ'
            )
          )}
        />
      )}
    </div>
  );
}

export default CapacityRebalancerTabV2;
