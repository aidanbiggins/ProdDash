// Overload Explain Drawer Component
// Shows detailed breakdown of why a recruiter is overloaded

import React from 'react';
import { OverloadExplanation, RecruiterLoadRow, ReqWithWorkload } from '../../../types/capacityTypes';

interface OverloadExplainDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  recruiterLoad: RecruiterLoadRow | null;
  reqWorkloads: ReqWithWorkload[];
}

function WorkloadBreakdownRow({ req }: { req: ReqWithWorkload }) {
  return (
    <div className="border border-white/10 rounded-lg p-3 mb-2 text-sm">
      <div className="flex justify-between mb-2">
        <span className="font-medium text-foreground">{req.reqTitle}</span>
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-accent/15 text-accent">
          {req.workloadScore.toFixed(1)} WU
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div>
          <i className="bi bi-bar-chart-steps mr-1"></i>
          Base: <span className="font-mono">{req.components.baseDifficulty.toFixed(2)}</span>
        </div>
        <div>
          <i className="bi bi-funnel mr-1"></i>
          Remaining: <span className="font-mono">{(req.components.remainingWork * 100).toFixed(0)}%</span>
        </div>
        <div>
          <i className="bi bi-person-badge mr-1"></i>
          HM Friction: <span className="font-mono">{req.components.frictionMultiplier.toFixed(2)}x</span>
        </div>
        <div>
          <i className="bi bi-clock-history mr-1"></i>
          Aging: <span className="font-mono">{req.components.agingMultiplier.toFixed(2)}x ({req.reqAgeDays}d)</span>
        </div>
      </div>
    </div>
  );
}

export function OverloadExplainDrawer({
  isOpen,
  onClose,
  recruiterLoad,
  reqWorkloads
}: OverloadExplainDrawerProps) {
  if (!isOpen || !recruiterLoad) return null;

  // Get reqs for this recruiter, sorted by workload
  const recruiterReqs = reqWorkloads
    .filter(r => r.recruiterId === recruiterLoad.recruiterId)
    .sort((a, b) => b.workloadScore - a.workloadScore);

  const statusColor = recruiterLoad.utilization > 1.2 ? '#f87171' :
                      recruiterLoad.utilization > 1.1 ? '#fbbf24' :
                      recruiterLoad.utilization > 0.9 ? '#60a5fa' : '#34d399';

  const utilizationClass = recruiterLoad.utilization > 1.2 ? 'text-bad' :
                          recruiterLoad.utilization > 1.1 ? 'text-warn' :
                          recruiterLoad.utilization > 0.9 ? 'text-accent' : 'text-good';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1040]"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 h-full w-[450px] max-w-[90vw] z-[1050] overflow-y-auto bg-bg-surface border-l border-glass-border"
      >
        <div className="sticky top-0 bg-bg-surface/95 backdrop-blur-sm border-b border-white/10 px-4 py-3">
          <div className="flex justify-between items-start">
            <h5 className="text-base font-semibold text-foreground">
              Why is {recruiterLoad.recruiterName} overloaded?
            </h5>
            <button
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              onClick={onClose}
            >
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        </div>

        <div className="p-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="text-center p-3 rounded-lg bg-white/5">
              <div className="text-xs text-muted-foreground">Demand</div>
              <div className={`font-mono font-bold ${utilizationClass}`}>
                {recruiterLoad.demandWU} WU
              </div>
            </div>
            <div className="text-center p-3 rounded-lg bg-white/5">
              <div className="text-xs text-muted-foreground">Capacity</div>
              <div className="font-mono font-bold text-foreground">{recruiterLoad.capacityWU} WU</div>
            </div>
            <div className={`text-center p-3 rounded-lg ${recruiterLoad.utilization > 1.1 ? 'bg-bad-bg' : 'bg-good-bg'}`}>
              <div className="text-xs text-muted-foreground">Utilization</div>
              <div className={`font-mono font-bold ${utilizationClass}`}>
                {Math.round(recruiterLoad.utilization * 100)}%
              </div>
            </div>
          </div>

          {/* Workload Breakdown */}
          <h6 className="text-sm font-semibold text-foreground mb-3">
            <i className="bi bi-list-ul mr-2"></i>
            Workload Breakdown ({recruiterReqs.length} reqs)
          </h6>

          {recruiterReqs.slice(0, 10).map(req => (
            <WorkloadBreakdownRow key={req.reqId} req={req} />
          ))}

          {recruiterReqs.length > 10 && (
            <div className="text-muted-foreground text-sm text-center mt-2">
              + {recruiterReqs.length - 10} more reqs
            </div>
          )}

          {/* Capacity Derivation */}
          <h6 className="text-sm font-semibold text-foreground mt-6 mb-3">
            <i className="bi bi-calculator mr-2"></i>
            Capacity Calculation
          </h6>
          <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-sm">
            <div className="text-foreground">
              <strong>Sustainable Capacity:</strong> <span className="font-mono">{recruiterLoad.capacityWU} WU</span>
            </div>
            <div className="mt-1 text-muted-foreground">
              {recruiterLoad.confidence === 'HIGH'
                ? 'Based on historical stable weeks (HIGH confidence)'
                : recruiterLoad.confidence === 'MED'
                ? 'Based on limited historical data (MED confidence)'
                : 'Using team median as fallback (LOW confidence)'}
            </div>
          </div>

          {/* Recommendations */}
          {recruiterLoad.utilization > 1.1 && (
            <>
              <h6 className="text-sm font-semibold text-foreground mt-6 mb-3">
                <i className="bi bi-lightbulb mr-2"></i>
                Recommendations
              </h6>
              <ul className="text-sm text-muted-foreground space-y-1.5 list-none">
                <li className="flex items-start gap-2">
                  <span className="text-accent">•</span>
                  Consider redistributing high-WU reqs to available recruiters
                </li>
                {recruiterReqs.some(r => r.components.remainingWork > 0.8) && (
                  <li className="flex items-start gap-2">
                    <span className="text-accent">•</span>
                    Prioritize sourcing for reqs with empty pipelines
                  </li>
                )}
                {recruiterReqs.some(r => r.components.frictionMultiplier > 1.1) && (
                  <li className="flex items-start gap-2">
                    <span className="text-accent">•</span>
                    Escalate HM responsiveness on high-friction reqs
                  </li>
                )}
                {recruiterReqs.some(r => r.reqAgeDays > 90) && (
                  <li className="flex items-start gap-2">
                    <span className="text-accent">•</span>
                    Review aging reqs (90+ days) for closure or re-prioritization
                  </li>
                )}
              </ul>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default OverloadExplainDrawer;
