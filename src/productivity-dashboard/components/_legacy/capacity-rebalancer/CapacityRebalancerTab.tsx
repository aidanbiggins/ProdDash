/**
 * Capacity Rebalancer Tab
 *
 * Main page for capacity rebalancing analysis and recommendations.
 * Answers three key questions:
 * 1. Who is overloaded vs has slack?
 * 2. Which req moves reduce delay the most?
 * 3. What is the predicted improvement?
 */

import React, { useMemo, useState, useCallback } from 'react';
import { useDashboard } from '../../../hooks/useDashboardContext';
import { useDataMasking } from '../../../contexts/DataMaskingContext';
import {
    computeRecruiterUtilization,
    suggestReassignments,
    simulateMoveImpact,
    RebalancerInput
} from '../../../services/capacityRebalancerService';
import {
    RecruiterUtilizationRow,
    ReassignmentSuggestion,
    RebalancerResult,
    PrivacyMode,
    LOAD_STATUS_COLORS,
    getRecruiterDisplayName,
    ReassignmentCandidate
} from '../../../types/rebalancerTypes';
import { RecruiterUtilizationTable } from './RecruiterUtilizationTable';
import { SuggestedMoveCard } from './SuggestedMoveCard';
import { RecruiterWorkloadDrawer } from './RecruiterWorkloadDrawer';
import { MoveDetailDrawer } from './MoveDetailDrawer';
import { GlassPanel, SectionHeader, StatLabel, StatValue } from '../../common';
import { ActionItem, generateActionId } from '../../../types/actionTypes';
import { saveActionState } from '../../../services/actionQueueService';

