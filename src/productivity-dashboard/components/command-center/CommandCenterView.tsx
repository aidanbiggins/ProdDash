// Command Center View - Leader-first landing page
// Renders six sections answering the six leader questions.
// Uses existing services through useCommandCenter hook.

import React, { useMemo, useCallback, useState } from 'react';
import { useCommandCenter } from '../../hooks/useCommandCenter';
import { SectionCard } from './SectionCard';
import { AttentionSection } from './AttentionSection';
import { OnTrackSection } from './OnTrackSection';
import { RiskSection } from './RiskSection';
import { ChangesSection } from './ChangesSection';
import { WhatIfSection } from './WhatIfSection';
import { BottleneckSection } from './BottleneckSection';
import { Requisition, Candidate, Event, User } from '../../types/entities';
import { OverviewMetrics, MetricFilters } from '../../types/metrics';
import { DashboardConfig } from '../../types/config';
import { HiringManagerFriction } from '../../types/metrics';
import { ActionItem } from '../../types/actionTypes';
import { CoverageMetrics } from '../../types/resilientImportTypes';
import { SectionId, ScenarioId } from '../../types/commandCenterTypes';
import { generateWeeklyBrief } from '../../services/commandCenterService';
import { generateUnifiedActionQueue } from '../../services/actionQueueService';
import { runPreMortemBatch } from '../../services/preMortemService';
import { getExplanation } from '../../services/explain';
import { ExplainProviderId } from '../../types/explainTypes';
import { HMPendingAction } from '../../types/hmTypes';
import { TabType } from '../../routes';

export interface CommandCenterViewProps {
  requisitions: Requisition[];
  candidates: Candidate[];
  events: Event[];
  users: User[];
  overview: OverviewMetrics | null;
  hmFriction: HiringManagerFriction[];
  hmActions: HMPendingAction[];
  filters: MetricFilters;
  config: DashboardConfig;
  coverage: CoverageMetrics | null | undefined;
  onNavigateToTab?: (tab: TabType | string) => void;
  onNavigateToReq?: (reqId: string) => void;
  onOpenAction?: (actionId: string) => void;
  onOpenExplain?: (providerId: string) => void;
}

