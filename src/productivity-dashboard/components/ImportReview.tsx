// Import Review Component
// Shows diagnostics about the most recent data import

import React, { useState, useEffect } from 'react';
import { useDashboard } from '../hooks/useDashboardContext';
import {
  ImportDiagnostics,
  EntityDiagnostics,
  ColumnMapping,
  loadDiagnostics,
  createDiagnosticsSummary,
  analyzeImportData,
  saveDiagnostics,
} from '../services/importDiagnosticsService';

interface ImportReviewProps {
  onClose: () => void;
}

export function ImportReview({ onClose }: ImportReviewProps) {
  const { state } = useDashboard();
  const [diagnostics, setDiagnostics] = useState<ImportDiagnostics | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'requisitions' | 'candidates' | 'events' | 'users'>('overview');

  useEffect(() => {
    // Try to load saved diagnostics first
    let diag = loadDiagnostics();

    // If no saved diagnostics but we have data, generate live diagnostics
    if (!diag && state.dataStore.requisitions.length > 0) {
      diag = generateLiveDiagnostics();
      if (diag) {
        saveDiagnostics(diag);
      }
    }

    setDiagnostics(diag);
  }, [state.dataStore]);

  const generateLiveDiagnostics = (): ImportDiagnostics | null => {
    const { requisitions, candidates, events, users } = state.dataStore;

    if (requisitions.length === 0) return null;

    // Analyze current data
    const reqDiag = analyzeCurrentData(requisitions, 'requisitions');
    const candDiag = analyzeCurrentData(candidates, 'candidates');
    const eventDiag = analyzeCurrentData(events, 'events');
    const userDiag = analyzeCurrentData(users, 'users');

    return {
      importedAt: state.dataStore.lastImportAt || new Date(),
      requisitions: reqDiag,
      candidates: candDiag,
      events: eventDiag,
      users: userDiag,
      overallHealth: {
        totalRecords: requisitions.length + candidates.length + events.length + users.length,
        totalMappedColumns: 0,
        totalUnmappedColumns: 0,
        criticalMissing: [],
      },
    };
  };

  const analyzeCurrentData = (data: any[], entityType: string): EntityDiagnostics | null => {
    if (!data || data.length === 0) return null;

    // Analyze the parsed data to see field coverage
    const fieldCoverage: Record<string, { filled: number; total: number; coverage: number }> = {};
    const sampleRow = data[0];

    for (const key of Object.keys(sampleRow)) {
      let filledCount = 0;
      for (const row of data) {
        const value = row[key];
        if (value !== null && value !== undefined && value !== '') {
          filledCount++;
        }
      }
      fieldCoverage[key] = {
        filled: filledCount,
        total: data.length,
        coverage: (filledCount / data.length) * 100,
      };
    }

    return {
      entityType: entityType as any,
      rowCount: data.length,
      columnMappings: Object.keys(sampleRow).map(key => ({
        originalName: key,
        normalizedName: key,
        mappedTo: key,
        sampleValues: data.slice(0, 3).map(r => String(r[key] || '').slice(0, 30)),
        nonEmptyCount: fieldCoverage[key]?.filled || 0,
        totalCount: data.length,
        coverage: fieldCoverage[key]?.coverage || 0,
      })),
      mappedColumns: Object.keys(sampleRow),
      unmappedColumns: [],
      missingIdealColumns: [],
      synthesizedIds: 0,
      fieldCoverage,
    };
  };

  if (!diagnostics) {
    return (
      <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
        <div className="modal-dialog modal-xl modal-dialog-centered">
          <div className="modal-content glass-panel">
            <div className="modal-header border-secondary">
              <h5 className="modal-title">Import Review</h5>
              <button type="button" className="btn-close btn-close-white" onClick={onClose} />
            </div>
            <div className="modal-body text-center py-5">
              <p className="text-muted">No import data available.</p>
              <p className="small">Import some data first to see diagnostics.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const summary = createDiagnosticsSummary(diagnostics);

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
      <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content glass-panel" style={{ maxHeight: '90vh' }}>
          <div className="modal-header border-secondary">
            <h5 className="modal-title">Import Review & Field Mapping</h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose} />
          </div>

          {/* Tabs */}
          <div className="border-bottom border-secondary">
            <ul className="nav nav-tabs border-0 px-3">
              <li className="nav-item">
                <button
                  className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`}
                  onClick={() => setActiveTab('overview')}
                  style={{ color: activeTab === 'overview' ? '#d4a373' : '#94a3b8' }}
                >
                  Overview
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link ${activeTab === 'requisitions' ? 'active' : ''}`}
                  onClick={() => setActiveTab('requisitions')}
                  style={{ color: activeTab === 'requisitions' ? '#d4a373' : '#94a3b8' }}
                >
                  Requisitions ({diagnostics.requisitions?.rowCount || 0})
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link ${activeTab === 'candidates' ? 'active' : ''}`}
                  onClick={() => setActiveTab('candidates')}
                  style={{ color: activeTab === 'candidates' ? '#d4a373' : '#94a3b8' }}
                >
                  Candidates ({diagnostics.candidates?.rowCount || 0})
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link ${activeTab === 'events' ? 'active' : ''}`}
                  onClick={() => setActiveTab('events')}
                  style={{ color: activeTab === 'events' ? '#d4a373' : '#94a3b8' }}
                >
                  Events ({diagnostics.events?.rowCount || 0})
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link ${activeTab === 'users' ? 'active' : ''}`}
                  onClick={() => setActiveTab('users')}
                  style={{ color: activeTab === 'users' ? '#d4a373' : '#94a3b8' }}
                >
                  Users ({diagnostics.users?.rowCount || 0})
                </button>
              </li>
            </ul>
          </div>

          <div className="modal-body" style={{ overflowY: 'auto' }}>
            {activeTab === 'overview' && (
              <OverviewTab diagnostics={diagnostics} summary={summary} />
            )}
            {activeTab === 'requisitions' && diagnostics.requisitions && (
              <EntityTab entity={diagnostics.requisitions} />
            )}
            {activeTab === 'candidates' && diagnostics.candidates && (
              <EntityTab entity={diagnostics.candidates} />
            )}
            {activeTab === 'events' && diagnostics.events && (
              <EntityTab entity={diagnostics.events} />
            )}
            {activeTab === 'users' && diagnostics.users && (
              <EntityTab entity={diagnostics.users} />
            )}
          </div>

          <div className="modal-footer border-secondary">
            <button className="btn btn-outline-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ diagnostics, summary }: { diagnostics: ImportDiagnostics; summary: ReturnType<typeof createDiagnosticsSummary> }) {
  return (
    <div>
      {/* Health Score */}
      <div className="row mb-4">
        <div className="col-md-4">
          <div className="glass-panel p-4 text-center">
            <div className="stat-label">IMPORT HEALTH SCORE</div>
            <div
              className="stat-value"
              style={{
                color: summary.score >= 80 ? '#10b981' : summary.score >= 50 ? '#f59e0b' : '#ef4444',
              }}
            >
              {summary.score}
            </div>
            <div className="small text-muted">out of 100</div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="glass-panel p-4 text-center">
            <div className="stat-label">TOTAL RECORDS</div>
            <div className="stat-value">{diagnostics.overallHealth.totalRecords.toLocaleString()}</div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="glass-panel p-4 text-center">
            <div className="stat-label">IMPORTED AT</div>
            <div className="small mt-2">
              {diagnostics.importedAt?.toLocaleString() || 'Unknown'}
            </div>
          </div>
        </div>
      </div>

      {/* Issues */}
      {summary.issues.length > 0 && (
        <div className="alert alert-danger mb-3">
          <strong>Critical Issues:</strong>
          <ul className="mb-0 mt-2">
            {summary.issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {summary.warnings.length > 0 && (
        <div className="alert alert-warning mb-3">
          <strong>Warnings:</strong>
          <ul className="mb-0 mt-2">
            {summary.warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Per-Entity Summary */}
      <h6 className="text-muted mb-3">Data by Entity</h6>
      <div className="row g-3">
        <EntitySummaryCard entity={diagnostics.requisitions} name="Requisitions" />
        <EntitySummaryCard entity={diagnostics.candidates} name="Candidates" />
        <EntitySummaryCard entity={diagnostics.events} name="Events" />
        <EntitySummaryCard entity={diagnostics.users} name="Users" />
      </div>
    </div>
  );
}

function EntitySummaryCard({ entity, name }: { entity: EntityDiagnostics | null; name: string }) {
  if (!entity) {
    return (
      <div className="col-md-3">
        <div className="glass-panel p-3">
          <h6>{name}</h6>
          <div className="text-muted small">No data</div>
        </div>
      </div>
    );
  }

  return (
    <div className="col-md-3">
      <div className="glass-panel p-3">
        <h6>{name}</h6>
        <div className="small">
          <div><strong>{entity.rowCount.toLocaleString()}</strong> rows</div>
          <div className="text-success">{entity.mappedColumns.length} fields mapped</div>
          {entity.unmappedColumns.length > 0 && (
            <div className="text-warning">{entity.unmappedColumns.length} unmapped</div>
          )}
          {entity.missingIdealColumns.length > 0 && (
            <div className="text-danger">{entity.missingIdealColumns.length} missing ideal</div>
          )}
        </div>
      </div>
    </div>
  );
}

function EntityTab({ entity }: { entity: EntityDiagnostics }) {
  const [showUnmapped, setShowUnmapped] = useState(false);

  return (
    <div>
      {/* Summary */}
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="glass-panel p-3 text-center">
            <div className="stat-label">ROWS</div>
            <div className="h4 mb-0">{entity.rowCount.toLocaleString()}</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="glass-panel p-3 text-center">
            <div className="stat-label">MAPPED COLUMNS</div>
            <div className="h4 mb-0 text-success">{entity.mappedColumns.length}</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="glass-panel p-3 text-center">
            <div className="stat-label">UNMAPPED</div>
            <div className="h4 mb-0 text-warning">{entity.unmappedColumns.length}</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="glass-panel p-3 text-center">
            <div className="stat-label">SYNTHESIZED IDS</div>
            <div className="h4 mb-0 text-info">{entity.synthesizedIds}</div>
          </div>
        </div>
      </div>

      {/* Missing Ideal Columns */}
      {entity.missingIdealColumns.length > 0 && (
        <div className="alert alert-warning mb-4">
          <strong>Missing Recommended Columns:</strong> {entity.missingIdealColumns.join(', ')}
          <div className="small mt-1">
            These columns would enable more features. Check if your data has similar columns under different names.
          </div>
        </div>
      )}

      {/* Toggle for unmapped columns */}
      <div className="mb-3">
        <button
          className="btn btn-sm btn-outline-secondary"
          onClick={() => setShowUnmapped(!showUnmapped)}
        >
          {showUnmapped ? 'Show Mapped Only' : `Show All (including ${entity.unmappedColumns.length} unmapped)`}
        </button>
      </div>

      {/* Column Mapping Table */}
      <div className="table-responsive">
        <table className="table table-dark table-sm">
          <thead>
            <tr>
              <th>Original Column</th>
              <th>Maps To</th>
              <th>Coverage</th>
              <th>Sample Values</th>
            </tr>
          </thead>
          <tbody>
            {entity.columnMappings
              .filter(cm => showUnmapped || cm.mappedTo)
              .sort((a, b) => {
                // Sort mapped first, then by coverage
                if (a.mappedTo && !b.mappedTo) return -1;
                if (!a.mappedTo && b.mappedTo) return 1;
                return b.coverage - a.coverage;
              })
              .map((cm, i) => (
                <tr key={i} className={cm.mappedTo ? '' : 'table-secondary'}>
                  <td>
                    <code className="small">{cm.originalName}</code>
                  </td>
                  <td>
                    {cm.mappedTo ? (
                      <span className="badge bg-success">{cm.mappedTo}</span>
                    ) : (
                      <span className="badge bg-secondary">unmapped</span>
                    )}
                  </td>
                  <td>
                    <div className="progress" style={{ width: 100, height: 8 }}>
                      <div
                        className={`progress-bar ${cm.coverage > 80 ? 'bg-success' : cm.coverage > 50 ? 'bg-warning' : 'bg-danger'}`}
                        style={{ width: `${cm.coverage}%` }}
                      />
                    </div>
                    <span className="small text-muted ms-2">{cm.coverage.toFixed(0)}%</span>
                  </td>
                  <td>
                    <span className="small text-muted">
                      {cm.sampleValues.slice(0, 2).join(', ') || '(empty)'}
                    </span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Field Coverage */}
      <h6 className="mt-4 mb-3">Field Coverage</h6>
      <div className="row g-2">
        {Object.entries(entity.fieldCoverage)
          .sort(([, a], [, b]) => b.coverage - a.coverage)
          .slice(0, 12)
          .map(([field, stats]) => (
            <div key={field} className="col-md-4 col-lg-3">
              <div className="d-flex align-items-center gap-2">
                <div className="progress flex-grow-1" style={{ height: 6 }}>
                  <div
                    className={`progress-bar ${stats.coverage > 80 ? 'bg-success' : stats.coverage > 50 ? 'bg-warning' : 'bg-danger'}`}
                    style={{ width: `${stats.coverage}%` }}
                  />
                </div>
                <code className="small" style={{ minWidth: 100 }}>{field}</code>
                <span className="small text-muted">{stats.coverage.toFixed(0)}%</span>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

export default ImportReview;
