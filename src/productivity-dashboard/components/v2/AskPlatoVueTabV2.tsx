'use client';

// Ask PlatoVue V2 - Tailwind-based conversational interface
// Matches V0 design language: glass panels, chat-style input, clean responses

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Send, MessageSquareText, Clock, RefreshCw, Copy, Check, Sparkles, Cpu, ChevronRight, Database, Users, Calendar, HeartPulse, AlertCircle, Loader2, ExternalLink, Zap, CheckCircle } from 'lucide-react';
import { useDashboard } from '../../hooks/useDashboardContext';
import { ActionItem } from '../../types/actionTypes';
import { createActionPlanFromResponse, responseHasActionableContent } from '../../services/askActionPlanService';
import type { IntentResponse as AskIntentResponse, FactCitation } from '../../types/askTypes';

// Types
interface SuggestedQuestion {
  category: string;
  question: string;
}

interface Citation {
  ref: string;
  label: string;
  key_path: string;
}

interface DeepLink {
  tab: string;
  label: string;
  params: Record<string, string>;
}

interface IntentResponse {
  answer_markdown: string;
  citations: Citation[];
  deep_links: DeepLink[];
  suggested_questions?: string[];
  confidence?: string;
}

interface ConversationItem {
  query: string;
  response: IntentResponse;
  timestamp: Date;
  usedFallback?: boolean;
}

interface ActionPlanFeedback {
  actionsCreated: number;
  duplicatesSkipped: number;
}

interface AskPlatoVueTabV2Props {
  onNavigateToTab?: (tab: string, params?: Record<string, string>) => void;
  onAddActions?: (actions: ActionItem[]) => void;
  existingActions?: ActionItem[];
}

// Map key_path to tab navigation
function keyPathToNavigation(keyPath: string): { tab: string; params: Record<string, string> } {
  // Map key paths to their corresponding tabs
  if (keyPath.startsWith('control_tower')) {
    return { tab: 'command-center', params: {} };
  }
  if (keyPath.startsWith('risks') || keyPath.includes('stalled') || keyPath.includes('zombie')) {
    return { tab: 'command-center', params: { section: 'risks' } };
  }
  if (keyPath.startsWith('actions')) {
    return { tab: 'command-center', params: { section: 'actions' } };
  }
  if (keyPath.startsWith('velocity') || keyPath.includes('funnel') || keyPath.includes('bottleneck')) {
    return { tab: 'diagnose', params: { subview: 'velocity' } };
  }
  if (keyPath.startsWith('sources') || keyPath.includes('source')) {
    return { tab: 'diagnose', params: { subview: 'source-mix' } };
  }
  if (keyPath.startsWith('capacity') || keyPath.includes('recruiter')) {
    return { tab: 'plan', params: { subview: 'capacity' } };
  }
  if (keyPath.startsWith('forecast')) {
    return { tab: 'plan', params: { subview: 'forecasting' } };
  }
  if (keyPath.includes('hm') || keyPath.includes('hiring_manager')) {
    return { tab: 'diagnose', params: { subview: 'hiring-managers' } };
  }
  // Default to command center
  return { tab: 'command-center', params: {} };
}

