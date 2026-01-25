// Ask Main Panel - Query input and response display
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { IntentResponse, AskFactPack, FactCitation } from '../../types/askTypes';
import { keyPathToDeepLinkWithFallback, highlightElement } from '../../services/askDeepLinkService';
import { getRelativeTime } from '../../services/askCacheService';
import { responseHasActionableContent } from '../../services/askActionPlanService';

export interface ActionPlanFeedback {
  actionsCreated: number;
  duplicatesSkipped: number;
}

interface AskMainPanelProps {
  query: string;
  onQueryChange: (query: string) => void;
  onSubmit: () => void;
  onQuickAsk: (question: string) => void;
  response: IntentResponse | null;
  isLoading: boolean;
  error: string | null;
  aiEnabled: boolean;
  factPack: AskFactPack;
  onDeepLink: (tab: string, params: Record<string, string>) => void;
  onCopy: () => void;
  usedFallback?: boolean;
  currentQuery?: string;
  generatedAt?: string | null;
  onRefresh?: () => void;
  onCreateActionPlan?: () => Promise<ActionPlanFeedback | null>;
}

// Thinking phrases for loading animation
const THINKING_PHRASES = [
  'Analyzing your data...',
  'Scanning requisitions...',
  'Checking pipeline health...',
  'Calculating metrics...',
  'Finding insights...',
  'Processing request...',
];

