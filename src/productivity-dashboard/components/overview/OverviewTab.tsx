// Overview Tab Component

import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Area, ComposedChart
} from 'recharts';
import { format, startOfWeek, isSameWeek } from 'date-fns';
import { OverviewMetrics, RecruiterSummary, WeeklyTrend, DataHealth, Candidate, Requisition, User } from '../../types';
import { KPICard } from '../common/KPICard';
import { DataDrillDownModal, DrillDownType, buildHiresRecords, buildOffersRecords, buildReqsRecords } from '../common/DataDrillDownModal';
import { METRIC_FORMULAS } from '../common/MetricDrillDown';
import { exportRecruiterSummaryCSV } from '../../services';
import { MetricFilters } from '../../types';
import { BespokeTable, BespokeTableColumn } from '../common/BespokeTable';
import { useIsMobile } from '../../hooks/useIsMobile';

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
  const isMobile = useIsMobile();
  const chartHeight = isMobile ? 180 : 220;

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

  const handleSort = (key: string, direction: 'asc' | 'desc') => {
    setSortColumn(key);
    setSortDirection(direction);
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

  // Format trend data for charts (team totals)
  const trendData = useMemo(() => weeklyTrends.map(t => ({
    week: format(t.weekStart, 'MMM d'),
    weekStart: t.weekStart,
    hires: t.hires,
    offers: t.offers,
    hmLatency: t.hmLatencyMedian ? Math.round(t.hmLatencyMedian) : 0,
    outreach: t.outreachSent
  })), [weeklyTrends]);

  // Calculate filtered trend data when recruiters are selected
  const chartData = useMemo(() => {
    if (selectedRecruiterIds.size === 0) {
      // No selection - just use team data
      return trendData.map(d => ({
        ...d,
        selectedHires: null,
        selectedOffers: null,
        selectedOutreach: null
      }));
    }

    // Get requisition IDs for selected recruiters
    const selectedReqIds = new Set(
      requisitions
        .filter(r => selectedRecruiterIds.has(r.recruiter_id))
        .map(r => r.req_id)
    );

    // Calculate per-week metrics for selected recruiters
    return trendData.map(d => {
      // Count hires for selected recruiters in this week
      const weekHires = candidates.filter(c => {
        if (!selectedReqIds.has(c.req_id)) return false;
        if (c.current_stage !== 'Hired' && c.disposition !== 'Hired') return false;
        const hireDate = c.hired_at ? new Date(c.hired_at) : null;
        return hireDate && isSameWeek(hireDate, d.weekStart, { weekStartsOn: 1 });
      }).length;

      // Count offers for selected recruiters in this week
      const weekOffers = candidates.filter(c => {
        if (!selectedReqIds.has(c.req_id)) return false;
        const offerDate = c.offer_extended_at ? new Date(c.offer_extended_at) : null;
        return offerDate && isSameWeek(offerDate, d.weekStart, { weekStartsOn: 1 });
      }).length;

      // Outreach approximation: use ratio of selected reqs to total
      const selectedOutreach = selectedReqIds.size > 0 && requisitions.length > 0
        ? Math.round(d.outreach * (selectedReqIds.size / requisitions.filter(r => r.status === 'Open').length || 1))
        : 0;

      return {
        ...d,
        selectedHires: weekHires,
        selectedOffers: weekOffers,
        selectedOutreach: selectedOutreach,
        // For stacked bar, need the "other" portion
        teamHires: d.hires - weekHires,
        teamOffers: d.offers - weekOffers,
        teamOutreach: d.outreach - selectedOutreach
      };
    });
  }, [trendData, selectedRecruiterIds, requisitions, candidates]);

  const isFiltered = selectedRecruiterIds.size > 0;

  const handleExport = () => {
    exportRecruiterSummaryCSV(overview.recruiterSummaries, filters);
  };

  return (
    <div>
      {/* KPI Cards - show filtered values with total context when selection is active */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-2">
          <KPICard
            title="Hires"
            value={filteredStats ? filteredStats.hires : overview.totalHires}
            contextTotal={filteredStats ? overview.totalHires : undefined}
            priorPeriod={!filteredStats && overview.priorPeriod ? {
              value: overview.priorPeriod.hires,
              label: overview.priorPeriod.label
            } : undefined}
            onClick={() => openDrillDown('hires', 'Hires', overview.totalHires)}
          />
        </div>
        <div className="col-6 col-md-2">
          <KPICard
            title="Weighted Hires"
            value={filteredStats ? parseFloat(filteredStats.weightedHires.toFixed(1)) : parseFloat(overview.totalWeightedHires.toFixed(1))}
            contextTotal={filteredStats ? parseFloat(overview.totalWeightedHires.toFixed(1)) : undefined}
            priorPeriod={!filteredStats && overview.priorPeriod ? {
              value: parseFloat(overview.priorPeriod.weightedHires.toFixed(1)),
              label: overview.priorPeriod.label
            } : undefined}
            lowConfidence={isLowConfidence('Weighted Metrics')}
            onClick={() => openDrillDown('weightedHires', 'Weighted Hires', overview.totalWeightedHires.toFixed(1))}
          />
        </div>
        <div className="col-6 col-md-2">
          <KPICard
            title="Offers"
            value={filteredStats ? filteredStats.offers : overview.totalOffers}
            contextTotal={filteredStats ? overview.totalOffers : undefined}
            priorPeriod={!filteredStats && overview.priorPeriod ? {
              value: overview.priorPeriod.offers,
              label: overview.priorPeriod.label
            } : undefined}
            onClick={() => openDrillDown('offers', 'Offers Extended', overview.totalOffers)}
          />
        </div>
        <div className="col-6 col-md-2">
          <KPICard
            title="Offer Accept Rate"
            value={overview.totalOfferAcceptanceRate !== null
              ? `${(overview.totalOfferAcceptanceRate * 100).toFixed(0)}%`
              : 'N/A'}
          />
        </div>
        <div className="col-6 col-md-2">
          <KPICard
            title="Median TTF"
            value={overview.medianTTF !== null ? `${overview.medianTTF}d` : 'N/A'}
            subtitle="days"
          />
        </div>
        <div className="col-6 col-md-2">
          <KPICard
            title="Stalled Reqs"
            value={filteredStats ? filteredStats.stalled : overview.stalledReqCount}
            contextTotal={filteredStats ? overview.stalledReqCount : undefined}
            subtitle="no activity 14+ days"
          />
        </div>
      </div>

      {/* Trends Charts */}
      <div className="row g-4 mb-4">
        <div className="col-12 col-md-6">
          <div className={`card-bespoke h-100 ${isFiltered ? 'border-primary border-opacity-25' : ''}`}>
            <div className="card-header d-flex justify-content-between align-items-center">
              <h6 className="mb-0">Weekly Hires & Offers</h6>
              {isFiltered && <span className="badge-bespoke badge-primary-soft small">Filtered</span>}
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={chartHeight}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="week" fontSize={12} stroke="#64748b" />
                  <YAxis fontSize={12} stroke="#64748b" />
                  <Tooltip />
                  <Legend />
                  {/* Team totals as lighter background */}
                  <Area
                    type="monotone"
                    dataKey="hires"
                    fill="#059669"
                    fillOpacity={isFiltered ? 0.15 : 0.3}
                    stroke="#059669"
                    strokeWidth={isFiltered ? 1 : 2.5}
                    strokeOpacity={isFiltered ? 0.3 : 1}
                    name={isFiltered ? 'Team Hires' : 'Hires'}
                  />
                  <Area
                    type="monotone"
                    dataKey="offers"
                    fill="#6366f1"
                    fillOpacity={isFiltered ? 0.15 : 0.3}
                    stroke="#6366f1"
                    strokeWidth={isFiltered ? 1 : 2.5}
                    strokeOpacity={isFiltered ? 0.3 : 1}
                    name={isFiltered ? 'Team Offers' : 'Offers'}
                  />
                  {/* Selected recruiters as solid lines (only when filtered) */}
                  {isFiltered && (
                    <>
                      <Line
                        type="monotone"
                        dataKey="selectedHires"
                        stroke="#059669"
                        strokeWidth={3}
                        name="Selected Hires"
                        dot={{ fill: '#059669', strokeWidth: 0, r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="selectedOffers"
                        stroke="#6366f1"
                        strokeWidth={3}
                        name="Selected Offers"
                        dot={{ fill: '#6366f1', strokeWidth: 0, r: 4 }}
                      />
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-6">
          <div className={`card-bespoke h-100 ${isFiltered ? 'border-primary border-opacity-25' : ''}`}>
            <div className="card-header d-flex justify-content-between align-items-center">
              <h6 className="mb-0">Weekly Outreach</h6>
              {isFiltered && <span className="badge-bespoke badge-primary-soft small">Filtered</span>}
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="week" fontSize={12} stroke="#64748b" />
                  <YAxis fontSize={12} stroke="#64748b" />
                  <Tooltip />
                  <Legend />
                  {isFiltered ? (
                    <>
                      <Bar dataKey="teamOutreach" fill="#0f766e" fillOpacity={0.25} stackId="a" name="Team (Other)" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="selectedOutreach" fill="#0f766e" stackId="a" name="Selected" radius={[4, 4, 0, 0]} />
                    </>
                  ) : (
                    <Bar dataKey="outreach" fill="#0f766e" name="Outreach Sent" radius={[4, 4, 0, 0]} />
                  )}
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
              <span className="badge-bespoke badge-primary-soft">{selectedRecruiterIds.size} selected</span>
            )}
          </div>
          <div className="d-flex gap-2">
            {selectedRecruiterIds.size > 0 && (
              <>
                {selectedRecruiterIds.size === 1 && (
                  <button className="btn btn-bespoke-primary btn-sm" onClick={handleViewSelected}>
                    View Details
                  </button>
                )}
                <button className="btn btn-bespoke-secondary btn-sm" onClick={clearSelection}>
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
          <BespokeTable<RecruiterSummary>
            columns={[
              {
                key: 'recruiterName',
                header: 'Recruiter',
                width: '140px',
                render: (r) => (
                  <div>
                    <div className="cell-primary text-truncate" style={{ maxWidth: '130px' }} title={r.recruiterName}>{r.recruiterName}</div>
                    {r.team && <small className="cell-muted cell-small">{r.team}</small>}
                  </div>
                )
              },
              { key: 'hires', header: 'Hires', align: 'right', sortable: true, width: '55px', render: (r) => r.outcomes.hires },
              { key: 'weighted', header: 'Wtd', align: 'right', sortable: true, width: '50px', render: (r) => r.weighted.weightedHires.toFixed(1) },
              { key: 'offers', header: 'Offers', align: 'right', sortable: true, width: '55px', render: (r) => r.outcomes.offersExtended },
              { key: 'accept', header: 'Acc%', align: 'right', sortable: true, width: '50px', render: (r) => r.outcomes.offerAcceptanceRate !== null ? `${(r.outcomes.offerAcceptanceRate * 100).toFixed(0)}%` : '—' },
              { key: 'openReqs', header: 'Open', align: 'right', sortable: true, width: '50px', render: (r) => r.aging.openReqCount },
              {
                key: 'stalled',
                header: 'Stall',
                align: 'right',
                sortable: true,
                width: '50px',
                render: (r) => r.aging.stalledReqs.count > 0
                  ? <span className="badge-bespoke badge-warning-soft">{r.aging.stalledReqs.count}</span>
                  : <span className="cell-muted">{r.aging.stalledReqs.count}</span>
              },
              { key: 'outreach', header: 'Out', align: 'right', sortable: true, width: '50px', cellClass: 'cell-muted', render: (r) => r.executionVolume.outreachSent },
              { key: 'screens', header: 'Scr', align: 'right', sortable: true, width: '45px', cellClass: 'cell-muted', render: (r) => r.executionVolume.screensCompleted },
              { key: 'submittals', header: 'Sub', align: 'right', sortable: true, width: '45px', cellClass: 'cell-muted', render: (r) => r.executionVolume.submittalsToHM },
              {
                key: 'productivity',
                header: 'Prod',
                align: 'right',
                sortable: true,
                width: '60px',
                render: (r) => <span className="badge-bespoke badge-accent-soft">{r.productivityIndex.toFixed(2)}</span>
              }
            ]}
            data={sortedRecruiters}
            keyExtractor={(r) => r.recruiterId}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
            onRowClick={(r) => toggleRecruiterSelection(r.recruiterId)}
            selectable={true}
            selectedKeys={selectedRecruiterIds}
            onSelectionChange={setSelectedRecruiterIds}
            emptyState={
              <div>
                <div className="empty-state-icon">👥</div>
                <div>No recruiters found</div>
              </div>
            }
          />
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
