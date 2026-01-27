// Overload Explain Drawer Component
// Shows detailed breakdown of why a recruiter is overloaded

import React from 'react';
import { OverloadExplanation, RecruiterLoadRow, ReqWithWorkload } from '../../types/capacityTypes';

interface OverloadExplainDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  recruiterLoad: RecruiterLoadRow | null;
  reqWorkloads: ReqWithWorkload[];
}

function WorkloadBreakdownRow({ req }: { req: ReqWithWorkload }) {
  return (
    <div className="border rounded p-2 mb-2" style={{ borderColor: 'rgba(255,255,255,0.1)', fontSize: '0.85rem' }}>
      <div className="flex justify-between mb-1">
        <span className="font-medium">{req.reqTitle}</span>
        <span className="badge-bespoke badge-primary-soft">
          {req.workloadScore.toFixed(1)} WU
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1 text-sm text-muted-foreground">
        <div>
          <i className="bi bi-bar-chart-steps mr-1"></i>
          Base: {req.components.baseDifficulty.toFixed(2)}
        </div>
        <div>
          <i className="bi bi-funnel mr-1"></i>
          Remaining: {(req.components.remainingWork * 100).toFixed(0)}%
        </div>
        <div>
          <i className="bi bi-person-badge mr-1"></i>
          HM Friction: {req.components.frictionMultiplier.toFixed(2)}x
        </div>
        <div>
          <i className="bi bi-clock-history mr-1"></i>
          Aging: {req.components.agingMultiplier.toFixed(2)}x ({req.reqAgeDays}d)
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

  return (
    <>
      {/* Backdrop */}
      <div
        className="glass-backdrop fixed top-0 left-0 w-full h-full"
        style={{ zIndex: 1040 }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="glass-drawer fixed top-0 right-0 h-full"
        style={{
          width: '450px',
          maxWidth: '90vw',
          zIndex: 1050,
          overflowY: 'auto'
        }}
      >
        <div className="glass-drawer-header p-3">
          <div className="flex justify-between items-start">
            <h5 className="mb-0">
              Why is {recruiterLoad.recruiterName} overloaded?
            </h5>
            <button
              className="text-sm text-muted-foreground p-0 hover:text-white transition-colors"
              onClick={onClose}
            >
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        </div>

        <div className="p-3">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div>
              <div className="text-center p-2 rounded" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div className="text-sm text-muted-foreground">Demand</div>
                <div className="font-bold" style={{ color: statusColor }}>
                  {recruiterLoad.demandWU} WU
                </div>
              </div>
            </div>
            <div>
              <div className="text-center p-2 rounded" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div className="text-sm text-muted-foreground">Capacity</div>
                <div className="font-bold">{recruiterLoad.capacityWU} WU</div>
              </div>
            </div>
            <div>
              <div className="text-center p-2 rounded" style={{ background: `${statusColor}15` }}>
                <div className="text-sm text-muted-foreground">Utilization</div>
                <div className="font-bold" style={{ color: statusColor }}>
                  {Math.round(recruiterLoad.utilization * 100)}%
                </div>
              </div>
            </div>
          </div>

          {/* Workload Breakdown */}
          <h6 className="mb-3">
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
          <h6 className="mt-4 mb-3">
            <i className="bi bi-calculator mr-2"></i>
            Capacity Calculation
          </h6>
          <div className="p-3 rounded-lg text-sm" style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#94a3b8'
          }}>
            <div>
              <strong>Sustainable Capacity:</strong> {recruiterLoad.capacityWU} WU
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
              <h6 className="mt-4 mb-3">
                <i className="bi bi-lightbulb mr-2"></i>
                Recommendations
              </h6>
              <ul className="text-sm text-muted-foreground">
                <li className="mb-1">
                  Consider redistributing high-WU reqs to available recruiters
                </li>
                {recruiterReqs.some(r => r.components.remainingWork > 0.8) && (
                  <li className="mb-1">
                    Prioritize sourcing for reqs with empty pipelines
                  </li>
                )}
                {recruiterReqs.some(r => r.components.frictionMultiplier > 1.1) && (
                  <li className="mb-1">
                    Escalate HM responsiveness on high-friction reqs
                  </li>
                )}
                {recruiterReqs.some(r => r.reqAgeDays > 90) && (
                  <li className="mb-1">
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
