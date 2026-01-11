// Hiring Manager Friction Tab Component

import React, { useState, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, ReferenceLine
} from 'recharts';
import { HiringManagerFriction, Requisition, Event, User, MetricFilters } from '../../types';
import { exportHMFrictionCSV } from '../../services';
import { useIsMobile } from '../../hooks/useIsMobile';

// Helper to truncate long names
const truncateName = (name: string, maxLen: number) =>
  name.length > maxLen ? name.substring(0, maxLen) + '...' : name;

interface HMFrictionTabProps {
  friction: HiringManagerFriction[];
  requisitions: Requisition[];
  events: Event[];
  users: User[];
  filters?: MetricFilters;
}

export function HMFrictionTab({
  friction,
  requisitions,
  events,
  users,
  filters
}: HMFrictionTabProps) {
  const isMobile = useIsMobile();
  const mainChartHeight = isMobile ? 280 : 380;
  const smallChartHeight = isMobile ? 220 : 280;

  const [selectedHM, setSelectedHM] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<keyof HiringManagerFriction>('decisionLatencyMedian');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [expandedKPI, setExpandedKPI] = useState<'totalHMs' | 'avgTimeTax' | 'latencyImpact' | 'fastHMs' | null>(null);

  // Filter requisitions based on master filters
  const filteredRequisitions = useMemo(() => {
    return requisitions.filter(r => {
      if (filters?.recruiterIds?.length && !filters.recruiterIds.includes(r.recruiter_id || '')) return false;
      if (filters?.functions?.length && !filters.functions.includes(r.function)) return false;
      if (filters?.jobFamilies?.length && !filters.jobFamilies.includes(r.job_family || '')) return false;
      if (filters?.levels?.length && !filters.levels.includes(r.level || '')) return false;
      if (filters?.regions?.length && !filters.regions.includes(r.location_region)) return false;
      if (filters?.hiringManagerIds?.length && !filters.hiringManagerIds.includes(r.hiring_manager_id || '')) return false;
      return true;
    });
  }, [requisitions, filters]);

  // Get HM IDs that have matching requisitions
  const hmIdsWithData = useMemo(() => {
    return new Set(filteredRequisitions.map(r => r.hiring_manager_id).filter(Boolean));
  }, [filteredRequisitions]);

  // Filter friction data to only HMs with matching requisitions
  const filteredFriction = useMemo(() => {
    // If HM filter is set, only show those HMs
    if (filters?.hiringManagerIds?.length) {
      return friction.filter(f => filters.hiringManagerIds!.includes(f.hmId));
    }
    // Otherwise, show HMs that have requisitions matching other filters
    return friction.filter(f => hmIdsWithData.has(f.hmId));
  }, [friction, filters, hmIdsWithData]);

  const handleSort = (column: keyof HiringManagerFriction) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const sortedFriction = [...filteredFriction].sort((a, b) => {
    const aVal = a[sortColumn];
    const bVal = b[sortColumn];

    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return 1; // Nulls last
    if (bVal === null) return -1;

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Use pre-calculated composition data from service layer
  const compositionChartData = useMemo(() =>
    [...filteredFriction]
      .filter(f => f.composition.totalLatencyHours > 0 || f.composition.activeTimeHours > 0)
      .sort((a, b) => {
        // Sort by total cycle time (all stages combined)
        const totalA = a.composition.stageBreakdown.sourcingHours +
          a.composition.stageBreakdown.screeningHours +
          a.composition.stageBreakdown.hmReviewHours +
          a.composition.stageBreakdown.interviewHours +
          a.composition.stageBreakdown.feedbackHours +
          a.composition.stageBreakdown.decisionHours;
        const totalB = b.composition.stageBreakdown.sourcingHours +
          b.composition.stageBreakdown.screeningHours +
          b.composition.stageBreakdown.hmReviewHours +
          b.composition.stageBreakdown.interviewHours +
          b.composition.stageBreakdown.feedbackHours +
          b.composition.stageBreakdown.decisionHours;
        return totalB - totalA || a.hmName.localeCompare(b.hmName);
      })
      .slice(0, 12)
      .map(f => ({
        name: truncateName(f.hmName, 14),
        fullName: f.hmName,
        hmId: f.hmId,
        // Stage breakdown
        sourcing: f.composition.stageBreakdown.sourcingHours,
        screening: f.composition.stageBreakdown.screeningHours,
        hmReview: f.composition.stageBreakdown.hmReviewHours,
        interview: f.composition.stageBreakdown.interviewHours,
        feedback: f.composition.stageBreakdown.feedbackHours,
        decision: f.composition.stageBreakdown.decisionHours,
        // Legacy fields for compatibility
        activeTime: f.composition.activeTimeHours,
        totalLatency: f.composition.totalLatencyHours,
        timeTax: f.composition.timeTaxPercent,
        weight: f.hmWeight
      })),
    [filteredFriction]
  );

  // KPI calculations
  const avgTimeTax = useMemo(() =>
    compositionChartData.length > 0
      ? Math.round(compositionChartData.reduce((sum, d) => sum + d.timeTax, 0) / compositionChartData.length)
      : 0,
    [compositionChartData]
  );

  const totalLatencyImpactDays = useMemo(() =>
    filteredFriction.length > 0
      ? Math.round(filteredFriction.reduce((sum, f) => sum + f.composition.totalLatencyHours, 0) / 24)
      : 0,
    [filteredFriction]
  );

  // Fast HMs - those with hmWeight < 0.9
  const fastHMs = useMemo(() =>
    filteredFriction.filter(f => f.hmWeight < 0.9).sort((a, b) => a.hmWeight - b.hmWeight),
    [filteredFriction]
  );

  // HMs sorted by latency impact (highest first)
  const hmsByLatencyImpact = useMemo(() =>
    [...filteredFriction]
      .filter(f => f.composition.totalLatencyHours > 0)
      .sort((a, b) => b.composition.totalLatencyHours - a.composition.totalLatencyHours),
    [filteredFriction]
  );

  // Time tax distribution buckets
  const timeTaxDistribution = useMemo(() => {
    const buckets = [
      { label: '0-10%', min: 0, max: 10, count: 0, hms: [] as HiringManagerFriction[] },
      { label: '10-20%', min: 10, max: 20, count: 0, hms: [] as HiringManagerFriction[] },
      { label: '20-30%', min: 20, max: 30, count: 0, hms: [] as HiringManagerFriction[] },
      { label: '30-40%', min: 30, max: 40, count: 0, hms: [] as HiringManagerFriction[] },
      { label: '40-50%', min: 40, max: 50, count: 0, hms: [] as HiringManagerFriction[] },
      { label: '50%+', min: 50, max: 100, count: 0, hms: [] as HiringManagerFriction[] }
    ];
    for (const f of filteredFriction) {
      const tax = f.composition.timeTaxPercent;
      const bucket = buckets.find(b => tax >= b.min && tax < b.max) || buckets[buckets.length - 1];
      bucket.count++;
      bucket.hms.push(f);
    }
    return buckets;
  }, [filteredFriction]);

  // Handle KPI tile click
  const handleKPIClick = useCallback((kpi: 'totalHMs' | 'avgTimeTax' | 'latencyImpact' | 'fastHMs') => {
    setExpandedKPI(expandedKPI === kpi ? null : kpi);
  }, [expandedKPI]);

  // Shared click handler for chart bars
  const handleBarClick = useCallback((data: unknown) => {
    const item = data as { hmId?: string };
    if (item?.hmId) setSelectedHM(item.hmId);
  }, []);

  // Candidate Decay Curve data: acceptance rate vs latency
  const decayCurveData = useMemo(() => {
    return filteredFriction
      .filter(f => f.offerAcceptanceRate !== null && f.composition.totalLatencyHours > 0)
      .map(f => ({
        hmName: f.hmName,
        hmId: f.hmId,
        latencyDays: Math.round(f.composition.totalLatencyHours / 24),
        acceptanceRate: Math.round((f.offerAcceptanceRate ?? 0) * 100),
        loopCount: f.loopCount
      }))
      .sort((a, b) => a.latencyDays - b.latencyDays);
  }, [filteredFriction]);

  // Calculate average acceptance rate for reference line
  const avgAcceptanceRate = useMemo(() => {
    const withOffers = filteredFriction.filter(f => f.offerAcceptanceRate !== null);
    if (withOffers.length === 0) return 0;
    return Math.round(withOffers.reduce((sum, f) => sum + (f.offerAcceptanceRate ?? 0) * 100, 0) / withOffers.length);
  }, [filteredFriction]);

  // Stage-by-Stage Heatmap data
  const heatmapData = useMemo(() =>
    filteredFriction
      .filter(f => f.feedbackLatencyMedian !== null || f.decisionLatencyMedian !== null)
      .sort((a, b) => b.composition.totalLatencyHours - a.composition.totalLatencyHours)
      .slice(0, 10)
      .map(f => ({
        hmName: truncateName(f.hmName, 12),
        fullName: f.hmName,
        hmId: f.hmId,
        feedback: f.feedbackLatencyMedian ? Math.round(f.feedbackLatencyMedian) : null,
        decision: f.decisionLatencyMedian ? Math.round(f.decisionLatencyMedian) : null,
        total: f.composition.totalLatencyHours
      })),
    [filteredFriction]
  );

  // Get color for heatmap cell based on hours
  const getHeatmapColor = (hours: number | null, type: 'feedback' | 'decision') => {
    if (hours === null) return '#f1f5f9'; // gray for no data
    const thresholds = type === 'feedback'
      ? { good: 24, warn: 48, bad: 72 }
      : { good: 48, warn: 72, bad: 120 };

    if (hours <= thresholds.good) return '#dcfce7'; // green
    if (hours <= thresholds.warn) return '#fef3c7'; // yellow
    if (hours <= thresholds.bad) return '#fed7aa'; // orange
    return '#fecaca'; // red
  };

  const handleExport = () => {
    exportHMFrictionCSV(filteredFriction);
  };

  // Get reqs for selected HM (filtered by master filters)
  const selectedHMReqs = selectedHM
    ? filteredRequisitions.filter(r => r.hiring_manager_id === selectedHM)
    : [];

  // Helper to render sort icon
  const renderSortIcon = (column: keyof HiringManagerFriction) => {
    if (sortColumn !== column) return <i className="bi bi-arrow-down-up text-muted opacity-25 ms-1" style={{ fontSize: '0.7rem' }}></i>;
    return sortDirection === 'asc'
      ? <i className="bi bi-arrow-up-short ms-1 text-primary"></i>
      : <i className="bi bi-arrow-down-short ms-1 text-primary"></i>;
  };

  // Helper for clickable header
  const SortableHeader = ({ column, label, align = 'text-end' }: { column: keyof HiringManagerFriction, label: string, align?: string }) => (
    <th
      className={`${align}`}
      onClick={() => handleSort(column)}
      style={{
        borderBottom: '2px solid var(--color-slate-200)',
        padding: '0.625rem 0.5rem',
        fontSize: '0.7rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
        color: sortColumn === column ? 'var(--color-accent)' : 'var(--color-slate-600)',
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap'
      }}
    >
      <div className={`d-flex align-items-center ${align === 'text-end' ? 'justify-content-end' : ''}`}>
        {label}
        {renderSortIcon(column)}
      </div>
    </th>
  );

  return (
    <div>
      {/* Overview Stats - Time Tax focused - Clickable KPI Tiles */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div
            className={`card-bespoke cursor-pointer transition-all ${expandedKPI === 'totalHMs' ? 'border-primary shadow' : ''}`}
            onClick={() => handleKPIClick('totalHMs')}
            style={{ cursor: 'pointer' }}
          >
            <div className="card-body text-center">
              <div className="stat-label mb-2">Total Hiring Managers</div>
              <div className="stat-value">{filteredFriction.length}</div>
              <div className="text-muted small mt-1"><i className="bi bi-chevron-down"></i> Click for details</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div
            className={`card-bespoke cursor-pointer transition-all ${expandedKPI === 'avgTimeTax' ? 'border-primary shadow' : 'border-danger border-opacity-25'}`}
            onClick={() => handleKPIClick('avgTimeTax')}
            style={{ cursor: 'pointer' }}
          >
            <div className="card-body text-center">
              <div className="stat-label mb-2">Avg Time Tax</div>
              <div className="stat-value text-danger">{avgTimeTax}%</div>
              <div className="text-muted small">of cycle spent waiting</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div
            className={`card-bespoke cursor-pointer transition-all ${expandedKPI === 'latencyImpact' ? 'border-primary shadow' : ''}`}
            onClick={() => handleKPIClick('latencyImpact')}
            style={{ cursor: 'pointer' }}
          >
            <div className="card-body text-center">
              <div className="stat-label mb-2">Latency Impact</div>
              <div className="stat-value" style={{ color: 'var(--color-warning)' }}>
                {totalLatencyImpactDays}d
              </div>
              <div className="text-muted small">total time lost waiting</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div
            className={`card-bespoke cursor-pointer transition-all ${expandedKPI === 'fastHMs' ? 'border-primary shadow' : ''}`}
            onClick={() => handleKPIClick('fastHMs')}
            style={{ cursor: 'pointer' }}
          >
            <div className="card-body text-center">
              <div className="stat-label mb-2 text-success">Fast HMs</div>
              <div className="stat-value" style={{ color: 'var(--color-success)' }}>
                {fastHMs.length}
              </div>
              <div className="text-muted small mt-1"><i className="bi bi-chevron-down"></i> Click for details</div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Drill-Down Panels */}
      {expandedKPI && (
        <div className="card-bespoke mb-4 border-primary">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h6 className="mb-0">
              {expandedKPI === 'totalHMs' && 'All Hiring Managers Overview'}
              {expandedKPI === 'avgTimeTax' && 'Time Tax Distribution'}
              {expandedKPI === 'latencyImpact' && 'Latency Impact by HM'}
              {expandedKPI === 'fastHMs' && 'Fast Hiring Managers'}
            </h6>
            <button className="btn btn-sm btn-bespoke-secondary" onClick={() => setExpandedKPI(null)}>
              <i className="bi bi-x-lg"></i> Close
            </button>
          </div>
          <div className="card-body">
            {/* Total HMs Panel */}
            {expandedKPI === 'totalHMs' && (
              <div className="table-responsive">
                <table className="table table-sm mb-0" style={{ fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th>Hiring Manager</th>
                      <th className="text-end">Reqs</th>
                      <th className="text-end">Loops</th>
                      <th className="text-end">Avg Latency</th>
                      <th className="text-end">Time Tax</th>
                      <th className="text-end">Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFriction.slice(0, 20).map(f => (
                      <tr key={f.hmId} onClick={() => setSelectedHM(f.hmId)} style={{ cursor: 'pointer' }}>
                        <td className="fw-medium">{f.hmName}</td>
                        <td className="text-end">{f.reqsInRange}</td>
                        <td className="text-end">{f.loopCount}</td>
                        <td className="text-end">
                          {f.composition.totalLatencyHours > 0 ? `${Math.round(f.composition.totalLatencyHours / 24)}d` : '-'}
                        </td>
                        <td className="text-end">
                          <span className={f.composition.timeTaxPercent > 30 ? 'text-danger fw-bold' : f.composition.timeTaxPercent > 15 ? 'text-warning' : ''}>
                            {f.composition.timeTaxPercent}%
                          </span>
                        </td>
                        <td className="text-end">
                          <span className={`badge-bespoke ${f.hmWeight > 1.2 ? 'badge-danger-soft' : f.hmWeight > 1.0 ? 'badge-warning-soft' : f.hmWeight < 0.9 ? 'badge-success-soft' : 'badge-neutral-soft'}`}>
                            {f.hmWeight.toFixed(2)}x
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredFriction.length > 20 && (
                  <div className="text-center text-muted small mt-2">
                    Showing top 20 of {filteredFriction.length} HMs
                  </div>
                )}
              </div>
            )}

            {/* Avg Time Tax Panel - Distribution */}
            {expandedKPI === 'avgTimeTax' && (
              <div>
                <div className="row mb-3">
                  {timeTaxDistribution.map(bucket => (
                    <div key={bucket.label} className="col-4 col-md-2 mb-2">
                      <div className="text-center p-2 rounded" style={{ background: bucket.min >= 30 ? '#fef2f2' : bucket.min >= 20 ? '#fefce8' : '#f0fdf4' }}>
                        <div className="small text-muted">{bucket.label}</div>
                        <div className="fw-bold" style={{ fontSize: '1.5rem' }}>{bucket.count}</div>
                        <div className="small text-muted">HMs</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="small text-muted mb-2">
                  <i className="bi bi-info-circle me-1"></i>
                  HMs with &gt;30% Time Tax are costing significant recruiting cycle time
                </div>
                {timeTaxDistribution.filter(b => b.min >= 30).flatMap(b => b.hms).length > 0 && (
                  <>
                    <h6 className="mt-3 mb-2">High Time Tax HMs (&gt;30%)</h6>
                    <div className="table-responsive">
                      <table className="table table-sm mb-0" style={{ fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ background: '#fef2f2' }}>
                            <th>Hiring Manager</th>
                            <th className="text-end">Time Tax</th>
                            <th className="text-end">Feedback Latency</th>
                            <th className="text-end">Decision Latency</th>
                          </tr>
                        </thead>
                        <tbody>
                          {timeTaxDistribution.filter(b => b.min >= 30).flatMap(b => b.hms)
                            .sort((a, b) => b.composition.timeTaxPercent - a.composition.timeTaxPercent)
                            .map(f => (
                              <tr key={f.hmId} onClick={() => setSelectedHM(f.hmId)} style={{ cursor: 'pointer' }}>
                                <td className="fw-medium">{f.hmName}</td>
                                <td className="text-end text-danger fw-bold">{f.composition.timeTaxPercent}%</td>
                                <td className="text-end">{f.feedbackLatencyMedian ? `${Math.round(f.feedbackLatencyMedian)} hrs` : '-'}</td>
                                <td className="text-end">{f.decisionLatencyMedian ? `${Math.round(f.decisionLatencyMedian)} hrs` : '-'}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Latency Impact Panel */}
            {expandedKPI === 'latencyImpact' && (
              <div>
                <div className="mb-3 p-3 rounded" style={{ background: '#fefce8' }}>
                  <div className="d-flex justify-content-between align-items-center">
                    <span>Total latency across all HMs:</span>
                    <strong className="text-warning" style={{ fontSize: '1.25rem' }}>{totalLatencyImpactDays} days</strong>
                  </div>
                </div>
                <h6 className="mb-2">Top Contributors to Latency</h6>
                <div className="table-responsive">
                  <table className="table table-sm mb-0" style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th>Hiring Manager</th>
                        <th className="text-end">Total Latency</th>
                        <th className="text-end">% of Total</th>
                        <th className="text-end">Feedback</th>
                        <th className="text-end">Decision</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hmsByLatencyImpact.slice(0, 10).map(f => {
                        const pctOfTotal = totalLatencyImpactDays > 0
                          ? Math.round((f.composition.totalLatencyHours / 24) / totalLatencyImpactDays * 100)
                          : 0;
                        return (
                          <tr key={f.hmId} onClick={() => setSelectedHM(f.hmId)} style={{ cursor: 'pointer' }}>
                            <td className="fw-medium">{f.hmName}</td>
                            <td className="text-end fw-bold">{Math.round(f.composition.totalLatencyHours / 24)}d</td>
                            <td className="text-end">
                              <div className="d-flex align-items-center justify-content-end gap-2">
                                <div className="progress" style={{ width: '60px', height: '8px' }}>
                                  <div className="progress-bar bg-warning" style={{ width: `${pctOfTotal}%` }}></div>
                                </div>
                                <span>{pctOfTotal}%</span>
                              </div>
                            </td>
                            <td className="text-end">{f.composition.feedbackLatencyHours}h</td>
                            <td className="text-end">{f.composition.decisionLatencyHours}h</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Fast HMs Panel */}
            {expandedKPI === 'fastHMs' && (
              <div>
                {fastHMs.length > 0 ? (
                  <>
                    <div className="mb-3 p-3 rounded" style={{ background: '#f0fdf4' }}>
                      <div className="d-flex justify-content-between align-items-center">
                        <span>HMs with faster-than-median decision speed:</span>
                        <strong className="text-success" style={{ fontSize: '1.25rem' }}>{fastHMs.length} HMs</strong>
                      </div>
                    </div>
                    <div className="table-responsive">
                      <table className="table table-sm mb-0" style={{ fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ background: '#f0fdf4' }}>
                            <th>Hiring Manager</th>
                            <th className="text-end">Weight</th>
                            <th className="text-end">Avg Feedback</th>
                            <th className="text-end">Avg Decision</th>
                            <th className="text-end">Time Tax</th>
                            <th className="text-end">Offer Accept</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fastHMs.map(f => (
                            <tr key={f.hmId} onClick={() => setSelectedHM(f.hmId)} style={{ cursor: 'pointer' }}>
                              <td className="fw-medium">{f.hmName}</td>
                              <td className="text-end">
                                <span className="badge-bespoke badge-success-soft">{f.hmWeight.toFixed(2)}x</span>
                              </td>
                              <td className="text-end">{f.feedbackLatencyMedian ? `${Math.round(f.feedbackLatencyMedian)}h` : '-'}</td>
                              <td className="text-end">{f.decisionLatencyMedian ? `${Math.round(f.decisionLatencyMedian)}h` : '-'}</td>
                              <td className="text-end text-success">{f.composition.timeTaxPercent}%</td>
                              <td className="text-end">{f.offerAcceptanceRate ? `${Math.round(f.offerAcceptanceRate * 100)}%` : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="small text-muted mt-2">
                      <i className="bi bi-lightbulb me-1"></i>
                      These HMs have lower-than-median decision latency, reducing complexity scores on their reqs
                    </div>
                  </>
                ) : (
                  <div className="text-center text-muted py-4">
                    <div className="mb-2" style={{ fontSize: '2rem' }}>🏃</div>
                    <div>No HMs currently qualify as "fast" (weight &lt; 0.9)</div>
                    <div className="small mt-1">This requires at least 3 interview loops and faster-than-median decisions</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hiring Cycle Breakdown - Stacked Composition Chart */}
      <div className="card-bespoke mb-4">
        <div className="card-header d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center">
            <span className="me-2" style={{ fontSize: '1.25rem' }}>📊</span>
            <h6 className="mb-0">Hiring Cycle Breakdown <span className="text-muted fw-normal">(time composition by HM)</span></h6>
          </div>
          <div className="d-flex align-items-center gap-3 flex-wrap">
            <div className="d-flex align-items-center gap-2 small flex-wrap">
              <span className="d-inline-block rounded" style={{ width: '12px', height: '12px', background: '#64748b' }}></span>
              <span className="text-muted">Sourcing</span>
              <span className="d-inline-block rounded" style={{ width: '12px', height: '12px', background: '#3b82f6' }}></span>
              <span className="text-muted">Screening</span>
              <span className="d-inline-block rounded" style={{ width: '12px', height: '12px', background: '#14b8a6' }}></span>
              <span className="text-muted">HM Review</span>
              <span className="d-inline-block rounded" style={{ width: '12px', height: '12px', background: '#22c55e' }}></span>
              <span className="text-muted">Interview</span>
              <span className="d-inline-block rounded" style={{ width: '12px', height: '12px', background: '#f59e0b' }}></span>
              <span className="text-muted">Feedback</span>
              <span className="d-inline-block rounded" style={{ width: '12px', height: '12px', background: '#dc2626' }}></span>
              <span className="text-muted">Decision</span>
            </div>
          </div>
        </div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={mainChartHeight}>
            <BarChart data={compositionChartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                type="number"
                unit=" hrs"
                fontSize={11}
                stroke="#64748b"
                domain={[0, 'dataMax']}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={110}
                fontSize={11}
                stroke="#64748b"
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload[0]) return null;
                  const d = payload[0].payload;
                  const totalCycle = d.sourcing + d.screening + d.hmReview + d.interview + d.feedback + d.decision;
                  return (
                    <div className="bg-white border rounded p-3 shadow-sm" style={{ minWidth: '240px' }}>
                      <div className="fw-bold mb-2">{d.fullName}</div>
                      <div className="small text-muted mb-2">Pipeline Stage Breakdown</div>
                      <div className="d-flex justify-content-between">
                        <span style={{ color: '#64748b' }}>● Sourcing:</span>
                        <strong>{d.sourcing} hrs</strong>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span style={{ color: '#3b82f6' }}>● Screening:</span>
                        <strong>{d.screening} hrs</strong>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span style={{ color: '#14b8a6' }}>● HM Review:</span>
                        <strong>{d.hmReview} hrs</strong>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span style={{ color: '#22c55e' }}>● Interview:</span>
                        <strong>{d.interview} hrs</strong>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span style={{ color: '#f59e0b' }}>● Feedback Wait:</span>
                        <strong>{d.feedback} hrs</strong>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span style={{ color: '#dc2626' }}>● Decision Wait:</span>
                        <strong>{d.decision} hrs</strong>
                      </div>
                      <hr className="my-2" />
                      <div className="d-flex justify-content-between">
                        <span className="fw-bold">Total Cycle:</span>
                        <strong>{totalCycle} hrs ({Math.round(totalCycle / 24)}d)</strong>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span className="fw-bold">Time Tax:</span>
                        <strong className={d.timeTax > 30 ? 'text-danger' : d.timeTax > 15 ? 'text-warning' : 'text-success'}>
                          {d.timeTax}%
                        </strong>
                      </div>
                    </div>
                  );
                }}
              />
              {/* Stacked bars: 6 pipeline stages from sourcing to decision */}
              <Bar dataKey="sourcing" stackId="a" fill="#64748b" name="Sourcing" onClick={handleBarClick} cursor="pointer" />
              <Bar dataKey="screening" stackId="a" fill="#3b82f6" name="Screening" onClick={handleBarClick} cursor="pointer" />
              <Bar dataKey="hmReview" stackId="a" fill="#14b8a6" name="HM Review" onClick={handleBarClick} cursor="pointer" />
              <Bar dataKey="interview" stackId="a" fill="#22c55e" name="Interview" onClick={handleBarClick} cursor="pointer" />
              <Bar dataKey="feedback" stackId="a" fill="#f59e0b" name="Feedback Wait" onClick={handleBarClick} cursor="pointer" />
              <Bar dataKey="decision" stackId="a" fill="#dc2626" name="Decision Wait" radius={[0, 4, 4, 0]} onClick={handleBarClick} cursor="pointer" />
            </BarChart>
          </ResponsiveContainer>
          <div className="text-center text-muted small mt-2">
            <i className="bi bi-info-circle me-1"></i>
            Shows time in each pipeline stage. <span className="text-warning fw-medium">Orange</span> and <span className="text-danger fw-medium">red</span> segments are HM latency (Time Tax) - click any bar to see HM details
          </div>
        </div>
      </div>

      {/* Advanced Visualizations Row */}
      <div className="row g-4 mb-4">
        {/* Candidate Decay Curve */}
        <div className="col-12 col-md-6">
          <div className="card-bespoke h-100">
            <div className="card-header">
              <div className="d-flex align-items-center">
                <span className="me-2" style={{ fontSize: '1.25rem' }}>📉</span>
                <h6 className="mb-0">Candidate Decay Curve</h6>
              </div>
              <small className="text-muted">Offer acceptance rate vs HM latency</small>
            </div>
            <div className="card-body">
              {decayCurveData.length > 0 ? (
                <ResponsiveContainer width="100%" height={smallChartHeight}>
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      type="number"
                      dataKey="latencyDays"
                      name="Latency"
                      unit=" days"
                      fontSize={11}
                      stroke="#64748b"
                      label={{ value: 'Total Latency (days)', position: 'bottom', fontSize: 11, fill: '#64748b' }}
                    />
                    <YAxis
                      type="number"
                      dataKey="acceptanceRate"
                      name="Acceptance"
                      unit="%"
                      fontSize={11}
                      stroke="#64748b"
                      domain={[0, 100]}
                      label={{ value: 'Offer Accept %', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#64748b' }}
                    />
                    <ZAxis type="number" dataKey="loopCount" range={[50, 400]} name="Interview Loops" />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload[0]) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="bg-white border rounded p-2 shadow-sm">
                            <div className="fw-bold">{d.hmName}</div>
                            <div className="small">Latency: {d.latencyDays} days</div>
                            <div className="small">Accept Rate: {d.acceptanceRate}%</div>
                            <div className="small text-muted">({d.loopCount} loops)</div>
                          </div>
                        );
                      }}
                    />
                    <ReferenceLine
                      y={avgAcceptanceRate}
                      stroke="#6366f1"
                      strokeDasharray="5 5"
                      label={{ value: `Avg: ${avgAcceptanceRate}%`, position: 'right', fontSize: 10, fill: '#6366f1' }}
                    />
                    <Scatter
                      name="HMs"
                      data={decayCurveData}
                      fill="#059669"
                      onClick={(data) => {
                        if (data?.hmId) setSelectedHM(data.hmId);
                      }}
                      cursor="pointer"
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-muted py-5">
                  <div className="mb-2">📊</div>
                  <div>No offer data available</div>
                </div>
              )}
              <div className="text-center text-muted small mt-2">
                <i className="bi bi-info-circle me-1"></i>
                Larger dots = more interview loops. Points below the average line indicate declining acceptance with latency.
              </div>
            </div>
          </div>
        </div>

        {/* Stage-by-Stage Heatmap */}
        <div className="col-12 col-md-6">
          <div className="card-bespoke h-100">
            <div className="card-header">
              <div className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center">
                  <span className="me-2" style={{ fontSize: '1.25rem' }}>🗺️</span>
                  <h6 className="mb-0">Stage Latency Heatmap</h6>
                </div>
                <div className="d-flex align-items-center gap-2 small">
                  <span className="d-inline-block rounded" style={{ width: '12px', height: '12px', background: '#dcfce7' }}></span>
                  <span className="text-muted">Fast</span>
                  <span className="d-inline-block rounded" style={{ width: '12px', height: '12px', background: '#fef3c7' }}></span>
                  <span className="text-muted">Slow</span>
                  <span className="d-inline-block rounded" style={{ width: '12px', height: '12px', background: '#fecaca' }}></span>
                  <span className="text-muted">Very Slow</span>
                </div>
              </div>
              <small className="text-muted">Top 10 HMs by total latency</small>
            </div>
            <div className="card-body p-0">
              {heatmapData.length > 0 ? (
                <div className="table-responsive">
                  <table className="table table-sm mb-0" style={{ fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={{ padding: '0.5rem', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>HM</th>
                        <th className="text-center" style={{ padding: '0.5rem', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>Feedback (hrs)</th>
                        <th className="text-center" style={{ padding: '0.5rem', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>Decision (hrs)</th>
                        <th className="text-center" style={{ padding: '0.5rem', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>Total (hrs)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {heatmapData.map(row => (
                        <tr
                          key={row.hmId}
                          style={{ cursor: 'pointer' }}
                          onClick={() => setSelectedHM(row.hmId)}
                          className={selectedHM === row.hmId ? 'bg-soft-primary' : ''}
                        >
                          <td style={{ padding: '0.5rem' }} title={row.fullName}>
                            <span className="fw-medium">{row.hmName}</span>
                          </td>
                          <td
                            className="text-center fw-medium"
                            style={{
                              padding: '0.5rem',
                              background: getHeatmapColor(row.feedback, 'feedback')
                            }}
                          >
                            {row.feedback ?? '-'}
                          </td>
                          <td
                            className="text-center fw-medium"
                            style={{
                              padding: '0.5rem',
                              background: getHeatmapColor(row.decision, 'decision')
                            }}
                          >
                            {row.decision ?? '-'}
                          </td>
                          <td
                            className="text-center fw-bold"
                            style={{ padding: '0.5rem' }}
                          >
                            {Math.round(row.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center text-muted py-5">
                  <div className="mb-2">🗺️</div>
                  <div>No latency data available</div>
                </div>
              )}
              <div className="text-center text-muted small p-2">
                <i className="bi bi-info-circle me-1"></i>
                Color indicates speed: green ≤24h feedback / ≤48h decision, red &gt;72h / &gt;120h
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* HM Table */}
      <div className="card-bespoke">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h6 className="mb-0">All Hiring Managers</h6>
          <button className="btn btn-bespoke-secondary btn-sm" onClick={handleExport}>
            Export CSV
          </button>
        </div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-bespoke table-hover mb-0">
              <thead>
                <tr>
                  <SortableHeader column="hmName" label="Hiring Manager" align="text-start" />
                  <SortableHeader column="reqsInRange" label="Reqs" />
                  <SortableHeader column="loopCount" label="Interview Loops" />
                  <SortableHeader column="feedbackLatencyMedian" label="Feedback Latency" />
                  <SortableHeader column="decisionLatencyMedian" label="Decision Latency" />
                  <SortableHeader column="offerAcceptanceRate" label="Offer Accept %" />
                  <SortableHeader column="hmWeight" label="HM Weight" />
                </tr>
              </thead>
              <tbody>
                {sortedFriction.map(f => (
                  <tr
                    key={f.hmId}
                    className={selectedHM === f.hmId ? 'bg-soft-primary' : ''}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedHM(selectedHM === f.hmId ? null : f.hmId)}
                  >
                    <td className="fw-medium">
                      {f.hmName}
                    </td>
                    <td className="text-end text-muted">
                      {f.reqsInRange}
                    </td>
                    <td className="text-end">
                      {f.loopCount}
                    </td>
                    <td className="text-end">
                      {f.feedbackLatencyMedian !== null
                        ? `${Math.round(f.feedbackLatencyMedian)} hrs`
                        : '-'}
                    </td>
                    <td className="text-end">
                      <span className={
                        f.decisionLatencyMedian !== null && f.decisionLatencyMedian > 72 ? 'text-danger fw-bold' :
                          f.decisionLatencyMedian !== null && f.decisionLatencyMedian > 48 ? 'text-warning fw-bold' : ''
                      }>
                        {f.decisionLatencyMedian !== null
                          ? `${Math.round(f.decisionLatencyMedian)} hrs`
                          : '-'}
                      </span>
                    </td>
                    <td className="text-end">
                      {f.offerAcceptanceRate !== null
                        ? `${(f.offerAcceptanceRate * 100).toFixed(0)}%`
                        : '-'}
                    </td>
                    <td className="text-end">
                      <span className={`badge-bespoke ${f.hmWeight > 1.2 ? 'badge-danger-soft' :
                        f.hmWeight > 1.0 ? 'badge-warning-soft' :
                          f.hmWeight < 0.9 ? 'badge-success-soft' : 'badge-neutral-soft'
                        }`}>
                        {f.hmWeight.toFixed(2)}x
                      </span>
                      {f.loopCount < 3 && (
                        <small className="text-muted ms-1" title="Low data volume">
                          *
                        </small>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Selected HM Details */}
      {selectedHM && selectedHMReqs.length > 0 && (
        <div className="card-bespoke mt-4">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h6 className="mb-0">
              Requisitions for <span className="text-primary">{filteredFriction.find(f => f.hmId === selectedHM)?.hmName}</span>
            </h6>
            <button
              className="btn btn-sm btn-bespoke-secondary"
              onClick={() => setSelectedHM(null)}
            >
              Close
            </button>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-bespoke table-sm mb-0">
                <thead>
                  <tr>
                    <th>Req ID</th>
                    <th>Title</th>
                    <th>Level</th>
                    <th>Status</th>
                    <th>Recruiter</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedHMReqs.map(req => {
                    const recruiter = users.find(u => u.user_id === req.recruiter_id);
                    return (
                      <tr key={req.req_id}>
                        <td><code className="small">{req.req_id}</code></td>
                        <td>{req.req_title}</td>
                        <td>{req.level}</td>
                        <td>
                          <span className={`badge-bespoke ${req.status === 'Open' ? 'badge-success-soft' :
                            req.status === 'Closed' ? 'badge-neutral-soft' :
                              req.status === 'OnHold' ? 'badge-warning-soft' : 'badge-danger-soft'
                            }`}>
                            {req.status}
                          </span>
                        </td>
                        <td>{recruiter?.name || req.recruiter_id}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="card-bespoke mt-4">
        <div className="card-body">
          <h6 className="mb-3">Understanding HM Weight</h6>
          <p className="small text-muted mb-2">
            HM Weight measures how a hiring manager's decision speed compares to the median.
            It affects the complexity score of their requisitions:
          </p>
          <div className="d-flex gap-4">
            <div>
              <span className="badge-bespoke badge-success-soft">0.8 - 0.95x</span>
              <span className="ms-2 small">Fast - reduces complexity</span>
            </div>
            <div>
              <span className="badge-bespoke badge-neutral-soft">0.95 - 1.05x</span>
              <span className="ms-2 small">Average</span>
            </div>
            <div>
              <span className="badge-bespoke badge-warning-soft">1.05 - 1.2x</span>
              <span className="ms-2 small">Slow</span>
            </div>
            <div>
              <span className="badge-bespoke badge-danger-soft">1.2 - 1.3x</span>
              <span className="ms-2 small">Very slow - increases complexity</span>
            </div>
          </div>
          <p className="small text-muted mt-2 mb-0">
            * HMs with fewer than 3 interview loops are assigned the default weight of 1.0
          </p>
        </div>
      </div>
    </div>
  );
}
