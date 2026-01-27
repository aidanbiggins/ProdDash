// OwnerLeaderboard.tsx
// Displays owner-level breach aggregation (HM leaderboard)

import React, { useState } from 'react';
import { OwnerBreachSummary, SlaOwnerType, SLA_THRESHOLDS } from '../../../types/slaTypes';
import { GlassPanel } from '../layout/GlassPanel';
import { SectionHeader } from '../../common/SectionHeader';
import { HelpButton, HelpDrawer } from '../../common';
import { SLA_BREACH_SUMMARY_HELP } from './bottlenecksHelpContent';

interface OwnerLeaderboardProps {
  owners: OwnerBreachSummary[];
  breachByOwnerType: Record<SlaOwnerType, number>;
  onOwnerClick?: (ownerId: string, ownerType: SlaOwnerType) => void;
}

function formatHours(hours: number): string {
  if (hours < 24) {
    return `${hours.toFixed(1)}h`;
  }
  const days = hours / 24;
  return `${days.toFixed(1)}d`;
}

function getOwnerTypeColor(ownerType: SlaOwnerType): string {
  switch (ownerType) {
    case 'HM':
      return '#8b5cf6'; // Purple
    case 'RECRUITER':
      return '#3b82f6'; // Blue
    case 'OPS':
      return '#06b6d4'; // Cyan
    default:
      return '#9ca3af'; // Gray
  }
}

function getOwnerTypeLabel(ownerType: SlaOwnerType): string {
  switch (ownerType) {
    case 'HM':
      return 'Hiring Manager';
    case 'RECRUITER':
      return 'Recruiter';
    case 'OPS':
      return 'TA Ops';
    default:
      return 'Unknown';
  }
}

export function OwnerLeaderboard({
  owners,
  breachByOwnerType,
  onOwnerClick,
}: OwnerLeaderboardProps) {
  const [showHelp, setShowHelp] = useState(false);
  const totalBreaches =
    breachByOwnerType.HM + breachByOwnerType.RECRUITER + breachByOwnerType.OPS;

  // Filter to only show owners with sufficient breaches
  const qualifiedOwners = owners.filter(
    (o) => o.breach_count >= SLA_THRESHOLDS.MIN_BREACHES_FOR_LEADERBOARD
  );

  return (
    <GlassPanel>
      <SectionHeader
        title="SLA Breach Summary"
        actions={<HelpButton onClick={() => setShowHelp(true)} ariaLabel="Help for SLA breach summary" />}
      />
      <HelpDrawer
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        title="SLA Breach Summary"
        content={SLA_BREACH_SUMMARY_HELP}
      />

      {/* Summary by Owner Type */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-4)',
          padding: 'var(--space-3)',
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Total Breaches
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-2xl)',
              fontWeight: 'var(--font-bold)',
              color: 'var(--text-primary)',
            }}
          >
            {totalBreaches}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 'var(--space-3)',
            alignItems: 'center',
          }}
        >
          {(['HM', 'RECRUITER', 'OPS'] as SlaOwnerType[]).map((type) => {
            const count = breachByOwnerType[type] ?? 0;
            const percent = totalBreaches > 0 ? (count / totalBreaches) * 100 : 0;

            return (
              <div key={type} style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: getOwnerTypeColor(type),
                    fontWeight: 'var(--font-medium)',
                  }}
                >
                  {getOwnerTypeLabel(type)}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 'var(--font-semibold)',
                  }}
                >
                  {count}
                  <span
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-secondary)',
                      marginLeft: '4px',
                    }}
                  >
                    ({percent.toFixed(0)}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Owner Leaderboard */}
      {qualifiedOwners.length > 0 ? (
        <>
          <div
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 'var(--space-2)',
            }}
          >
            Owner Leaderboard (HMs with {SLA_THRESHOLDS.MIN_BREACHES_FOR_LEADERBOARD}+ breaches)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {qualifiedOwners.slice(0, 5).map((owner) => (
              <div
                key={`${owner.owner_type}:${owner.owner_id}`}
                onClick={() => onOwnerClick?.(owner.owner_id, owner.owner_type)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-2) var(--space-3)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: 'var(--radius-sm)',
                  borderLeft: `3px solid ${getOwnerTypeColor(owner.owner_type)}`,
                  cursor: onOwnerClick ? 'pointer' : 'default',
                }}
                onMouseEnter={(e) => {
                  if (onOwnerClick) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                }}
              >
                <div>
                  <div style={{ fontWeight: 'var(--font-medium)' }}>
                    {owner.owner_name}
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {owner.breach_stages.join(', ')}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 'var(--font-semibold)',
                      color: '#ef4444',
                    }}
                  >
                    {owner.breach_count} breaches
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Avg: {formatHours(owner.avg_breach_hours)} over
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div
          style={{
            padding: 'var(--space-4)',
            textAlign: 'center',
            color: 'var(--text-secondary)',
            fontSize: 'var(--text-sm)',
          }}
        >
          No individual owners with {SLA_THRESHOLDS.MIN_BREACHES_FOR_LEADERBOARD}+ breaches.
          <br />
          <span style={{ fontSize: 'var(--text-xs)' }}>
            Aggregated by owner type above.
          </span>
        </div>
      )}

      {/* Note */}
      <div
        style={{
          marginTop: 'var(--space-3)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-tertiary)',
          fontStyle: 'italic',
        }}
      >
        Note: Shows individual HMs with {SLA_THRESHOLDS.MIN_BREACHES_FOR_LEADERBOARD}+ breaches.
        Recruiter/Ops breaches are aggregated by type.
      </div>
    </GlassPanel>
  );
}

export default OwnerLeaderboard;
