'use client';

// QualityTabV2 - V0 Design Language
// Quality Guardrails: Monitor candidate quality metrics and offer outcomes

import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { QualityMetrics } from '../../types';
import { StatLabel, StatValue } from '../common';
import { SubViewHeader } from './SubViewHeader';
import { QUALITY_PAGE_HELP } from '../_legacy/quality/qualityHelpContent';

// V0 Design: Badge Component
function BadgeV2({
  children,
  variant = 'neutral'
}: {
  children: React.ReactNode;
  variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}) {
  const variantClasses = {
    neutral: 'bg-white/10 text-muted-foreground',
    success: 'bg-good/20 text-good',
    warning: 'bg-warn/20 text-warn',
    danger: 'bg-bad/20 text-bad',
    info: 'bg-accent/20 text-accent'
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variantClasses[variant]}`}>
      {children}
    </span>
  );
}

// Glass tooltip styling for Recharts
const glassTooltipStyle = {
  background: 'rgba(10, 10, 10, 0.85)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '8px',
  padding: '8px 12px',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '12px'
};

interface QualityTabV2Props {
  quality: QualityMetrics;
}

export function QualityTabV2({ quality }: QualityTabV2Props) {

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
    <div className="space-y-4">
      {/* Page Header */}
      <SubViewHeader
        title="Quality Guardrails"
        subtitle="Monitor candidate quality metrics and offer outcomes"
        helpContent={QUALITY_PAGE_HELP}
      />

      {/* Candidate Experience Stats */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-6">
          <div className="glass-panel p-4 h-full">
            <div className="text-center py-4">
              <StatLabel className="mb-2">Application to First Touch</StatLabel>
              <StatValue color="primary">
                {quality.candidateExperience.applicationToFirstTouchMedian !== null
                  ? `${Math.round(quality.candidateExperience.applicationToFirstTouchMedian)} hrs`
                  : 'N/A'}
              </StatValue>
              <span className="text-sm text-muted-foreground block mt-2">Median time for candidates to hear back</span>
            </div>
          </div>
        </div>
        <div className="col-span-12 md:col-span-6">
          <div className="glass-panel p-4 h-full">
            <div className="text-center py-4">
              <StatLabel className="mb-2">Time Between Steps</StatLabel>
              <StatValue color="primary">
                {quality.candidateExperience.timeBetweenStepsMedian !== null
                  ? `${Math.round(quality.candidateExperience.timeBetweenStepsMedian)} hrs`
                  : 'N/A'}
              </StatValue>
              <span className="text-sm text-muted-foreground block mt-2">Median wait between stage changes</span>
            </div>
          </div>
        </div>
      </div>

      {/* Late Stage Fallout */}
      <div className="glass-panel p-4">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Late-Stage Fallout Rates</h3>
        </div>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 md:col-span-8">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={falloutData} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="name" fontSize={12} stroke="#94A3B8" tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tick={{ fontFamily: "'JetBrains Mono', monospace" }} />
                <YAxis unit="%" fontSize={12} stroke="#94A3B8" tickLine={false} axisLine={false} tick={{ fontFamily: "'JetBrains Mono', monospace" }} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  contentStyle={glassTooltipStyle}
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
              <p className="font-semibold mb-2 text-foreground">What these metrics show:</p>
              <ul className="pl-3 mb-3 space-y-1">
                <li><strong className="text-foreground">Onsite to Reject:</strong> Candidates rejected after onsite</li>
                <li><strong className="text-foreground">Offer to Decline:</strong> Offers declined by candidates</li>
                <li><strong className="text-foreground">Offer to Withdraw:</strong> Candidates withdrew after offer</li>
              </ul>
              <p className="text-xs text-muted-foreground">High rates may indicate calibration issues or poor candidate experience.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Offer Acceptance by Function */}
      <div className="glass-panel p-4">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Offer Acceptance Rate by Function</h3>
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={functionData} layout="vertical" barSize={20}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.1)" />
            <XAxis type="number" domain={[0, 100]} unit="%" fontSize={12} stroke="#94A3B8" tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tick={{ fontFamily: "'JetBrains Mono', monospace" }} />
            <YAxis type="category" dataKey="name" width={100} fontSize={12} stroke="#94A3B8" tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              contentStyle={glassTooltipStyle}
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

      {/* Offer Acceptance by Recruiter */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-6">
          <div className="glass-panel overflow-hidden h-full">
            <div className="p-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                Top 5 Recruiters <span className="text-muted-foreground font-normal normal-case">(Offer Acceptance)</span>
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30">
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recruiter</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Offers</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Accept Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {topRecruiters.map(r => (
                    <tr key={r.recruiterId} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-3 font-medium text-foreground">{r.recruiterName}</td>
                      <td className="px-3 py-3 text-right font-mono">{r.offerCount}</td>
                      <td className="px-3 py-3 text-right">
                        <BadgeV2 variant="success">
                          {r.acceptanceRate !== null
                            ? `${(r.acceptanceRate * 100).toFixed(0)}%`
                            : '-'}
                        </BadgeV2>
                      </td>
                    </tr>
                  ))}
                  {topRecruiters.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
                        No recruiters with 2+ offers
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="col-span-12 md:col-span-6">
          <div className="glass-panel overflow-hidden h-full">
            <div className="p-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                Bottom 5 Recruiters <span className="text-muted-foreground font-normal normal-case">(Offer Acceptance)</span>
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30">
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recruiter</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Offers</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Accept Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {bottomRecruiters.map(r => (
                    <tr key={r.recruiterId} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-3 font-medium text-foreground">{r.recruiterName}</td>
                      <td className="px-3 py-3 text-right font-mono">{r.offerCount}</td>
                      <td className="px-3 py-3 text-right">
                        <BadgeV2 variant={r.acceptanceRate !== null && r.acceptanceRate >= 0.6 ? 'warning' : 'danger'}>
                          {r.acceptanceRate !== null
                            ? `${(r.acceptanceRate * 100).toFixed(0)}%`
                            : '-'}
                        </BadgeV2>
                      </td>
                    </tr>
                  ))}
                  {bottomRecruiters.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
                        No recruiters with 2+ offers
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Interpretation Guide */}
      <div className="glass-panel p-4">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quality Guardrails: What to Watch For</h3>
        </div>
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 md:col-span-4">
            <div className="p-3 h-full bg-muted/30 rounded border-t-2 border-bad">
              <h6 className="text-sm font-semibold mb-2 text-foreground">Red Flags</h6>
              <ul className="text-xs text-muted-foreground pl-4 space-y-1 list-disc">
                <li>Offer acceptance rate below 60%</li>
                <li>High onsite-to-reject rate (&gt;40%)</li>
                <li>Application to first touch &gt;72 hours</li>
                <li>Significant variance between recruiters</li>
              </ul>
            </div>
          </div>
          <div className="col-span-12 md:col-span-4">
            <div className="p-3 h-full bg-muted/30 rounded border-t-2 border-warn">
              <h6 className="text-sm font-semibold mb-2 text-foreground">Areas to Monitor</h6>
              <ul className="text-xs text-muted-foreground pl-4 space-y-1 list-disc">
                <li>Offer acceptance between 60-80%</li>
                <li>Functions with lower acceptance rates</li>
                <li>Candidate withdrawals at offer stage</li>
                <li>Long waits between interview stages</li>
              </ul>
            </div>
          </div>
          <div className="col-span-12 md:col-span-4">
            <div className="p-3 h-full bg-muted/30 rounded border-t-2 border-good">
              <h6 className="text-sm font-semibold mb-2 text-foreground">Good Health Indicators</h6>
              <ul className="text-xs text-muted-foreground pl-4 space-y-1 list-disc">
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

export default QualityTabV2;
