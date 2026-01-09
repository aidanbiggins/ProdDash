// Hiring Managers Tab Component
// Main container for all HM-focused features with sub-navigation

import React, { useState, useMemo, useEffect } from 'react';
import { Requisition, Candidate, Event, User } from '../../types/entities';
import {
    HMFactTables,
    HMReqRollup,
    HMRollup,
    HMPendingAction,
    HMFilterState
} from '../../types/hmTypes';
import { StageMappingConfig } from '../../types/config';
import { buildHMFactTables } from '../../services/hmFactTables';
import { buildHMReqRollups, buildHMRollups, calculatePendingActions } from '../../services/hmMetricsEngine';
import { DEFAULT_HM_RULES } from '../../config/hmRules';
import { HMOverview } from './HMOverview';
import { HMScorecard } from './HMScorecard';
import { HMActionQueue } from './HMActionQueue';

interface HiringManagersTabProps {
    requisitions: Requisition[];
    candidates: Candidate[];
    events: Event[];
    users: User[];
    stageMappingConfig: StageMappingConfig;
    lastImportAt: Date | null;
}

type HMSubTab = 'overview' | 'scorecard' | 'actions';

export function HiringManagersTab({
    requisitions,
    candidates,
    events,
    users,
    stageMappingConfig,
    lastImportAt
}: HiringManagersTabProps) {
    const [activeSubTab, setActiveSubTab] = useState<HMSubTab>('overview');
    const [selectedHmUserId, setSelectedHmUserId] = useState<string | null>(null);

    // Build fact tables and metrics
    const asOfDate = lastImportAt ?? new Date();

    const factTables: HMFactTables = useMemo(() => {
        return buildHMFactTables(
            requisitions,
            candidates,
            events,
            users,
            stageMappingConfig,
            asOfDate
        );
    }, [requisitions, candidates, events, users, stageMappingConfig, asOfDate]);

    const reqRollups: HMReqRollup[] = useMemo(() => {
        return buildHMReqRollups(factTables, users, DEFAULT_HM_RULES);
    }, [factTables, users]);

    const hmRollups: HMRollup[] = useMemo(() => {
        return buildHMRollups(factTables, users, reqRollups, DEFAULT_HM_RULES);
    }, [factTables, users, reqRollups]);

    const pendingActions: HMPendingAction[] = useMemo(() => {
        return calculatePendingActions(factTables, users, DEFAULT_HM_RULES);
    }, [factTables, users]);

    // Filter actions by selected HM
    const filteredActions = useMemo(() => {
        if (!selectedHmUserId) return pendingActions;
        return pendingActions.filter(a => a.hmUserId === selectedHmUserId);
    }, [pendingActions, selectedHmUserId]);

    // Calculate days since import
    const daysSinceImport = lastImportAt
        ? Math.floor((new Date().getTime() - lastImportAt.getTime()) / (1000 * 60 * 60 * 24))
        : null;

    return (
        <div className="p-3">
            {/* As-of Banner */}
            <div className={`alert ${daysSinceImport && daysSinceImport > 3 ? 'alert-warning' : 'alert-info'} d-flex justify-content-between align-items-center mb-3`}>
                <div>
                    <strong>Data as of:</strong>{' '}
                    {lastImportAt ? lastImportAt.toLocaleDateString() + ' ' + lastImportAt.toLocaleTimeString() : 'Unknown'}
                    {daysSinceImport !== null && daysSinceImport > 3 && (
                        <span className="ms-2 text-warning">
                            ⚠️ Data is {daysSinceImport} days old
                        </span>
                    )}
                </div>
                <small className="text-muted">
                    {requisitions.length} reqs • {candidates.length} candidates • {users.length} users
                </small>
            </div>

            {/* Sub-Navigation */}
            <ul className="nav nav-tabs mb-3">
                <li className="nav-item">
                    <button
                        className={`nav-link ${activeSubTab === 'overview' ? 'active' : ''}`}
                        onClick={() => setActiveSubTab('overview')}
                    >
                        Overview
                        <span className="badge bg-secondary ms-2">{hmRollups.length} HMs</span>
                    </button>
                </li>
                <li className="nav-item">
                    <button
                        className={`nav-link ${activeSubTab === 'scorecard' ? 'active' : ''}`}
                        onClick={() => setActiveSubTab('scorecard')}
                    >
                        Req Scorecard
                        <span className="badge bg-secondary ms-2">{reqRollups.length}</span>
                    </button>
                </li>
                <li className="nav-item">
                    <button
                        className={`nav-link ${activeSubTab === 'actions' ? 'active' : ''}`}
                        onClick={() => setActiveSubTab('actions')}
                    >
                        Pending Actions
                        {pendingActions.length > 0 && (
                            <span className="badge bg-warning ms-2">{pendingActions.length}</span>
                        )}
                    </button>
                </li>
            </ul>

            {/* Selected HM Indicator */}
            {selectedHmUserId && (
                <div className="alert alert-primary d-flex justify-content-between align-items-center mb-3">
                    <span>
                        Viewing data for: <strong>{hmRollups.find(h => h.hmUserId === selectedHmUserId)?.hmName ?? 'Unknown'}</strong>
                    </span>
                    <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => setSelectedHmUserId(null)}
                    >
                        View All HMs
                    </button>
                </div>
            )}

            {/* Tab Content */}
            {activeSubTab === 'overview' && (
                <HMOverview
                    hmRollups={hmRollups}
                    onSelectHM={setSelectedHmUserId}
                    selectedHmUserId={selectedHmUserId}
                />
            )}

            {activeSubTab === 'scorecard' && (
                <HMScorecard
                    reqRollups={reqRollups}
                    selectedHmUserId={selectedHmUserId}
                />
            )}

            {activeSubTab === 'actions' && (
                <HMActionQueue
                    actions={filteredActions}
                    selectedHmUserId={selectedHmUserId}
                />
            )}
        </div>
    );
}
