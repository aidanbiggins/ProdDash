/**
 * ScenarioOutputPanelV2
 *
 * Main container for displaying scenario results.
 * V2 version using glass-panel, Tailwind tokens, and lucide-react icons.
 */

import React, { useState } from 'react';
import { OctagonAlert, XCircle, Quote, ArrowRightCircle } from 'lucide-react';
import { SectionHeader } from '../../../common';
import { FeasibilityBadgeV2 } from './FeasibilityBadgeV2';
import { DeltasCardV2 } from './DeltasCardV2';
import { BottlenecksCardV2 } from './BottlenecksCardV2';
import { ActionPlanCardV2 } from './ActionPlanCardV2';
import { ConfidenceCardV2 } from './ConfidenceCardV2';
import { CitationsDrawerV2 } from './CitationsDrawerV2';
import { GenerateActionPlanButtonV2 } from '../actions/GenerateActionPlanButtonV2';
import { ExplainForExecsButtonV2 } from '../actions/ExplainForExecsButtonV2';
import { ScenarioOutput } from '../../../../types/scenarioTypes';

interface ScenarioOutputPanelV2Props {
  output: ScenarioOutput;
  scenarioMeta: { title: string; description: string; icon: string };
  datasetId: string;
}

export function ScenarioOutputPanelV2({
  output,
  scenarioMeta,
  datasetId,
}: ScenarioOutputPanelV2Props) {
  const [showCitations, setShowCitations] = useState(false);

  // Check if scenario is blocked
  if (output.blocked) {
    return (
      <div className="glass-panel p-6 mt-4">
        <div className="text-center py-8">
          <OctagonAlert size={48} className="text-bad mx-auto mb-3" />
          <h5 className="text-lg font-semibold text-foreground mb-2">Cannot Run Scenario</h5>
          <p className="text-muted-foreground mb-4">{output.blocked.reason}</p>

          {output.blocked.missing_data.length > 0 && (
            <div className="text-left mt-4">
              <h6 className="text-foreground font-medium mb-2">Missing Data:</h6>
              <ul className="space-y-2">
                {output.blocked.missing_data.map((item, idx) => (
                  <li key={idx} className="flex items-start">
                    <XCircle size={16} className="text-bad mr-2 mt-0.5 shrink-0" />
                    <span>
                      <strong className="text-foreground">{item.field}:</strong>{' '}
                      <span className="text-muted-foreground">{item.description}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {output.blocked.fix_instructions.length > 0 && (
            <div className="text-left mt-4">
              <h6 className="text-foreground font-medium mb-2">To Fix:</h6>
              <ul className="list-decimal pl-5 space-y-1">
                {output.blocked.fix_instructions.map((instruction, idx) => (
                  <li key={idx} className="text-muted-foreground">
                    {instruction}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {/* Header with feasibility */}
      <div className="glass-panel p-4">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3 mb-3">
          <div>
            <h4 className="text-lg font-semibold text-foreground mb-1">{output.scenario_name}</h4>
            <p className="text-muted-foreground text-sm">
              Generated {output.generated_at.toLocaleString()}
            </p>
          </div>
          <FeasibilityBadgeV2 feasibility={output.feasibility} />
        </div>

        {/* Deltas summary */}
        <DeltasCardV2 deltas={output.deltas} className="mt-3" />
      </div>

      {/* Main content in 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 space-y-4">
          {/* Bottlenecks */}
          {output.bottlenecks.length > 0 && <BottlenecksCardV2 bottlenecks={output.bottlenecks} />}

          {/* Action Plan */}
          {output.action_plan.length > 0 && <ActionPlanCardV2 actions={output.action_plan} />}
        </div>

        <div className="lg:col-span-5 space-y-4">
          {/* Resource Impact */}
          {output.resource_impact && (
            <div className="glass-panel p-4">
              <SectionHeader title="Resource Impact" />
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Team Utilization Change</span>
                  <span
                    className={
                      output.resource_impact.team_utilization_delta > 0 ? 'text-bad' : 'text-good'
                    }
                  >
                    {output.resource_impact.team_utilization_delta > 0 ? '+' : ''}
                    {Math.round(output.resource_impact.team_utilization_delta * 100)}%
                  </span>
                </div>

                {output.resource_impact.recruiter_impacts.length > 0 && (
                  <div className="mt-3">
                    <small className="text-muted-foreground">Per-Recruiter Impact:</small>
                    <div className="mt-2 space-y-1">
                      {output.resource_impact.recruiter_impacts
                        .filter((r) => r.status_change !== 'NO_CHANGE')
                        .slice(0, 5)
                        .map((impact) => (
                          <div key={impact.recruiter_id} className="flex justify-between text-sm">
                            <span className="text-foreground">{impact.recruiter_name_anon}</span>
                            <span
                              className={
                                impact.status_change === 'BECOMES_OVERLOADED'
                                  ? 'text-bad'
                                  : 'text-good'
                              }
                            >
                              {impact.status_change === 'BECOMES_OVERLOADED'
                                ? 'Overloaded'
                                : 'Available'}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Confidence */}
          <ConfidenceCardV2 confidence={output.confidence} />

          {/* Deep Links */}
          {output.deep_links.length > 0 && (
            <div className="glass-panel p-4">
              <SectionHeader title="Related Views" />
              <div className="space-y-2">
                {output.deep_links.map((link, idx) => (
                  <a
                    key={idx}
                    href={`/${link.tab}?${new URLSearchParams(link.params).toString()}`}
                    className="flex items-start p-2 rounded-lg hover:bg-muted/30 transition-colors group"
                  >
                    <ArrowRightCircle
                      size={16}
                      className="mr-2 mt-0.5 text-primary group-hover:translate-x-0.5 transition-transform"
                    />
                    <div>
                      <span className="text-foreground group-hover:text-primary transition-colors">
                        {link.label}
                      </span>
                      <small className="block text-muted-foreground">{link.rationale}</small>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        <GenerateActionPlanButtonV2 actions={output.action_plan} datasetId={datasetId} />

        <ExplainForExecsButtonV2 output={output} />

        <button
          className="px-4 py-2 min-h-[44px] rounded-md border border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground transition-colors inline-flex items-center"
          onClick={() => setShowCitations(true)}
        >
          <Quote size={16} className="mr-2" />
          View Citations ({output.citations.length})
        </button>
      </div>

      {/* Citations drawer */}
      <CitationsDrawerV2
        citations={output.citations}
        show={showCitations}
        onClose={() => setShowCitations(false)}
      />
    </div>
  );
}

export default ScenarioOutputPanelV2;