// Suggested questions organized by category
const SUGGESTED_QUESTIONS: SuggestedQuestion[] = [
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

// Thinking phrases for loading state
const THINKING_PHRASES = [
  'Analyzing your data...',
  'Scanning requisitions...',
  'Checking pipeline health...',
  'Calculating metrics...',
  'Finding insights...',
  'Processing request...',
];

// Mock response for demo
const MOCK_RESPONSE: IntentResponse = {
  answer_markdown: `## Current Pipeline Health

Your pipeline is showing some areas of concern that need attention:

**Key Findings:**
- **Time-to-fill** is averaging **47 days**, which is above your 45-day target [1]
- **3 requisitions** are currently stalled with no activity in 14+ days [2]
- Your **offer acceptance rate** is strong at 85% [3]

### Recommended Actions
1. Review stalled reqs in Engineering - 2 roles have been inactive
2. Follow up with hiring managers on pending feedback
3. Consider sourcing boost for Sales roles with thin pipelines

The overall health score is **72%** which indicates moderate risk.`,
  citations: [
    { ref: '[1]', label: 'TTF Metrics', key_path: 'control_tower.kpis.median_ttf' },
    { ref: '[2]', label: 'Stalled Reqs', key_path: 'risks.stalled_requisitions' },
    { ref: '[3]', label: 'Offer Metrics', key_path: 'control_tower.kpis.accept_rate' },
  ],
  deep_links: [
    { tab: 'control-tower', label: 'View Control Tower', params: {} },
    { tab: 'hiring-managers', label: 'HM Action Queue', params: {} },
  ],
  suggested_questions: [
    'Which hiring managers have overdue feedback?',
    'Show me the pipeline by stage',
    'What are the bottleneck stages?',
  ],
};

export function AskPlatoVueTabV2({ onNavigateToTab, onAddActions, existingActions = [] }: AskPlatoVueTabV2Props = {}) {
  const { state } = useDashboard();
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<IntentResponse | null>(null);
  const [currentQuery, setCurrentQuery] = useState<string>('');
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [copied, setCopied] = useState(false);
  const [thinkingPhrase, setThinkingPhrase] = useState(THINKING_PHRASES[0]);
  const [highlightedCitation, setHighlightedCitation] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<ConversationItem[]>([]);
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [planFeedback, setPlanFeedback] = useState<ActionPlanFeedback | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // AI mode - would come from settings in real implementation
  const aiEnabled = false;

  // Data context stats
  const dataStats = useMemo(() => ({
    reqs: state.dataStore.requisitions.length,
    candidates: state.dataStore.candidates.length,
    dataWindow: 90, // Would calculate from actual data
    healthScore: 72, // Would come from data health service
  }), [state.dataStore]);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Rotate thinking phrases during loading
  useEffect(() => {
    if (!isLoading) return;
    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % THINKING_PHRASES.length;
      setThinkingPhrase(THINKING_PHRASES[index]);
    }, 2000);
    return () => clearInterval(interval);
  }, [isLoading]);

  // Handle query submission
  const handleSubmit = useCallback(async (submittedQuery?: string) => {
    const q = submittedQuery || query;
    if (!q.trim()) return;

    setIsLoading(true);
    setCurrentQuery(q);
    setQuery('');

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    setResponse(MOCK_RESPONSE);
    setGeneratedAt(new Date());
    setConversationHistory(prev => [...prev, {
      query: q,
      response: MOCK_RESPONSE,
      timestamp: new Date(),
    }]);
    setIsLoading(false);
  }, [query]);

  // Handle keyboard submit
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Handle copy
  const handleCopy = useCallback(() => {
    if (response) {
      const text = response.answer_markdown.replace(/\[\d+\]/g, '');
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [response]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    if (currentQuery) {
      handleSubmit(currentQuery);
    }
  }, [currentQuery, handleSubmit]);

  // Handle inline citation click (e.g., [1] in text) - scroll to source badge
  const handleInlineCitationClick = useCallback((ref: string) => {
    setHighlightedCitation(ref);

    // Find and scroll to the citation badge
    const badge = document.querySelector(`[data-citation-ref="${ref}"]`);
    if (badge) {
      badge.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Clear highlight after animation
    setTimeout(() => setHighlightedCitation(null), 2000);
  }, []);

  // Handle citation badge click - navigate to the relevant tab
  const handleCitationNavigate = useCallback((citation: Citation) => {
    if (onNavigateToTab) {
      const { tab, params } = keyPathToNavigation(citation.key_path);
      onNavigateToTab(tab, params);
    } else {
      console.log('[AskPlatoVue] Navigate to:', citation.key_path);
    }
  }, [onNavigateToTab]);

  // Handle deep link click
  const handleDeepLinkClick = useCallback((link: DeepLink) => {
    if (onNavigateToTab) {
      onNavigateToTab(link.tab, link.params);
    } else {
      console.log('[AskPlatoVue] Navigate to tab:', link.tab);
    }
  }, [onNavigateToTab]);

  // Check if response has actionable content
  const hasActionableContent = useMemo(() => {
    if (!response) return false;
    // Convert local IntentResponse to service-compatible format
    const serviceResponse: AskIntentResponse = {
      answer_markdown: response.answer_markdown,
      citations: response.citations.map(c => ({
        ref: c.ref,
        label: c.label,
        key_path: c.key_path,
        value: '',
      })),
      deep_links: response.deep_links.map(d => ({
        tab: d.tab,
        label: d.label,
        params: d.params,
      })),
      suggested_questions: response.suggested_questions || [],
    };
    return responseHasActionableContent(serviceResponse);
  }, [response]);

  // Handle creating action plan from response
  const handleCreateActionPlan = useCallback(async () => {
    if (!response || !onAddActions) return;

    setIsCreatingPlan(true);

    try {
      // Convert local IntentResponse to service-compatible format
      const serviceResponse: AskIntentResponse = {
        answer_markdown: response.answer_markdown,
        citations: response.citations.map(c => ({
          ref: c.ref,
          label: c.label,
          key_path: c.key_path,
          value: '',
        })),
        deep_links: response.deep_links.map(d => ({
          tab: d.tab,
          label: d.label,
          params: d.params,
        })),
        suggested_questions: response.suggested_questions || [],
      };

      const result = createActionPlanFromResponse(
        serviceResponse,
        existingActions,
        currentQuery,
        5 // Max 5 actions
      );

      if (result.actions.length > 0) {
        onAddActions(result.actions);
      }

      setPlanFeedback({
        actionsCreated: result.actions.length,
        duplicatesSkipped: result.duplicatesSkipped,
      });

      // Clear feedback after 5 seconds
      setTimeout(() => setPlanFeedback(null), 5000);
    } catch (error) {
      console.error('[AskPlatoVue] Error creating action plan:', error);
    } finally {
      setIsCreatingPlan(false);
    }
  }, [response, existingActions, currentQuery, onAddActions]);

  // Format relative time
  const formatRelativeTime = (date: Date): string => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  // Group questions by category
  const questionsByCategory = useMemo(() => {
    return SUGGESTED_QUESTIONS.reduce((acc, q) => {
      if (!acc[q.category]) acc[q.category] = [];
      acc[q.category].push(q);
      return acc;
    }, {} as Record<string, SuggestedQuestion[]>);
  }, []);

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto min-h-[calc(100vh-200px)]">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight mb-1">
          Ask PlatoVue
        </h1>
        <p className="text-xs md:text-sm text-muted-foreground">
          Ask questions about your recruiting data in plain English
        </p>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 min-h-[600px]">

        {/* Left Rail - Suggested Questions */}
        <aside className="hidden lg:block bg-card/70 backdrop-blur-sm rounded-xl border border-border p-4 h-fit max-h-[calc(100vh-250px)] overflow-y-auto">
          <div className="mb-5">
            <h2 className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1">
              Suggested Questions
            </h2>
            {Object.entries(questionsByCategory).map(([category, questions]) => (
              <div key={category} className="mb-4">
                <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-primary mb-2 block px-1">
                  {category}
                </span>
                <div className="flex flex-col gap-1">
                  {questions.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSubmit(q.question)}
                      className="text-left px-2.5 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-foreground border border-transparent transition-all"
                    >
                      {q.question}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Recent Questions */}
          {conversationHistory.length > 0 && (
            <div>
              <h2 className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1">
                Recent Questions
              </h2>
              <div className="flex flex-col gap-1">
                {conversationHistory.slice(-5).reverse().map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setResponse(item.response);
                      setCurrentQuery(item.query);
                      setGeneratedAt(item.timestamp);
                    }}
                    className="text-left p-2 rounded-md hover:bg-accent transition-colors"
                  >
                    <span className="block text-sm text-foreground truncate max-w-[200px]">
                      {item.query}
                    </span>
                    <span className="block text-[0.65rem] text-muted-foreground mt-0.5">
                      {formatRelativeTime(item.timestamp)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Main Panel */}
        <main className="bg-card/70 backdrop-blur-sm rounded-xl border border-border p-6 flex flex-col min-h-[600px]">

          {/* Mode Badge */}
          <div className="flex justify-end mb-4">
            {aiEnabled ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-violet-500/15 text-violet-400">
                <Sparkles className="w-3 h-3" /> AI
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                <Cpu className="w-3 h-3" /> Guided
              </span>
            )}
          </div>

          {/* Input Area */}
          <div className="flex items-end gap-3 bg-card border border-border rounded-xl p-3 focus-within:border-primary transition-colors">
            <textarea
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={aiEnabled
                ? "Ask anything about your recruiting data..."
                : "Type a question or choose from suggestions..."
              }
              rows={1}
              disabled={isLoading}
              className="flex-1 bg-transparent border-none resize-none text-foreground text-sm placeholder:text-muted-foreground focus:outline-none min-h-[24px] max-h-[120px]"
            />
            <button
              onClick={() => handleSubmit()}
              disabled={isLoading || !query.trim()}
              className="shrink-0 w-11 h-11 min-w-[44px] min-h-[44px] rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex-1 flex flex-col items-center justify-center py-12">
              <div className="flex gap-2 mb-6">
                <span className="w-3 h-3 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0ms' }} />
                <span className="w-3 h-3 rounded-full bg-primary animate-pulse" style={{ animationDelay: '200ms' }} />
                <span className="w-3 h-3 rounded-full bg-primary animate-pulse" style={{ animationDelay: '400ms' }} />
              </div>
              <div className="text-sm text-muted-foreground font-medium animate-pulse">
                {thinkingPhrase}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                <span>Analyzing {dataStats.reqs} reqs</span>
                <span className="opacity-50">•</span>
                <span>{dataStats.candidates} candidates</span>
              </div>
            </div>
          )}

          {/* Response */}
          {response && !isLoading && (
            <div className="flex-1 flex flex-col mt-6">

              {/* Response Header */}
              {currentQuery && (
                <div className="flex justify-between items-start gap-4 p-3 bg-muted/50 rounded-lg border border-border mb-4">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <MessageSquareText className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-sm text-muted-foreground italic line-clamp-2">
                      {currentQuery}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {generatedAt && (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(generatedAt)}
                      </span>
                    )}
                    <button
                      onClick={handleRefresh}
                      className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground border border-border rounded-md hover:bg-accent hover:text-primary hover:border-primary transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Refresh
                    </button>
                  </div>
                </div>
              )}

              {/* Answer */}
              <div className="bg-card rounded-xl p-5 mb-4 border-l-[3px] border-primary">
                <MarkdownRenderer
                  content={response.answer_markdown}
                  onCitationClick={handleInlineCitationClick}
                />
              </div>

              {/* Citations */}
              {response.citations.length > 0 && (
                <div className="mb-4" data-sources-section>
                  <h4 className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Sources
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {response.citations.map((citation, idx) => (
                      <button
                        key={idx}
                        data-citation-ref={citation.ref}
                        onClick={() => handleCitationNavigate(citation)}
                        className={`inline-flex items-center rounded-md overflow-hidden text-xs border hover:-translate-y-0.5 transition-all duration-200 ${
                          highlightedCitation === citation.ref
                            ? 'border-primary ring-2 ring-primary/40 scale-105 shadow-lg shadow-primary/20 animate-pulse'
                            : 'border-border hover:border-primary'
                        }`}
                      >
                        <span className="bg-primary text-primary-foreground px-2 py-1 font-semibold text-[0.7rem]">
                          {citation.ref}
                        </span>
                        <span className="px-2.5 py-1 text-foreground bg-card">
                          {citation.label}
                        </span>
                        <ExternalLink className="w-2.5 h-2.5 mr-2 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Deep Links */}
              {response.deep_links.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Explore Further
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {response.deep_links.map((link, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleDeepLinkClick(link)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-primary border border-primary rounded-md hover:bg-primary/10 transition-colors"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                        {link.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Follow-ups */}
              {response.suggested_questions && response.suggested_questions.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Related Questions
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {response.suggested_questions.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSubmit(q)}
                        className="px-3.5 py-1.5 text-sm text-muted-foreground bg-card border border-border rounded-full hover:border-primary hover:text-primary transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Bar */}
              <div className="flex flex-wrap gap-2 pt-4 border-t border-border mt-auto">
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] text-xs border rounded-md transition-colors ${
                    copied
                      ? 'bg-green-500/10 border-green-500 text-green-500'
                      : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                {/* View Evidence - scrolls to sources section */}
                <button
                  onClick={() => {
                    const sourcesEl = document.querySelector('[data-sources-section]');
                    sourcesEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                  className="flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] text-xs border border-border text-muted-foreground rounded-md hover:bg-accent hover:text-foreground transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Evidence
                </button>
                {/* Create Action Plan - only show if actions can be created */}
                {onAddActions && hasActionableContent && (
                  <button
                    onClick={handleCreateActionPlan}
                    disabled={isCreatingPlan || planFeedback !== null}
                    className={`flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] text-xs border rounded-md transition-colors font-medium ${
                      planFeedback
                        ? 'bg-green-500/10 border-green-500 text-green-500'
                        : 'bg-primary/10 border-primary text-primary hover:bg-primary hover:text-primary-foreground'
                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    {isCreatingPlan ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Creating...
                      </>
                    ) : planFeedback ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5" />
                        {planFeedback.actionsCreated} Actions Added
                        {planFeedback.duplicatesSkipped > 0 && (
                          <span className="text-muted-foreground ml-1">
                            ({planFeedback.duplicatesSkipped} skipped)
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5" />
                        Create Action Plan
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!response && !isLoading && (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-violet-500/20 flex items-center justify-center mb-5">
                <MessageSquareText className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                What would you like to know?
              </h3>
              <p className="text-sm text-muted-foreground max-w-[360px] mb-6">
                {aiEnabled
                  ? 'Ask any question about your recruiting data. AI will analyze your metrics and provide insights.'
                  : 'Choose a question below or type your own to get started.'}
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  onClick={() => handleSubmit("What's on fire?")}
                  className="px-3.5 py-2 text-sm text-muted-foreground bg-card border border-border rounded-lg hover:border-primary hover:text-primary hover:bg-primary/10 transition-colors"
                >
                  What's on fire?
                </button>
                <button
                  onClick={() => handleSubmit("Why is TTF high?")}
                  className="px-3.5 py-2 text-sm text-muted-foreground bg-card border border-border rounded-lg hover:border-primary hover:text-primary hover:bg-primary/10 transition-colors"
                >
                  Why is TTF high?
                </button>
                <button
                  onClick={() => handleSubmit("Show me stalled reqs")}
                  className="px-3.5 py-2 text-sm text-muted-foreground bg-card border border-border rounded-lg hover:border-primary hover:text-primary hover:bg-primary/10 transition-colors"
                >
                  Stalled reqs
                </button>
              </div>
            </div>
          )}

          {/* Data Context Footer */}
          <div className="flex gap-4 pt-3 border-t border-border mt-auto">
            {[
              { icon: Database, value: `${dataStats.reqs} reqs` },
              { icon: Users, value: `${dataStats.candidates} candidates` },
              { icon: Calendar, value: `${dataStats.dataWindow}d window` },
              { icon: HeartPulse, value: `${dataStats.healthScore}% health` },
            ].map(({ icon: Icon, value }, idx) => (
              <span key={idx} className="flex items-center gap-1.5 text-[0.65rem] text-muted-foreground">
                <Icon className="w-3 h-3 opacity-70" />
                {value}
              </span>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

// Simple markdown renderer with citation support
function MarkdownRenderer({
  content,
  onCitationClick
}: {
  content: string;
  onCitationClick: (ref: string) => void;
}) {
  const renderLine = (line: string, key: number): React.ReactNode => {
    // Headers
    if (line.startsWith('### ')) {
      return (
        <h4 key={key} className="text-sm font-semibold text-primary mt-4 mb-2">
          {renderInline(line.slice(4))}
        </h4>
      );
    }
    if (line.startsWith('## ')) {
      return (
        <h3 key={key} className="text-base font-semibold text-foreground mb-3 pb-2 border-b border-border">
          {renderInline(line.slice(3))}
        </h3>
      );
    }

    // List items
    if (line.match(/^[-*]\s+/) || line.match(/^\d+\.\s+/)) {
      const text = line.replace(/^[-*\d.]+\s+/, '');
      return (
        <li key={key} className="text-sm text-foreground mb-1.5 ml-4">
          {renderInline(text)}
        </li>
      );
    }

    // Empty line
    if (!line.trim()) {
      return <div key={key} className="h-2" />;
    }

    // Regular paragraph
    return (
      <p key={key} className="text-sm text-foreground mb-2.5 leading-relaxed">
        {renderInline(line)}
      </p>
    );
  };

  const renderInline = (text: string): React.ReactNode => {
    const parts = text.split(/(\*\*[^*]+\*\*|\[\d+\])/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="text-primary font-semibold">{part.slice(2, -2)}</strong>;
      }
      if (/^\[\d+\]$/.test(part)) {
        return (
          <button
            key={i}
            onClick={() => onCitationClick(part)}
            className="text-primary font-semibold hover:underline mx-0.5"
            title={`Jump to source ${part}`}
          >
            <sup>{part}</sup>
          </button>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const lines = content.split('\n');

  return (
    <div className="prose prose-invert prose-sm max-w-none">
      {lines.map((line, idx) => renderLine(line, idx))}
    </div>
  );
}

export default AskPlatoVueTabV2;
