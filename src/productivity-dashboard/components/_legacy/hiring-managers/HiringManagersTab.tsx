// Hiring Managers Tab Component
// Main container for all HM-focused features with sub-navigation

import React, { useState, useMemo } from 'react';
import { Requisition, Candidate, Event, User } from '../../../types/entities';
import { MetricFilters } from '../../../types';
import {
    HMFactTables,
    HMReqRollup,
    HMRollup,
    HMPendingAction
} from '../../../types/hmTypes';
import { StageMappingConfig } from '../../../types/config';
import { buildHMFactTables } from '../../../services/hmFactTables';
import { buildHMReqRollups, buildHMRollupsWithBenchmarks, calculatePendingActions } from '../../../services/hmMetricsEngine';
import { DEFAULT_HM_RULES } from '../../../config/hmRules';
import { HMOverview } from './HMOverview';
import { HMScorecard } from './HMScorecard';
import { HMActionQueue } from './HMActionQueue';
import { HMForecastsTab } from './HMForecastsTab';
import { FilterActiveIndicator } from '../../common/FilterActiveIndicator';
import { HelpButton, HelpDrawer } from '../../common';
import { hasActiveDimensionalFilters } from '../../../services/filterUtils';
import { PageHeader } from '../layout';
import { HM_SCORECARD_PAGE_HELP } from './hiringManagersHelpContent';

interface HiringManagersTabProps {
    requisitions: Requisition[];
    candidates: Candidate[];
    events: Event[];
    users: User[];
    stageMappingConfig: StageMappingConfig;
    lastImportAt: Date | null;
    filters?: MetricFilters;
}

type HMSubTab = 'overview' | 'scorecard' | 'actions' | 'forecasts';