export function CapacityRebalancerTab() {
    const { state } = useDashboard();
    const { dataStore } = state;
    const { requisitions, candidates, events, users, config, lastImportAt } = dataStore;
    const { isMasked } = useDataMasking();

    // State
    const [selectedRecruiter, setSelectedRecruiter] = useState<RecruiterUtilizationRow | null>(null);
    const [selectedSuggestion, setSelectedSuggestion] = useState<ReassignmentSuggestion | null>(null);
    const [appliedPlanIds, setAppliedPlanIds] = useState<Set<string>>(new Set());

    // Privacy mode
    const privacyMode: PrivacyMode = isMasked ? 'anonymized' : 'full';

    // Generate dataset ID for localStorage persistence (same pattern as ControlTowerTab)
    const datasetId = useMemo(() => {
        return `ds_${requisitions.length}_${candidates.length}_${lastImportAt?.getTime() || 0}`;
    }, [requisitions.length, candidates.length, lastImportAt]);

    // Build rebalancer input
    const rebalancerInput: RebalancerInput | null = useMemo(() => {
        if (!requisitions.length) return null;

        const dateRange = {
            start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
            end: new Date()
        };

        return {
            candidates,
            requisitions,
            events,
            users,
            dateRange
        };
    }, [candidates, requisitions, events, users]);

    // Run rebalancer analysis
    const result: RebalancerResult | null = useMemo(() => {
        if (!rebalancerInput) return null;
        return suggestReassignments(rebalancerInput);
    }, [rebalancerInput]);

    // Handle Apply Plan
    const handleApplyPlan = useCallback((suggestions: ReassignmentSuggestion[]) => {
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
    }, [appliedPlanIds, datasetId]);

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
            totalCandidates: Object.values(selectedSuggestion.reqDemand).reduce((a, b) => a + b, 0)
        };

        return simulateMoveImpact(move, rebalancerInput);
    }, [selectedSuggestion, rebalancerInput]);

    // No data state
    if (!result) {
        return (
            <div className="w-full px-4 py-4">
                <GlassPanel elevated padding="lg">
                    <div className="text-center py-8">
                        <i className="bi bi-arrow-left-right text-muted-foreground empty-state-icon"></i>
                        <h5 className="mt-3">No Data Available</h5>
                        <p className="text-muted-foreground">
                            Load data to view capacity rebalancing analysis.
                        </p>
                    </div>
                </GlassPanel>
            </div>
        );
    }

    // Degraded mode - low coverage
    const { utilizationResult, suggestions, isBalanced, confidence, hedgeMessage } = result;

    return (
        <div className="w-full px-4 py-4">
            {/* Page Header */}
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h4 className="mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                        Capacity Rebalancer
                    </h4>
                    <p className="text-muted-foreground mb-0 text-sm">
                        Identify overloaded recruiters and suggest workload rebalancing
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs"
                        style={{
                            background: confidence === 'HIGH' ? 'var(--color-good-bg)' :
                                confidence === 'MED' ? 'var(--color-warn-bg)' :
                                    'var(--color-bad-bg)',
                            color: confidence === 'HIGH' ? 'var(--color-good)' :
                                confidence === 'MED' ? 'var(--color-warn)' : 'var(--color-bad)'
                        }}
                    >
                        {confidence}
                    </span>
                </div>
            </div>

            {/* Degraded Mode Banner */}
            {utilizationResult.dataQuality.recruiterIdCoverage < 0.5 && (
                <div className="p-3 rounded-lg mb-4" style={{
                    background: 'var(--color-warn-bg)',
                    border: '1px solid var(--color-warn-border)'
                }}>
                    <div className="flex items-start gap-2">
                        <i className="bi bi-exclamation-triangle text-yellow-500"></i>
                        <div>
                            <strong>Limited Data Coverage</strong>
                            <p className="mb-0 text-sm">
                                Only {Math.round(utilizationResult.dataQuality.recruiterIdCoverage * 100)}% of requisitions have recruiter_id assigned.
                                Map the "Owner" or "Recruiter" column during import to unlock full analysis.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Overview Summary */}
            <GlassPanel elevated className="mb-4">
                <SectionHeader
                    title="Capacity Overview"
                    badge={<span className="text-muted-foreground text-sm">{hedgeMessage}</span>}
                />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
                    <div>
                        <StatLabel>Total Demand</StatLabel>
                        <StatValue size="lg">{utilizationResult.summary.totalDemand}</StatValue>
                        <span className="text-muted-foreground text-sm">candidates in flight</span>
                    </div>
                    <div>
                        <StatLabel>Team Capacity</StatLabel>
                        <StatValue size="lg">{Math.round(utilizationResult.summary.totalCapacity)}</StatValue>
                        <span className="text-muted-foreground text-sm">per week</span>
                    </div>
                    <div>
                        <StatLabel>Utilization</StatLabel>
                        <StatValue
                            size="lg"
                            style={{ color: LOAD_STATUS_COLORS[utilizationResult.summary.overallStatus] }}
                        >
                            {Math.round(utilizationResult.summary.overallUtilization * 100)}%
                        </StatValue>
                        <span className="text-muted-foreground text-sm">{utilizationResult.summary.overallStatus}</span>
                    </div>
                    <div>
                        <StatLabel>Status</StatLabel>
                        <div className="flex flex-wrap gap-2 mt-1">
                            {utilizationResult.summary.criticalCount > 0 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs" style={{ background: LOAD_STATUS_COLORS.critical, color: 'var(--text-heading)' }}>
                                    {utilizationResult.summary.criticalCount} Critical
                                </span>
                            )}
                            {utilizationResult.summary.overloadedCount > 0 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs" style={{ background: LOAD_STATUS_COLORS.overloaded, color: 'var(--text-heading)' }}>
                                    {utilizationResult.summary.overloadedCount} Overloaded
                                </span>
                            )}
                            {utilizationResult.summary.availableCount > 0 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs" style={{ background: LOAD_STATUS_COLORS.available, color: 'var(--text-heading)' }}>
                                    {utilizationResult.summary.availableCount} Available
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </GlassPanel>

            {/* Main Content - Two Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Left Column - Utilization Table */}
                <div>
                    <GlassPanel elevated>
                        <SectionHeader title="Recruiter Utilization" />
                        <RecruiterUtilizationTable
                            rows={utilizationResult.rows}
                            privacyMode={privacyMode}
                            onRowClick={setSelectedRecruiter}
                            selectedRecruiterId={selectedRecruiter?.recruiterId}
                        />
                        {utilizationResult.dataQuality.reqsWithoutRecruiter > 0 && (
                            <div className="text-muted-foreground text-sm mt-3 px-2">
                                <i className="bi bi-info-circle mr-1"></i>
                                {utilizationResult.dataQuality.reqsWithoutRecruiter} reqs missing recruiter_id (not shown)
                            </div>
                        )}
                    </GlassPanel>
                </div>

                {/* Right Column - Suggested Moves */}
                <div>
                    <GlassPanel elevated>
                        <SectionHeader
                            title="Suggested Moves"
                            badge={
                                suggestions.length > 0 ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-600 text-white">{suggestions.length}</span>
                                ) : null
                            }
                        />

                        {isBalanced ? (
                            <div className="text-center py-4">
                                <i className="bi bi-check-circle text-green-500 empty-state-icon"></i>
                                <h6 className="mt-2 text-green-500">Capacity Balanced</h6>
                                <p className="text-muted-foreground text-sm mb-0">
                                    No recruiters are currently overloaded. All recruiters are operating within capacity.
                                </p>
                            </div>
                        ) : suggestions.length === 0 ? (
                            <div className="text-center py-4">
                                <i className="bi bi-dash-circle text-muted-foreground empty-state-icon"></i>
                                <h6 className="mt-2">No Moves Suggested</h6>
                                <p className="text-muted-foreground text-sm mb-0">
                                    {hedgeMessage}
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-col gap-3 mt-3">
                                    {suggestions.map(suggestion => (
                                        <SuggestedMoveCard
                                            key={`${suggestion.reqId}-${suggestion.toRecruiterId}`}
                                            suggestion={suggestion}
                                            privacyMode={privacyMode}
                                            onViewDetails={() => setSelectedSuggestion(suggestion)}
                                            isApplied={appliedPlanIds.has(generateActionId(
                                                'TA_OPS',
                                                'ta_ops_team',
                                                suggestion.reqId,
                                                'REASSIGN_REQ'
                                            ))}
                                        />
                                    ))}
                                </div>

                                <div className="flex gap-2 mt-4 pt-3 border-t border-border">
                                    <button
                                        className="grow px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                                        onClick={() => handleApplyPlan(suggestions)}
                                        disabled={suggestions.every(s =>
                                            appliedPlanIds.has(generateActionId('TA_OPS', 'ta_ops_team', s.reqId, 'REASSIGN_REQ'))
                                        )}
                                    >
                                        <i className="bi bi-check-lg mr-1"></i>
                                        Apply Plan
                                    </button>
                                    <button className="px-4 py-2 border border-gray-500 text-gray-300 rounded-md hover:bg-gray-700">
                                        <i className="bi bi-download mr-1"></i>
                                        Export CSV
                                    </button>
                                </div>

                                <p className="text-muted-foreground text-sm mt-3 mb-0">
                                    <i className="bi bi-info-circle mr-1"></i>
                                    {hedgeMessage}. Apply Plan creates action items in the Unified Action Queue.
                                </p>
                            </>
                        )}
                    </GlassPanel>
                </div>
            </div>

            {/* Recruiter Workload Drawer */}
            {selectedRecruiter && (
                <RecruiterWorkloadDrawer
                    recruiter={selectedRecruiter}
                    requisitions={requisitions}
                    candidates={candidates}
                    privacyMode={privacyMode}
                    onClose={() => setSelectedRecruiter(null)}
                />
            )}

            {/* Move Detail Drawer */}
            {selectedSuggestion && selectedMoveImpact && (
                <MoveDetailDrawer
                    suggestion={selectedSuggestion}
                    impact={selectedMoveImpact}
                    privacyMode={privacyMode}
                    onClose={() => setSelectedSuggestion(null)}
                    onApply={() => {
                        handleApplyPlan([selectedSuggestion]);
                        setSelectedSuggestion(null);
                    }}
                    isApplied={appliedPlanIds.has(generateActionId(
                        'TA_OPS',
                        'ta_ops_team',
                        selectedSuggestion.reqId,
                        'REASSIGN_REQ'
                    ))}
                />
            )}
        </div>
    );
}
