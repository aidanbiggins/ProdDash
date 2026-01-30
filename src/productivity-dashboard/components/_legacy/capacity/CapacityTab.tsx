// Capacity Tab Component
// Main container for capacity planning views

import React, { useMemo, useState } from 'react';
import { useDashboard } from '../../../hooks/useDashboardContext';
import { analyzeCapacity } from '../../../services/capacityFitEngine';
import { TeamCapacitySummary } from './TeamCapacitySummary';
import { RecruiterLoadTable } from './RecruiterLoadTable';
import { FitMatrix } from './FitMatrix';
import { RebalanceRecommendations } from './RebalanceRecommendations';
import { OverloadExplainDrawer } from './OverloadExplainDrawer';
import { FitExplainDrawer } from './FitExplainDrawer';
import { RecruiterLoadRow, FitMatrixCell, RebalanceRecommendation } from '../../../types/capacityTypes';
import { PageHeader } from '../layout';
import { HelpButton, HelpDrawer } from '../../common';
import { CAPACITY_PAGE_HELP } from './capacityHelpContent';

export function CapacityTab() {
  const { state } = useDashboard();
  const { dataStore, filters } = state;
  const { requisitions, candidates, events, users, config } = dataStore;

  // State for page help
  const [showPageHelp, setShowPageHelp] = useState(false);

  // State for drawers
  const [selectedRecruiterId, setSelectedRecruiterId] = useState<string | null>(null);
  const [selectedFitCell, setSelectedFitCell] = useState<FitMatrixCell | null>(null);

  // Run capacity analysis
  const analysis = useMemo(() => {
    if (!requisitions.length || !config) {
      return null;
    }

    return analyzeCapacity(
      requisitions,
      candidates,
      events,
      users,
      filters,
      config
    );
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

  // Handle rebalance apply (placeholder - would integrate with req reassignment)
  const handleRebalanceApply = (rec: RebalanceRecommendation) => {
    console.log('Apply rebalance:', rec);
    // TODO: Implement actual req reassignment
    alert(`Rebalancing ${rec.reqTitle} from ${rec.fromRecruiterName} to ${rec.toRecruiterName} is not yet implemented.`);
  };

  // Blocked state
  if (!analysis || analysis.blocked) {
    return (
      <div className="w-full px-4 py-4">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12">
            <div className="rounded-lg border border-border bg-card">
              <div className="text-center py-8 px-4">
                <i className="bi bi-exclamation-triangle text-warn text-4xl"></i>
                <h5 className="mt-3 text-lg font-semibold text-foreground">Insufficient Data for Capacity Analysis</h5>
                <p className="text-muted-foreground mt-2">
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
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-4">
      {/* Page Header */}
      <PageHeader
        title="Capacity Planning"
        description="Analyze team workload distribution and recruiter fit by segment"
        actions={<HelpButton onClick={() => setShowPageHelp(true)} ariaLabel="Open page help" />}
      />
      <HelpDrawer
        isOpen={showPageHelp}
        onClose={() => setShowPageHelp(false)}
        title="Capacity Planning"
        content={CAPACITY_PAGE_HELP}
      />

      <div className="grid grid-cols-12 gap-4">
        {/* Left Column: Summary + Load Table */}
        <div className="col-span-12 lg:col-span-8">
          {/* Team Summary */}
          {analysis.teamSummary && (
            <div className="mb-4">
              <TeamCapacitySummary summary={analysis.teamSummary} />
            </div>
          )}

          {/* Recruiter Load Table */}
          <div className="mb-4">
            <RecruiterLoadTable
              rows={analysis.recruiterLoads}
              onRecruiterClick={handleRecruiterClick}
            />
          </div>

          {/* Fit Matrix */}
          <div className="mb-4">
            <FitMatrix
              cells={analysis.fitMatrix}
              onCellClick={handleFitCellClick}
            />
          </div>
        </div>

        {/* Right Column: Rebalance Recommendations */}
        <div className="col-span-12 lg:col-span-4">
          <div className="sticky top-4">
            <RebalanceRecommendations
              recommendations={analysis.rebalanceRecommendations}
              onApply={handleRebalanceApply}
            />
          </div>
        </div>
      </div>

      {/* Overload Explain Drawer */}
      <OverloadExplainDrawer
        isOpen={!!selectedRecruiterId}
        onClose={() => setSelectedRecruiterId(null)}
        recruiterLoad={selectedRecruiterLoad}
        reqWorkloads={analysis.reqWorkloads}
      />

      {/* Fit Explain Drawer */}
      <FitExplainDrawer
        isOpen={!!selectedFitCell}
        onClose={() => setSelectedFitCell(null)}
        cell={selectedFitCell}
      />
    </div>
  );
}

export default CapacityTab;