export function AskMainPanel({
  query,
  onQueryChange,
  onSubmit,
  onQuickAsk,
  response,
  isLoading,
  error,
  aiEnabled,
  factPack,
  onDeepLink,
  onCopy,
  usedFallback,
  currentQuery,
  generatedAt,
  onRefresh,
  onCreateActionPlan,
}: AskMainPanelProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);
  const [thinkingPhrase, setThinkingPhrase] = useState(THINKING_PHRASES[0]);
  const [highlightedCitation, setHighlightedCitation] = useState<string | null>(null);
  const [relativeTime, setRelativeTime] = useState<string>('');
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [planFeedback, setPlanFeedback] = useState<ActionPlanFeedback | null>(null);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Update relative time periodically
  useEffect(() => {
    if (!generatedAt) {
      setRelativeTime('');
      return;
    }

    // Set initial value
    setRelativeTime(getRelativeTime(generatedAt));

    // Update every minute
    const interval = setInterval(() => {
      setRelativeTime(getRelativeTime(generatedAt));
    }, 60000);

    return () => clearInterval(interval);
  }, [generatedAt]);

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

  // Handle copy with feedback
  const handleCopy = useCallback(() => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [onCopy]);

  // Handle keyboard submit
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  // Handle citation click in text - scroll to and highlight source chip
  const handleCitationClick = useCallback((ref: string) => {
    setHighlightedCitation(ref);
    // Find and scroll to the citation badge
    const badge = document.querySelector(`[data-citation-ref="${ref}"]`);
    if (badge) {
      badge.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    // Clear highlight after animation
    setTimeout(() => setHighlightedCitation(null), 2000);
  }, []);

  // Handle creating action plan
  const handleCreateActionPlan = useCallback(async () => {
    if (!onCreateActionPlan || isCreatingPlan) return;

    setIsCreatingPlan(true);
    setPlanFeedback(null);

    try {
      const result = await onCreateActionPlan();
      if (result) {
        setPlanFeedback(result);
        // Clear feedback after a few seconds
        setTimeout(() => setPlanFeedback(null), 5000);
      }
    } catch (err) {
      console.error('Failed to create action plan:', err);
    } finally {
      setIsCreatingPlan(false);
    }
  }, [onCreateActionPlan, isCreatingPlan]);

  // Check if response has actionable content
  const hasActionableContent = response ? responseHasActionableContent(response) : false;

  return (
    <main className="ask-main-panel">
      {/* Top Bar with Mode Badge */}
      <div className="ask-top-bar">
        <div className="ask-mode-badge">
          {aiEnabled ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium badge-ai-on">
              <i className="bi bi-stars" /> AI
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium badge-ai-off">
              <i className="bi bi-cpu" /> Guided
            </span>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="ask-input-container">
        <textarea
          ref={inputRef}
          className="ask-input"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={aiEnabled
            ? "Ask anything about your recruiting data..."
            : "Type a question or choose from suggestions..."
          }
          rows={1}
          disabled={isLoading}
        />
        <button
          className="ask-submit-btn"
          onClick={onSubmit}
          disabled={isLoading || !query.trim()}
          title="Send"
        >
          {isLoading ? (
            <span className="w-4 h-4 border-2 border-current border-r-transparent rounded-full animate-spin" />
          ) : (
            <i className="bi bi-arrow-up" />
          )}
        </button>
      </div>

      {/* Loading State - Animated */}
      {isLoading && (
        <div className="ask-loading-state">
          <div className="ask-loading-animation">
            <div className="ask-thinking-orbs">
              <span className="ask-orb ask-orb-1"></span>
              <span className="ask-orb ask-orb-2"></span>
              <span className="ask-orb ask-orb-3"></span>
            </div>
            <div className="ask-thinking-text">{thinkingPhrase}</div>
          </div>
          <div className="ask-loading-context">
            <span>Analyzing {factPack.meta.sample_sizes.total_reqs} reqs</span>
            <span className="ask-loading-dot">•</span>
            <span>{factPack.meta.sample_sizes.total_candidates} candidates</span>
          </div>
        </div>
      )}

      {/* Error Display - Clean banner, no internal details */}
      {error && !isLoading && (
        <div className="ask-error">
          <i className="bi bi-exclamation-circle" />
          <span>Something went wrong. Please try again.</span>
        </div>
      )}

      {/* Response Display */}
      {response && !isLoading && (
        <div className="ask-response">
          {/* Response Header - Shows query, timestamp, refresh */}
          {currentQuery && (
            <div className="ask-response-header">
              <div className="ask-response-query">
                <i className="bi bi-chat-left-text" />
                <span className="ask-response-query-text">{currentQuery}</span>
              </div>
              <div className="ask-response-meta">
                {relativeTime && (
                  <span className="ask-response-timestamp" title={generatedAt ? new Date(generatedAt).toLocaleString() : ''}>
                    <i className="bi bi-clock" />
                    {relativeTime}
                  </span>
                )}
                {onRefresh && (
                  <button
                    className="ask-refresh-btn"
                    onClick={onRefresh}
                    title="Regenerate response"
                  >
                    <i className="bi bi-arrow-clockwise" />
                    Refresh
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Fallback Banner - Clean, no internal error details */}
          {usedFallback && (
            <div className="ask-fallback-banner">
              <i className="bi bi-info-circle" />
              <span>AI unavailable. Showing deterministic answer.</span>
            </div>
          )}

          {/* Answer */}
          <div className="ask-answer">
            <MarkdownRenderer
              content={response.answer_markdown}
              onCitationClick={handleCitationClick}
            />
          </div>

          {/* Citations / Sources */}
          {response.citations.length > 0 && (
            <div className="ask-citations">
              <h4 className="ask-citations-title">Sources</h4>
              <div className="ask-citations-list">
                {response.citations.map((citation, idx) => (
                  <CitationBadge
                    key={idx}
                    citation={citation}
                    onNavigate={onDeepLink}
                    isHighlighted={highlightedCitation === citation.ref}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Deep Links / Explore Further */}
          {response.deep_links.length > 0 && (
            <div className="ask-deep-links">
              <h4 className="ask-deep-links-title">Explore Further</h4>
              <div className="ask-deep-links-list">
                {response.deep_links.map((link, idx) => (
                  <button
                    key={idx}
                    className="ask-deep-link"
                    onClick={() => onDeepLink(link.tab, link.params)}
                  >
                    <i className="bi bi-arrow-right-circle" />
                    {link.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Suggested Follow-ups */}
          {response.suggested_questions && response.suggested_questions.length > 0 && (
            <div className="ask-follow-ups">
              <h4 className="ask-follow-ups-title">Related Questions</h4>
              <div className="ask-follow-ups-list">
                {response.suggested_questions.map((q, idx) => (
                  <button
                    key={idx}
                    className="ask-follow-up-chip"
                    onClick={() => onQuickAsk(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div className="ask-action-bar">
            <button
              className={`ask-action-btn ${copied ? 'ask-action-btn-success' : ''}`}
              onClick={handleCopy}
              title="Copy response"
            >
              <i className={`bi ${copied ? 'bi-check' : 'bi-clipboard'}`} />
              {copied ? 'Copied!' : 'Copy'}
            </button>
            {response.citations.length > 0 && (
              <button
                className="ask-action-btn"
                onClick={() => onDeepLink('control-tower', {})}
                title="View evidence in Control Tower"
              >
                <i className="bi bi-search" />
                View Evidence
              </button>
            )}
            {/* Create Action Plan Button */}
            {onCreateActionPlan && hasActionableContent && (
              <button
                className={`ask-action-btn ask-action-btn-primary ${planFeedback ? 'ask-action-btn-success' : ''}`}
                onClick={handleCreateActionPlan}
                disabled={isCreatingPlan}
                title="Create action items from this response"
              >
                {isCreatingPlan ? (
                  <>
                    <span className="w-4 h-4 border-2 border-current border-r-transparent rounded-full animate-spin" />
                    Creating...
                  </>
                ) : planFeedback ? (
                  <>
                    <i className="bi bi-check-circle" />
                    {planFeedback.actionsCreated} Actions Added
                  </>
                ) : (
                  <>
                    <i className="bi bi-lightning-charge" />
                    Create Action Plan
                  </>
                )}
              </button>
            )}
          </div>
          {/* Action Plan Feedback Toast */}
          {planFeedback && (
            <div className="ask-action-plan-feedback">
              <i className="bi bi-check-circle-fill" />
              <span>
                <strong>{planFeedback.actionsCreated} action{planFeedback.actionsCreated !== 1 ? 's' : ''}</strong> added to queue
                {planFeedback.duplicatesSkipped > 0 && (
                  <span className="text-muted-foreground"> ({planFeedback.duplicatesSkipped} duplicate{planFeedback.duplicatesSkipped !== 1 ? 's' : ''} skipped)</span>
                )}
              </span>
              <button
                className="ask-action-plan-feedback-link"
                onClick={() => onDeepLink('control-tower', { section: 'actions' })}
              >
                View Queue <i className="bi bi-arrow-right" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!response && !isLoading && !error && (
        <div className="ask-empty-state">
          <div className="ask-empty-icon">
            <i className="bi bi-chat-square-text" />
          </div>
          <div className="section-header-title">What would you like to know?</div>
          <p>
            {aiEnabled
              ? 'Ask any question about your recruiting data. AI will analyze your metrics and provide insights.'
              : 'Choose a question below or type your own to get started.'}
          </p>
          <div className="ask-empty-examples">
            <button
              className="ask-empty-example"
              onClick={() => onQuickAsk("What's on fire?")}
            >
              What's on fire?
            </button>
            <button
              className="ask-empty-example"
              onClick={() => onQuickAsk("Why is TTF high?")}
            >
              Why is TTF high?
            </button>
            <button
              className="ask-empty-example"
              onClick={() => onQuickAsk("Show me stalled reqs")}
            >
              Stalled reqs
            </button>
          </div>
        </div>
      )}

      {/* Data Context Footer */}
      <div className="ask-footer">
        {[
          { icon: 'bi-database', value: `${factPack.meta.sample_sizes.total_reqs} reqs` },
          { icon: 'bi-people', value: `${factPack.meta.sample_sizes.total_candidates} candidates` },
          { icon: 'bi-calendar-range', value: `${factPack.meta.data_window.days}d window` },
          { icon: 'bi-heart-pulse', value: `${factPack.meta.data_health_score}% health` },
        ].map(({ icon, value }) => (
          <span key={icon} className="ask-footer-item">
            <i className={`bi ${icon}`} />
            {value}
          </span>
        ))}
      </div>
    </main>
  );
}

// Citation badge component
function CitationBadge({
  citation,
  onNavigate,
  isHighlighted,
}: {
  citation: FactCitation;
  onNavigate: (tab: string, params: Record<string, string>) => void;
  isHighlighted?: boolean;
}) {
  const handleClick = () => {
    const deepLink = keyPathToDeepLinkWithFallback(citation.key_path);
    onNavigate(deepLink.tab, deepLink.params);
    if (deepLink.highlightSelector) {
      highlightElement(deepLink.highlightSelector);
    }
  };

  return (
    <button
      className={`ask-citation-badge ${isHighlighted ? 'ask-citation-highlighted' : ''}`}
      onClick={handleClick}
      title={`View: ${citation.label}`}
      data-citation-ref={citation.ref}
    >
      <span className="ask-citation-ref">{citation.ref}</span>
      <span className="ask-citation-label">{citation.label}</span>
      <i className="bi bi-arrow-up-right ask-citation-arrow" />
    </button>
  );
}

// Enhanced markdown renderer with header support and clickable citations
function MarkdownRenderer({
  content,
  onCitationClick
}: {
  content: string;
  onCitationClick: (ref: string) => void;
}) {
  const renderMarkdown = (text: string): React.ReactElement[] => {
    const lines = text.split('\n');
    const elements: React.ReactElement[] = [];
    let listItems: string[] = [];
    let listType: 'ul' | 'ol' | null = null;
    let keyCounter = 0;

    const getKey = () => `md-${keyCounter++}`;

    const flushList = () => {
      if (listItems.length > 0 && listType) {
        const ListTag = listType;
        const listKey = getKey();
        elements.push(
          <ListTag key={listKey} className="ask-md-list">
            {listItems.map((item, i) => (
              <li key={`${listKey}-li-${i}`}>{renderInline(item, `${listKey}-li-${i}`)}</li>
            ))}
          </ListTag>
        );
        listItems = [];
        listType = null;
      }
    };

    const renderInline = (text: string, parentKey: string): React.ReactNode => {
      const result: React.ReactNode[] = [];

      // Split on bold markers and citation refs
      const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[\d+\])/g);

      parts.forEach((part, i) => {
        if (!part) return;

        if (part.startsWith('**') && part.endsWith('**')) {
          result.push(<strong key={`${parentKey}-b-${i}`}>{part.slice(2, -2)}</strong>);
        } else if (part.startsWith('__') && part.endsWith('__')) {
          result.push(<strong key={`${parentKey}-u-${i}`}>{part.slice(2, -2)}</strong>);
        } else if (part.startsWith('`') && part.endsWith('`')) {
          result.push(<code key={`${parentKey}-c-${i}`}>{part.slice(1, -1)}</code>);
        } else if (/^\[\d+\]$/.test(part)) {
          // Make citation refs clickable
          result.push(
            <button
              key={`${parentKey}-cite-${i}`}
              className="ask-cite-ref-btn"
              onClick={() => onCitationClick(part)}
              title={`Jump to source ${part}`}
            >
              <sup className="ask-cite-ref">{part}</sup>
            </button>
          );
        } else {
          result.push(<span key={`${parentKey}-t-${i}`}>{part}</span>);
        }
      });

      return result.length === 1 ? result[0] : <>{result}</>;
    };

    lines.forEach((line) => {
      // Skip lines that are just the fallback note (remove internal error text)
      if (line.includes('generated using guided mode due to') ||
          line.includes('processing issue') ||
          line.includes('*Note:')) {
        return;
      }

      // Headers (h2, h3, h4)
      const headerMatch = line.match(/^(#{2,4})\s+(.+)/);
      if (headerMatch) {
        flushList();
        const key = getKey();
        const level = headerMatch[1].length as 2 | 3 | 4;
        const text = headerMatch[2];
        const className = `ask-md-h${level}`;
        const content = renderInline(text, key);
        // Using div with role="heading" for markdown content rendering
        // This is AI-generated content, not page structure headers
        if (level === 2) {
          elements.push(<div key={key} className={`${className} section-header-title`} role="heading" aria-level={2}>{content}</div>);
        } else if (level === 3) {
          elements.push(<div key={key} className={`${className} section-header-title`} role="heading" aria-level={3}>{content}</div>);
        } else {
          elements.push(<div key={key} className={className} role="heading" aria-level={4}>{content}</div>);
        }
        return;
      }

      // Unordered list item
      if (line.match(/^[-*]\s+/)) {
        if (listType !== 'ul') {
          flushList();
          listType = 'ul';
        }
        listItems.push(line.replace(/^[-*]\s+/, ''));
        return;
      }

      // Ordered list item
      if (line.match(/^\d+\.\s+/)) {
        if (listType !== 'ol') {
          flushList();
          listType = 'ol';
        }
        listItems.push(line.replace(/^\d+\.\s+/, ''));
        return;
      }

      // Not a list item, flush any pending list
      flushList();

      // Empty line
      if (!line.trim()) {
        return;
      }

      // Regular paragraph
      const key = getKey();
      elements.push(<p key={key} className="ask-md-p">{renderInline(line, key)}</p>);
    });

    // Flush any remaining list
    flushList();

    return elements;
  };

  return <div className="ask-md-content">{renderMarkdown(content)}</div>;
}

export default AskMainPanel;
