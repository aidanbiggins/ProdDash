// Hiring Manager Friction Tab Component

import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { HiringManagerFriction, Requisition, Event, User } from '../../types';
import { exportHMFrictionCSV } from '../../services';

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

  // Chart data - top 10 slowest HMs (Always sort by latency for the chart)
  const chartData = [...friction]
    .sort((a, b) => (b.decisionLatencyMedian || 0) - (a.decisionLatencyMedian || 0))
    .filter(f => f.decisionLatencyMedian !== null)
    .slice(0, 10)
    .map(f => ({
      name: f.hmName.length > 15 ? f.hmName.substring(0, 15) + '...' : f.hmName,
      fullName: f.hmName,
      latency: Math.round(f.decisionLatencyMedian || 0),
      hmId: f.hmId,
      weight: f.hmWeight
    }));

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
      {/* Overview Stats */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card bg-light">
            <div className="card-body text-center">
              <h6 className="text-muted mb-1">Total Hiring Managers</h6>
              <h3>{friction.length}</h3>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-light">
            <div className="card-body text-center">
              <h6 className="text-muted mb-1">Avg Decision Latency</h6>
              <h3>
                {friction.filter(f => f.decisionLatencyMedian !== null).length > 0
                  ? `${Math.round(
                    friction
                      .filter(f => f.decisionLatencyMedian !== null)
                      .reduce((sum, f) => sum + (f.decisionLatencyMedian || 0), 0) /
                    friction.filter(f => f.decisionLatencyMedian !== null).length
                  )} hrs`
                  : 'N/A'}
              </h3>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-light">
            <div className="card-body text-center">
              <h6 className="text-muted mb-1">Slow HMs (&gt;1.2x weight)</h6>
              <h3 className="text-warning">
                {friction.filter(f => f.hmWeight > 1.2).length}
              </h3>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-light">
            <div className="card-body text-center">
              <h6 className="text-muted mb-1">Fast HMs (&lt;0.9x weight)</h6>
              <h3 className="text-success">
                {friction.filter(f => f.hmWeight < 0.9).length}
              </h3>
            </div>
          </div>
        </div>
      </div>

      {/* Top Slowest HMs Chart */}
      <div className="card mb-4">
        <div className="card-header">
          <h6 className="mb-0">Top 10 Slowest Decision Makers (by median latency)</h6>
        </div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" unit=" hrs" fontSize={12} />
              <YAxis type="category" dataKey="name" width={120} fontSize={12} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload[0]) return null;
                  const tooltipData = payload[0].payload;
                  return (
                    <div className="bg-white border rounded p-2 shadow-sm">
                      <div className="fw-bold">{tooltipData.fullName}</div>
                      <div>Decision Latency: {tooltipData.latency} hours</div>
                      <div>HM Weight: {tooltipData.weight.toFixed(2)}x</div>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="latency"
                onClick={(clickedData: unknown) => {
                  const item = clickedData as { hmId?: string };
                  if (item.hmId) setSelectedHM(item.hmId);
                }}
                cursor="pointer"
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.weight > 1.2 ? '#dc3545' : entry.weight > 1.0 ? '#ffc107' : '#28a745'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
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
            <table className="table table-hover mb-0">
              <thead>
                <tr style={{ background: 'var(--color-slate-50, #f8fafc)' }}>
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
                    className={selectedHM === f.hmId ? 'table-primary' : ''}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedHM(selectedHM === f.hmId ? null : f.hmId)}
                  >
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-slate-100)' }}>
                      <strong style={{ color: 'var(--color-slate-800)', fontSize: '0.85rem' }}>{f.hmName}</strong>
                    </td>
                    <td className="text-end" style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-slate-100)', color: 'var(--color-slate-700)', fontSize: '0.85rem' }}>{f.reqsInRange}</td>
                    <td className="text-end" style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-slate-100)', color: 'var(--color-slate-700)', fontSize: '0.85rem' }}>{f.loopCount}</td>
                    <td className="text-end" style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-slate-100)', color: 'var(--color-slate-700)', fontSize: '0.85rem' }}>
                      {f.feedbackLatencyMedian !== null
                        ? `${Math.round(f.feedbackLatencyMedian)} hrs`
                        : '-'}
                    </td>
                    <td className="text-end" style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-slate-100)', color: 'var(--color-slate-700)', fontSize: '0.85rem' }}>
                      <span className={
                        f.decisionLatencyMedian !== null && f.decisionLatencyMedian > 72 ? 'text-danger' :
                          f.decisionLatencyMedian !== null && f.decisionLatencyMedian > 48 ? 'text-warning' : ''
                      }>
                        {f.decisionLatencyMedian !== null
                          ? `${Math.round(f.decisionLatencyMedian)} hrs`
                          : '-'}
                      </span>
                    </td>
                    <td className="text-end" style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-slate-100)', color: 'var(--color-slate-700)', fontSize: '0.85rem' }}>
                      {f.offerAcceptanceRate !== null
                        ? `${(f.offerAcceptanceRate * 100).toFixed(0)}%`
                        : '-'}
                    </td>
                    <td className="text-end" style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-slate-100)' }}>
                      <span className={`badge-bespoke ${f.hmWeight > 1.2 ? 'badge-danger-soft' :
                          f.hmWeight > 1.0 ? 'badge-warning-soft' :
                            f.hmWeight < 0.9 ? 'badge-success-soft' : 'badge-neutral-soft'
                        }`} style={{ fontSize: '0.75rem' }}>
                        {f.hmWeight.toFixed(2)}x
                      </span>
                      {f.loopCount < 3 && (
                        <small className="text-muted ms-1" title="Less than 3 loops - using default weight">
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
        <div className="card mt-4">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h6 className="mb-0">
              Requisitions for {friction.find(f => f.hmId === selectedHM)?.hmName}
            </h6>
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setSelectedHM(null)}
            >
              Close
            </button>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-sm mb-0">
                <thead className="table-light">
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
                          <span className={`badge ${req.status === 'Open' ? 'bg-success' :
                            req.status === 'Closed' ? 'bg-secondary' :
                              req.status === 'OnHold' ? 'bg-warning' : 'bg-danger'
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
      <div className="card mt-4">
        <div className="card-body">
          <h6 className="mb-3">Understanding HM Weight</h6>
          <p className="small text-muted mb-2">
            HM Weight measures how a hiring manager's decision speed compares to the median.
            It affects the complexity score of their requisitions:
          </p>
          <div className="d-flex gap-4">
            <div>
              <span className="badge bg-success">0.8 - 0.95x</span>
              <span className="ms-2 small">Fast - reduces complexity</span>
            </div>
            <div>
              <span className="badge bg-secondary">0.95 - 1.05x</span>
              <span className="ms-2 small">Average</span>
            </div>
            <div>
              <span className="badge bg-warning text-dark">1.05 - 1.2x</span>
              <span className="ms-2 small">Slow</span>
            </div>
            <div>
              <span className="badge bg-danger">1.2 - 1.3x</span>
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
