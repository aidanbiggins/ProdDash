// Top Priority Ribbon
// Full-width ribbon above all Command Center sections.
// Shows the single dominant priority: category badge, headline, CTA button.

import React from 'react';
import { TopPriority, PriorityCategory, PrioritySeverity } from '../../../types/commandCenterTypes';
import { TabType } from '../../../routes';

interface TopPriorityRibbonProps {
  priority: TopPriority;
  onNavigate?: (target: TabType | string) => void;
}

const CATEGORY_LABELS: Record<PriorityCategory, string> = {
  BLOCKING_ATTENTION: 'BLOCKING',
  OFF_TRACK: 'OFF TRACK',
  CRITICAL_RISK: 'CRITICAL RISK',
  AT_RISK_ATTENTION: 'AT RISK',
  CAPACITY_BOUND: 'CAPACITY',
  NONE: 'ALL CLEAR',
};

const SEVERITY_STYLES: Record<PrioritySeverity, { bg: string; border: string; badge: string; text: string }> = {
  critical: {
    bg: 'rgba(239, 68, 68, 0.08)',
    border: 'rgba(239, 68, 68, 0.3)',
    badge: '#ef4444',
    text: 'rgba(255, 255, 255, 0.9)',
  },
  high: {
    bg: 'rgba(245, 158, 11, 0.08)',
    border: 'rgba(245, 158, 11, 0.3)',
    badge: '#f59e0b',
    text: 'rgba(255, 255, 255, 0.9)',
  },
  info: {
    bg: 'rgba(16, 185, 129, 0.06)',
    border: 'rgba(16, 185, 129, 0.2)',
    badge: '#10b981',
    text: 'rgba(255, 255, 255, 0.7)',
  },
};

export const TopPriorityRibbon: React.FC<TopPriorityRibbonProps> = ({ priority, onNavigate }) => {
  const styles = SEVERITY_STYLES[priority.severity];
  const label = CATEGORY_LABELS[priority.category];

  const ribbonClass = [
    'cc-ribbon',
    priority.category === 'NONE' ? 'cc-ribbon--none' : '',
    priority.severity === 'critical' ? 'cc-ribbon--critical' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={ribbonClass}
      style={{
        background: styles.bg,
        border: `1px solid ${styles.border}`,
      }}
    >
      <span
        className="cc-ribbon__badge"
        style={{
          color: styles.badge,
          background: `${styles.badge}1a`,
          border: `1px solid ${styles.badge}33`,
        }}
      >
        {label}
      </span>
      <span className="cc-ribbon__headline" style={{ color: styles.text }}>
        {priority.headline}
      </span>
      {priority.category !== 'NONE' && priority.accountability && (
        <span className="cc-ribbon__accountability">
          <span className="cc-ribbon__acct-owner">{priority.accountability.owner}</span>
          {priority.accountability.due && (
            <span style={{ color: styles.badge }}>{priority.accountability.due}</span>
          )}
        </span>
      )}
      {priority.cta_label && onNavigate && (
        <button
          onClick={() => onNavigate(priority.cta_target)}
          className="cc-ribbon__cta"
          style={{
            color: styles.badge,
            border: `1px solid ${styles.border}`,
          }}
        >
          {priority.cta_label} <i className="bi bi-arrow-right cc-ribbon__cta-arrow" />
        </button>
      )}
    </div>
  );
};
