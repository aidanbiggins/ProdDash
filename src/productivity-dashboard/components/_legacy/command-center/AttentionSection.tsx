// Section 1: What needs attention right now? (V2)
// Summary tiles only — drawer is rendered by CommandCenterView (outside the
// SectionCard stacking context) to avoid position:fixed being scoped to the
// animated card instead of the viewport.

import React, { useCallback } from 'react';
import { AttentionV2Data, AttentionBucketId } from '../../../types/attentionTypes';
import { AttentionSummaryTiles } from './AttentionSummaryTiles';
import { TabType } from '../../../routes';
import {
  DrawerFocus,
  navigateToAttentionEvidence,
} from '../../../services/attentionNavigationService';

interface AttentionSectionProps {
  data: AttentionV2Data;
  onNavigateToTab?: (tab: TabType | string) => void;
  onOpenDrilldown?: (focus?: DrawerFocus) => void;
}

export const AttentionSection: React.FC<AttentionSectionProps> = ({ data, onNavigateToTab, onOpenDrilldown }) => {
  const handleNavigateViaBucket = useCallback((bucketId: AttentionBucketId) => {
    navigateToAttentionEvidence(
      bucketId,
      { drilldownData: data.drilldown },
      {
        navigateToTab: (tab: TabType) => onNavigateToTab?.(tab),
        openDrawerWithFocus: (focus: DrawerFocus) => {
          onOpenDrilldown?.(focus);
        },
      }
    );
  }, [data.drilldown, onNavigateToTab, onOpenDrilldown]);

  return (
    <AttentionSummaryTiles
      data={data.summary}
      onBucketAction={handleNavigateViaBucket}
    />
  );
};
