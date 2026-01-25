/**
 * Scenario Output Panel
 *
 * Main container for displaying scenario results.
 */

import React, { useState } from 'react';
import { GlassPanel, SectionHeader } from '../../common';
import FeasibilityBadge from './FeasibilityBadge';
import DeltasCard from './DeltasCard';
import BottlenecksCard from './BottlenecksCard';
import ActionPlanCard from './ActionPlanCard';
import ConfidenceCard from './ConfidenceCard';
import CitationsDrawer from './CitationsDrawer';
import GenerateActionPlanButton from '../actions/GenerateActionPlanButton';
import ExplainForExecsButton from '../actions/ExplainForExecsButton';
import { ScenarioOutput } from '../../../types/scenarioTypes';

interface ScenarioOutputPanelProps {
  output: ScenarioOutput;
  scenarioMeta: { title: string; description: string; icon: string };
  datasetId: string;
}

export default function ScenarioOutputPanel({
  output,
  scenarioMeta,
  datasetId,
}: ScenarioOutputPanelProps) {
  const [showCitations, setShowCitations] = useState(false);

  // Check if scenario is blocked
  if (output.blocked) {
    return (
      <GlassPanel className="scenario-output-blocked mt-3">
        <div className="text-center py-8">
          <i className="bi bi-exclamation-octagon text-5xl text-red-400 mb-3 block" />
          <h5>Cannot Run Scenario</h5>
          <p className="text-muted-foreground mb-3">{output.blocked.reason}</p>

          {output.blocked.missing_data.length > 0 && (
            <div className="text-left mt-3">
              <h6>Missing Data:</h6>
              <ul className="list-none p-0">
                {output.blocked.missing_data.map((item, idx) => (
                  <li key={idx} className="mb-2">
                    <i className="bi bi-x-circle text-red-400 mr-2" />
                    <strong>{item.field}:</strong> {item.description}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {output.blocked.fix_instructions.length > 0 && (
            <div className="text-left mt-3">
              <h6>To Fix:</h6>
              <ul>
                {output.blocked.fix_instructions.map((instruction, idx) => (
                  <li key={idx}>{instruction}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </GlassPanel>
    );
  }

  return (
    <div className="scenario-output-panel mt-3">
      {/* Header with feasibility */}
      <GlassPanel className="scenario-output-header mb-3">
        <div className="flex justify-between items-start">
          <div>
            <h4 className="mb-1">{output.scenario_name}</h4>
            <p className="text-muted-foreground mb-0">
              Generated {output.generated_at.toLocaleString()}
            </p>
          </div>
          <FeasibilityBadge feasibility={output.feasibility} />
        </div>

        {/* Deltas summary */}
        <DeltasCard deltas={output.deltas} className="mt-3" />
      </GlassPanel>

      {/* Main content in 2-column layout */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-7">
          {/* Bottlenecks */}
          {output.bottlenecks.length > 0 && (
            <BottlenecksCard
              bottlenecks={output.bottlenecks}
              className="mb-3"
            />
          )}

          {/* Action Plan */}
          {output.action_plan.length > 0 && (
            <ActionPlanCard
              actions={output.action_plan}
              className="mb-3"
            />
          )}
        </div>

        <div className="col-span-12 lg:col-span-5">
          {/* Resource Impact */}
          {output.resource_impact && (
            <GlassPanel className="mb-3">
              <SectionHeader title="Resource Impact" />
              <div className="resource-impact-content">
                <div className="flex justify-between mb-2">
                  <span className="text-muted-foreground">Team Utilization Change</span>
                  <span className={output.resource_impact.team_utilization_delta > 0 ? 'text-red-400' : 'text-green-400'}>
                    {output.resource_impact.team_utilization_delta > 0 ? '+' : ''}
                    {Math.round(output.resource_impact.team_utilization_delta * 100)}%
                  </span>
                </div>

                {output.resource_impact.recruiter_impacts.length > 0 && (
                  <div className="recruiter-impacts mt-3">
                    <small className="text-muted-foreground">Per-Recruiter Impact:</small>
                    <div className="mt-2">
                      {output.resource_impact.recruiter_impacts
                        .filter(r => r.status_change !== 'NO_CHANGE')
                        .slice(0, 5)
                        .map(impact => (
                          <div key={impact.recruiter_id} className="flex justify-between mb-1">
                            <span>{impact.recruiter_name_anon}</span>
                            <span className={impact.status_change === 'BECOMES_OVERLOADED' ? 'text-red-400' : 'text-green-400'}>
                              {impact.status_change === 'BECOMES_OVERLOADED' ? 'Overloaded' : 'Available'}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </GlassPanel>
          )}

          {/* Confidence */}
          <ConfidenceCard confidence={output.confidence} className="mb-3" />

          {/* Deep Links */}
          {output.deep_links.length > 0 && (
            <GlassPanel className="mb-3">
              <SectionHeader title="Related Views" />
              <div className="deep-links">
                {output.deep_links.map((link, idx) => (
                  <a
                    key={idx}
                    href={`/${link.tab}?${new URLSearchParams(link.params).toString()}`}
                    className="deep-link-item block mb-2"
                  >
                    <i className="bi bi-arrow-right-circle mr-2" />
                    {link.label}
                    <small className="block text-muted-foreground">{link.rationale}</small>
                  </a>
                ))}
              </div>
            </GlassPanel>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="scenario-actions mt-3 flex gap-2 flex-wrap">
        <GenerateActionPlanButton
          actions={output.action_plan}
          datasetId={datasetId}
        />

        <ExplainForExecsButton output={output} />

        <button
          className="px-4 py-2 rounded-md border border-glass-border bg-transparent text-muted-foreground hover:bg-surface-elevated hover:text-foreground transition-colors"
          onClick={() => setShowCitations(true)}
        >
          <i className="bi bi-quote mr-2" />
          View Citations ({output.citations.length})
        </button>
      </div>

      {/* Citations drawer */}
      <CitationsDrawer
        citations={output.citations}
        show={showCitations}
        onClose={() => setShowCitations(false)}
      />
    </div>
  );
}
