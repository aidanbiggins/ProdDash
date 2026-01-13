// Pipeline Benchmark Configuration Modal
// Allows users to edit target benchmarks and load historical defaults

import React, { useState, useEffect } from 'react';
import {
  PipelineBenchmarkConfig,
  StageBenchmark,
  DEFAULT_PIPELINE_BENCHMARKS,
  HistoricalBenchmarkResult
} from '../../types/pipelineTypes';
import { CanonicalStage } from '../../types/entities';

interface BenchmarkConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: PipelineBenchmarkConfig;
  historicalBenchmarks: HistoricalBenchmarkResult | null;
  onSave: (config: PipelineBenchmarkConfig) => void;
  onLoadHistorical: () => void;
  isLoadingHistorical?: boolean;
}

const STAGE_ORDER = [
  CanonicalStage.SCREEN,
  CanonicalStage.HM_SCREEN,
  CanonicalStage.ONSITE,
  CanonicalStage.OFFER
];

const STAGE_NAMES: Record<CanonicalStage, string> = {
  [CanonicalStage.LEAD]: 'Lead',
  [CanonicalStage.APPLIED]: 'Applied',
  [CanonicalStage.SCREEN]: 'Screen',
  [CanonicalStage.HM_SCREEN]: 'HM Screen',
  [CanonicalStage.ONSITE]: 'Onsite',
  [CanonicalStage.FINAL]: 'Final',
  [CanonicalStage.OFFER]: 'Offer',
  [CanonicalStage.HIRED]: 'Hired',
  [CanonicalStage.REJECTED]: 'Rejected',
  [CanonicalStage.WITHDREW]: 'Withdrew'
};

