/**
 * CalibrationCardV2
 *
 * Model trust score display with calibration report.
 * V2 version using glass-panel and Tailwind tokens.
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { CalibrationReport } from '../../../services/calibrationService';
import { StatLabel, StatValue, LogoSpinner } from '../../common';

interface CalibrationCardV2Props {
  report: CalibrationReport | null;
  isLoading?: boolean;
  className?: string;
  onRunCalibration?: () => void;
}

export function CalibrationCardV2({
  report,
  isLoading,
  className,
  onRunCalibration,
}: CalibrationCardV2Props) {
  if (isLoading) {
    return (
      <div className={`glass-panel p-3 ${className || ''}`}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <LogoSpinner size={24} message="Running backtest..." />
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className={`glass-panel p-3 ${className || ''}`}>
        <div className="flex justify-between items-center">
          <StatLabel>Model Accuracy</StatLabel>
          {onRunCalibration && (
            <button
              type="button"
              className="px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:bg-muted transition-colors min-h-[32px]"
              onClick={onRunCalibration}
            >
              Verify Model
            </button>
          )}
        </div>
        <div className="text-muted-foreground/70 text-xs mt-2">
          Run a backtest on recent hires to verify Oracle's accuracy.
        </div>
      </div>
    );
  }

  // Determine colors based on accuracy
  const isAccurate = report.accuracy >= 0.7;
  const biasOk = Math.abs(report.bias) <= 3;

  return (
    <div className={`glass-panel p-3 ${className || ''}`}>
      <div className="flex justify-between items-center mb-3">
        <StatLabel>Model Trust Score</StatLabel>
        <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground text-[0.6rem] px-2 py-0.5">
          {report.period}
        </span>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <StatValue size="lg" color={isAccurate ? 'success' : 'warning'}>
          {(report.accuracy * 100).toFixed(0)}%
        </StatValue>
        <div className="w-px h-8 bg-border" />
        <div className="text-xs text-muted-foreground leading-tight">
          of recent forecasts
          <br />
          were accurate
        </div>
      </div>

      <div className="p-3 rounded-md bg-muted/50 text-xs">
        <div className="flex justify-between mb-2">
          <span className="text-muted-foreground/70">Bias Trend:</span>
          <span className={`font-mono font-semibold ${biasOk ? 'text-good' : 'text-warn'}`}>
            {report.bias > 0 ? '+' : ''}
            {report.bias.toFixed(1)} days
            <span className="text-muted-foreground/70 font-normal ml-1">
              ({report.bias > 0 ? 'Pessimistic' : report.bias < 0 ? 'Optimistic' : 'Neutral'})
            </span>
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground/70">Sample Size:</span>
          <span className="font-mono font-semibold text-foreground">{report.sampleSize} hires</span>
        </div>
      </div>

      {!isAccurate && (
        <div className="mt-3 p-2 rounded-md bg-warn/10 border-l-[3px] border-warn text-xs text-warn flex items-start gap-1">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>Model is currently under-performing. Adjusting constraints recommended.</span>
        </div>
      )}
    </div>
  );
}

export default CalibrationCardV2;
