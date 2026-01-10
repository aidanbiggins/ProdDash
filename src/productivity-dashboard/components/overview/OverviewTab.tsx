// Overview Tab Component

import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { format } from 'date-fns';
import { OverviewMetrics, RecruiterSummary, WeeklyTrend, DataHealth, Candidate, Requisition, User } from '../../types';
import { KPICard } from '../common/KPICard';
import { DataDrillDownModal, DrillDownType, buildHiresRecords, buildOffersRecords, buildReqsRecords } from '../common/DataDrillDownModal';
import { METRIC_FORMULAS } from '../common/MetricDrillDown';
import { exportRecruiterSummaryCSV } from '../../services';
import { MetricFilters } from '../../types';

interface OverviewTabProps {
  overview: OverviewMetrics;
  weeklyTrends: WeeklyTrend[];
  dataHealth: DataHealth;
  filters: MetricFilters;
  onSelectRecruiter: (recruiterId: string) => void;
  // Raw data for drill-down
  candidates: Candidate[];
  requisitions: Requisition[];
  users: User[];
}

export function OverviewTab({
  overview,
  weeklyTrends,
  dataHealth,
  filters,
  onSelectRecruiter,
  candidates,
  requisitions,
  users
}: OverviewTabProps) {
  const [drillDown, setDrillDown] = useState<{
    isOpen: boolean;
    type: DrillDownType;
    title: string;
    formula?: string;
    totalValue?: string | number;
  } | null>(null);

  // Sorting state for leaderboard
  const [sortColumn, setSortColumn] = useState<string>('productivity');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Multi-select state for recruiters
  const [selectedRecruiterIds, setSelectedRecruiterIds] = useState<Set<string>>(new Set());

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // Toggle recruiter selection
  const toggleRecruiterSelection = (recruiterId: string) => {
    setSelectedRecruiterIds(prev => {
      const next = new Set(prev);
      if (next.has(recruiterId)) {
        next.delete(recruiterId);
      } else {
        next.add(recruiterId);
      }
      return next;
    });
  };

  // Select all / clear all
  const handleSelectAll = () => {
    if (selectedRecruiterIds.size === sortedRecruiters.length) {
      setSelectedRecruiterIds(new Set());
    } else {
      setSelectedRecruiterIds(new Set(sortedRecruiters.map(r => r.recruiterId)));
    }
  };

  // Navigate to selected recruiter(s)
  const handleViewSelected = () => {
    if (selectedRecruiterIds.size === 1) {
      onSelectRecruiter(Array.from(selectedRecruiterIds)[0]);
    }
  };

  // Clear selection
  const clearSelection = () => setSelectedRecruiterIds(new Set());

  // Calculate filtered stats when recruiters are selected
  const filteredStats = useMemo(() => {
    if (selectedRecruiterIds.size === 0) return null;

    const filteredRecruiters = overview.recruiterSummaries.filter(r =>
      selectedRecruiterIds.has(r.recruiterId)
    );

    const hires = filteredRecruiters.reduce((sum, r) => sum + r.outcomes.hires, 0);
    const offers = filteredRecruiters.reduce((sum, r) => sum + r.outcomes.offersExtended, 0);
    const weighted = filteredRecruiters.reduce((sum, r) => sum + r.weighted.weightedHires, 0);
    const openReqs = filteredRecruiters.reduce((sum, r) => sum + r.aging.openReqCount, 0);
    const screens = filteredRecruiters.reduce((sum, r) => sum + r.executionVolume.screensCompleted, 0);
    const stalled = filteredRecruiters.reduce((sum, r) => sum + r.aging.stalledReqs.count, 0);

    return {
      count: filteredRecruiters.length,
      hires,
      offers,
      weightedHires: weighted,
      openReqs,
      screens,
      stalled
    };
  }, [selectedRecruiterIds, overview.recruiterSummaries]);

  const getSortValue = (r: RecruiterSummary, column: string): number => {
    switch (column) {
      case 'hires': return r.outcomes.hires;
      case 'weighted': return r.weighted.weightedHires;
      case 'offers': return r.outcomes.offersExtended;
      case 'accept': return r.outcomes.offerAcceptanceRate ?? 0;
      case 'openReqs': return r.aging.openReqCount;
      case 'stalled': return r.aging.stalledReqs.count;
      case 'outreach': return r.executionVolume.outreachSent;
      case 'screens': return r.executionVolume.screensCompleted;
      case 'submittals': return r.executionVolume.submittalsToHM;
      case 'productivity': return r.productivityIndex;
      default: return 0;
    }
  };

  const sortedRecruiters = [...overview.recruiterSummaries].sort((a, b) => {
    const aVal = getSortValue(a, sortColumn);
    const bVal = getSortValue(b, sortColumn);
    return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const isLowConfidence = (metric: string) =>
    dataHealth.lowConfidenceMetrics.includes(metric);

  const openDrillDown = (type: DrillDownType, title: string, totalValue?: string | number) => {
    const formulaInfo = METRIC_FORMULAS[type] || { formula: 'Custom calculation' };
    setDrillDown({
      isOpen: true,
      type,
      title,
      formula: formulaInfo.formula,
      totalValue
    });
  };

  // Build complexity scores map from all recruiter summaries
  const complexityScoresMap = useMemo(() => {
    const map = new Map<string, { totalScore: number; levelWeight: number; hmWeight: number }>();
    overview.recruiterSummaries.forEach(r => {
      r.weighted.complexityScores.forEach(cs => {
        map.set(cs.reqId, {
          totalScore: cs.totalScore,
          levelWeight: cs.levelWeight,
          hmWeight: cs.hmWeight
        });
      });
    });
    return map;
  }, [overview.recruiterSummaries]);

  // Build drill-down records based on type
  const getDrillDownRecords = useMemo(() => {
    if (!drillDown) return [];
    switch (drillDown.type) {
      case 'hires':
        return buildHiresRecords(candidates, requisitions, users);
      case 'weightedHires':
        return buildHiresRecords(candidates, requisitions, users, complexityScoresMap);
      case 'offers':
        return buildOffersRecords(candidates, requisitions, users);
      case 'openReqs':
        return buildReqsRecords(requisitions.filter(r => r.status === 'Open'), users);
      case 'stalledReqs':
        // Stalled reqs are those with no activity - just filter open reqs for now
        return buildReqsRecords(requisitions.filter(r => r.status === 'Open'), users);
      default:
        return [];
    }
  }, [drillDown, candidates, requisitions, users, complexityScoresMap]);

  // Format trend data for charts
  const trendData = weeklyTrends.map(t => ({
    week: format(t.weekStart, 'MMM d'),
    hires: t.hires,
    offers: t.offers,
    hmLatency: t.hmLatencyMedian ? Math.round(t.hmLatencyMedian) : 0,
    outreach: t.outreachSent
  }));

  const handleExport = () => {
    exportRecruiterSummaryCSV(overview.recruiterSummaries, filters);
  };

  return (
    <div>
      {/* Filtered Stats Banner - shows when recruiters are selected */}
      {filteredStats && (
        <div className="card-bespoke mb-4 border-primary border-opacity-50">
          <div className="card-header d-flex justify-content-between align-items-center bg-primary bg-opacity-10">
            <div className="d-flex align-items-center">
              <span style={{ marginRight: '0.5rem' }}>🔽</span>
              <span className="text-primary fw-medium">
                Showing stats for {filteredStats.count} selected recruiter{filteredStats.count > 1 ? 's' : ''}
              </span>
            </div>
            <button
              className="btn btn-sm btn-outline-primary"
              onClick={clearSelection}
            >
              Show All
            </button>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-2">
                <div className="text-center">
                  <div className="stat-label">Hires</div>
                  <div className="stat-value text-primary">{filteredStats.hires}</div>
                </div>
              </div>
              <div className="col-md-2">
                <div className="text-center">
                  <div className="stat-label">Weighted</div>
                  <div className="stat-value text-primary">{filteredStats.weightedHires.toFixed(1)}</div>
                </div>
              </div>
              <div className="col-md-2">
                <div className="text-center">
                  <div className="stat-label">Offers</div>
                  <div className="stat-value text-primary">{filteredStats.offers}</div>
                </div>
              </div>
              <div className="col-md-2">
                <div className="text-center">
                  <div className="stat-label">Open Reqs</div>
                  <div className="stat-value">{filteredStats.openReqs}</div>
                </div>
              </div>
              <div className="col-md-2">
                <div className="text-center">
                  <div className="stat-label">Screens</div>
                  <div className="stat-value">{filteredStats.screens}</div>
                </div>
              </div>
              <div className="col-md-2">
                <div className="text-center">
                  <div className="stat-label">Stalled</div>
                  <div className="stat-value text-warning">{filteredStats.stalled}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="row g-3 mb-4">
        <div className="col-md-2">
          <KPICard
            title="Hires"
            value={overview.totalHires}
            priorPeriod={overview.priorPeriod ? {
              value: overview.priorPeriod.hires,
              label: overview.priorPeriod.label
            } : undefined}
            onClick={() => openDrillDown('hires', 'Hires', overview.totalHires)}
          />
        </div>
        <div className="col-md-2">
          <KPICard
            title="Weighted Hires"
            value={parseFloat(overview.totalWeightedHires.toFixed(1))}
            priorPeriod={overview.priorPeriod ? {
              value: parseFloat(overview.priorPeriod.weightedHires.toFixed(1)),
              label: overview.priorPeriod.label
            } : undefined}
            lowConfidence={isLowConfidence('Weighted Metrics')}
            onClick={() => openDrillDown('weightedHires', 'Weighted Hires', overview.totalWeightedHires.toFixed(1))}
          />
        </div>
        <div className="col-md-2">
          <KPICard
            title="Offers"
            value={overview.totalOffers}
            priorPeriod={overview.priorPeriod ? {
              value: overview.priorPeriod.offers,
              label: overview.priorPeriod.label
            } : undefined}
            onClick={() => openDrillDown('offers', 'Offers Extended', overview.totalOffers)}
          />
        </div>
        <div className="col-md-2">
          <KPICard
            title="Offer Accept Rate"
            value={overview.totalOfferAcceptanceRate !== null
              ? `${(overview.totalOfferAcceptanceRate * 100).toFixed(0)}%`
              : 'N/A'}
          />
        </div>
        <div className="col-md-2">
          <KPICard
            title="Median TTF"
            value={overview.medianTTF !== null ? `${overview.medianTTF}d` : 'N/A'}
            subtitle="days"
          />
        </div>
        <div className="col-md-2">
          <KPICard
            title="Stalled Reqs"
            value={overview.stalledReqCount}
            subtitle="no activity 14+ days"
          />
        </div>
      </div>

      {/* Trends Charts */}
      <div className="row g-4 mb-4">
        <div className="col-md-6">
          <div className="card-bespoke h-100">
            <div className="card-header">
              <h6>Weekly Hires & Offers</h6>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="week" fontSize={12} stroke="#64748b" />
                  <YAxis fontSize={12} stroke="#64748b" />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="hires"
                    stroke="#059669"
                    strokeWidth={2.5}
                    name="Hires"
                    dot={{ fill: '#059669', strokeWidth: 0, r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="offers"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    name="Offers"
                    dot={{ fill: '#6366f1', strokeWidth: 0, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card-bespoke h-100">
            <div className="card-header">
              <h6>Weekly Outreach</h6>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="week" fontSize={12} stroke="#64748b" />
                  <YAxis fontSize={12} stroke="#64748b" />
                  <Tooltip />
                  <Bar dataKey="outreach" fill="#0f766e" name="Outreach Sent" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Recruiter Leaderboard */}
      <div className="card-bespoke">
        <div className="card-header d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-3">
            <h6 className="mb-0">Recruiter Leaderboard</h6>
            {selectedRecruiterIds.size > 0 && (
              <span className="badge bg-primary">{selectedRecruiterIds.size} selected</span>
            )}
          </div>
          <div className="d-flex gap-2">
            {selectedRecruiterIds.size > 0 && (
              <>
                {selectedRecruiterIds.size === 1 && (
                  <button className="btn btn-primary btn-sm" onClick={handleViewSelected}>
                    View Details
                  </button>
                )}
                <button className="btn btn-outline-secondary btn-sm" onClick={clearSelection}>
                  Clear Selection
                </button>
              </>
            )}
            <button className="btn btn-bespoke-secondary btn-sm" onClick={handleExport}>
              Export CSV
            </button>
          </div>
        </div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0" style={{ tableLayout: 'fixed', minWidth: '900px' }}>
              <thead>
                <tr style={{ background: 'var(--color-slate-50, #f8fafc)' }}>
                  <th style={{ width: '40px', borderBottom: '2px solid var(--color-slate-200)', padding: '0.625rem 0.5rem' }}>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={selectedRecruiterIds.size === sortedRecruiters.length && sortedRecruiters.length > 0}
                      onChange={handleSelectAll}
                      title="Select all"
                    />
                  </th>
                  <th style={{ width: '140px', borderBottom: '2px solid var(--color-slate-200)', padding: '0.625rem 0.5rem', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--color-slate-600)' }}>Recruiter</th>
                  {[
                    { key: 'hires', label: 'Hires' },
                    { key: 'weighted', label: 'Wtd' },
                    { key: 'offers', label: 'Offers' },
                    { key: 'accept', label: 'Accept' },
                    { key: 'openReqs', label: 'Open' },
                    { key: 'stalled', label: 'Stall' },
                    { key: 'outreach', label: 'Outreach' },
                    { key: 'screens', label: 'Screens' },
                    { key: 'submittals', label: 'Submits' },
                    { key: 'productivity', label: 'Prod' }
                  ].map(col => (
                    <th
                      key={col.key}
                      className="text-end"
                      style={{
                        borderBottom: '2px solid var(--color-slate-200)',
                        padding: '0.625rem 0.5rem',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em',
                        color: sortColumn === col.key ? 'var(--color-accent)' : 'var(--color-slate-600)',
                        cursor: 'pointer',
                        userSelect: 'none',
                        whiteSpace: 'nowrap'
                      }}
                      onClick={() => handleSort(col.key)}
                    >
                      {col.label}
                      {sortColumn === col.key && (
                        <span style={{ marginLeft: '2px', fontSize: '0.6rem' }}>
                          {sortDirection === 'desc' ? '▼' : '▲'}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRecruiters.map(r => {
                  const isSelected = selectedRecruiterIds.has(r.recruiterId);
                  return (
                    <tr
                      key={r.recruiterId}
                      className={`cursor-pointer ${isSelected ? 'table-primary' : ''}`}
                      onClick={() => toggleRecruiterSelection(r.recruiterId)}
                    >
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-slate-100)' }} onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={isSelected}
                          onChange={() => toggleRecruiterSelection(r.recruiterId)}
                        />
                      </td>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-slate-100)' }}>
                        <strong style={{ color: 'var(--color-slate-800)', fontSize: '0.85rem' }}>{r.recruiterName}</strong>
                        {r.team && <small className="text-muted d-block" style={{ fontSize: '0.7rem' }}>{r.team}</small>}
                      </td>
                      <td className="text-end" style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-slate-100)', color: 'var(--color-slate-700)', fontSize: '0.85rem' }}>{r.outcomes.hires}</td>
                      <td className="text-end" style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-slate-100)', color: 'var(--color-slate-700)', fontSize: '0.85rem' }}>{r.weighted.weightedHires.toFixed(1)}</td>
                      <td className="text-end" style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-slate-100)', color: 'var(--color-slate-700)', fontSize: '0.85rem' }}>{r.outcomes.offersExtended}</td>
                      <td className="text-end" style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-slate-100)', color: 'var(--color-slate-700)', fontSize: '0.85rem' }}>
                        {r.outcomes.offerAcceptanceRate !== null
                          ? `${(r.outcomes.offerAcceptanceRate * 100).toFixed(0)}%`
                          : '-'}
                      </td>
                      <td className="text-end" style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-slate-100)', color: 'var(--color-slate-700)', fontSize: '0.85rem' }}>{r.aging.openReqCount}</td>
                      <td className="text-end" style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-slate-100)' }}>
                        <span className={r.aging.stalledReqs.count > 0 ? 'badge-bespoke badge-warning-soft' : ''} style={r.aging.stalledReqs.count > 0 ? { fontSize: '0.75rem' } : { color: 'var(--color-slate-700)', fontSize: '0.85rem' }}>
                          {r.aging.stalledReqs.count}
                        </span>
                      </td>
                      <td className="text-end" style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-slate-100)', color: 'var(--color-slate-700)', fontSize: '0.85rem' }}>{r.executionVolume.outreachSent}</td>
                      <td className="text-end" style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-slate-100)', color: 'var(--color-slate-700)', fontSize: '0.85rem' }}>{r.executionVolume.screensCompleted}</td>
                      <td className="text-end" style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-slate-100)', color: 'var(--color-slate-700)', fontSize: '0.85rem' }}>{r.executionVolume.submittalsToHM}</td>
                      <td className="text-end" style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-slate-100)' }}>
                        <span className="badge-bespoke" style={{ background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)', color: 'white', fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>
                          {r.productivityIndex.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Drill Down Modal */}
      {drillDown && (
        <DataDrillDownModal
          isOpen={drillDown.isOpen}
          onClose={() => setDrillDown(null)}
          title={drillDown.title}
          type={drillDown.type}
          records={getDrillDownRecords}
          formula={drillDown.formula}
          totalValue={drillDown.totalValue}
        />
      )}
    </div>
  );
}
