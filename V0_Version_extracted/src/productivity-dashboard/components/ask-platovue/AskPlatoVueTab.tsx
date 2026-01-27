// Ask PlatoVue Tab - Conversational interface for dashboard insights
// AI OFF: Deterministic intent handlers over pre-computed Fact Pack
// AI ON: Free-form Q&A with BYOK, citation validation, fallback

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Requisition, Candidate, Event, User } from '../../types/entities';
import { DashboardConfig } from '../../types/config';
import { HiringManagerFriction, MetricFilters, OverviewMetrics } from '../../types';
import { HMPendingAction } from '../../types/hmTypes';
import { AiProviderConfig } from '../../types/aiTypes';
import { AskFactPack, IntentResponse } from '../../types/askTypes';
import { ActionItem } from '../../types/actionTypes';
import { DataSnapshot, SnapshotEvent } from '../../types/snapshotTypes';
import { buildSimpleFactPack } from '../../services/askFactPackService';
import { handleDeterministicQuery } from '../../services/askIntentService';
import { sendAskQueryWithRetry } from '../../services/askAiService';
import { saveAskCache, loadAskCache, loadAskHistory, AskCacheEntry } from '../../services/askCacheService';
import { checkAskCoverage, CoverageGateResult } from '../../services/askCoverageGateService';
import { createActionPlanFromResponse } from '../../services/askActionPlanService';
import { AskLeftRail } from './AskLeftRail';
import { AskMainPanel, ActionPlanFeedback } from './AskMainPanel';
import { AskBlockedState } from './AskBlockedState';
import { PageHeader } from '../common/PageHeader';
import { HelpButton, HelpDrawer } from '../common';
import { ASK_PLATOVUE_PAGE_HELP } from './askPlatoVueHelpContent';
import './ask-platovue.css';

export interface AskPlatoVueTabProps {
  requisitions: Requisition[];
  candidates: Candidate[];
  events: Event[];
  users: User[];
  overview: OverviewMetrics | null;
  hmFriction: HiringManagerFriction[];
  hmActions: HMPendingAction[];
  config: DashboardConfig;
  filters: MetricFilters;
  dataHealth: {
    overallHealthScore: number;
  };
  aiEnabled: boolean;
  aiConfig: AiProviderConfig | null;
  onNavigateToTab: (tab: string) => void;
  existingActions?: ActionItem[];
  onAddActions?: (actions: ActionItem[]) => void;
  // Snapshot data for SLA tracking (optional)
  snapshots?: DataSnapshot[];
  snapshotEvents?: SnapshotEvent[];
}

// Suggested questions for the left rail
const SUGGESTED_QUESTIONS = [
  { category: 'Health', question: "What's on fire right now?" },
  { category: 'Health', question: 'What are my top risks?' },
  { category: 'Actions', question: 'What actions should I take today?' },
  { category: 'Metrics', question: 'Why is time-to-offer so high?' },
  { category: 'Metrics', question: 'Why is HM latency elevated?' },
  { category: 'Pipeline', question: 'Which reqs are stalled?' },
  { category: 'Pipeline', question: 'What is my forecast gap?' },
  { category: 'Analysis', question: 'How is my pipeline velocity?' },
  { category: 'Analysis', question: 'How is my source mix performing?' },
  { category: 'Team', question: 'How is recruiter capacity looking?' },
];