export const CommandCenterView: React.FC<CommandCenterViewProps> = (props) => {
  const [briefCopied, setBriefCopied] = useState(false);

  // Compute explanations, actions, and pre-mortems from source data
  const explanations = useMemo(() => {
    const context = {
      requisitions: props.requisitions,
      candidates: props.candidates,
      events: props.events,
      users: props.users,
      filters: props.filters,
      config: props.config,
      overview: props.overview,
      hmFriction: props.hmFriction,
    };
    const map = new Map<ExplainProviderId, any>();
    const ids: ExplainProviderId[] = ['median_ttf', 'hm_latency', 'stalled_reqs', 'offer_accept_rate', 'time_to_offer'];
    for (const id of ids) {
      map.set(id, getExplanation(id, context));
    }
    return map;
  }, [props.requisitions, props.candidates, props.events, props.users, props.filters, props.config, props.overview, props.hmFriction]);

  const actions: ActionItem[] = useMemo(() => {
    const datasetId = `cc_${props.requisitions.length}_${props.candidates.length}`;
    return generateUnifiedActionQueue({
      hmActions: props.hmActions,
      explanations,
      requisitions: props.requisitions,
      users: props.users,
      datasetId,
    });
  }, [props.hmActions, explanations, props.requisitions, props.users]);

  const preMortems = useMemo(() => {
    return runPreMortemBatch(props.requisitions, props.candidates, props.events, props.hmActions);
  }, [props.requisitions, props.candidates, props.events, props.hmActions]);

  const { factPack, gates, isSectionBlocked, getSectionGate } = useCommandCenter({
    requisitions: props.requisitions,
    candidates: props.candidates,
    events: props.events,
    users: props.users,
    overview: props.overview,
    hmFriction: props.hmFriction,
    actions,
    preMortems,
    filters: props.filters,
    config: props.config,
    coverage: props.coverage,
  });

  const handleGenerateBrief = useCallback(() => {
    const brief = generateWeeklyBrief(factPack);
    navigator.clipboard.writeText(brief).then(() => {
      setBriefCopied(true);
      setTimeout(() => setBriefCopied(false), 2000);
    });
  }, [factPack]);

  const handleExploreScenario = useCallback((scenarioId: ScenarioId) => {
    props.onNavigateToTab?.('scenarios');
  }, [props.onNavigateToTab]);

  const handleNavigate = useCallback((target: string) => {
    props.onNavigateToTab?.(target as TabType);
  }, [props.onNavigateToTab]);

  return (
    <div className="command-center-view" style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)', margin: 0, fontFamily: 'Cormorant Garamond, serif' }}>
            Command Center
          </h1>
          <div style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.25rem' }}>
            Confidence: <span style={{ color: factPack.meta.confidence === 'HIGH' ? '#10b981' : factPack.meta.confidence === 'MED' ? '#f59e0b' : '#94a3b8' }}>
              {factPack.meta.confidence}
            </span>
          </div>
        </div>
        <button
          onClick={handleGenerateBrief}
          className="btn btn-sm"
          style={{
            fontSize: '0.6875rem',
            color: briefCopied ? '#10b981' : '#06b6d4',
            border: `1px solid ${briefCopied ? 'rgba(16, 185, 129, 0.3)' : 'rgba(6, 182, 212, 0.3)'}`,
            borderRadius: '6px',
            padding: '0.375rem 0.75rem',
            background: 'transparent',
          }}
        >
          {briefCopied ? 'Copied!' : 'Generate Exec Brief'}
        </button>
      </div>

      {/* Section 1: Attention */}
      <SectionCard
        sectionId="cc_attention"
        title="What needs attention right now?"
        gate={getSectionGate('cc_attention')!}
        confidence={getSectionGate('cc_attention')?.confidence}
        onViewDetails={() => props.onNavigateToTab?.('overview')}
        detailsLabel="All actions"
      >
        <AttentionSection data={factPack.attention} onActionClick={props.onOpenAction} />
      </SectionCard>

      {/* Section 2: On Track */}
      <SectionCard
        sectionId="cc_on_track"
        title="Are we on track?"
        gate={getSectionGate('cc_on_track')!}
        confidence={getSectionGate('cc_on_track')?.confidence}
        onExplain={() => props.onOpenExplain?.('median_ttf')}
        explainLabel="Explain TTF"
        onViewDetails={() => props.onNavigateToTab?.('overview')}
        detailsLabel="KPI detail"
      >
        <OnTrackSection data={factPack.on_track} onExplainKPI={props.onOpenExplain} />
      </SectionCard>

      {/* Section 3: Risk */}
      <SectionCard
        sectionId="cc_risk"
        title="What's at risk?"
        gate={getSectionGate('cc_risk')!}
        confidence={getSectionGate('cc_risk')?.confidence}
        onViewDetails={() => props.onNavigateToTab?.('forecasting')}
        detailsLabel="Pre-mortem"
      >
        <RiskSection data={factPack.risk} onRiskClick={props.onNavigateToReq} />
      </SectionCard>

      {/* Section 4: Changes */}
      <SectionCard
        sectionId="cc_changes"
        title="What changed since last week?"
        gate={getSectionGate('cc_changes')!}
        confidence={getSectionGate('cc_changes')?.confidence}
        onViewDetails={() => props.onNavigateToTab?.('overview')}
        detailsLabel="Full changelog"
      >
        <ChangesSection data={factPack.changes} />
      </SectionCard>

      {/* Section 5: What-If */}
      <SectionCard
        sectionId="cc_whatif"
        title="What happens if we change something?"
        gate={getSectionGate('cc_whatif')!}
        confidence={getSectionGate('cc_whatif')?.confidence}
        onViewDetails={() => props.onNavigateToTab?.('scenarios')}
        detailsLabel="Scenario library"
      >
        <WhatIfSection data={factPack.whatif} onExploreScenario={handleExploreScenario} />
      </SectionCard>

      {/* Section 6: Bottleneck */}
      <SectionCard
        sectionId="cc_bottleneck"
        title="Pipeline or capacity — what do we need more of?"
        gate={getSectionGate('cc_bottleneck')!}
        confidence={getSectionGate('cc_bottleneck')?.confidence}
        onViewDetails={() => props.onNavigateToTab?.('capacity-rebalancer')}
        detailsLabel="Capacity plan"
      >
        <BottleneckSection data={factPack.bottleneck} onNavigate={handleNavigate} />
      </SectionCard>
    </div>
  );
};

export default CommandCenterView;
