// Quality Guardrails Tab Component

import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie
} from 'recharts';
import { QualityMetrics } from '../../types';

interface QualityTabProps {
  quality: QualityMetrics;
}

export function QualityTab({ quality }: QualityTabProps) {
  // Prepare offer acceptance by recruiter data (top/bottom 5)
  const recruiterAcceptance = quality.offerAcceptanceByRecruiter
    .filter(r => r.offerCount >= 2)  // Only show recruiters with 2+ offers
    .sort((a, b) => (b.acceptanceRate || 0) - (a.acceptanceRate || 0));

  const topRecruiters = recruiterAcceptance.slice(0, 5);
  const bottomRecruiters = recruiterAcceptance.slice(-5).reverse();

  // Prepare offer acceptance by function data
  const functionData = quality.offerAcceptanceByFunction
    .filter(f => f.offerCount >= 1)
    .map(f => ({
      name: f.function,
      rate: f.acceptanceRate !== null ? f.acceptanceRate * 100 : 0,
      offers: f.offerCount
    }));

  // Late stage fallout data
  const falloutData = [
    {
      name: 'Onsite → Reject',
      count: quality.lateStageFallout.onsiteToReject.count,
      rate: quality.lateStageFallout.onsiteToReject.rate !== null
        ? quality.lateStageFallout.onsiteToReject.rate * 100
        : 0
    },
    {
      name: 'Offer → Decline',
      count: quality.lateStageFallout.offerToDecline.count,
      rate: quality.lateStageFallout.offerToDecline.rate !== null
        ? quality.lateStageFallout.offerToDecline.rate * 100
        : 0
    },
    {
      name: 'Offer → Withdraw',
      count: quality.lateStageFallout.offerToWithdraw.count,
      rate: quality.lateStageFallout.offerToWithdraw.rate !== null
        ? quality.lateStageFallout.offerToWithdraw.rate * 100
        : 0
    }
  ];

  return (
    <div>
      {/* Candidate Experience Stats */}
      <div className="row g-4 mb-4">
        <div className="col-md-6">
          <div className="card-bespoke h-100">
            <div className="card-body text-center py-4">
              <div className="stat-label mb-2">Application to First Touch</div>
              <div className="stat-value" style={{ color: 'var(--color-accent)' }}>
                {quality.candidateExperience.applicationToFirstTouchMedian !== null
                  ? `${Math.round(quality.candidateExperience.applicationToFirstTouchMedian)} hrs`
                  : 'N/A'}
              </div>
              <small className="text-muted">Median time for candidates to hear back</small>
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card-bespoke h-100">
            <div className="card-body text-center py-4">
              <div className="stat-label mb-2">Time Between Steps</div>
              <div className="stat-value" style={{ color: 'var(--color-accent)' }}>
                {quality.candidateExperience.timeBetweenStepsMedian !== null
                  ? `${Math.round(quality.candidateExperience.timeBetweenStepsMedian)} hrs`
                  : 'N/A'}
              </div>
              <small className="text-muted">Median wait between stage changes</small>
            </div>
          </div>
        </div>
      </div>

      {/* Late Stage Fallout */}
      <div className="card-bespoke mb-4">
        <div className="card-header">
          <h6>Late-Stage Fallout Rates</h6>
        </div>
        <div className="card-body">
          <div className="row">
            <div className="col-md-8">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={falloutData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" fontSize={12} stroke="#64748b" />
                  <YAxis unit="%" fontSize={12} stroke="#64748b" />
                  <Tooltip
                    formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Fallout Rate']}
                  />
                  <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                    {falloutData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.rate > 30 ? '#dc2626' : entry.rate > 15 ? '#d97706' : '#059669'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="col-md-4">
              <div className="small" style={{ color: 'var(--color-slate-600)' }}>
                <p className="fw-semibold mb-2">What these metrics show:</p>
                <ul className="ps-3 mb-3">
                  <li className="mb-1"><strong>Onsite → Reject:</strong> Candidates rejected after onsite</li>
                  <li className="mb-1"><strong>Offer → Decline:</strong> Offers declined by candidates</li>
                  <li><strong>Offer → Withdraw:</strong> Candidates withdrew after offer</li>
                </ul>
                <p className="mb-0 small text-muted">High rates may indicate calibration issues or poor candidate experience.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Offer Acceptance by Function */}
      <div className="card-bespoke mb-4">
        <div className="card-header">
          <h6>Offer Acceptance Rate by Function</h6>
        </div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={functionData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" domain={[0, 100]} unit="%" fontSize={12} stroke="#64748b" />
              <YAxis type="category" dataKey="name" width={100} fontSize={12} stroke="#64748b" />
              <Tooltip
                formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Accept Rate']}
              />
              <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                {functionData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.rate >= 80 ? '#059669' : entry.rate >= 60 ? '#d97706' : '#dc2626'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Offer Acceptance by Recruiter */}
      <div className="row g-4 mb-4">
        <div className="col-md-6">
          <div className="card-bespoke h-100">
            <div className="card-header border-bottom">
              <h6 className="mb-0">Top 5 Recruiters <span className="text-muted fw-normal">(Offer Acceptance)</span></h6>
            </div>
            <div className="card-body p-0">
              <table className="table table-bespoke table-hover mb-0">
                <thead>
                  <tr>
                    <th>Recruiter</th>
                    <th className="text-end">Offers</th>
                    <th className="text-end">Accept Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {topRecruiters.map(r => (
                    <tr key={r.recruiterId}>
                      <td className="fw-medium">{r.recruiterName}</td>
                      <td className="text-end">{r.offerCount}</td>
                      <td className="text-end">
                        <span className="badge-bespoke badge-success-soft">
                          {r.acceptanceRate !== null
                            ? `${(r.acceptanceRate * 100).toFixed(0)}%`
                            : '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card-bespoke h-100">
            <div className="card-header border-bottom">
              <h6 className="mb-0">Bottom 5 Recruiters <span className="text-muted fw-normal">(Offer Acceptance)</span></h6>
            </div>
            <div className="card-body p-0">
              <table className="table table-bespoke table-hover mb-0">
                <thead>
                  <tr>
                    <th>Recruiter</th>
                    <th className="text-end">Offers</th>
                    <th className="text-end">Accept Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {bottomRecruiters.map(r => (
                    <tr key={r.recruiterId}>
                      <td className="fw-medium">{r.recruiterName}</td>
                      <td className="text-end">{r.offerCount}</td>
                      <td className="text-end">
                        <span className={`badge-bespoke ${r.acceptanceRate !== null && r.acceptanceRate >= 0.6 ? 'badge-warning-soft' : 'badge-danger-soft'
                          }`}>
                          {r.acceptanceRate !== null
                            ? `${(r.acceptanceRate * 100).toFixed(0)}%`
                            : '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Interpretation Guide */}
      <div className="card">
        <div className="card-header">
          <h6 className="mb-0">Quality Guardrails: What to Watch For</h6>
        </div>
        <div className="card-body">
          <div className="row">
            <div className="col-md-4">
              <h6 className="text-danger">Red Flags</h6>
              <ul className="small ps-3">
                <li>Offer acceptance rate below 60%</li>
                <li>High onsite-to-reject rate (&gt;40%)</li>
                <li>Application to first touch &gt;72 hours</li>
                <li>Significant variance between recruiters</li>
              </ul>
            </div>
            <div className="col-md-4">
              <h6 className="text-warning">Areas to Monitor</h6>
              <ul className="small ps-3">
                <li>Offer acceptance between 60-80%</li>
                <li>Functions with lower acceptance rates</li>
                <li>Candidate withdrawals at offer stage</li>
                <li>Long waits between interview stages</li>
              </ul>
            </div>
            <div className="col-md-4">
              <h6 className="text-success">Good Health Indicators</h6>
              <ul className="small ps-3">
                <li>Offer acceptance rate above 80%</li>
                <li>Consistent performance across recruiters</li>
                <li>Fast response times to candidates</li>
                <li>Low late-stage fallout</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
