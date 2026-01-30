// Stage Mapping Modal Component

import React, { useState, useEffect } from 'react';
import { Candidate, Event, CanonicalStage } from '../types';
import { DashboardConfig, StageMapping } from '../types/config';
import {
  extractAllStages,
  autoSuggestMappings,
  createStageMappingConfig,
  validateStageMappingCompleteness
} from '../services';

interface StageMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: DashboardConfig;
  candidates: Candidate[];
  events: Event[];
  onSave: (config: DashboardConfig) => void;
}

const CANONICAL_STAGES: { value: CanonicalStage; label: string; description: string }[] = [
  { value: CanonicalStage.LEAD, label: 'Lead', description: 'Initial prospect' },
  { value: CanonicalStage.APPLIED, label: 'Applied', description: 'Submitted application' },
  { value: CanonicalStage.SCREEN, label: 'Screen', description: 'Recruiter phone screen' },
  { value: CanonicalStage.HM_SCREEN, label: 'HM Screen', description: 'Hiring manager review' },
  { value: CanonicalStage.ONSITE, label: 'Onsite', description: 'Full interview loop' },
  { value: CanonicalStage.FINAL, label: 'Final', description: 'Final round/exec interview' },
  { value: CanonicalStage.OFFER, label: 'Offer', description: 'Offer extended' },
  { value: CanonicalStage.HIRED, label: 'Hired', description: 'Offer accepted, hired' },
  { value: CanonicalStage.REJECTED, label: 'Rejected', description: 'Candidate rejected' },
  { value: CanonicalStage.WITHDREW, label: 'Withdrew', description: 'Candidate withdrew' }
];

export function StageMappingModal({
  isOpen,
  onClose,
  config,
  candidates,
  events,
  onSave
}: StageMappingModalProps) {
  const [mappings, setMappings] = useState<StageMapping[]>([]);
  const [allStages, setAllStages] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      const stages = extractAllStages(candidates, events);
      setAllStages(stages);

      // Use existing mappings or auto-suggest
      if (config.stageMapping.mappings.length > 0) {
        setMappings(config.stageMapping.mappings);
      } else {
        const suggestions = autoSuggestMappings(stages);
        setMappings(suggestions);
      }
    }
  }, [isOpen, candidates, events, config]);

  const handleMappingChange = (atsStage: string, canonicalStage: CanonicalStage | '') => {
    setMappings(prev => {
      // Remove existing mapping for this ATS stage
      const filtered = prev.filter(m => m.atsStage !== atsStage);

      // Add new mapping if a canonical stage was selected
      if (canonicalStage) {
        return [...filtered, { atsStage, canonicalStage }];
      }
      return filtered;
    });
  };

  const handleAutoSuggest = () => {
    const suggestions = autoSuggestMappings(allStages);
    setMappings(suggestions);
  };

  const handleSave = () => {
    const stageMappingConfig = createStageMappingConfig(mappings, allStages);
    const newConfig: DashboardConfig = {
      ...config,
      stageMapping: stageMappingConfig,
      lastUpdated: new Date(),
      lastUpdatedBy: 'user'
    };
    onSave(newConfig);
  };

  const validation = validateStageMappingCompleteness(mappings);
  const mappedAtsStages = new Set(mappings.map(m => m.atsStage));
  const unmappedStages = allStages.filter(s => !mappedAtsStages.has(s));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-5xl mx-4">
        <div className="bg-card border border-border rounded-lg shadow-lg max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h5 className="font-semibold text-foreground">Stage Mapping Configuration</h5>
            <button type="button" className="text-muted-foreground hover:text-foreground" onClick={onClose}>&times;</button>
          </div>
          <div className="p-4 overflow-y-auto flex-1">
            {/* Instructions */}
            <div className="p-3 rounded-lg bg-accent/10 border border-accent/30 text-foreground mb-4">
              <strong>Map your ATS stages to canonical stages.</strong>
              <p className="mb-0 text-sm mt-1">
                This mapping is required for funnel conversion metrics. Each ATS stage should be
                mapped to one canonical stage. Multiple ATS stages can map to the same canonical stage.
              </p>
            </div>

            {/* Validation Status */}
            <div className={`p-3 rounded-lg mb-4 ${validation.isComplete ? 'bg-good/10 border border-good/30 text-good' : 'bg-warn/10 border border-warn/30 text-warn'}`}>
              {validation.isComplete ? (
                <span>All required stages are mapped</span>
              ) : (
                <div>
                  <strong>Missing mappings for:</strong>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {validation.missingStages.map(s => (
                      <span key={s} className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-warn text-primary-foreground">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Auto-suggest button */}
            <div className="mb-4">
              <button className="px-3 py-1.5 text-sm font-medium rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={handleAutoSuggest}>
                Auto-suggest Mappings
              </button>
              <span className="text-muted-foreground text-sm ml-2">
                Attempts to match stage names based on common patterns
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Mapping Table */}
              <div className="md:col-span-2">
                <h6 className="mb-3 font-semibold text-foreground">Stage Mappings</h6>
                <div className="overflow-auto max-h-[400px] border border-border rounded">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">ATS Stage Name</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Canonical Stage</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allStages.map(stage => {
                        const mapping = mappings.find(m => m.atsStage === stage);
                        return (
                          <tr key={stage} className="border-b border-border">
                            <td className="px-3 py-2">
                              <code className="text-accent">{stage}</code>
                            </td>
                            <td className="px-3 py-2">
                              <select
                                className="w-full px-2 py-1 text-sm bg-card/30 border border-border rounded text-foreground focus:outline-none focus:border-accent"
                                value={mapping?.canonicalStage || ''}
                                onChange={(e) => handleMappingChange(
                                  stage,
                                  e.target.value as CanonicalStage | ''
                                )}
                              >
                                <option value="">-- Select --</option>
                                {CANONICAL_STAGES.map(cs => (
                                  <option key={cs.value} value={cs.value}>
                                    {cs.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              {mapping ? (
                                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-good text-white">Mapped</span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-muted text-muted-foreground">Unmapped</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Canonical Stage Reference */}
              <div>
                <h6 className="mb-3 font-semibold text-foreground">Canonical Stages Reference</h6>
                <div className="space-y-1 text-sm">
                  {CANONICAL_STAGES.map(cs => (
                    <div key={cs.value} className="p-2 rounded bg-muted border border-border">
                      <div className="flex justify-between items-center">
                        <strong className="text-foreground">{cs.label}</strong>
                        {validation.mappedStages.includes(cs.value) && (
                          <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded bg-good text-white">ok</span>
                        )}
                      </div>
                      <p className="text-muted-foreground text-xs mt-0.5">{cs.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="mt-4 p-3 rounded bg-muted border border-border">
              <div className="grid grid-cols-3 text-center">
                <div>
                  <div className="text-2xl font-bold text-foreground">{allStages.length}</div>
                  <p className="text-xs text-muted-foreground">Total Stages</p>
                </div>
                <div>
                  <div className="text-2xl font-bold text-good">{mappings.length}</div>
                  <p className="text-xs text-muted-foreground">Mapped</p>
                </div>
                <div>
                  <div className="text-2xl font-bold text-warn">{unmappedStages.length}</div>
                  <p className="text-xs text-muted-foreground">Unmapped</p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 p-4 border-t border-border">
            <button type="button" className="px-4 py-2 text-sm font-medium rounded-md bg-muted text-foreground hover:bg-muted/80" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium rounded-md bg-accent text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              onClick={handleSave}
              disabled={!validation.isComplete}
            >
              Save Mappings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