export function HiringManagersTab({
    requisitions,
    candidates,
    events,
    users,
    stageMappingConfig,
    lastImportAt,
    filters
}: HiringManagersTabProps) {
    const [showPageHelp, setShowPageHelp] = useState(false);
    const [activeSubTab, setActiveSubTab] = useState<HMSubTab>('overview');
    // Multi-select: track selected HM IDs as a Set (Local specific comparison)
    const [selectedHmUserIds, setSelectedHmUserIds] = useState<Set<string>>(new Set());

    // Build fact tables and metrics
    const asOfDate = lastImportAt ?? new Date();

    // 1. FILTER REQUISITIONS based on global filters
    const filteredGlobalReqs = useMemo(() => {
        if (!filters) return requisitions;

        const { dateRange, functions, jobFamilies, levels, regions, recruiterIds, hiringManagerIds } = filters;

        return requisitions.filter(req => {
            // Date Range: Req must be active during the window
            // STRICT: skip reqs without opened_at
            if (!req.opened_at) return false;
            const openedAt = new Date(req.opened_at);
            const closedAt = req.closed_at ? new Date(req.closed_at) : null;

            const isOpenInRange =
                openedAt <= dateRange.endDate &&
                (!closedAt || closedAt >= dateRange.startDate);

            if (!isOpenInRange) return false;

            // Dimensional Filters
            if (functions && functions.length > 0 && !functions.includes(String(req.function))) return false;
            // Note: job_family string mapping
            if (jobFamilies && jobFamilies.length > 0 && !jobFamilies.includes(req.job_family)) return false;
            if (levels && levels.length > 0 && !levels.includes(req.level)) return false;
            if (regions && regions.length > 0 && !regions.includes(req.location_region)) return false;
            if (recruiterIds && recruiterIds.length > 0 && !recruiterIds.includes(req.recruiter_id)) return false;
            if (hiringManagerIds && hiringManagerIds.length > 0 && !hiringManagerIds.includes(req.hiring_manager_id)) return false;

            return true;
        });
    }, [requisitions, filters]);

    // 2. FILTER CANDIDATES to those on filtered reqs
    const filteredCandidates = useMemo(() => {
        const filteredReqIds = new Set(filteredGlobalReqs.map(r => r.req_id));
        return candidates.filter(c => filteredReqIds.has(c.req_id));
    }, [candidates, filteredGlobalReqs]);

    // 3. FILTER EVENTS to date range and filtered reqs
    const filteredEvents = useMemo(() => {
        if (!filters?.dateRange) return events;

        const { startDate, endDate } = filters.dateRange;
        const filteredReqIds = new Set(filteredGlobalReqs.map(r => r.req_id));

        return events.filter(e => {
            // Event must be for a filtered req
            if (!filteredReqIds.has(e.req_id)) return false;

            // Event must be within date range
            const eventDate = new Date(e.event_at);
            return eventDate >= startDate && eventDate <= endDate;
        });
    }, [events, filters?.dateRange, filteredGlobalReqs]);

    // Build Fact Tables using FILTERED reqs, candidates, and events
    const factTables: HMFactTables = useMemo(() => {
        return buildHMFactTables(
            filteredGlobalReqs,
            filteredCandidates,
            filteredEvents,
            users,
            stageMappingConfig,
            asOfDate
        );
    }, [filteredGlobalReqs, filteredCandidates, filteredEvents, users, stageMappingConfig, asOfDate]);

    const reqRollups: HMReqRollup[] = useMemo(() => {
        return buildHMReqRollups(factTables, users, DEFAULT_HM_RULES);
    }, [factTables, users]);

    const hmRollups: HMRollup[] = useMemo(() => {
        return buildHMRollupsWithBenchmarks(factTables, users, reqRollups, DEFAULT_HM_RULES);
    }, [factTables, users, reqRollups]);

    const pendingActions: HMPendingAction[] = useMemo(() => {
        return calculatePendingActions(factTables, users, DEFAULT_HM_RULES);
    }, [factTables, users]);

    // Filter rollups by LOCAL selection if any
    const filteredReqRollups = useMemo(() => {
        let result = reqRollups;
        if (selectedHmUserIds.size > 0) {
            result = result.filter(r => selectedHmUserIds.has(r.hmUserId));
        }
        return result;
    }, [reqRollups, selectedHmUserIds]);

    // Filter actions by LOCAL selection
    const filteredActions = useMemo(() => {
        let result = pendingActions;
        if (selectedHmUserIds.size > 0) {
            result = result.filter(a => selectedHmUserIds.has(a.hmUserId));
        }
        return result;
    }, [pendingActions, selectedHmUserIds]);

    // Calculate days since import
    const daysSinceImport = lastImportAt
        ? Math.floor((new Date().getTime() - lastImportAt.getTime()) / (1000 * 60 * 60 * 24))
        : null;

    // Toggle HM selection
    const toggleHmSelection = (hmUserId: string) => {
        setSelectedHmUserIds(prev => {
            const next = new Set(prev);
            if (next.has(hmUserId)) {
                next.delete(hmUserId);
            } else {
                next.add(hmUserId);
            }
            return next;
        });
    };

    // Clear all selections
    const clearSelection = () => {
        setSelectedHmUserIds(new Set());
    };

    // Get selected HM names for display
    const selectedHmNames = useMemo(() => {
        return hmRollups
            .filter(h => selectedHmUserIds.has(h.hmUserId))
            .map(h => h.hmName);
    }, [hmRollups, selectedHmUserIds]);

    return (
        <div className="animate-fade-in">
            {/* Page Header */}
            <PageHeader
                title="HM Scorecard"
                description="Track hiring manager performance and manage action queues"
                actions={<HelpButton onClick={() => setShowPageHelp(true)} ariaLabel="Open page help" />}
            />
            <HelpDrawer
                isOpen={showPageHelp}
                onClose={() => setShowPageHelp(false)}
                title="HM Scorecard"
                content={HM_SCORECARD_PAGE_HELP}
            />

            {/* Filter Active Indicator */}
            {filters && (
                <FilterActiveIndicator
                    filters={filters}
                    totalCount={requisitions.length}
                    filteredCount={filteredGlobalReqs.length}
                    itemLabel="requisitions"
                />
            )}

            {/* Header & Sub-Navigation */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
                <div className="nav-pills-bespoke">
                    <button
                        className={`nav-link ${activeSubTab === 'overview' ? 'active' : ''}`}
                        onClick={() => setActiveSubTab('overview')}
                    >
                        Overview
                        <span className="inline-flex items-center px-2 py-0.5 ml-2 bg-slate-200 text-slate-600 rounded-full text-xs">{hmRollups.length}</span>
                    </button>
                    <button
                        className={`nav-link ${activeSubTab === 'scorecard' ? 'active' : ''}`}
                        onClick={() => setActiveSubTab('scorecard')}
                    >
                        Req Scorecard
                        <span className="inline-flex items-center px-2 py-0.5 ml-2 bg-slate-200 text-slate-600 rounded-full text-xs">
                            {selectedHmUserIds.size > 0 ? filteredReqRollups.length : reqRollups.length}
                        </span>
                    </button>
                    <button
                        className={`nav-link ${activeSubTab === 'actions' ? 'active' : ''}`}
                        onClick={() => setActiveSubTab('actions')}
                    >
                        Pending Actions
                        {filteredActions.length > 0 && (
                            <span className="inline-flex items-center px-2 py-0.5 ml-2 bg-amber-500 text-black rounded-full text-xs font-medium">{filteredActions.length}</span>
                        )}
                    </button>
                    <button
                        className={`nav-link ${activeSubTab === 'forecasts' ? 'active' : ''}`}
                        onClick={() => setActiveSubTab('forecasts')}
                    >
                        Forecasts
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    {/* Selected HMs Indicator (Multi-select) */}
                    {selectedHmUserIds.size > 0 && (
                        <div className="flex items-center px-3 py-1 rounded-full" style={{ background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <span className="text-sm mr-2" style={{ color: '#94A3B8' }}>Comparing:</span>
                            <span className="font-bold mr-2" style={{ color: '#F8FAFC' }}>
                                {selectedHmUserIds.size === 1
                                    ? selectedHmNames[0]
                                    : `${selectedHmUserIds.size} HMs`}
                            </span>
                            <button
                                className="p-0 text-muted-foreground hover:text-white transition-colors"
                                onClick={clearSelection}
                                title="Clear selection"
                            >
                                <i className="bi bi-x-circle-fill"></i>
                            </button>
                        </div>
                    )}

                    {/* As-of Date */}
                    <div
                        className="px-3 py-1 rounded-full text-right flex flex-col justify-center"
                        style={{
                            height: '38px',
                            background: daysSinceImport !== null && daysSinceImport > 3
                                ? 'rgba(251, 191, 36, 0.15)'
                                : 'rgba(45, 212, 191, 0.15)',
                            border: `1px solid ${daysSinceImport !== null && daysSinceImport > 3
                                ? 'rgba(251, 191, 36, 0.3)'
                                : 'rgba(45, 212, 191, 0.3)'}`,
                            color: daysSinceImport !== null && daysSinceImport > 3
                                ? '#fbbf24'
                                : '#2dd4bf'
                        }}
                    >
                        <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', fontWeight: 700, lineHeight: 1, marginBottom: '2px', opacity: 0.8 }}>Data Refresh</div>
                        <div className="font-bold text-sm flex items-center justify-end gap-1" style={{ lineHeight: 1 }}>
                            {lastImportAt ? lastImportAt.toLocaleDateString() : 'Unknown'}
                            {daysSinceImport !== null && daysSinceImport <= 3 && <i className="bi bi-check-circle-fill ml-1" style={{ fontSize: '0.8em' }}></i>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab Content */}
            {activeSubTab === 'overview' && (
                <HMOverview
                    hmRollups={hmRollups}
                    onToggleHM={toggleHmSelection}
                    selectedHmUserIds={selectedHmUserIds}
                    onClearSelection={clearSelection}
                />
            )}

            {activeSubTab === 'scorecard' && (
                <HMScorecard
                    reqRollups={filteredReqRollups}
                    selectedHmUserIds={selectedHmUserIds}
                    onSelectReq={(reqId) => console.log('Selected req:', reqId)}
                />
            )}

            {activeSubTab === 'actions' && (
                <HMActionQueue
                    actions={filteredActions}
                    selectedHmUserIds={selectedHmUserIds}
                />
            )}

            {activeSubTab === 'forecasts' && (
                <HMForecastsTab
                    reqRollups={filteredReqRollups}
                />
            )}
        </div>
    );
}

export default HiringManagersTab;