export function BenchmarkConfigModal({
  isOpen,
  onClose,
  currentConfig,
  historicalBenchmarks,
  onSave,
  onLoadHistorical,
  isLoadingHistorical
}: BenchmarkConfigModalProps) {
  const [editedConfig, setEditedConfig] = useState<PipelineBenchmarkConfig>(currentConfig);
  const [showHistoricalPreview, setShowHistoricalPreview] = useState(false);

  // Reset edited config when modal opens
  useEffect(() => {
    if (isOpen) {
      setEditedConfig(currentConfig);
      setShowHistoricalPreview(false);
    }
  }, [isOpen, currentConfig]);

  const handleStageChange = (
    stage: CanonicalStage,
    field: keyof StageBenchmark,
    value: number
  ) => {
    setEditedConfig(prev => ({
      ...prev,
      stages: prev.stages.map(s =>
        s.stage === stage ? { ...s, [field]: value } : s
      )
    }));
  };

  const handleTotalTTFChange = (value: number) => {
    setEditedConfig(prev => ({
      ...prev,
      targetTotalTTF: value
    }));
  };

  const handleLoadDefaults = () => {
    setEditedConfig({
      ...DEFAULT_PIPELINE_BENCHMARKS,
      lastUpdated: new Date(),
      source: 'default'
    });
  };

  const handleApplyHistorical = () => {
    if (historicalBenchmarks) {
      setEditedConfig({
        ...historicalBenchmarks.benchmarks,
        lastUpdated: new Date(),
        source: 'historical'
      });
      setShowHistoricalPreview(false);
    }
  };

  const handleSave = () => {
    onSave({
      ...editedConfig,
      lastUpdated: new Date(),
      source: 'manual'
    });
    onClose();
  };

  const calculateTotalTargetDays = () => {
    return editedConfig.stages.reduce((sum, s) => sum + s.targetDays, 0);
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal show d-block"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <div>
              <h5 className="modal-title mb-1">
                <i className="bi bi-sliders me-2"></i>
                Configure Pipeline Benchmarks
              </h5>
              <small className="text-muted">
                Set your target SLAs for each stage of the hiring process
              </small>
            </div>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>

          <div className="modal-body">
            {/* Quick Actions */}
            <div className="d-flex gap-2 mb-4">
              <button
                className="btn btn-bespoke-secondary btn-sm"
                onClick={handleLoadDefaults}
              >
                <i className="bi bi-arrow-counterclockwise me-1"></i>
                Reset to Defaults
              </button>
              <button
                className="btn btn-bespoke-primary btn-sm"
                onClick={() => {
                  if (!historicalBenchmarks) {
                    onLoadHistorical();
                  }
                  setShowHistoricalPreview(true);
                }}
                disabled={isLoadingHistorical}
              >
                {isLoadingHistorical ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                    Calculating...
                  </>
                ) : (
                  <>
                    <i className="bi bi-database me-1"></i>
                    Load from Historical Data
                  </>
                )}
              </button>
            </div>

            {/* Historical Preview */}
            {showHistoricalPreview && historicalBenchmarks && (
              <div className="alert alert-info mb-4">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <strong>
                      <i className="bi bi-graph-up me-1"></i>
                      Historical Benchmarks Available
                    </strong>
                    <div className="small mt-1">
                      Based on {historicalBenchmarks.sampleSize} closed requisitions
                      <span className={`badge ms-2 ${
                        historicalBenchmarks.confidence === 'high' ? 'bg-success' :
                        historicalBenchmarks.confidence === 'medium' ? 'bg-warning' : 'bg-danger'
                      }`}>
                        {historicalBenchmarks.confidence} confidence
                      </span>
                    </div>
                    {historicalBenchmarks.notes.map((note, i) => (
                      <div key={i} className="small text-muted">{note}</div>
                    ))}
                  </div>
                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-sm btn-success"
                      onClick={handleApplyHistorical}
                    >
                      Apply
                    </button>
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => setShowHistoricalPreview(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Total TTF Target */}
            <div className="mb-4">
              <label className="form-label fw-medium">
                Target Total Time-to-Fill
              </label>
              <div className="input-group" style={{ maxWidth: 200 }}>
                <input
                  type="number"
                  className="form-control"
                  value={editedConfig.targetTotalTTF}
                  onChange={(e) => handleTotalTTFChange(parseInt(e.target.value) || 0)}
                  min={1}
                />
                <span className="input-group-text">days</span>
              </div>
              <small className="text-muted">
                Sum of stage targets: {calculateTotalTargetDays()} days
              </small>
            </div>

            {/* Stage Configuration */}
            <div className="table-responsive">
              <table className="table table-bespoke">
                <thead>
                  <tr>
                    <th>Stage</th>
                    <th className="text-center" style={{ width: 120 }}>
                      Target Days
                      <div className="small fw-normal">SLA target</div>
                    </th>
                    <th className="text-center" style={{ width: 120 }}>
                      Max Days
                      <div className="small fw-normal">Red flag</div>
                    </th>
                    <th className="text-center" style={{ width: 120 }}>
                      Target Pass %
                      <div className="small fw-normal">Conversion</div>
                    </th>
                    <th className="text-center" style={{ width: 120 }}>
                      Min Pass %
                      <div className="small fw-normal">Red flag</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {STAGE_ORDER.map(stageKey => {
                    const stage = editedConfig.stages.find(s => s.stage === stageKey);
                    if (!stage) return null;

                    return (
                      <tr key={stageKey}>
                        <td className="fw-medium">{STAGE_NAMES[stageKey]}</td>
                        <td>
                          <input
                            type="number"
                            className="form-control form-control-sm text-center"
                            value={stage.targetDays}
                            onChange={(e) => handleStageChange(stageKey, 'targetDays', parseInt(e.target.value) || 0)}
                            min={1}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-control form-control-sm text-center"
                            value={stage.maxDays}
                            onChange={(e) => handleStageChange(stageKey, 'maxDays', parseInt(e.target.value) || 0)}
                            min={1}
                          />
                        </td>
                        <td>
                          <div className="input-group input-group-sm">
                            <input
                              type="number"
                              className="form-control text-center"
                              value={Math.round(stage.targetPassRate * 100)}
                              onChange={(e) => handleStageChange(stageKey, 'targetPassRate', (parseInt(e.target.value) || 0) / 100)}
                              min={0}
                              max={100}
                            />
                            <span className="input-group-text">%</span>
                          </div>
                        </td>
                        <td>
                          <div className="input-group input-group-sm">
                            <input
                              type="number"
                              className="form-control text-center"
                              value={Math.round(stage.minPassRate * 100)}
                              onChange={(e) => handleStageChange(stageKey, 'minPassRate', (parseInt(e.target.value) || 0) / 100)}
                              min={0}
                              max={100}
                            />
                            <span className="input-group-text">%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Info Box */}
            <div className="small mb-0 p-3" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px' }}>
              <i className="bi bi-info-circle me-1" style={{ color: '#94A3B8' }}></i>
              <strong style={{ color: '#F8FAFC' }}>How benchmarks work:</strong>
              <ul className="mb-0 mt-2" style={{ color: '#94A3B8' }}>
                <li><strong style={{ color: '#F8FAFC' }}>Target</strong>: Your ideal SLA - performance at or better than this is "On Track"</li>
                <li><strong style={{ color: '#F8FAFC' }}>Max/Min</strong>: Red flag thresholds - exceeding these marks performance as "Critical"</li>
                <li>Benchmarks can be filtered by function/level when viewing reports</li>
              </ul>
            </div>
          </div>

          <div className="modal-footer">
            <div className="text-muted small me-auto">
              {editedConfig.source === 'historical' && (
                <i className="bi bi-database me-1"></i>
              )}
              {editedConfig.source === 'manual' && (
                <i className="bi bi-pencil me-1"></i>
              )}
              {editedConfig.source === 'default' && (
                <i className="bi bi-gear me-1"></i>
              )}
              Source: {editedConfig.source}
              {editedConfig.lastUpdated && (
                <> | Last updated: {new Date(editedConfig.lastUpdated).toLocaleDateString()}</>
              )}
            </div>
            <button type="button" className="btn btn-bespoke-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-bespoke-primary" onClick={handleSave}>
              <i className="bi bi-check-lg me-1"></i>
              Save Benchmarks
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BenchmarkConfigModal;
