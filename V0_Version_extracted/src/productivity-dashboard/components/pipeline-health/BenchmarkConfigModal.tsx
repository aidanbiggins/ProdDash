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
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col bg-[#1a1a1a] rounded-lg border border-white/10">
        <div className="flex items-start justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h5 className="text-lg font-semibold mb-1">
              <i className="bi bi-sliders mr-2"></i>
              Configure Pipeline Benchmarks
            </h5>
            <small className="text-muted-foreground text-xs">
              Set your target SLAs for each stage of the hiring process
            </small>
          </div>
          <button type="button" className="p-0 border-0 bg-transparent text-2xl" onClick={onClose}>&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* Quick Actions */}
            <div className="flex gap-2 mb-4">
              <button
                className="px-3 py-1.5 text-xs rounded border border-white/10 text-muted-foreground hover:bg-white/5"
                onClick={handleLoadDefaults}
              >
                <i className="bi bi-arrow-counterclockwise mr-1"></i>
                Reset to Defaults
              </button>
              <button
                className="px-3 py-1.5 text-xs rounded font-medium"
                style={{
                  background: 'var(--primary)',
                  color: '#1a1a1a',
                }}
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
                    <span className="w-4 h-4 border-2 border-current border-r-transparent rounded-full animate-spin mr-1 inline-block" role="status"></span>
                    Calculating...
                  </>
                ) : (
                  <>
                    <i className="bi bi-database mr-1"></i>
                    Load from Historical Data
                  </>
                )}
              </button>
            </div>

            {/* Historical Preview */}
            {showHistoricalPreview && historicalBenchmarks && (
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 mb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <strong>
                      <i className="bi bi-graph-up mr-1"></i>
                      Historical Benchmarks Available
                    </strong>
                    <div className="small mt-1">
                      Based on {historicalBenchmarks.sampleSize} closed requisitions
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ml-2 ${
                        historicalBenchmarks.confidence === 'high' ? 'bg-green-500 text-white' :
                        historicalBenchmarks.confidence === 'medium' ? 'bg-yellow-500 text-gray-900' : 'bg-red-500 text-white'
                      }`}>
                        {historicalBenchmarks.confidence} confidence
                      </span>
                    </div>
                    {historicalBenchmarks.notes.map((note, i) => (
                      <div key={i} className="small text-muted-foreground">{note}</div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="px-3 py-1 text-xs rounded bg-green-500/20 text-green-500 hover:bg-green-500/30"
                      onClick={handleApplyHistorical}
                    >
                      Apply
                    </button>
                    <button
                      className="px-3 py-1 text-xs rounded border border-white/10 text-muted-foreground hover:bg-white/5"
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
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Target Total Time-to-Fill
              </label>
              <div className="flex" style={{ maxWidth: 200 }}>
                <input
                  type="number"
                  className="flex-1 px-3 py-2 rounded-l border"
                  value={editedConfig.targetTotalTTF}
                  onChange={(e) => handleTotalTTFChange(parseInt(e.target.value) || 0)}
                  min={1}
                />
                <span className="px-3 py-2 rounded-r border border-l-0 bg-white/5 text-xs">days</span>
              </div>
              <small className="text-muted-foreground text-xs">
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
                      <div className="small font-normal">SLA target</div>
                    </th>
                    <th className="text-center" style={{ width: 120 }}>
                      Max Days
                      <div className="small font-normal">Red flag</div>
                    </th>
                    <th className="text-center" style={{ width: 120 }}>
                      Target Pass %
                      <div className="small font-normal">Conversion</div>
                    </th>
                    <th className="text-center" style={{ width: 120 }}>
                      Min Pass %
                      <div className="small font-normal">Red flag</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {STAGE_ORDER.map(stageKey => {
                    const stage = editedConfig.stages.find(s => s.stage === stageKey);
                    if (!stage) return null;

                    return (
                      <tr key={stageKey}>
                        <td className="font-medium">{STAGE_NAMES[stageKey]}</td>
                        <td>
                          <input
                            type="number"
                            className="w-full px-2 py-1 rounded border text-xs text-center"
                            value={stage.targetDays}
                            onChange={(e) => handleStageChange(stageKey, 'targetDays', parseInt(e.target.value) || 0)}
                            min={1}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="w-full px-2 py-1 rounded border text-xs text-center"
                            value={stage.maxDays}
                            onChange={(e) => handleStageChange(stageKey, 'maxDays', parseInt(e.target.value) || 0)}
                            min={1}
                          />
                        </td>
                        <td>
                          <div className="flex">
                            <input
                              type="number"
                              className="flex-1 px-2 py-1 rounded-l border text-xs text-center"
                              value={Math.round(stage.targetPassRate * 100)}
                              onChange={(e) => handleStageChange(stageKey, 'targetPassRate', (parseInt(e.target.value) || 0) / 100)}
                              min={0}
                              max={100}
                            />
                            <span className="px-2 py-1 rounded-r border border-l-0 bg-white/5 text-xs">%</span>
                          </div>
                        </td>
                        <td>
                          <div className="flex">
                            <input
                              type="number"
                              className="flex-1 px-2 py-1 rounded-l border text-xs text-center"
                              value={Math.round(stage.minPassRate * 100)}
                              onChange={(e) => handleStageChange(stageKey, 'minPassRate', (parseInt(e.target.value) || 0) / 100)}
                              min={0}
                              max={100}
                            />
                            <span className="px-2 py-1 rounded-r border border-l-0 bg-white/5 text-xs">%</span>
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
              <i className="bi bi-info-circle mr-1" style={{ color: '#94A3B8' }}></i>
              <strong style={{ color: '#F8FAFC' }}>How benchmarks work:</strong>
              <ul className="mb-0 mt-2" style={{ color: '#94A3B8' }}>
                <li><strong style={{ color: '#F8FAFC' }}>Target</strong>: Your ideal SLA - performance at or better than this is "On Track"</li>
                <li><strong style={{ color: '#F8FAFC' }}>Max/Min</strong>: Red flag thresholds - exceeding these marks performance as "Critical"</li>
                <li>Benchmarks can be filtered by function/level when viewing reports</li>
              </ul>
            </div>
          </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
          <div className="text-muted-foreground text-xs">
            {editedConfig.source === 'historical' && (
              <i className="bi bi-database mr-1"></i>
            )}
            {editedConfig.source === 'manual' && (
              <i className="bi bi-pencil mr-1"></i>
            )}
            {editedConfig.source === 'default' && (
              <i className="bi bi-gear mr-1"></i>
            )}
            Source: {editedConfig.source}
            {editedConfig.lastUpdated && (
              <> | Last updated: {new Date(editedConfig.lastUpdated).toLocaleDateString()}</>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="px-4 py-2 rounded border border-white/10 text-muted-foreground hover:bg-white/5"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded font-medium"
              style={{
                background: 'var(--primary)',
                color: '#1a1a1a',
              }}
              onClick={handleSave}
            >
              <i className="bi bi-check-lg mr-1"></i>
              Save Benchmarks
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BenchmarkConfigModal;
