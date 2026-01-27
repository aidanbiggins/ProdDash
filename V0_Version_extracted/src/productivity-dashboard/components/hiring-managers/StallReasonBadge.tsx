// Stall Reason Badge Component
// Displays a stall reason code as a colored badge with tooltip

import React from 'react';
import { StallReason, StallReasonCode } from '../../types/hmTypes';

interface StallReasonBadgeProps {
    stallReason: StallReason;
    showEvidence?: boolean;
}

// Dark mode palette - translucent backgrounds, vibrant text
const STALL_COLORS: Record<StallReasonCode, { bg: string; text: string }> = {
    [StallReasonCode.AWAITING_HM_FEEDBACK]: { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171' },   // Red
    [StallReasonCode.AWAITING_HM_REVIEW]: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24' },     // Amber
    [StallReasonCode.PIPELINE_THIN]: { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171' },           // Red
    [StallReasonCode.NO_ACTIVITY]: { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8' },           // Slate
    [StallReasonCode.OFFER_STALL]: { bg: 'rgba(96, 165, 250, 0.15)', text: '#60a5fa' },            // Blue
    [StallReasonCode.LATE_STAGE_EMPTY]: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24' },       // Amber
    [StallReasonCode.PROCESS_STALL_UNKNOWN]: { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8' }, // Slate
    [StallReasonCode.NONE]: { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399' }                    // Emerald
};

const STALL_LABELS: Record<StallReasonCode, string> = {
    [StallReasonCode.AWAITING_HM_FEEDBACK]: 'Feedback Due',
    [StallReasonCode.AWAITING_HM_REVIEW]: 'Review Backlog',
    [StallReasonCode.PIPELINE_THIN]: 'Low Pipeline',
    [StallReasonCode.NO_ACTIVITY]: 'No Activity',
    [StallReasonCode.OFFER_STALL]: 'Offer Pending',
    [StallReasonCode.LATE_STAGE_EMPTY]: 'Late Stage Gap',
    [StallReasonCode.PROCESS_STALL_UNKNOWN]: 'Unknown Stall',
    [StallReasonCode.NONE]: 'On Track'
};

export function StallReasonBadge({ stallReason, showEvidence = false }: StallReasonBadgeProps) {
    const colors = STALL_COLORS[stallReason.code] ?? STALL_COLORS[StallReasonCode.NONE];
    const label = STALL_LABELS[stallReason.code] ?? 'Unknown';

    if (stallReason.code === StallReasonCode.NONE) {
        return (
            <span
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                style={{ backgroundColor: colors.bg, color: colors.text }}
                title={stallReason.explanation}
            >
                ✓ {label}
            </span>
        );
    }

    return (
        <span
            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium cursor-help"
            style={{
                backgroundColor: colors.bg,
                color: colors.text,
            }}
            title={`${stallReason.explanation}\n\nEvidence: ${stallReason.evidence}`}
        >
            {label}
            {showEvidence && (
                <small className="block" style={{ fontSize: '0.75em', opacity: 0.9 }}>
                    {stallReason.evidence}
                </small>
            )}
        </span>
    );
}

// Risk Flag Badges
interface RiskFlagBadgesProps {
    flags: Array<{ code: string; label: string; severity: 'warning' | 'danger' | 'info' }>;
    compact?: boolean;
}

// Compact labels for tight table columns
const COMPACT_LABELS: Record<string, string> = {
    'NO_MOVEMENT': 'Stalled',
    'LOW_PIPELINE': 'Low Pipe',
    'FEEDBACK_BACKLOG': 'FB Due',
    'HM_REVIEW_BACKLOG': 'Review',
    'OFFER_PENDING': 'Offer'
};

export function RiskFlagBadges({ flags, compact = false }: RiskFlagBadgesProps) {
    if (flags.length === 0) {
        return <span className="text-muted-foreground text-sm">—</span>;
    }

    return (
        <div className="flex flex-wrap gap-1">
            {flags.map(flag => (
                <span
                    key={flag.code}
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        flag.severity === 'danger' ? 'bg-red-500/15 text-red-400' :
                        flag.severity === 'warning' ? 'bg-amber-500/15 text-amber-400' :
                        'bg-blue-500/15 text-blue-400'
                    }`}
                    title={flag.label}
                >
                    {compact ? (COMPACT_LABELS[flag.code] || flag.label) : flag.label}
                </span>
            ))}
        </div>
    );
}
