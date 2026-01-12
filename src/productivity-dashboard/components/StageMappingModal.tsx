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
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Stage Mapping Configuration</h5>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body">
            {/* Instructions */}
            <div className="alert alert-info mb-4">
              <strong>Map your ATS stages to canonical stages.</strong>
              <p className="mb-0 small">
                This mapping is required for funnel conversion metrics. Each ATS stage should be
                mapped to one canonical stage. Multiple ATS stages can map to the same canonical stage.
              </p>
            </div>

            {/* Validation Status */}
            <div className={`alert ${validation.isComplete ? 'alert-success' : 'alert-warning'} mb-4`}>
              {validation.isComplete ? (
                <span>✓ All required stages are mapped</span>
              ) : (
                <div>
                  <strong>Missing mappings for:</strong>
                  <div className="mt-1">
                    {validation.missingStages.map(s => (
                      <span key={s} className="badge bg-warning text-dark me-1">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Auto-suggest button */}
            <div className="mb-4">
              <button className="btn btn-outline-secondary btn-sm" onClick={handleAutoSuggest}>
                Auto-suggest Mappings
              </button>
              <small className="text-muted ms-2">
                Attempts to match stage names based on common patterns
              </small>
            </div>

            <div className="row">
              {/* Mapping Table */}
              <div className="col-md-8">
                <h6 className="mb-3">Stage Mappings</h6>
                <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <table className="table table-sm">
                    <thead className="table-light sticky-top">
                      <tr>
                        <th>ATS Stage Name</th>
                        <th>Canonical Stage</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allStages.map(stage => {
                        const mapping = mappings.find(m => m.atsStage === stage);
                        return (
                          <tr key={stage}>
                            <td>
                              <code>{stage}</code>
                            </td>
                            <td>
                              <select
                                className="form-select form-select-sm"
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
                            <td>
                              {mapping ? (
                                <span className="badge bg-success">Mapped</span>
                              ) : (
                                <span className="badge bg-secondary">Unmapped</span>
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
              <div className="col-md-4">
                <h6 className="mb-3">Canonical Stages Reference</h6>
                <div className="list-group small">
                  {CANONICAL_STAGES.map(cs => (
                    <div key={cs.value} className="list-group-item py-2">
                      <div className="d-flex justify-content-between">
                        <strong>{cs.label}</strong>
                        {validation.mappedStages.includes(cs.value) && (
                          <span className="badge bg-success">✓</span>
                        )}
                      </div>
                      <small className="text-muted">{cs.description}</small>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="mt-4 p-3 rounded" style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="row text-center">
                <div className="col">
                  <div className="h4 mb-0" style={{ color: '#F8FAFC' }}>{allStages.length}</div>
                  <small style={{ color: '#94A3B8' }}>Total Stages</small>
                </div>
                <div className="col">
                  <div className="h4 mb-0 text-success">{mappings.length}</div>
                  <small style={{ color: '#94A3B8' }}>Mapped</small>
                </div>
                <div className="col">
                  <div className="h4 mb-0 text-warning">{unmappedStages.length}</div>
                  <small style={{ color: '#94A3B8' }}>Unmapped</small>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
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
