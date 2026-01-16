// Ask ProdDash Tab - Conversational interface for dashboard insights
// AI OFF: Deterministic intent handlers over pre-computed Fact Pack
// AI ON: Free-form Q&A with BYOK, citation validation, fallback

import React, { useState, useMemo, useCallback } from 'react';
import { Requisition, Candidate, Event, User } from '../../types/entities';
import { DashboardConfig } from '../../types/config';
import { HiringManagerFriction, MetricFilters, OverviewMetrics } from '../../types';
import { HMPendingAction } from '../../types/hmTypes';
import { AskFactPack, IntentResponse } from '../../types/askTypes';
import { buildSimpleFactPack } from '../../services/askFactPackService';
import { handleDeterministicQuery } from '../../services/askIntentService';
import { AskLeftRail } from './AskLeftRail';
import { AskMainPanel } from './AskMainPanel';
import './ask-proddash.css';

export interface AskProdDashTabProps {
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
  onNavigateToTab: (tab: string) => void;
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

export function AskProdDashTab({
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
  onNavigateToTab,
}: AskProdDashTabProps) {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<IntentResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<Array<{
    query: string;
    response: IntentResponse;
    timestamp: Date;
  }>>([]);

  // Build the Fact Pack (memoized for performance)
  const factPack = useMemo<AskFactPack>(() => {
    return buildSimpleFactPack({
      requisitions,
      candidates,
      events,
      users,
      aiEnabled,
      dataHealthScore: dataHealth.overallHealthScore,
    });
  }, [requisitions, candidates, events, users, aiEnabled, dataHealth.overallHealthScore]);

  // Handle query submission
  const handleSubmit = useCallback(async (submittedQuery: string) => {
    if (!submittedQuery.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      // Try deterministic intent matching first
      const result = handleDeterministicQuery(submittedQuery, factPack);

      setResponse(result);
      setConversationHistory(prev => [...prev, {
        query: submittedQuery,
        response: result,
        timestamp: new Date(),
      }]);
      setQuery('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [factPack]);

  // Handle suggested question click
  const handleSuggestedClick = useCallback((question: string) => {
    setQuery(question);
    handleSubmit(question);
  }, [handleSubmit]);

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

  return (
    <div className="ask-proddash-container">
      <div className="ask-proddash-layout">
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
          response={response}
          isLoading={isLoading}
          error={error}
          aiEnabled={aiEnabled}
          factPack={factPack}
          onDeepLink={handleDeepLink}
          onCopy={handleCopy}
        />
      </div>
    </div>
  );
}

export default AskProdDashTab;
