/**
 * OverloadExplainDrawerV2
 *
 * Drawer showing detailed explanation of why a recruiter is overloaded.
 * V2 version using GlassDrawer and Tailwind tokens.
 * Uses the real RecruiterLoadRow and ReqWithWorkload types.
 */

import React from 'react';
import { GlassDrawer } from '../../common';
import { AlertTriangle, Clock, TrendingUp, Target, Zap, Gauge } from 'lucide-react';
import { RecruiterLoadRow, ReqWithWorkload, ConfidenceLevel } from '../../../types/capacityTypes';

interface OverloadExplainDrawerV2Props {
  isOpen: boolean;
  onClose: () => void;
  recruiterLoad: RecruiterLoadRow | null;
  reqWorkloads: ReqWithWorkload[];
  onRebalanceClick?: () => void;
  privacyMode?: 'normal' | 'anonymized';
}

export function OverloadExplainDrawerV2({
  isOpen,
  onClose,
  recruiterLoad,
  reqWorkloads,
  onRebalanceClick,
  privacyMode = 'normal',
}: OverloadExplainDrawerV2Props) {
  if (!isOpen || !recruiterLoad) return null;

  // Get reqs for this recruiter
  const recruiterReqs = reqWorkloads.filter(r => r.recruiterId === recruiterLoad.recruiterId);

  const displayName = privacyMode === 'anonymized' ? 'Recruiter A' : recruiterLoad.recruiterName;

  const formatUtilization = (util: number) => `${Math.round(util * 100)}%`;

  const getWorkloadColor = (score: number) => {
    if (score >= 8) return 'text-bad';
    if (score >= 5) return 'text-warn';
    return 'text-good';
  };

  const getConfidenceBadge = (level: ConfidenceLevel) => {
    const styles: Record<ConfidenceLevel, string> = {
      HIGH: 'bg-good/20 text-good',
      MED: 'bg-warn/20 text-warn',
      LOW: 'bg-muted text-muted-foreground',
      INSUFFICIENT: 'bg-bad/20 text-bad',
    };
    return (
      <span className={`text-xs px-1.5 py-0.5 rounded ${styles[level]}`}>
        {level}
      </span>
    );
  };

  const isOverloaded = recruiterLoad.status === 'overloaded' || recruiterLoad.status === 'critical';

  return (
    <GlassDrawer
      title="Workload Analysis"
      onClose={onClose}
      width="480px"
    >
      {/* Header */}
      <div className="mb-4">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
          Recruiter
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-lg text-foreground">
            {displayName}
          </span>
          {getConfidenceBadge(recruiterLoad.confidence)}
        </div>
      </div>

      {/* Alert Banner (if overloaded) */}
      {isOverloaded && (
        <div className="p-4 rounded-lg bg-bad/10 border border-bad/30 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-bad" />
            <span className="font-semibold text-bad">Capacity Exceeded</span>
          </div>
          <p className="text-sm text-foreground">
            Currently at <span className="font-mono font-bold text-bad">{formatUtilization(recruiterLoad.utilization)}</span> utilization
          </p>
        </div>
      )}

      {/* Capacity Summary */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="glass-panel p-3">
          <div className="flex items-center gap-2 mb-1">
            <Gauge className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Demand
            </span>
          </div>
          <div className="font-mono text-xl font-bold text-foreground">
            {recruiterLoad.demandWU}
            <span className="text-sm font-normal text-muted-foreground ml-1">WU</span>
          </div>
        </div>
        <div className="glass-panel p-3">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Capacity
            </span>
          </div>
          <div className="font-mono text-xl font-bold text-foreground">
            {recruiterLoad.capacityWU}
            <span className="text-sm font-normal text-muted-foreground ml-1">WU</span>
          </div>
        </div>
      </div>

      {/* Top Driver */}
      <div className="p-3 rounded-lg bg-muted/30 mb-4">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
          Primary Driver
        </div>
        <p className="text-sm text-foreground">
          {recruiterLoad.topDriver}
        </p>
      </div>

      {/* Workload Breakdown */}
      {recruiterReqs.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Workload Breakdown ({recruiterReqs.length} Reqs)
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {recruiterReqs
              .sort((a, b) => b.workloadScore - a.workloadScore)
              .slice(0, 10)
              .map((req) => (
                <div key={req.reqId} className="glass-panel p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate" title={req.reqTitle}>
                        {req.reqTitle}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {req.reqAgeDays}d open
                        </span>
                        {req.hasOfferOut && (
                          <span className="text-good">Offer out</span>
                        )}
                        {req.hasFinalist && !req.hasOfferOut && (
                          <span className="text-warn">Has finalist</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={`font-mono text-sm font-semibold ${getWorkloadColor(req.workloadScore)}`}>
                        {req.workloadScore.toFixed(1)}
                      </span>
                      <span className="text-xs text-muted-foreground">WU</span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Workload Components Legend */}
      {recruiterReqs.length > 0 && (
        <div className="text-xs text-muted-foreground mb-4">
          <strong>WU factors:</strong> Base difficulty × Remaining work × HM friction × Age multiplier
        </div>
      )}

      {/* Action */}
      {onRebalanceClick && isOverloaded && (
        <button
          type="button"
          onClick={onRebalanceClick}
          className="w-full px-4 py-3 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors min-h-[48px] flex items-center justify-center gap-2"
        >
          <TrendingUp className="w-4 h-4" />
          View Rebalance Suggestions
        </button>
      )}
    </GlassDrawer>
  );
}

export default OverloadExplainDrawerV2;