export function AskPlatoVueTab({
  requisitions,
  candidates,
  events,
  users,
  overview,
  hmFriction,
  hmActions,
  config,
  filters,
  dataHealth,
  aiEnabled,
  aiConfig,
  onNavigateToTab,
  existingActions = [],
  onAddActions,
  snapshots = [],
  snapshotEvents = [],
}: AskPlatoVueTabProps) {
  const [showPageHelp, setShowPageHelp] = useState(false);
  const [query, setQuery] = useState('');
  const [currentQuery, setCurrentQuery] = useState<string>(''); // The query that generated the current response
  const [response, setResponse] = useState<IntentResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null); // ISO timestamp
  const [conversationHistory, setConversationHistory] = useState<Array<{
    query: string;
    response: IntentResponse;
    timestamp: Date;
    usedFallback?: boolean;
  }>>([]);

  // Load cached response on mount
  useEffect(() => {
    const cached = loadAskCache();
    if (cached) {
      setResponse(cached.response);
      setCurrentQuery(cached.query);
      setGeneratedAt(cached.generatedAt);
      setUsedFallback(cached.usedFallback);
    }

    // Load conversation history from cache
    const cachedHistory = loadAskHistory();
    if (cachedHistory.length > 0) {
      setConversationHistory(cachedHistory.map(entry => ({
        query: entry.query,
        response: entry.response,
        timestamp: new Date(entry.generatedAt),
        usedFallback: entry.usedFallback,
      })));
    }
  }, []);

  // Build the Fact Pack (memoized for performance)
  const factPack = useMemo<AskFactPack>(() => {
    return buildSimpleFactPack({
      requisitions,
      candidates,
      events,
      users,
      aiEnabled,
      dataHealthScore: dataHealth.overallHealthScore,
      filters: {
        recruiterIds: filters.recruiterIds,
        dateRange: filters.dateRange,
        functions: filters.functions,
        regions: filters.regions,
      },
      snapshots,
      snapshotEvents,
    });
  }, [requisitions, candidates, events, users, aiEnabled, dataHealth.overallHealthScore, filters, snapshots, snapshotEvents]);

  // Check coverage gate
  const coverageResult = useMemo<CoverageGateResult>(() => {
    return checkAskCoverage(factPack);
  }, [factPack]);

  // Handle query submission
  const handleSubmit = useCallback(async (submittedQuery: string) => {
    if (!submittedQuery.trim()) return;

    setIsLoading(true);
    setError(null);
    setUsedFallback(false);

    try {
      let result: IntentResponse;
      let didUseFallback = false;

      // Use AI if enabled and configured, otherwise use deterministic
      if (aiEnabled && aiConfig) {
        const aiResult = await sendAskQueryWithRetry(submittedQuery, factPack, aiConfig);
        result = aiResult.response;
        didUseFallback = aiResult.usedFallback || false;

        // Log for debugging (no user-visible error details)
        if (aiResult.usedFallback && aiResult.error) {
          console.log('AI used fallback:', aiResult.error);
        }
      } else {
        // Deterministic intent matching
        result = handleDeterministicQuery(submittedQuery, factPack);
      }

      const timestamp = new Date().toISOString();

      setResponse(result);
      setCurrentQuery(submittedQuery);
      setGeneratedAt(timestamp);
      setUsedFallback(didUseFallback);
      setConversationHistory(prev => [...prev, {
        query: submittedQuery,
        response: result,
        timestamp: new Date(),
        usedFallback: didUseFallback,
      }]);
      setQuery('');

      // Save to cache for persistence across navigation
      saveAskCache({
        query: submittedQuery,
        response: result,
        generatedAt: timestamp,
        usedFallback: didUseFallback,
        aiEnabled,
      });
    } catch (err) {
      // Clean error message, no internal details
      setError('Something went wrong. Please try again.');
      console.error('Ask query error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [factPack, aiEnabled, aiConfig]);

  // Handle suggested question click
  const handleSuggestedClick = useCallback((question: string) => {
    setQuery(question);
    handleSubmit(question);
  }, [handleSubmit]);

  // Handle refresh - re-run the current query
  const handleRefresh = useCallback(() => {
    if (currentQuery) {
      handleSubmit(currentQuery);
    }
  }, [currentQuery, handleSubmit]);

  // Handle deep link navigation
  const handleDeepLink = useCallback((tab: string, params: Record<string, string>) => {
    onNavigateToTab(tab);
    // Note: params can be used to set filters or highlight specific items
    // This will be enhanced in Commits 10-12
  }, [onNavigateToTab]);

  // Handle copy response
  const handleCopy = useCallback(() => {
    if (response) {
      const text = response.answer_markdown.replace(/\[\d+\]/g, ''); // Strip citation refs
      navigator.clipboard.writeText(text);
    }
  }, [response]);

  // Handle creating action plan from response
  const handleCreateActionPlan = useCallback(async (): Promise<ActionPlanFeedback | null> => {
    if (!response || !onAddActions) return null;

    const result = createActionPlanFromResponse(
      response,
      existingActions,
      currentQuery,
      5 // Max 5 actions
    );

    if (result.actions.length > 0) {
      onAddActions(result.actions);
    }

    return {
      actionsCreated: result.actions.length,
      duplicatesSkipped: result.duplicatesSkipped,
    };
  }, [response, existingActions, currentQuery, onAddActions]);

  // If coverage gate fails, show blocked state
  if (!coverageResult.enabled) {
    return (
      <div className="ask-platovue-container">
        <AskBlockedState
          issues={coverageResult.issues}
          onNavigateToTab={onNavigateToTab}
        />
      </div>
    );
  }

  return (
    <div className="ask-platovue-container">
      <PageHeader
        title="Ask PlatoVue"
        subtitle="Ask questions about your recruiting data in plain English"
        actions={<HelpButton onClick={() => setShowPageHelp(true)} ariaLabel="Open page help" />}
      />
      <HelpDrawer
        isOpen={showPageHelp}
        onClose={() => setShowPageHelp(false)}
        title="Ask PlatoVue"
        content={ASK_PLATOVUE_PAGE_HELP}
      />

      <div className="ask-platovue-layout">
        {/* Left Rail - Suggested Questions */}
        <AskLeftRail
          suggestedQuestions={SUGGESTED_QUESTIONS}
          onQuestionClick={handleSuggestedClick}
          conversationHistory={conversationHistory}
          onHistoryClick={(item) => {
            setQuery(item.query);
            setResponse(item.response);
          }}
        />

        {/* Main Panel - Input + Response */}
        <AskMainPanel
          query={query}
          onQueryChange={setQuery}
          onSubmit={() => handleSubmit(query)}
          onQuickAsk={handleSuggestedClick}
          response={response}
          isLoading={isLoading}
          error={error}
          aiEnabled={aiEnabled}
          factPack={factPack}
          onDeepLink={handleDeepLink}
          onCopy={handleCopy}
          usedFallback={usedFallback}
          currentQuery={currentQuery}
          generatedAt={generatedAt}
          onRefresh={handleRefresh}
          onCreateActionPlan={onAddActions ? handleCreateActionPlan : undefined}
        />
      </div>
    </div>
  );
}

export default AskPlatoVueTab;
