// Attention Drilldown Drawer (Back Layer)
// Right-side drawer showing ranked lists for TA leader action.
// Three sections: Top Recruiters, Top HMs, Top Req Clusters.
// Supports focused view (single section) and export affordances.

import React, { useCallback, useEffect, useRef } from 'react';
import {
  AttentionDrilldownData,
  RecruiterDrilldownItem,
  HMDrilldownItem,
  ReqClusterDrilldownItem,
  BucketSeverity,
} from '../../../types/attentionTypes';
import { TabType } from '../../../routes';
import {
  DrawerFocus,
  formatDrilldownAsText,
  formatDrilldownAsCSV,
} from '../../../services/attentionNavigationService';

interface AttentionDrilldownDrawerProps {
  data: AttentionDrilldownData;
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (tab: TabType) => void;
  focus?: DrawerFocus;
}

const SEVERITY_COLORS: Record<BucketSeverity, string> = {
  'blocking': '#ef4444',
  'at-risk': '#f59e0b',
  'watch': '#94a3b8',
};

const SEVERITY_CLASSES: Record<BucketSeverity, string> = {
  'blocking': 'cc-drilldown-row--blocking',
  'at-risk': 'cc-drilldown-row--at-risk',
  'watch': 'cc-drilldown-row--watch',
};

