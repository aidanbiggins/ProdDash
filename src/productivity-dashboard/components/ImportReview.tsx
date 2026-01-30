// Import Review Component
// Shows diagnostics about the most recent data import

import React, { useState, useEffect } from 'react';
import { useDashboard } from '../hooks/useDashboardContext';
import {
  ImportDiagnostics,
  EntityDiagnostics,
  ImportColumnMapping,
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
        <div className="w-full max-w-5xl mx-4">
          <div className="bg-card border border-border rounded-lg shadow-lg">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h5 className="font-semibold text-foreground">Import Review</h5>
              <button type="button" className="text-muted-foreground hover:text-foreground" onClick={onClose}>&times;</button>
            </div>
            <div className="p-8 text-center">
              <p className="text-muted-foreground">No import data available.</p>
              <p className="text-sm text-muted-foreground">Import some data first to see diagnostics.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const summary = createDiagnosticsSummary(diagnostics);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-5xl mx-4 flex flex-col max-h-[90vh]">
        <div className="bg-card border border-border rounded-lg shadow-lg flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h5 className="font-semibold text-foreground">Import Review & Field Mapping</h5>
            <button type="button" className="text-muted-foreground hover:text-foreground" onClick={onClose}>&times;</button>
          </div>

          {/* Tabs */}
          <div className="border-b border-border px-3">
            <div className="flex gap-1">
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'overview' ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                onClick={() => setActiveTab('overview')}
              >
                Overview
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'requisitions' ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                onClick={() => setActiveTab('requisitions')}
              >
                Requisitions ({diagnostics.requisitions?.rowCount || 0})
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'candidates' ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                onClick={() => setActiveTab('candidates')}
              >
                Candidates ({diagnostics.candidates?.rowCount || 0})
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'events' ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                onClick={() => setActiveTab('events')}
              >
                Events ({diagnostics.events?.rowCount || 0})
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'users' ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                onClick={() => setActiveTab('users')}
              >
                Users ({diagnostics.users?.rowCount || 0})
              </button>
            </div>
          </div>

          <div className="p-4 overflow-y-auto flex-1">
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

          <div className="flex justify-end gap-2 p-4 border-t border-border">
            <button className="px-4 py-2 text-sm font-medium rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted" onClick={onClose}>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="glass-panel p-4 text-center">
          <div className="stat-label">IMPORT HEALTH SCORE</div>
          <div
            className={`stat-value ${summary.score >= 80 ? 'text-good' : summary.score >= 50 ? 'text-warn' : 'text-bad'}`}
          >
            {summary.score}
          </div>
          <div className="text-sm text-muted-foreground">out of 100</div>
        </div>
        <div className="glass-panel p-4 text-center">
          <div className="stat-label">TOTAL RECORDS</div>
          <div className="stat-value">{diagnostics.overallHealth.totalRecords.toLocaleString()}</div>
        </div>
        <div className="glass-panel p-4 text-center">
          <div className="stat-label">IMPORTED AT</div>
          <div className="text-sm mt-2 text-foreground">
            {diagnostics.importedAt?.toLocaleString() || 'Unknown'}
          </div>
        </div>
      </div>

      {/* Issues */}
      {summary.issues.length > 0 && (
        <div className="p-3 rounded-lg bg-bad/10 border border-bad/30 text-foreground mb-3">
          <strong className="text-bad">Critical Issues:</strong>
          <ul className="mb-0 mt-2 list-disc list-inside">
            {summary.issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {summary.warnings.length > 0 && (
        <div className="p-3 rounded-lg bg-warn/10 border border-warn/30 text-foreground mb-3">
          <strong className="text-warn">Warnings:</strong>
          <ul className="mb-0 mt-2 list-disc list-inside">
            {summary.warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Per-Entity Summary */}
      <h6 className="text-muted-foreground mb-3 font-semibold">Data by Entity</h6>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
      <div className="glass-panel p-3">
        <h6 className="font-semibold text-foreground">{name}</h6>
        <div className="text-muted-foreground text-sm">No data</div>
      </div>
    );
  }

  return (
    <div className="glass-panel p-3">
      <h6 className="font-semibold text-foreground">{name}</h6>
      <div className="text-sm">
        <div className="text-foreground"><strong>{entity.rowCount.toLocaleString()}</strong> rows</div>
        <div className="text-good">{entity.mappedColumns.length} fields mapped</div>
        {entity.unmappedColumns.length > 0 && (
          <div className="text-warn">{entity.unmappedColumns.length} unmapped</div>
        )}
        {entity.missingIdealColumns.length > 0 && (
          <div className="text-bad">{entity.missingIdealColumns.length} missing ideal</div>
        )}
      </div>
    </div>
  );
}

function EntityTab({ entity }: { entity: EntityDiagnostics }) {
  const [showUnmapped, setShowUnmapped] = useState(false);

  return (
    <div>
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="glass-panel p-3 text-center">
          <div className="stat-label">ROWS</div>
          <div className="text-2xl font-bold text-foreground">{entity.rowCount.toLocaleString()}</div>
        </div>
        <div className="glass-panel p-3 text-center">
          <div className="stat-label">MAPPED COLUMNS</div>
          <div className="text-2xl font-bold text-good">{entity.mappedColumns.length}</div>
        </div>
        <div className="glass-panel p-3 text-center">
          <div className="stat-label">UNMAPPED</div>
          <div className="text-2xl font-bold text-warn">{entity.unmappedColumns.length}</div>
        </div>
        <div className="glass-panel p-3 text-center">
          <div className="stat-label">SYNTHESIZED IDS</div>
          <div className="text-2xl font-bold text-accent">{entity.synthesizedIds}</div>
        </div>
      </div>

      {/* Missing Ideal Columns */}
      {entity.missingIdealColumns.length > 0 && (
        <div className="p-3 rounded-lg bg-warn/10 border border-warn/30 text-foreground mb-4">
          <strong className="text-warn">Missing Recommended Columns:</strong> {entity.missingIdealColumns.join(', ')}
          <div className="text-sm mt-1 text-muted-foreground">
            These columns would enable more features. Check if your data has similar columns under different names.
          </div>
        </div>
      )}

      {/* Toggle for unmapped columns */}
      <div className="mb-3">
        <button
          className="px-3 py-1.5 text-sm font-medium rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          onClick={() => setShowUnmapped(!showUnmapped)}
        >
          {showUnmapped ? 'Show Mapped Only' : `Show All (including ${entity.unmappedColumns.length} unmapped)`}
        </button>
      </div>

      {/* Column Mapping Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Original Column</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Maps To</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Coverage</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Sample Values</th>
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
                <tr key={i} className={`border-b border-border ${cm.mappedTo ? '' : 'bg-muted/50'}`}>
                  <td className="px-3 py-2">
                    <code className="text-xs text-accent">{cm.originalName}</code>
                  </td>
                  <td className="px-3 py-2">
                    {cm.mappedTo ? (
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-good text-white">{cm.mappedTo}</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-muted text-muted-foreground">unmapped</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-muted rounded overflow-hidden">
                        <div
                          className={`h-full ${cm.coverage > 80 ? 'bg-good' : cm.coverage > 50 ? 'bg-warn' : 'bg-bad'}`}
                          style={{ width: `${cm.coverage}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{cm.coverage.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-xs text-muted-foreground">
                      {cm.sampleValues.slice(0, 2).join(', ') || '(empty)'}
                    </span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Field Coverage */}
      <h6 className="mt-4 mb-3 font-semibold text-foreground">Field Coverage</h6>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {Object.entries(entity.fieldCoverage)
          .sort(([, a], [, b]) => b.coverage - a.coverage)
          .slice(0, 12)
          .map(([field, stats]) => (
            <div key={field} className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-muted rounded overflow-hidden">
                <div
                  className={`h-full ${stats.coverage > 80 ? 'bg-good' : stats.coverage > 50 ? 'bg-warn' : 'bg-bad'}`}
                  style={{ width: `${stats.coverage}%` }}
                />
              </div>
              <code className="text-xs text-accent min-w-[100px]">{field}</code>
              <span className="text-xs text-muted-foreground">{stats.coverage.toFixed(0)}%</span>
            </div>
          ))}
      </div>
    </div>
  );
}

export default ImportReview;
