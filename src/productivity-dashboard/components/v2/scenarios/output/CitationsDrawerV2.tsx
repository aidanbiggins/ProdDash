/**
 * CitationsDrawerV2
 *
 * Slide-out panel showing all citations for the scenario output.
 * V2 version using GlassDrawer component.
 */

import React from 'react';
import { GlassDrawer } from '../../../common';
import { Citation } from '../../../../types/scenarioTypes';

interface CitationsDrawerV2Props {
  citations: Citation[];
  show: boolean;
  onClose: () => void;
}

export function CitationsDrawerV2({ citations, show, onClose }: CitationsDrawerV2Props) {
  if (!show) return null;

  // Group citations by source service
  const groupedCitations = citations.reduce(
    (acc, citation) => {
      const source = citation.source_service || 'unknown';
      if (!acc[source]) acc[source] = [];
      acc[source].push(citation);
      return acc;
    },
    {} as Record<string, Citation[]>
  );

  return (
    <GlassDrawer title="Citations" subtitle="Data Sources" onClose={onClose} width="400px">
      <p className="text-muted-foreground text-sm mb-4">
        Every computed value in this scenario is backed by data from your recruiting system.
        Citations link to the source of each metric.
      </p>

      {Object.entries(groupedCitations).map(([source, sourceCitations]) => (
        <div key={source} className="mb-6">
          <h6 className="text-muted-foreground uppercase text-xs tracking-wider mb-3">
            {formatSourceName(source)}
          </h6>
          <div className="space-y-2">
            {sourceCitations.map((citation, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center p-3 rounded-lg bg-muted/30 border-l-2 border-primary"
              >
                <span className="text-sm text-foreground">{citation.label}</span>
                <span className="font-mono font-semibold text-primary">
                  {formatValue(citation.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {citations.length === 0 && (
        <p className="text-muted-foreground text-center py-8">No citations available.</p>
      )}
    </GlassDrawer>
  );
}

/**
 * Format source service name for display
 */
function formatSourceName(source: string): string {
  const nameMap: Record<string, string> = {
    capacity_fit_engine: 'Capacity Analysis',
    forecasting_service: 'Forecasting',
    velocity_analysis: 'Velocity Metrics',
    scenario_library: 'Scenario Library',
    hm_metrics_engine: 'HM Metrics',
  };
  return nameMap[source] || source.replace(/_/g, ' ');
}

/**
 * Format citation value for display
 */
function formatValue(value: string | number): string {
  if (typeof value === 'number') {
    return value.toLocaleString();
  }
  return value;
}

export default CitationsDrawerV2;
