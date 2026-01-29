// Pipeline Benchmark Configuration Modal (V2)
// Allows users to edit target benchmarks and load historical defaults

import React, { useState, useEffect } from 'react';
import { X, RotateCcw, Database, Check, Info } from 'lucide-react';
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col glass-panel overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-border">
          <div>
            <h5 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <i className="bi bi-sliders"></i>
              Configure Pipeline Benchmarks
            </h5>
            <span className="text-xs text-muted-foreground">
              Set your target SLAs for each stage of the hiring process
            </span>
          </div>
          <button
            type="button"
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              className="px-3 py-1.5 text-xs rounded border border-border text-muted-foreground hover:bg-muted/50 transition-colors flex items-center gap-1.5"
              onClick={handleLoadDefaults}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset to Defaults
            </button>
            <button
              className="px-3 py-1.5 text-xs rounded font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-50"
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
                  <span className="w-3.5 h-3.5 border-2 border-current border-r-transparent rounded-full animate-spin"></span>
                  Calculating...
                </>
              ) : (
                <>
                  <Database className="w-3.5 h-3.5" />
                  Load from Historical Data
                </>
              )}
            </button>
          </div>

          {/* Historical Preview */}
          {showHistoricalPreview && historicalBenchmarks && (
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                <div>
                  <div className="font-medium text-foreground flex items-center gap-1.5">
                    <i className="bi bi-graph-up"></i>
                    Historical Benchmarks Available
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Based on {historicalBenchmarks.sampleSize} closed requisitions
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ml-2 ${
                      historicalBenchmarks.confidence === 'high' ? 'bg-good/20 text-good' :
                      historicalBenchmarks.confidence === 'medium' ? 'bg-warn/20 text-warn' : 'bg-bad/20 text-bad'
                    }`}>
                      {historicalBenchmarks.confidence} confidence
                    </span>
                  </div>
                  {historicalBenchmarks.notes.map((note, i) => (
                    <div key={i} className="text-xs text-muted-foreground mt-1">{note}</div>
                  ))}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    className="px-3 py-1.5 text-xs rounded bg-good/20 text-good hover:bg-good/30 transition-colors"
                    onClick={handleApplyHistorical}
                  >
                    Apply
                  </button>
                  <button
                    className="px-3 py-1.5 text-xs rounded border border-border text-muted-foreground hover:bg-muted/50 transition-colors"
                    onClick={() => setShowHistoricalPreview(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Total TTF Target */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Target Total Time-to-Fill
            </label>
            <div className="flex max-w-[200px]">
              <input
                type="number"
                className="flex-1 px-3 py-2 rounded-l border border-border bg-muted/30 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                value={editedConfig.targetTotalTTF}
                onChange={(e) => handleTotalTTFChange(parseInt(e.target.value) || 0)}
                min={1}
              />
              <span className="px-3 py-2 rounded-r border border-l-0 border-border bg-muted/50 text-xs text-muted-foreground flex items-center">days</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Sum of stage targets: {calculateTotalTargetDays()} days
            </div>
          </div>

          {/* Stage Configuration - Desktop Table */}
          <div className="hidden md:block">
            <div className="glass-panel overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Stage</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-28">
                      <div>Target Days</div>
                      <div className="font-normal normal-case tracking-normal">SLA target</div>
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-28">
                      <div>Max Days</div>
                      <div className="font-normal normal-case tracking-normal">Red flag</div>
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-28">
                      <div>Target Pass %</div>
                      <div className="font-normal normal-case tracking-normal">Conversion</div>
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-28">
                      <div>Min Pass %</div>
                      <div className="font-normal normal-case tracking-normal">Red flag</div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {STAGE_ORDER.map(stageKey => {
                    const stage = editedConfig.stages.find(s => s.stage === stageKey);
                    if (!stage) return null;

                    return (
                      <tr key={stageKey} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{STAGE_NAMES[stageKey]}</td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            className="w-full px-2 py-1.5 rounded border border-border bg-muted/30 text-foreground text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary"
                            value={stage.targetDays}
                            onChange={(e) => handleStageChange(stageKey, 'targetDays', parseInt(e.target.value) || 0)}
                            min={1}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            className="w-full px-2 py-1.5 rounded border border-border bg-muted/30 text-foreground text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary"
                            value={stage.maxDays}
                            onChange={(e) => handleStageChange(stageKey, 'maxDays', parseInt(e.target.value) || 0)}
                            min={1}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex">
                            <input
                              type="number"
                              className="flex-1 min-w-0 px-2 py-1.5 rounded-l border border-border bg-muted/30 text-foreground text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary"
                              value={Math.round(stage.targetPassRate * 100)}
                              onChange={(e) => handleStageChange(stageKey, 'targetPassRate', (parseInt(e.target.value) || 0) / 100)}
                              min={0}
                              max={100}
                            />
                            <span className="px-2 py-1.5 rounded-r border border-l-0 border-border bg-muted/50 text-xs text-muted-foreground flex items-center">%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex">
                            <input
                              type="number"
                              className="flex-1 min-w-0 px-2 py-1.5 rounded-l border border-border bg-muted/30 text-foreground text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary"
                              value={Math.round(stage.minPassRate * 100)}
                              onChange={(e) => handleStageChange(stageKey, 'minPassRate', (parseInt(e.target.value) || 0) / 100)}
                              min={0}
                              max={100}
                            />
                            <span className="px-2 py-1.5 rounded-r border border-l-0 border-border bg-muted/50 text-xs text-muted-foreground flex items-center">%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Stage Configuration - Mobile Cards */}
          <div className="md:hidden space-y-3">
            {STAGE_ORDER.map(stageKey => {
              const stage = editedConfig.stages.find(s => s.stage === stageKey);
              if (!stage) return null;

              return (
                <div key={stageKey} className="glass-panel p-4">
                  <div className="font-medium text-foreground mb-3">{STAGE_NAMES[stageKey]}</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[0.65rem] text-muted-foreground uppercase tracking-wider mb-1">Target Days</label>
                      <input
                        type="number"
                        className="w-full px-2 py-1.5 rounded border border-border bg-muted/30 text-foreground text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary"
                        value={stage.targetDays}
                        onChange={(e) => handleStageChange(stageKey, 'targetDays', parseInt(e.target.value) || 0)}
                        min={1}
                      />
                    </div>
                    <div>
                      <label className="block text-[0.65rem] text-muted-foreground uppercase tracking-wider mb-1">Max Days</label>
                      <input
                        type="number"
                        className="w-full px-2 py-1.5 rounded border border-border bg-muted/30 text-foreground text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary"
                        value={stage.maxDays}
                        onChange={(e) => handleStageChange(stageKey, 'maxDays', parseInt(e.target.value) || 0)}
                        min={1}
                      />
                    </div>
                    <div>
                      <label className="block text-[0.65rem] text-muted-foreground uppercase tracking-wider mb-1">Target Pass %</label>
                      <div className="flex">
                        <input
                          type="number"
                          className="flex-1 min-w-0 px-2 py-1.5 rounded-l border border-border bg-muted/30 text-foreground text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary"
                          value={Math.round(stage.targetPassRate * 100)}
                          onChange={(e) => handleStageChange(stageKey, 'targetPassRate', (parseInt(e.target.value) || 0) / 100)}
                          min={0}
                          max={100}
                        />
                        <span className="px-2 py-1.5 rounded-r border border-l-0 border-border bg-muted/50 text-sm text-muted-foreground flex items-center">%</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[0.65rem] text-muted-foreground uppercase tracking-wider mb-1">Min Pass %</label>
                      <div className="flex">
                        <input
                          type="number"
                          className="flex-1 min-w-0 px-2 py-1.5 rounded-l border border-border bg-muted/30 text-foreground text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary"
                          value={Math.round(stage.minPassRate * 100)}
                          onChange={(e) => handleStageChange(stageKey, 'minPassRate', (parseInt(e.target.value) || 0) / 100)}
                          min={0}
                          max={100}
                        />
                        <span className="px-2 py-1.5 rounded-r border border-l-0 border-border bg-muted/50 text-sm text-muted-foreground flex items-center">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Info Box */}
          <div className="p-4 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium text-foreground text-sm">How benchmarks work:</div>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <li><span className="text-foreground font-medium">Target</span>: Your ideal SLA - performance at or better than this is "On Track"</li>
                  <li><span className="text-foreground font-medium">Max/Min</span>: Red flag thresholds - exceeding these marks performance as "Critical"</li>
                  <li>Benchmarks can be filtered by function/level when viewing reports</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-t border-border bg-muted/20">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            {editedConfig.source === 'historical' && <Database className="w-3.5 h-3.5" />}
            {editedConfig.source === 'manual' && <i className="bi bi-pencil"></i>}
            {editedConfig.source === 'default' && <i className="bi bi-gear"></i>}
            Source: {editedConfig.source}
            {editedConfig.lastUpdated && (
              <> | Last updated: {new Date(editedConfig.lastUpdated).toLocaleDateString()}</>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              className="px-4 py-2 rounded border border-border text-muted-foreground hover:bg-muted/50 transition-colors text-sm"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm flex items-center gap-1.5"
              onClick={handleSave}
            >
              <Check className="w-4 h-4" />
              Save Benchmarks
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BenchmarkConfigModal;
