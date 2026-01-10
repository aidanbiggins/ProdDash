// Hiring Manager Friction Tab Component

import React, { useState, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, ReferenceLine
} from 'recharts';
import { HiringManagerFriction, Requisition, Event, User } from '../../types';
import { exportHMFrictionCSV } from '../../services';

// Helper to truncate long names
const truncateName = (name: string, maxLen: number) =>
  name.length > maxLen ? name.substring(0, maxLen) + '...' : name;

interface HMFrictionTabProps {
  friction: HiringManagerFriction[];
  requisitions: Requisition[];
  events: Event[];
  users: User[];
}

export function HMFrictionTab({
  friction,
  requisitions,
  events,
  users
}: HMFrictionTabProps) {
  const [selectedHM, setSelectedHM] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<keyof HiringManagerFriction>('decisionLatencyMedian');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (column: keyof HiringManagerFriction) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const sortedFriction = [...friction].sort((a, b) => {
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
    [...friction]
      .filter(f => f.composition.totalLatencyHours > 0)
      .sort((a, b) => b.composition.totalLatencyHours - a.composition.totalLatencyHours || a.hmName.localeCompare(b.hmName))
      .slice(0, 12)
      .map(f => ({
        name: truncateName(f.hmName, 14),
        fullName: f.hmName,
        hmId: f.hmId,
        feedback: f.composition.feedbackLatencyHours,
        decision: f.composition.decisionLatencyHours,
        activeTime: f.composition.activeTimeHours,
        totalLatency: f.composition.totalLatencyHours,
        timeTax: f.composition.timeTaxPercent,
        weight: f.hmWeight
      })),
    [friction]
  );

  // KPI calculations
  const avgTimeTax = useMemo(() =>
    compositionChartData.length > 0
      ? Math.round(compositionChartData.reduce((sum, d) => sum + d.timeTax, 0) / compositionChartData.length)
      : 0,
    [compositionChartData]
  );

  const totalLatencyImpactDays = useMemo(() =>
    friction.length > 0
      ? Math.round(friction.reduce((sum, f) => sum + f.composition.totalLatencyHours, 0) / 24)
      : 0,
    [friction]
  );

  // Shared click handler for chart bars
  const handleBarClick = useCallback((data: unknown) => {
    const item = data as { hmId?: string };
    if (item?.hmId) setSelectedHM(item.hmId);
  }, []);

  // Candidate Decay Curve data: acceptance rate vs latency
  const decayCurveData = useMemo(() => {
    return friction
      .filter(f => f.offerAcceptanceRate !== null && f.composition.totalLatencyHours > 0)
      .map(f => ({
        hmName: f.hmName,
        hmId: f.hmId,
        latencyDays: Math.round(f.composition.totalLatencyHours / 24),
        acceptanceRate: Math.round((f.offerAcceptanceRate ?? 0) * 100),
        loopCount: f.loopCount
      }))
      .sort((a, b) => a.latencyDays - b.latencyDays);
  }, [friction]);

  // Calculate average acceptance rate for reference line
  const avgAcceptanceRate = useMemo(() => {
    const withOffers = friction.filter(f => f.offerAcceptanceRate !== null);
    if (withOffers.length === 0) return 0;
    return Math.round(withOffers.reduce((sum, f) => sum + (f.offerAcceptanceRate ?? 0) * 100, 0) / withOffers.length);
  }, [friction]);

  // Stage-by-Stage Heatmap data
  const heatmapData = useMemo(() =>
    friction
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
    [friction]
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
    exportHMFrictionCSV(friction);
  };

  // Get reqs for selected HM
  const selectedHMReqs = selectedHM
    ? requisitions.filter(r => r.hiring_manager_id === selectedHM)
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
      {/* Overview Stats - Time Tax focused */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card-bespoke">
            <div className="card-body text-center">
              <div className="stat-label mb-2">Total Hiring Managers</div>
              <div className="stat-value">{friction.length}</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card-bespoke border-danger border-opacity-25">
            <div className="card-body text-center">
              <div className="stat-label mb-2">⏱️ Avg Time Tax</div>
              <div className="stat-value text-danger">{avgTimeTax}%</div>
              <div className="text-muted small">of cycle spent waiting</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card-bespoke">
            <div className="card-body text-center">
              <div className="stat-label mb-2">Latency Impact</div>
              <div className="stat-value" style={{ color: 'var(--color-warning)' }}>
                {totalLatencyImpactDays}d
              </div>
              <div className="text-muted small">total time lost waiting</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card-bespoke">
            <div className="card-body text-center">
              <div className="stat-label mb-2 text-success">Fast HMs (&lt;0.9x weight)</div>
              <div className="stat-value" style={{ color: 'var(--color-success)' }}>
                {friction.filter(f => f.hmWeight < 0.9).length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hiring Cycle Breakdown - Stacked Composition Chart */}
      <div className="card-bespoke mb-4">
        <div className="card-header d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center">
            <span className="me-2" style={{ fontSize: '1.25rem' }}>📊</span>
            <h6 className="mb-0">Hiring Cycle Breakdown <span className="text-muted fw-normal">(time composition by HM)</span></h6>
          </div>
          <div className="d-flex align-items-center gap-3">
            <div className="d-flex align-items-center gap-2 small">
              <span className="d-inline-block rounded" style={{ width: '12px', height: '12px', background: '#059669' }}></span>
              <span className="text-muted">Active</span>
              <span className="d-inline-block rounded" style={{ width: '12px', height: '12px', background: '#f59e0b' }}></span>
              <span className="text-muted">Feedback</span>
              <span className="d-inline-block rounded" style={{ width: '12px', height: '12px', background: '#dc2626' }}></span>
              <span className="text-muted">Decision</span>
            </div>
          </div>
        </div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={380}>
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
                  return (
                    <div className="bg-white border rounded p-3 shadow-sm" style={{ minWidth: '200px' }}>
                      <div className="fw-bold mb-2">{d.fullName}</div>
                      <div className="d-flex justify-content-between">
                        <span className="text-success">✓ Active Time:</span>
                        <strong>{d.activeTime} hrs</strong>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span className="text-warning">⏳ Feedback Wait:</span>
                        <strong>{d.feedback} hrs</strong>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span className="text-danger">⏱️ Decision Wait:</span>
                        <strong>{d.decision} hrs</strong>
                      </div>
                      <hr className="my-2" />
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
              {/* Stacked bars: Active (green) + Feedback (yellow) + Decision (red) */}
              <Bar dataKey="activeTime" stackId="a" fill="#059669" name="Active Time" onClick={handleBarClick} cursor="pointer" />
              <Bar dataKey="feedback" stackId="a" fill="#f59e0b" name="Feedback Latency" onClick={handleBarClick} cursor="pointer" />
              <Bar dataKey="decision" stackId="a" fill="#dc2626" name="Decision Latency" radius={[0, 4, 4, 0]} onClick={handleBarClick} cursor="pointer" />
            </BarChart>
          </ResponsiveContainer>
          <div className="text-center text-muted small mt-2">
            <i className="bi bi-info-circle me-1"></i>
            The more <span className="text-danger fw-medium">red</span> and <span className="text-warning fw-medium">yellow</span> segments, the higher the "Time Tax" - click any bar to see HM details
          </div>
        </div>
      </div>

      {/* Advanced Visualizations Row */}
      <div className="row g-4 mb-4">
        {/* Candidate Decay Curve */}
        <div className="col-md-6">
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
                <ResponsiveContainer width="100%" height={280}>
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
        <div className="col-md-6">
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
              Requisitions for <span className="text-primary">{friction.find(f => f.hmId === selectedHM)?.hmName}</span>
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