export const AttentionDrilldownDrawer: React.FC<AttentionDrilldownDrawerProps> = ({
  data,
  isOpen,
  onClose,
  onNavigate,
  focus,
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Focus trap: when opened, focus the close button
  useEffect(() => {
    if (isOpen && closeRef.current) {
      closeRef.current.focus();
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const hasContent = data.recruiters.length > 0 || data.hiringManagers.length > 0 || data.reqClusters.length > 0;

  // When focused, only show the relevant section
  const showRecruiters = (!focus || focus === 'recruiters') && data.recruiters.length > 0;
  const showHMs = (!focus || focus === 'hiringManagers') && data.hiringManagers.length > 0;
  const showClusters = (!focus || focus === 'reqClusters') && data.reqClusters.length > 0;

  return (
    <div
      ref={drawerRef}
      data-testid="attention-drilldown-drawer"
      className={`cc-drawer ${isOpen ? 'cc-drawer--open' : ''}`}
      aria-hidden={!isOpen}
    >
      {/* Header */}
      <div className="cc-drawer__header">
        <h4 className="cc-drawer__title">
          {focus ? getFocusTitle(focus) : 'Attention Drilldown'}
        </h4>
        <button
          ref={closeRef}
          onClick={onClose}
          className="cc-drawer__close"
          aria-label="Close drawer"
        >
          <i className="bi bi-x" />
        </button>
      </div>

      {/* Content */}
      <div className="cc-drawer__content">
        {!hasContent && (
          <div className="cc-drawer__empty">
            No drilldown data available.
          </div>
        )}

        {/* Top Recruiters */}
        {showRecruiters && (
          <DrilldownSection
            title="Top Recruiters to Intervene"
            onViewAll={() => onNavigate?.('recruiter')}
            viewAllLabel="View all recruiters"
            focusKey="recruiters"
            data={data}
          >
            {data.recruiters.map(r => (
              <RecruiterRow key={r.recruiterId} item={r} />
            ))}
          </DrilldownSection>
        )}

        {/* Top HMs */}
        {showHMs && (
          <DrilldownSection
            title="Top HMs to Escalate"
            onViewAll={() => onNavigate?.('hm-friction')}
            viewAllLabel="View all HMs"
            focusKey="hiringManagers"
            data={data}
          >
            {data.hiringManagers.map(hm => (
              <HMRow key={hm.hmId} item={hm} />
            ))}
          </DrilldownSection>
        )}

        {/* Top Req Clusters */}
        {showClusters && (
          <DrilldownSection
            title="At-Risk Req Clusters"
            onViewAll={() => onNavigate?.('overview')}
            viewAllLabel="View all reqs"
            focusKey="reqClusters"
            data={data}
          >
            {data.reqClusters.map((cluster, i) => (
              <ClusterRow key={`${cluster.clusterLabel}-${i}`} item={cluster} />
            ))}
          </DrilldownSection>
        )}
      </div>
    </div>
  );
};

function getFocusTitle(focus: DrawerFocus): string {
  switch (focus) {
    case 'recruiters': return 'Recruiter Intervention';
    case 'hiringManagers': return 'HM Escalation';
    case 'reqClusters': return 'At-Risk Req Clusters';
    default: return 'Attention Drilldown';
  }
}

// -- Shared Section Wrapper

interface DrilldownSectionProps {
  title: string;
  onViewAll?: () => void;
  viewAllLabel: string;
  focusKey: DrawerFocus;
  data: AttentionDrilldownData;
  children: React.ReactNode;
}

const DrilldownSection: React.FC<DrilldownSectionProps> = ({ title, onViewAll, viewAllLabel, focusKey, data, children }) => {
  const handleCopy = useCallback(() => {
    const text = formatDrilldownAsText(data, focusKey);
    navigator.clipboard.writeText(text);
  }, [data, focusKey]);

  const handleExportCSV = useCallback(() => {
    const csv = formatDrilldownAsCSV(data, focusKey);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attention-${focusKey}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data, focusKey]);

  return (
    <div className="cc-drilldown-section">
      <div className="cc-drilldown-section__header">
        <h5 className="cc-drilldown-section__title">
          {title}
        </h5>
        {onViewAll && (
          <button onClick={onViewAll} className="cc-drilldown-section__view-all">
            {viewAllLabel} <i className="bi bi-arrow-right cc-drilldown-section__view-all-arrow" />
          </button>
        )}
      </div>
      <div className="cc-drilldown-section__list">
        {children}
      </div>
      {/* Export affordances */}
      <div className="cc-drilldown-section__export-row">
        <button
          onClick={handleCopy}
          className="cc-drilldown-section__export-btn"
          data-testid={`drilldown-copy-${focusKey}`}
        >
          <i className="bi bi-clipboard cc-drilldown-section__export-icon" />
          Copy list
        </button>
        <button
          onClick={handleExportCSV}
          className="cc-drilldown-section__export-btn"
          data-testid={`drilldown-export-${focusKey}`}
        >
          <i className="bi bi-download cc-drilldown-section__export-icon" />
          Export CSV
        </button>
      </div>
    </div>
  );
};

// -- Row Components

const RecruiterRow: React.FC<{ item: RecruiterDrilldownItem }> = ({ item }) => (
  <div className={`cc-drilldown-row ${SEVERITY_CLASSES[item.severity]}`}>
    <div className="cc-drilldown-row__top">
      <span className="cc-drilldown-row__name">{item.recruiterName}</span>
      <span className="cc-drilldown-row__meta">{item.openReqCount} reqs</span>
    </div>
    <div className="cc-drilldown-row__stats">
      {item.utilizationLabel && <span>{item.utilizationLabel}</span>}
      <span>{item.keyLagMetric}</span>
    </div>
    <div className="cc-drilldown-row__intervention">
      &rarr; {item.suggestedIntervention}
    </div>
  </div>
);

const HMRow: React.FC<{ item: HMDrilldownItem }> = ({ item }) => (
  <div className={`cc-drilldown-row ${SEVERITY_CLASSES[item.severity]}`}>
    <div className="cc-drilldown-row__top">
      <span className="cc-drilldown-row__name">{item.hmName}</span>
      {item.openItemCount > 0 && (
        <span className="cc-drilldown-row__meta cc-drilldown-row__meta--critical">{item.openItemCount} overdue</span>
      )}
    </div>
    <div className="cc-drilldown-row__stats">
      {item.feedbackLatencyDays !== null && <span>Feedback: {item.feedbackLatencyDays}d</span>}
      {item.decisionLatencyDays !== null && <span>Decision: {item.decisionLatencyDays}d</span>}
    </div>
    <div className="cc-drilldown-row__intervention">
      &rarr; {item.suggestedIntervention}
    </div>
  </div>
);

const ClusterRow: React.FC<{ item: ReqClusterDrilldownItem }> = ({ item }) => (
  <div className={`cc-drilldown-row ${SEVERITY_CLASSES[item.severity]}`}>
    <div className="cc-drilldown-row__top">
      <span className="cc-drilldown-row__name">{item.clusterLabel}</span>
      <span className="cc-drilldown-row__meta">{item.reqCount} reqs</span>
    </div>
    <div className="cc-drilldown-row__stats">
      <span>Avg {item.avgDaysOpen}d open</span>
      <span>{item.riskLabel}</span>
    </div>
    <div className="cc-drilldown-row__intervention">
      &rarr; {item.suggestedIntervention}
    </div>
  </div>
);

// -- Backdrop

export const DrawerBackdrop: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  return (
    <div
      onClick={isOpen ? onClose : undefined}
      data-testid="drawer-backdrop"
      className={`cc-backdrop ${isOpen ? 'cc-backdrop--open' : ''}`}
      aria-hidden={!isOpen}
    />
  );
};
