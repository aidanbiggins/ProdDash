// Quality Guardrails Tab Component

import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie
} from 'recharts';
import { QualityMetrics } from '../../../types';
import { StatLabel, StatValue } from '../../common';
import { SubViewHeader } from '../../v2/SubViewHeader';
import { QUALITY_PAGE_HELP } from './qualityHelpContent';

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
      {/* Page Header */}
      <SubViewHeader
        title="Quality Guardrails"
        subtitle="Monitor candidate quality metrics and offer outcomes"
        helpContent={QUALITY_PAGE_HELP}
      />

      {/* Candidate Experience Stats */}
      <div className="grid grid-cols-12 gap-4 mb-4">
        <div className="col-span-12 md:col-span-6">
          <div className="card-bespoke h-full">
            <div className="card-body text-center py-4">
              <StatLabel className="mb-2">Application to First Touch</StatLabel>
              <StatValue color="primary">
                {quality.candidateExperience.applicationToFirstTouchMedian !== null
                  ? `${Math.round(quality.candidateExperience.applicationToFirstTouchMedian)} hrs`
                  : 'N/A'}
              </StatValue>
              <span className="text-sm text-muted-foreground">Median time for candidates to hear back</span>
            </div>
          </div>
        </div>
        <div className="col-span-12 md:col-span-6">
          <div className="card-bespoke h-full">
            <div className="card-body text-center py-4">
              <StatLabel className="mb-2">Time Between Steps</StatLabel>
              <StatValue color="primary">
                {quality.candidateExperience.timeBetweenStepsMedian !== null
                  ? `${Math.round(quality.candidateExperience.timeBetweenStepsMedian)} hrs`
                  : 'N/A'}
              </StatValue>
              <span className="text-sm text-muted-foreground">Median wait between stage changes</span>
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
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 md:col-span-8">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={falloutData} barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" />
                  <XAxis dataKey="name" fontSize={12} stroke="#94A3B8" tickLine={false} axisLine={{ stroke: '#3f3f46' }} tick={{ fontFamily: "'JetBrains Mono', monospace" }} />
                  <YAxis unit="%" fontSize={12} stroke="#94A3B8" tickLine={false} axisLine={false} tick={{ fontFamily: "'JetBrains Mono', monospace" }} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    contentStyle={{
                      background: '#0a0a0a',
                      border: '1px solid #3f3f46',
                      padding: '8px 12px',
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '12px'
                    }}
                    labelStyle={{ color: '#94A3B8', marginBottom: '4px' }}
                    itemStyle={{ color: '#94A3B8' }}
                    formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Fallout Rate']}
                  />
                  <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                    {falloutData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.rate > 30 ? '#F43F5E' : entry.rate > 15 ? '#F59E0B' : '#10B981'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="col-span-12 md:col-span-4">
              <div className="text-sm text-muted-foreground">
                <p className="font-semibold mb-2">What these metrics show:</p>
                <ul className="pl-3 mb-3">
                  <li className="mb-1"><strong>Onsite → Reject:</strong> Candidates rejected after onsite</li>
                  <li className="mb-1"><strong>Offer → Decline:</strong> Offers declined by candidates</li>
                  <li><strong>Offer → Withdraw:</strong> Candidates withdrew after offer</li>
                </ul>
                <p className="mb-0 text-sm text-muted-foreground">High rates may indicate calibration issues or poor candidate experience.</p>
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
            <BarChart data={functionData} layout="vertical" barSize={20}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#3f3f46" />
              <XAxis type="number" domain={[0, 100]} unit="%" fontSize={12} stroke="#94A3B8" tickLine={false} axisLine={{ stroke: '#3f3f46' }} tick={{ fontFamily: "'JetBrains Mono', monospace" }} />
              <YAxis type="category" dataKey="name" width={100} fontSize={12} stroke="#94A3B8" tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                contentStyle={{
                  background: '#0a0a0a',
                  border: '1px solid #3f3f46',
                  padding: '8px 12px',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '12px'
                }}
                labelStyle={{ color: '#94A3B8', marginBottom: '4px' }}
                itemStyle={{ color: '#94A3B8' }}
                formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Accept Rate']}
              />
              <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                {functionData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.rate >= 80 ? '#10B981' : entry.rate >= 60 ? '#F59E0B' : '#F43F5E'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Offer Acceptance by Recruiter */}
      <div className="grid grid-cols-12 gap-4 mb-4">
        <div className="col-span-12 md:col-span-6">
          <div className="card-bespoke h-full">
            <div className="card-header border-b border-border">
              <h6 className="mb-0">Top 5 Recruiters <span className="text-muted-foreground font-normal">(Offer Acceptance)</span></h6>
            </div>
            <div className="card-body p-0">
              <table className="table table-bespoke mb-0">
                <thead>
                  <tr>
                    <th>Recruiter</th>
                    <th className="text-right">Offers</th>
                    <th className="text-right">Accept Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {topRecruiters.map(r => (
                    <tr key={r.recruiterId}>
                      <td className="font-medium">{r.recruiterName}</td>
                      <td className="text-right">{r.offerCount}</td>
                      <td className="text-right">
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
        <div className="col-span-12 md:col-span-6">
          <div className="card-bespoke h-full">
            <div className="card-header border-b border-border">
              <h6 className="mb-0">Bottom 5 Recruiters <span className="text-muted-foreground font-normal">(Offer Acceptance)</span></h6>
            </div>
            <div className="card-body p-0">
              <table className="table table-bespoke mb-0">
                <thead>
                  <tr>
                    <th>Recruiter</th>
                    <th className="text-right">Offers</th>
                    <th className="text-right">Accept Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {bottomRecruiters.map(r => (
                    <tr key={r.recruiterId}>
                      <td className="font-medium">{r.recruiterName}</td>
                      <td className="text-right">{r.offerCount}</td>
                      <td className="text-right">
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
      <div className="card-bespoke">
        <div className="card-header">
          <h6 className="mb-0" style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94A3B8' }}>Quality Guardrails: What to Watch For</h6>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-12 md:col-span-4">
              <div className="p-3 h-full" style={{ background: '#141414', borderRadius: '2px', borderTop: '2px solid #EF4444' }}>
                <h6 className="text-sm font-semibold mb-2" style={{ color: '#f5f5f5' }}>Red Flags</h6>
                <ul className="text-xs text-muted-foreground pl-4 mb-0" style={{ lineHeight: 1.6 }}>
                  <li>Offer acceptance rate below 60%</li>
                  <li>High onsite-to-reject rate (&gt;40%)</li>
                  <li>Application to first touch &gt;72 hours</li>
                  <li>Significant variance between recruiters</li>
                </ul>
              </div>
            </div>
            <div className="col-span-12 md:col-span-4">
              <div className="p-3 h-full" style={{ background: '#141414', borderRadius: '2px', borderTop: '2px solid #F59E0B' }}>
                <h6 className="text-sm font-semibold mb-2" style={{ color: '#f5f5f5' }}>Areas to Monitor</h6>
                <ul className="text-xs text-muted-foreground pl-4 mb-0" style={{ lineHeight: 1.6 }}>
                  <li>Offer acceptance between 60-80%</li>
                  <li>Functions with lower acceptance rates</li>
                  <li>Candidate withdrawals at offer stage</li>
                  <li>Long waits between interview stages</li>
                </ul>
              </div>
            </div>
            <div className="col-span-12 md:col-span-4">
              <div className="p-3 h-full" style={{ background: '#141414', borderRadius: '2px', borderTop: '2px solid #10B981' }}>
                <h6 className="text-sm font-semibold mb-2" style={{ color: '#f5f5f5' }}>Good Health Indicators</h6>
                <ul className="text-xs text-muted-foreground pl-4 mb-0" style={{ lineHeight: 1.6 }}>
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
    </div>
  );
}

export default QualityTab;
