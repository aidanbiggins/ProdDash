// Section 3: What's at risk?
// Groups risk items by failure_mode with expand/collapse.
// Top group auto-expanded if it contains a critical item.

import React, { useState, useMemo } from 'react';
import { RiskSection as RiskData, RiskItem } from '../../types/commandCenterTypes';
import { getRiskAccountability } from '../../services/priorityArbitrationService';
import { RiskConcentrationSpark } from './CCVisualPrimitives';

interface RiskSectionProps {
  data: RiskData;
  onRiskClick?: (reqId: string) => void;
}

const SEVERITY_COLORS = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#94a3b8',
};

interface RiskGroup {
  mode: string;
  label: string;
  items: RiskItem[];
  hasCritical: boolean;
  worstSeverity: 'critical' | 'high' | 'medium';
}

export const RiskSection: React.FC<RiskSectionProps> = ({ data, onRiskClick }) => {
  const groups = useMemo(() => buildGroups(data.items), [data.items]);

  // Auto-expand the first group that has a critical item, otherwise first group
  const defaultExpanded = groups.findIndex(g => g.hasCritical);
  const initialExpanded = defaultExpanded >= 0 ? defaultExpanded : (groups.length > 0 ? 0 : -1);

  const [expandedIdx, setExpandedIdx] = useState<number>(initialExpanded);

  if (data.items.length === 0) {
    return (
      <div className="cc-risk__empty">
        No high-risk requisitions identified.
      </div>
    );
  }

  return (
    <div>
      {/* Summary bar + concentration spark */}
      <div className="cc-risk__summary-bar">
        <span className="cc-risk__summary-text">
          <strong className="cc-risk__summary-count">{data.total_at_risk}</strong> at risk
        </span>
        <RiskConcentrationSpark
          distribution={groups.map(g => ({
            mode: g.mode,
            count: g.items.length,
            severity: g.worstSeverity,
          }))}
        />
      </div>

      {/* Grouped rows */}
      <div className="cc-risk__groups">
        {groups.map((group, idx) => {
          const isExpanded = expandedIdx === idx;
          return (
            <div key={group.mode}>
              {/* Group header */}
              <div
                className={`cc-risk__group-header ${isExpanded ? 'cc-risk__group-header--expanded' : 'cc-risk__group-header--collapsed'}`}
                style={{ borderLeftColor: SEVERITY_COLORS[group.worstSeverity] }}
                onClick={() => setExpandedIdx(isExpanded ? -1 : idx)}
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedIdx(isExpanded ? -1 : idx); } }}
              >
                <i
                  className={`bi bi-chevron-right cc-risk__group-chevron ${isExpanded ? 'cc-risk__group-chevron--expanded' : ''}`}
                />
                <span className="cc-risk__group-label">
                  {group.items.length} {group.label}
                </span>
                {group.hasCritical && (
                  <span className="cc-risk__group-critical">
                    CRITICAL
                  </span>
                )}
              </div>

              {/* Expanded items */}
              {isExpanded && (
                <div className="cc-risk__group-items">
                  {group.items.map(item => (
                    <div
                      key={item.req_id}
                      className={`cc-risk__item ${onRiskClick ? 'cc-risk__item--clickable' : ''}`}
                      onClick={() => onRiskClick?.(item.req_id)}
                      role={onRiskClick ? 'button' : undefined}
                      tabIndex={onRiskClick ? 0 : undefined}
                      onKeyDown={onRiskClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRiskClick(item.req_id); } } : undefined}
                    >
                      <div className="cc-risk__item-header">
                        <span className="cc-risk__item-severity" style={{ color: SEVERITY_COLORS[item.severity] }}>
                          {item.severity}
                        </span>
                        <span className="cc-risk__item-title">
                          {item.req_title}
                        </span>
                        <span className="cc-risk__item-days">
                          {item.days_open}d open
                        </span>
                      </div>
                      <div className="cc-risk__item-why">
                        {item.why}
                      </div>
                      <div className="cc-risk__item-footer">
                        <span className="cc-risk__item-next-move">
                          → {item.next_move}
                        </span>
                        {(() => {
                          const acct = getRiskAccountability(item);
                          return (
                            <span className="cc-risk__item-accountability">
                              <span>{acct.owner}</span>
                              <span style={{ color: SEVERITY_COLORS[item.severity] }}>{acct.due}</span>
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

function buildGroups(items: RiskItem[]): RiskGroup[] {
  const map = new Map<string, RiskItem[]>();
  for (const item of items) {
    const key = item.failure_mode;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }

  const groups: RiskGroup[] = [];
  for (const [mode, groupItems] of map) {
    const hasCritical = groupItems.some(i => i.severity === 'critical');
    const worstSeverity = hasCritical ? 'critical' : groupItems.some(i => i.severity === 'high') ? 'high' : 'medium';
    groups.push({
      mode,
      label: formatMode(mode),
      items: groupItems,
      hasCritical,
      worstSeverity,
    });
  }

  // Sort: critical groups first, then by item count descending
  groups.sort((a, b) => {
    if (a.hasCritical !== b.hasCritical) return a.hasCritical ? -1 : 1;
    return b.items.length - a.items.length;
  });

  return groups;
}

function formatMode(mode: string): string {
  const labels: Record<string, string> = {
    EMPTY_PIPELINE: 'pipeline gap',
    HM_DELAY: 'HM slow',
    OFFER_RISK: 'offer risk',
    AGING_DECAY: 'aging',
    STALLED_PIPELINE: 'stalled',
    COMPLEXITY_MISMATCH: 'complexity',
  };
  return labels[mode] || mode.toLowerCase().replace(/_/g, ' ');
}
