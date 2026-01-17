// BreachTable.tsx
// Displays SLA breach table with requisition-level details

import React, { useState } from 'react';
import { ReqBreachSummary } from '../../types/slaTypes';
import { GlassPanel } from '../layout/GlassPanel';
import { SectionHeader } from '../common/SectionHeader';
import { HelpButton, HelpDrawer } from '../common';
import { BREACH_TABLE_HELP } from './bottlenecksHelpContent';

interface BreachTableProps {
  breaches: ReqBreachSummary[];
  onReqClick?: (reqId: string) => void;
  onExport?: () => void;
}

const PAGE_SIZE = 10;

function formatHours(hours: number): string {
  if (hours < 24) {
    return `${hours.toFixed(1)}h`;
  }
  const days = hours / 24;
  return `${days.toFixed(1)}d`;
}

function getBreachSeverity(hours: number): { color: string; label: string } {
  if (hours > 48) return { color: '#ef4444', label: 'Critical' };
  if (hours > 24) return { color: '#f59e0b', label: 'High' };
  return { color: '#22c55e', label: 'Medium' };
}

export function BreachTable({ breaches, onReqClick, onExport }: BreachTableProps) {
  const [showAll, setShowAll] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const displayedBreaches = showAll ? breaches : breaches.slice(0, PAGE_SIZE);
  const totalBreaches = breaches.length;
  const totalBreachHours = breaches.reduce((sum, b) => sum + b.total_breach_hours, 0);

  if (breaches.length === 0) {
    return (
      <GlassPanel>
        <SectionHeader
          title="SLA Breaches by Requisition"
          actions={
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              {onExport && (
                <button className="btn btn-sm btn-outline-secondary" onClick={onExport}>
                  <i className="bi bi-download me-1" />
                  Export
                </button>
              )}
              <HelpButton onClick={() => setShowHelp(true)} ariaLabel="Help for breach table" />
            </div>
          }
        />
        <HelpDrawer
          isOpen={showHelp}
          onClose={() => setShowHelp(false)}
          title="SLA Breaches by Requisition"
          content={BREACH_TABLE_HELP}
        />
        <div
          style={{
            padding: 'var(--space-6)',
            textAlign: 'center',
            color: 'var(--text-secondary)',
          }}
        >
          <i className="bi bi-shield-check" style={{ fontSize: '2rem', opacity: 0.5 }} />
          <p style={{ marginTop: 'var(--space-2)' }}>
            No SLA breaches detected. All stages within limits.
          </p>
        </div>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel>
      <SectionHeader
        title="SLA Breaches by Requisition"
        badge={`${totalBreaches} breaches`}
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-secondary)',
                padding: '4px 8px',
                background: 'rgba(239, 68, 68, 0.1)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              Total: {formatHours(totalBreachHours)} over SLA
            </span>
            {onExport && (
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={onExport}
                style={{
                  padding: '4px 8px',
                  fontSize: 'var(--text-xs)',
                }}
              >
                <i className="bi bi-download me-1" />
                Export
              </button>
            )}
            <HelpButton onClick={() => setShowHelp(true)} ariaLabel="Help for breach table" />
          </div>
        }
      />
      <HelpDrawer
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        title="SLA Breaches by Requisition"
        content={BREACH_TABLE_HELP}
      />

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 'var(--text-sm)',
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: '1px solid var(--glass-border)',
                textAlign: 'left',
              }}
            >
              <th style={thStyle}>Requisition</th>
              <th style={thStyle}>Worst Stage</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Breach Hours</th>
              <th style={thStyle}>Owner</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Days Open</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {displayedBreaches.map((breach) => {
              const severity = getBreachSeverity(breach.worst_breach_hours);
              const ownerName =
                breach.hiring_manager_name ?? breach.recruiter_name ?? 'Unknown';

              return (
                <tr
                  key={breach.req_id}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                    cursor: onReqClick ? 'pointer' : 'default',
                  }}
                  onClick={() => onReqClick?.(breach.req_id)}
                  onMouseEnter={(e) => {
                    if (onReqClick) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 'var(--font-medium)' }}>
                      {breach.req_id}
                    </div>
                    <div
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--text-secondary)',
                        maxWidth: '200px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {breach.req_title}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        padding: '2px 8px',
                        background: `${severity.color}15`,
                        color: severity.color,
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--text-xs)',
                        fontWeight: 'var(--font-medium)',
                      }}
                    >
                      {breach.worst_stage}
                    </span>
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      textAlign: 'right',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 'var(--font-semibold)',
                      color: severity.color,
                    }}
                  >
                    {formatHours(breach.worst_breach_hours)}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontSize: 'var(--text-sm)' }}>{ownerName}</div>
                    <div
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {breach.breach_count} breach{breach.breach_count !== 1 ? 'es' : ''}
                    </div>
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      textAlign: 'right',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {breach.days_open}d
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onReqClick?.(breach.req_id);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-accent-primary)',
                        cursor: 'pointer',
                        padding: '4px 8px',
                      }}
                    >
                      <i className="bi bi-arrow-right" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Show More / Show Less */}
      {totalBreaches > PAGE_SIZE && (
        <div style={{ textAlign: 'center', marginTop: 'var(--space-3)' }}>
          <button
            onClick={() => setShowAll(!showAll)}
            style={{
              background: 'transparent',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-secondary)',
              padding: '6px 16px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--text-xs)',
              cursor: 'pointer',
            }}
          >
            {showAll
              ? 'Show Less'
              : `Show All (${totalBreaches - PAGE_SIZE} more)`}
          </button>
        </div>
      )}
    </GlassPanel>
  );
}

const thStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-3)',
  fontSize: 'var(--text-xs)',
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  fontWeight: 'var(--font-semibold)',
};

const tdStyle: React.CSSProperties = {
  padding: 'var(--space-3)',
  verticalAlign: 'middle',
};

export default BreachTable;
