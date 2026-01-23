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
import { AttentionDrilldownDrawer, DrawerBackdrop } from './AttentionDrilldownDrawer';
import { ExplainDrawer } from '../common/ExplainDrawer';
import { Requisition, Candidate, Event, User } from '../../types/entities';
import { reqMatchesFilters } from '../../services/filterUtils';
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
import { ExplainProviderId, Explanation } from '../../types/explainTypes';
import { HMPendingAction } from '../../types/hmTypes';
import { TabType } from '../../routes';
import { computeAttentionV2 } from '../../services/attentionSummaryService';
import { AttentionV2Data } from '../../types/attentionTypes';
import { computeTopPriority } from '../../services/priorityArbitrationService';
import { TopPriorityRibbon } from './TopPriorityRibbon';
import { DrawerFocus } from '../../services/attentionNavigationService';
import {
  CommandCenterIntent,
  NavigationContext,
  NavigationHelpers,
  getCommandCenterDestination,
  performCommandCenterDestination,
} from '../../services/commandCenterNavigationService';
import './CommandCenter.css';

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
}

export const CommandCenterView: React.FC<CommandCenterViewProps> = (props) => {
  const [briefCopied, setBriefCopied] = useState(false);
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drawerFocus, setDrawerFocus] = useState<DrawerFocus | undefined>(undefined);
  const [explainOpen, setExplainOpen] = useState(false);
  const [explainData, setExplainData] = useState<Explanation | null>(null);

  // ── Filter data by dimensional filters ──
  const filteredRequisitions = useMemo(() => {
    return props.requisitions.filter(req => reqMatchesFilters(req, props.filters));
  }, [props.requisitions, props.filters]);

  const filteredReqIds = useMemo(() => {
    return new Set(filteredRequisitions.map(r => r.req_id));
  }, [filteredRequisitions]);

  const filteredCandidates = useMemo(() => {
    return props.candidates.filter(c => filteredReqIds.has(c.req_id));
  }, [props.candidates, filteredReqIds]);

  const filteredEvents = useMemo(() => {
    return props.events.filter(e => filteredReqIds.has(e.req_id));
  }, [props.events, filteredReqIds]);

  const filteredHmIds = useMemo(() => {
    return new Set(filteredRequisitions.map(r => r.hiring_manager_id).filter(Boolean));
  }, [filteredRequisitions]);

  const filteredHmFriction = useMemo(() => {
    return props.hmFriction.filter(hm => filteredHmIds.has(hm.hmId));
  }, [props.hmFriction, filteredHmIds]);

  const filteredHmActions = useMemo(() => {
    return props.hmActions.filter(a => filteredReqIds.has(a.reqId));
  }, [props.hmActions, filteredReqIds]);

  // Compute explanations, actions, and pre-mortems from filtered data
  const explanations = useMemo(() => {
    const context = {
      requisitions: filteredRequisitions,
      candidates: filteredCandidates,
      events: filteredEvents,
      users: props.users,
      filters: props.filters,
      config: props.config,
      overview: props.overview,
      hmFriction: filteredHmFriction,
    };
    const map = new Map<ExplainProviderId, any>();
    const ids: ExplainProviderId[] = ['median_ttf', 'hm_latency', 'stalled_reqs', 'offer_accept_rate', 'time_to_offer'];
    for (const id of ids) {
      map.set(id, getExplanation(id, context));
    }
    return map;
  }, [filteredRequisitions, filteredCandidates, filteredEvents, props.users, props.filters, props.config, props.overview, filteredHmFriction]);

  const actions: ActionItem[] = useMemo(() => {
    const datasetId = `cc_${filteredRequisitions.length}_${filteredCandidates.length}`;
    return generateUnifiedActionQueue({
      hmActions: filteredHmActions,
      explanations,
      requisitions: filteredRequisitions,
      users: props.users,
      datasetId,
    });
  }, [filteredHmActions, explanations, filteredRequisitions, filteredCandidates.length, props.users]);

  const preMortems = useMemo(() => {
    return runPreMortemBatch(filteredRequisitions, filteredCandidates, filteredEvents, filteredHmActions);
  }, [filteredRequisitions, filteredCandidates, filteredEvents, filteredHmActions]);

  const attentionV2Data: AttentionV2Data = useMemo(() => {
    return computeAttentionV2({
      requisitions: filteredRequisitions,
      candidates: filteredCandidates,
      users: props.users,
      overview: props.overview,
      hmFriction: filteredHmFriction,
      hmActions: filteredHmActions,
      coverage: props.coverage,
    });
  }, [filteredRequisitions, filteredCandidates, props.users, props.overview, filteredHmFriction, filteredHmActions, props.coverage]);

  const { factPack, gates, isSectionBlocked, getSectionGate } = useCommandCenter({
    requisitions: filteredRequisitions,
    candidates: filteredCandidates,
    events: filteredEvents,
    users: props.users,
    overview: props.overview,
    hmFriction: filteredHmFriction,
    actions,
    preMortems,
    filters: props.filters,
    config: props.config,
    coverage: props.coverage,
  });

  const topPriority = useMemo(() => {
    return computeTopPriority(attentionV2Data, factPack);
  }, [attentionV2Data, factPack]);

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

  const handleOpenDrilldown = useCallback((focus?: DrawerFocus) => {
    setDrawerFocus(focus);
    setDrilldownOpen(true);
  }, []);

  const handleOpenExplain = useCallback((providerId: string) => {
    const explanation = explanations.get(providerId as ExplainProviderId);
    if (explanation) {
      setExplainData(explanation);
      setExplainOpen(true);
    }
  }, [explanations]);

  const navContext: NavigationContext = useMemo(() => ({
    bottleneckDiagnosis: factPack.bottleneck.diagnosis,
    hasAttentionDrilldown: attentionV2Data.drilldown.recruiters.length > 0 ||
      attentionV2Data.drilldown.hiringManagers.length > 0 ||
      attentionV2Data.drilldown.reqClusters.length > 0,
    hasOnTrackKPIs: factPack.on_track.kpis.length > 0,
    hasRiskGroups: factPack.risk.items.length > 0,
    hasChanges: factPack.changes.deltas.length > 0,
    hasScenarios: factPack.whatif.scenario_previews.length > 0,
    defaultExplainKPI: 'median_ttf',
  }), [factPack, attentionV2Data]);

  const navHelpers: NavigationHelpers = useMemo(() => ({
    onNavigateToTab: props.onNavigateToTab,
    openAttentionDrilldown: handleOpenDrilldown,
    openExplainDrawer: handleOpenExplain,
  }), [props.onNavigateToTab, handleOpenDrilldown, handleOpenExplain]);

  const handleCTA = useCallback((intent: CommandCenterIntent) => {
    const destination = getCommandCenterDestination(intent, navContext);
    performCommandCenterDestination(destination, navHelpers);
  }, [navContext, navHelpers]);

  const confidenceClass = factPack.meta.confidence === 'HIGH'
    ? 'cc-header__confidence-value--high'
    : factPack.meta.confidence === 'MED'
    ? 'cc-header__confidence-value--med'
    : 'cc-header__confidence-value--low';

  return (
    <div className="cc-view command-center-view">
      {/* Header */}
      <div className="cc-header">
        <div>
          <h1 className="cc-header__title">Command Center</h1>
          <div className="cc-header__confidence">
            Data confidence: <span className={confidenceClass}>{factPack.meta.confidence}</span>
          </div>
        </div>
        <button
          onClick={handleGenerateBrief}
          className={`cc-header__brief-btn ${briefCopied ? 'cc-header__brief-btn--copied' : 'cc-header__brief-btn--default'}`}
        >
          {briefCopied ? 'Copied!' : 'Generate Exec Brief'}
        </button>
      </div>

      {/* Top Priority Ribbon */}
      <TopPriorityRibbon priority={topPriority} onNavigate={props.onNavigateToTab} />

      {/* Section 1: Attention */}
      <SectionCard
        sectionId="cc_attention"
        title="What needs attention right now?"
        gate={getSectionGate('cc_attention')!}
        confidence={getSectionGate('cc_attention')?.confidence}
        confidenceType="data"
        detailsCTA={{ label: 'Details', onClick: () => handleCTA('details_actions') }}
      >
        <AttentionSection data={attentionV2Data} onNavigateToTab={props.onNavigateToTab} onOpenDrilldown={handleOpenDrilldown} />
      </SectionCard>

      {/* Section 2: On Track */}
      <SectionCard
        sectionId="cc_on_track"
        title="Are we on track?"
        gate={getSectionGate('cc_on_track')!}
        confidence={getSectionGate('cc_on_track')?.confidence}
        confidenceType="data"
        primaryCTA={{ label: 'Explain TTF', onClick: () => handleCTA('explain_kpi') }}
        detailsCTA={{ label: 'Details', onClick: () => handleCTA('kpi_details') }}
      >
        <OnTrackSection data={factPack.on_track} onExplainKPI={handleOpenExplain} />
      </SectionCard>

      {/* Section 3: Risk */}
      <SectionCard
        sectionId="cc_risk"
        title="What's at risk?"
        gate={getSectionGate('cc_risk')!}
        confidence={getSectionGate('cc_risk')?.confidence}
        confidenceType="risk"
        primaryCTA={{ label: 'Triage risks', onClick: () => handleCTA('triage_risks') }}
        detailsCTA={{ label: 'Details', onClick: () => handleCTA('risk_details') }}
      >
        <RiskSection data={factPack.risk} onRiskClick={props.onNavigateToReq} />
      </SectionCard>

      {/* Section 4: Changes */}
      <SectionCard
        sectionId="cc_changes"
        title="What changed since last week?"
        gate={getSectionGate('cc_changes')!}
        confidence={getSectionGate('cc_changes')?.confidence}
        confidenceType="data"
        detailsCTA={{ label: 'Details', onClick: () => handleCTA('changes_details') }}
      >
        <ChangesSection data={factPack.changes} />
      </SectionCard>

      {/* Section 5: What-If */}
      <SectionCard
        sectionId="cc_whatif"
        title="What if we change something?"
        gate={getSectionGate('cc_whatif')!}
        confidence={getSectionGate('cc_whatif')?.confidence}
        confidenceType="forecast"
        primaryCTA={{ label: 'Model scenarios', onClick: () => handleCTA('model_scenarios') }}
        detailsCTA={{ label: 'Details', onClick: () => handleCTA('scenario_details') }}
      >
        <WhatIfSection data={factPack.whatif} bottleneckDiagnosis={factPack.bottleneck.diagnosis} onExploreScenario={handleExploreScenario} />
      </SectionCard>

      {/* Section 6: Bottleneck */}
      <SectionCard
        sectionId="cc_bottleneck"
        title="Pipeline or capacity?"
        gate={getSectionGate('cc_bottleneck')!}
        confidence={getSectionGate('cc_bottleneck')?.confidence}
        confidenceType="data"
        primaryCTA={{ label: 'Rebalance', onClick: () => handleCTA('rebalance_capacity') }}
        detailsCTA={{ label: 'Details', onClick: () => handleCTA('bottleneck_details') }}
      >
        <BottleneckSection data={factPack.bottleneck} onNavigate={handleNavigate} />
      </SectionCard>

      {/* Drawer + Backdrop rendered here (outside SectionCard stacking contexts) */}
      <DrawerBackdrop isOpen={drilldownOpen} onClose={() => setDrilldownOpen(false)} />
      <AttentionDrilldownDrawer
        data={attentionV2Data.drilldown}
        isOpen={drilldownOpen}
        onClose={() => setDrilldownOpen(false)}
        onNavigate={(tab) => props.onNavigateToTab?.(tab)}
        focus={drawerFocus}
      />
      <ExplainDrawer
        isOpen={explainOpen}
        onClose={() => setExplainOpen(false)}
        explanation={explainData}
      />
    </div>
  );
};

export default CommandCenterView;
