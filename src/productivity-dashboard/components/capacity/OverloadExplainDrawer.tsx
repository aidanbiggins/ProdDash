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
      <div className="d-flex justify-content-between mb-1">
        <span className="fw-medium">{req.reqTitle}</span>
        <span className="badge-bespoke badge-primary-soft">
          {req.workloadScore.toFixed(1)} WU
        </span>
      </div>
      <div className="row g-1 small text-muted">
        <div className="col-6">
          <i className="bi bi-bar-chart-steps me-1"></i>
          Base: {req.components.baseDifficulty.toFixed(2)}
        </div>
        <div className="col-6">
          <i className="bi bi-funnel me-1"></i>
          Remaining: {(req.components.remainingWork * 100).toFixed(0)}%
        </div>
        <div className="col-6">
          <i className="bi bi-person-badge me-1"></i>
          HM Friction: {req.components.frictionMultiplier.toFixed(2)}x
        </div>
        <div className="col-6">
          <i className="bi bi-clock-history me-1"></i>
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
        className="glass-backdrop position-fixed top-0 start-0 w-100 h-100"
        style={{ zIndex: 1040 }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="glass-drawer position-fixed top-0 end-0 h-100"
        style={{
          width: '450px',
          maxWidth: '90vw',
          zIndex: 1050,
          overflowY: 'auto'
        }}
      >
        <div className="glass-drawer-header p-3">
          <div className="d-flex justify-content-between align-items-start">
            <h5 className="mb-0">
              Why is {recruiterLoad.recruiterName} overloaded?
            </h5>
            <button
              className="btn btn-sm btn-link text-muted p-0"
              onClick={onClose}
            >
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        </div>

        <div className="p-3">
          {/* Summary Stats */}
          <div className="row g-2 mb-4">
            <div className="col-4">
              <div className="text-center p-2 rounded" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div className="small text-muted">Demand</div>
                <div className="fw-bold" style={{ color: statusColor }}>
                  {recruiterLoad.demandWU} WU
                </div>
              </div>
            </div>
            <div className="col-4">
              <div className="text-center p-2 rounded" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div className="small text-muted">Capacity</div>
                <div className="fw-bold">{recruiterLoad.capacityWU} WU</div>
              </div>
            </div>
            <div className="col-4">
              <div className="text-center p-2 rounded" style={{ background: `${statusColor}15` }}>
                <div className="small text-muted">Utilization</div>
                <div className="fw-bold" style={{ color: statusColor }}>
                  {Math.round(recruiterLoad.utilization * 100)}%
                </div>
              </div>
            </div>
          </div>

          {/* Workload Breakdown */}
          <h6 className="mb-3">
            <i className="bi bi-list-ul me-2"></i>
            Workload Breakdown ({recruiterReqs.length} reqs)
          </h6>

          {recruiterReqs.slice(0, 10).map(req => (
            <WorkloadBreakdownRow key={req.reqId} req={req} />
          ))}

          {recruiterReqs.length > 10 && (
            <div className="text-muted small text-center mt-2">
              + {recruiterReqs.length - 10} more reqs
            </div>
          )}

          {/* Capacity Derivation */}
          <h6 className="mt-4 mb-3">
            <i className="bi bi-calculator me-2"></i>
            Capacity Calculation
          </h6>
          <div className="alert alert-light small" style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#94a3b8'
          }}>
            <div>
              <strong>Sustainable Capacity:</strong> {recruiterLoad.capacityWU} WU
            </div>
            <div className="mt-1 text-muted">
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
                <i className="bi bi-lightbulb me-2"></i>
                Recommendations
              </h6>
              <ul className="small text-muted">
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
