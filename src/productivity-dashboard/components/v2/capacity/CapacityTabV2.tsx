/**
 * CapacityTabV2
 *
 * Main capacity planning tab showing recruiter workload and rebalancing.
 * V2 version using SubViewHeader, glass-panel, and Tailwind tokens.
 * Uses the real analyzeCapacity service for proper business logic.
 */

import React, { useState, useMemo } from 'react';
import { useDashboard } from '../../../hooks/useDashboardContext';
import { useDataMasking } from '../../../contexts/DataMaskingContext';
import { SubViewHeader } from '../SubViewHeader';
import { TeamCapacitySummaryV2 } from './TeamCapacitySummaryV2';
import { RecruiterLoadTableV2 } from './RecruiterLoadTableV2';
import { FitMatrixV2 } from './FitMatrixV2';
import { RebalanceRecommendationsV2 } from './RebalanceRecommendationsV2';
import { FitExplainDrawerV2 } from './FitExplainDrawerV2';
import { OverloadExplainDrawerV2 } from './OverloadExplainDrawerV2';
import { CAPACITY_PAGE_HELP } from './capacityHelpContent';
import { analyzeCapacity } from '../../../services/capacityFitEngine';
import { FitMatrixCell, RebalanceRecommendation, RecruiterLoadRow } from '../../../types/capacityTypes';
import { Users, Grid3X3, Lightbulb, AlertTriangle } from 'lucide-react';

interface CapacityTabV2Props {
  onNavigate?: (tab: string, params?: Record<string, string>) => void;
}

export function CapacityTabV2({ onNavigate }: CapacityTabV2Props) {
  const { state } = useDashboard();
  const { isMasked } = useDataMasking();
  const { dataStore, filters } = state;
  const { requisitions, candidates, events, users, config } = dataStore;

  // Local state for drawers
  const [selectedRecruiterId, setSelectedRecruiterId] = useState<string | null>(null);
  const [selectedFitCell, setSelectedFitCell] = useState<FitMatrixCell | null>(null);
  const [appliedRebalanceIds, setAppliedRebalanceIds] = useState<Set<string>>(new Set());

  // Run capacity analysis using the real engine
  const analysis = useMemo(() => {
    if (!requisitions.length || !config) {
      return null;
    }
    return analyzeCapacity(requisitions, candidates, events, users, filters, config);
  }, [requisitions, candidates, events, users, filters, config]);

  // Find selected recruiter load for drawer
  const selectedRecruiterLoad = useMemo(() => {
    if (!selectedRecruiterId || !analysis) return null;
    return analysis.recruiterLoads.find(r => r.recruiterId === selectedRecruiterId) || null;
  }, [selectedRecruiterId, analysis]);

  // Handle recruiter click
  const handleRecruiterClick = (recruiterId: string) => {
    setSelectedRecruiterId(recruiterId);
  };

  // Handle fit cell click
  const handleFitCellClick = (recruiterId: string, segmentString: string) => {
    if (!analysis) return;
    const cell = analysis.fitMatrix.find(c =>
      c.recruiterId === recruiterId && c.segmentString === segmentString
    );
    if (cell) {
      setSelectedFitCell(cell);
    }
  };

  // Handle rebalance apply
  const handleApplyRebalance = (rec: RebalanceRecommendation) => {
    setAppliedRebalanceIds(prev => new Set([...prev, rec.reqId]));
    // In real implementation, this would create an action in the action queue
    console.log('Apply rebalance:', rec);
  };

  const privacyModeValue = isMasked ? 'anonymized' : 'normal';

  // Blocked state - insufficient data for analysis
  if (!analysis || analysis.blocked) {
    return (
      <div className="space-y-6">
        <SubViewHeader
          title="Capacity Planning"
          subtitle="Analyze recruiter workload and optimize team capacity"
          helpContent={CAPACITY_PAGE_HELP}
        />

        <div className="glass-panel p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-warn mx-auto mb-3" />
          <h5 className="text-lg font-semibold text-foreground mb-2">
            Insufficient Data for Capacity Analysis
          </h5>
          <p className="text-muted-foreground max-w-md mx-auto">
            {analysis?.blockReason || 'Please load data to view capacity analysis.'}
          </p>
          <div className="text-sm text-muted-foreground mt-4">
            <strong className="text-foreground">Requirements:</strong>
            <ul className="list-none mt-2 space-y-1">
              <li>At least 3 recruiters with req assignments</li>
              <li>At least 10 open requisitions</li>
              <li>Recruiter ID coverage on 50%+ of reqs</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SubViewHeader
        title="Capacity Planning"
        subtitle="Analyze recruiter workload and optimize team capacity"
        helpContent={CAPACITY_PAGE_HELP}
      />

      {/* Top Row: Team Summary + Rebalance Suggestions side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Team Summary - 2/3 width */}
        <div className="lg:col-span-2">
          {analysis.teamSummary && (
            <TeamCapacitySummaryV2 summary={analysis.teamSummary} />
          )}
        </div>

        {/* Rebalance Suggestions - 1/3 width */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Rebalance Suggestions
            </span>
          </div>
          <RebalanceRecommendationsV2
            recommendations={analysis.rebalanceRecommendations}
            onApply={handleApplyRebalance}
            appliedIds={appliedRebalanceIds}
            privacyMode={privacyModeValue}
          />
        </div>
      </div>

      {/* Recruiter Workload Table - Full Width */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Recruiter Workload
          </span>
        </div>
        <RecruiterLoadTableV2
          rows={analysis.recruiterLoads}
          onRecruiterClick={handleRecruiterClick}
          privacyMode={privacyModeValue}
        />
      </div>

      {/* Fit Matrix - Full Width */}
      {analysis.fitMatrix.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Grid3X3 className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Fit Matrix (Capacity vs. Pipeline Fit)
            </span>
          </div>
          <FitMatrixV2
            cells={analysis.fitMatrix}
            onCellClick={handleFitCellClick}
            privacyMode={privacyModeValue}
          />
        </div>
      )}

      {/* Overload Explain Drawer */}
      <OverloadExplainDrawerV2
        isOpen={!!selectedRecruiterId}
        onClose={() => setSelectedRecruiterId(null)}
        recruiterLoad={selectedRecruiterLoad}
        reqWorkloads={analysis.reqWorkloads}
        onRebalanceClick={() => {
          setSelectedRecruiterId(null);
          onNavigate?.('capacity-rebalancer');
        }}
        privacyMode={privacyModeValue}
      />

      {/* Fit Explain Drawer */}
      <FitExplainDrawerV2
        isOpen={!!selectedFitCell}
        onClose={() => setSelectedFitCell(null)}
        cell={selectedFitCell}
        privacyMode={privacyModeValue}
      />
    </div>
  );
}

export default CapacityTabV2;
