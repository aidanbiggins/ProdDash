// useCommandCenter - React hook for the Command Center view
// Assembles data from existing services into the CommandCenterFactPack.
// Re-computes when data or filters change.

import { useMemo } from 'react';
import { CommandCenterFactPack, SectionGateResult } from '../types/commandCenterTypes';
import { buildCommandCenterFactPack, evaluateSectionGates, CommandCenterContext } from '../services/commandCenterService';
import { Requisition, Candidate, Event, User } from '../types/entities';
import { OverviewMetrics, MetricFilters } from '../types/metrics';
import { DashboardConfig } from '../types/config';
import { HiringManagerFriction } from '../types/metrics';
import { ActionItem } from '../types/actionTypes';
import { CoverageMetrics } from '../types/resilientImportTypes';
import { PreMortemResult } from '../types/preMortemTypes';

export interface UseCommandCenterProps {
  requisitions: Requisition[];
  candidates: Candidate[];
  events: Event[];
  users: User[];
  overview: OverviewMetrics | null;
  hmFriction: HiringManagerFriction[];
  actions: ActionItem[];
  preMortems: PreMortemResult[];
  filters: MetricFilters;
  config: DashboardConfig;
  coverage: CoverageMetrics | null | undefined;
}

export interface UseCommandCenterReturn {
  factPack: CommandCenterFactPack;
  gates: SectionGateResult[];
  isSectionUsable: (sectionId: string) => boolean;
  isSectionBlocked: (sectionId: string) => boolean;
  getSectionGate: (sectionId: string) => SectionGateResult | undefined;
}

export function useCommandCenter(props: UseCommandCenterProps): UseCommandCenterReturn {
  const gates = useMemo(
    () => evaluateSectionGates(props.coverage),
    [props.coverage]
  );

  const factPack = useMemo(() => {
    const ctx: CommandCenterContext = {
      requisitions: props.requisitions,
      candidates: props.candidates,
      events: props.events,
      users: props.users,
      overview: props.overview,
      hmFriction: props.hmFriction,
      actions: props.actions,
      preMortems: props.preMortems,
      filters: props.filters,
      config: props.config,
      coverage: props.coverage,
    };
    return buildCommandCenterFactPack(ctx);
  }, [
    props.requisitions,
    props.candidates,
    props.events,
    props.users,
    props.overview,
    props.hmFriction,
    props.actions,
    props.preMortems,
    props.filters,
    props.config,
    props.coverage,
  ]);

  const gateMap = useMemo(
    () => new Map(gates.map(g => [g.sectionId, g])),
    [gates]
  );

  return {
    factPack,
    gates,
    isSectionUsable: (id: string) => {
      const gate = gateMap.get(id as any);
      return gate ? gate.status !== 'BLOCKED' : false;
    },
    isSectionBlocked: (id: string) => {
      const gate = gateMap.get(id as any);
      return gate ? gate.status === 'BLOCKED' : true;
    },
    getSectionGate: (id: string) => gateMap.get(id as any),
  };
}

export default useCommandCenter;
