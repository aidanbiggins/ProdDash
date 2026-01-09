// Stall Reason Badge Component
// Displays a stall reason code as a colored badge with tooltip

import React from 'react';
import { StallReason, StallReasonCode } from '../../types/hmTypes';

interface StallReasonBadgeProps {
    stallReason: StallReason;
    showEvidence?: boolean;
}

const STALL_COLORS: Record<StallReasonCode, { bg: string; text: string }> = {
    [StallReasonCode.AWAITING_HM_FEEDBACK]: { bg: '#dc3545', text: 'white' },
    [StallReasonCode.AWAITING_HM_REVIEW]: { bg: '#fd7e14', text: 'white' },
    [StallReasonCode.PIPELINE_THIN]: { bg: '#6f42c1', text: 'white' },
    [StallReasonCode.NO_ACTIVITY]: { bg: '#6c757d', text: 'white' },
    [StallReasonCode.OFFER_STALL]: { bg: '#0d6efd', text: 'white' },
    [StallReasonCode.PROCESS_STALL_UNKNOWN]: { bg: '#adb5bd', text: 'dark' },
    [StallReasonCode.NONE]: { bg: '#198754', text: 'white' }
};

const STALL_LABELS: Record<StallReasonCode, string> = {
    [StallReasonCode.AWAITING_HM_FEEDBACK]: 'Feedback Due',
    [StallReasonCode.AWAITING_HM_REVIEW]: 'Review Backlog',
    [StallReasonCode.PIPELINE_THIN]: 'Low Pipeline',
    [StallReasonCode.NO_ACTIVITY]: 'No Activity',
    [StallReasonCode.OFFER_STALL]: 'Offer Pending',
    [StallReasonCode.PROCESS_STALL_UNKNOWN]: 'Unknown Stall',
    [StallReasonCode.NONE]: 'On Track'
};

export function StallReasonBadge({ stallReason, showEvidence = false }: StallReasonBadgeProps) {
    const colors = STALL_COLORS[stallReason.code] ?? STALL_COLORS[StallReasonCode.NONE];
    const label = STALL_LABELS[stallReason.code] ?? 'Unknown';

    if (stallReason.code === StallReasonCode.NONE) {
        return (
            <span
                className="badge"
                style={{ backgroundColor: colors.bg, color: colors.text }}
                title={stallReason.explanation}
            >
                ✓ {label}
            </span>
        );
    }

    return (
        <span
            className="badge"
            style={{
                backgroundColor: colors.bg,
                color: colors.text,
                cursor: 'help'
            }}
            title={`${stallReason.explanation}\n\nEvidence: ${stallReason.evidence}`}
        >
            {label}
            {showEvidence && (
                <small className="d-block" style={{ fontSize: '0.75em', opacity: 0.9 }}>
                    {stallReason.evidence}
                </small>
            )}
        </span>
    );
}

// Risk Flag Badges
interface RiskFlagBadgesProps {
    flags: Array<{ code: string; label: string; severity: 'warning' | 'danger' | 'info' }>;
}

export function RiskFlagBadges({ flags }: RiskFlagBadgesProps) {
    if (flags.length === 0) {
        return <span className="text-muted small">—</span>;
    }

    return (
        <div className="d-flex flex-wrap gap-1">
            {flags.map(flag => (
                <span
                    key={flag.code}
                    className={`badge bg-${flag.severity}`}
                    style={{ fontSize: '0.7rem' }}
                >
                    {flag.label}
                </span>
            ))}
        </div>
    );
}
