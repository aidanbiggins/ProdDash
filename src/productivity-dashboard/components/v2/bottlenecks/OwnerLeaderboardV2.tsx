'use client';

// OwnerLeaderboardV2.tsx
// Displays owner-level breach aggregation (HM leaderboard) (V2 version)

import React, { useState } from 'react';
import { OwnerBreachSummary, SlaOwnerType, SLA_THRESHOLDS } from '../../../types/slaTypes';
import { SectionHeader } from '../../common/SectionHeader';
import { HelpButton, HelpDrawer } from '../../common';
import { SLA_BREACH_SUMMARY_HELP } from '../../_legacy/bottlenecks/bottlenecksHelpContent';

interface OwnerLeaderboardV2Props {
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
      return 'text-violet-500';
    case 'RECRUITER':
      return 'text-blue-500';
    case 'OPS':
      return 'text-cyan-500';
    default:
      return 'text-gray-400';
  }
}

function getOwnerTypeBorderColor(ownerType: SlaOwnerType): string {
  switch (ownerType) {
    case 'HM':
      return 'border-l-violet-500';
    case 'RECRUITER':
      return 'border-l-blue-500';
    case 'OPS':
      return 'border-l-cyan-500';
    default:
      return 'border-l-gray-400';
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

export function OwnerLeaderboardV2({
  owners,
  breachByOwnerType,
  onOwnerClick,
}: OwnerLeaderboardV2Props) {
  const [showHelp, setShowHelp] = useState(false);
  const totalBreaches =
    breachByOwnerType.HM + breachByOwnerType.RECRUITER + breachByOwnerType.OPS;

  // Filter to only show owners with sufficient breaches
  const qualifiedOwners = owners.filter(
    (o) => o.breach_count >= SLA_THRESHOLDS.MIN_BREACHES_FOR_LEADERBOARD
  );

  return (
    <div className="glass-panel p-4">
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
      <div className="flex gap-4 mb-4 p-3 bg-white/[0.02] rounded-md">
        <div className="flex-1">
          <div className="text-xs text-muted-foreground/70 uppercase tracking-wide">
            Total Breaches
          </div>
          <div className="font-mono text-2xl font-bold text-foreground">
            {totalBreaches}
          </div>
        </div>

        <div className="flex gap-3 items-center">
          {(['HM', 'RECRUITER', 'OPS'] as SlaOwnerType[]).map((type) => {
            const count = breachByOwnerType[type] ?? 0;
            const percent = totalBreaches > 0 ? (count / totalBreaches) * 100 : 0;

            return (
              <div key={type} className="text-center">
                <div className={`text-xs font-medium ${getOwnerTypeColor(type)}`}>
                  {getOwnerTypeLabel(type)}
                </div>
                <div className="font-mono font-semibold text-foreground">
                  {count}
                  <span className="text-xs text-muted-foreground ml-1">
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
          <div className="text-xs text-muted-foreground/70 uppercase tracking-wide mb-2">
            Owner Leaderboard (HMs with {SLA_THRESHOLDS.MIN_BREACHES_FOR_LEADERBOARD}+ breaches)
          </div>
          <div className="flex flex-col gap-2">
            {qualifiedOwners.slice(0, 5).map((owner) => (
              <div
                key={`${owner.owner_type}:${owner.owner_id}`}
                onClick={() => onOwnerClick?.(owner.owner_id, owner.owner_type)}
                className={`flex items-center justify-between px-3 py-2 bg-white/[0.02] rounded border-l-[3px] ${getOwnerTypeBorderColor(owner.owner_type)} ${
                  onOwnerClick ? 'cursor-pointer hover:bg-white/[0.05]' : ''
                } transition-colors`}
              >
                <div>
                  <div className="font-medium text-foreground">
                    {owner.owner_name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {owner.breach_stages.join(', ')}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-semibold text-red-500">
                    {owner.breach_count} breaches
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Avg: {formatHours(owner.avg_breach_hours)} over
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="py-4 text-center text-muted-foreground text-sm">
          No individual owners with {SLA_THRESHOLDS.MIN_BREACHES_FOR_LEADERBOARD}+ breaches.
          <br />
          <span className="text-xs">
            Aggregated by owner type above.
          </span>
        </div>
      )}

      {/* Note */}
      <div className="mt-3 text-xs text-muted-foreground/70 italic">
        Note: Shows individual HMs with {SLA_THRESHOLDS.MIN_BREACHES_FOR_LEADERBOARD}+ breaches.
        Recruiter/Ops breaches are aggregated by type.
      </div>
    </div>
  );
}

export default OwnerLeaderboardV2;
