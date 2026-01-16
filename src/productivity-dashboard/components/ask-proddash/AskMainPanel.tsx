// Ask Main Panel - Query input and response display
import React, { useRef, useEffect } from 'react';
import { IntentResponse, AskFactPack, FactCitation } from '../../types/askTypes';

interface AskMainPanelProps {
  query: string;
  onQueryChange: (query: string) => void;
  onSubmit: () => void;
  response: IntentResponse | null;
  isLoading: boolean;
  error: string | null;
  aiEnabled: boolean;
  factPack: AskFactPack;
  onDeepLink: (tab: string, params: Record<string, string>) => void;
  onCopy: () => void;
}

export function AskMainPanel({
  query,
  onQueryChange,
  onSubmit,
  response,
  isLoading,
  error,
  aiEnabled,
  factPack,
  onDeepLink,
  onCopy,
}: AskMainPanelProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle keyboard submit
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <main className="ask-main-panel">
      {/* Header */}
      <div className="ask-header">
        <h2 className="ask-title">
          <i className="bi bi-chat-dots" style={{ marginRight: '0.5rem' }} />
          Ask ProdDash
        </h2>
        <div className="ask-mode-badge">
          {aiEnabled ? (
            <span className="badge badge-ai-on">
              <i className="bi bi-stars" /> AI Mode
            </span>
          ) : (
            <span className="badge badge-ai-off">
              <i className="bi bi-cpu" /> Guided Mode
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
            : "Ask a question or select from suggestions..."
          }
          rows={2}
          disabled={isLoading}
        />
        <button
          className="ask-submit-btn"
          onClick={onSubmit}
          disabled={isLoading || !query.trim()}
        >
          {isLoading ? (
            <span className="spinner-border spinner-border-sm" />
          ) : (
            <i className="bi bi-send" />
          )}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="ask-error">
          <i className="bi bi-exclamation-triangle" />
          <span>{error}</span>
        </div>
      )}

      {/* Response Display */}
      {response && !isLoading && (
        <div className="ask-response">
          {/* Answer */}
          <div className="ask-answer">
            <SimpleMarkdown content={response.answer_markdown} />
          </div>

          {/* Citations */}
          {response.citations.length > 0 && (
            <div className="ask-citations">
              <h4 className="ask-citations-title">Sources</h4>
              <div className="ask-citations-list">
                {response.citations.map((citation, idx) => (
                  <CitationBadge key={idx} citation={citation} />
                ))}
              </div>
            </div>
          )}

          {/* Deep Links */}
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
                    <i className="bi bi-arrow-right" />
                    {link.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Suggested Follow-ups */}
          {response.suggested_questions.length > 0 && (
            <div className="ask-follow-ups">
              <h4 className="ask-follow-ups-title">Related Questions</h4>
              <div className="ask-follow-ups-list">
                {response.suggested_questions.map((q, idx) => (
                  <button
                    key={idx}
                    className="ask-follow-up-chip"
                    onClick={() => {
                      onQueryChange(q);
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div className="ask-action-bar">
            <button className="ask-action-btn" onClick={onCopy} title="Copy response">
              <i className="bi bi-clipboard" />
              Copy
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!response && !isLoading && !error && (
        <div className="ask-empty-state">
          <div className="ask-empty-icon">
            <i className="bi bi-lightbulb" />
          </div>
          <h3>Ask ProdDash</h3>
          <p>
            {aiEnabled
              ? 'Ask any question about your recruiting data. AI will analyze your metrics and provide insights.'
              : 'Select a suggested question or type your own. ProdDash will analyze your data and respond.'}
          </p>
          <div className="ask-empty-examples">
            <span className="ask-empty-example">"What's on fire?"</span>
            <span className="ask-empty-example">"Why is TTF high?"</span>
            <span className="ask-empty-example">"Show me stalled reqs"</span>
          </div>
        </div>
      )}

      {/* Data Context Footer */}
      <div className="ask-footer">
        <span className="ask-footer-item">
          <i className="bi bi-database" />
          {factPack.meta.sample_sizes.total_reqs} reqs
        </span>
        <span className="ask-footer-item">
          <i className="bi bi-people" />
          {factPack.meta.sample_sizes.total_candidates} candidates
        </span>
        <span className="ask-footer-item">
          <i className="bi bi-calendar-range" />
          {factPack.meta.data_window.days}d window
        </span>
        <span className="ask-footer-item">
          <i className="bi bi-heart-pulse" />
          {factPack.meta.data_health_score}% health
        </span>
      </div>
    </main>
  );
}

// Citation badge component
function CitationBadge({ citation }: { citation: FactCitation }) {
  return (
    <span className="ask-citation-badge" title={citation.key_path}>
      <span className="ask-citation-ref">{citation.ref}</span>
      <span className="ask-citation-label">{citation.label}</span>
    </span>
  );
}

// Simple markdown renderer for basic formatting
function SimpleMarkdown({ content }: { content: string }) {
  // Convert markdown to HTML-safe content
  const renderMarkdown = (text: string): React.ReactElement[] => {
    const lines = text.split('\n');
    const elements: React.ReactElement[] = [];
    let listItems: string[] = [];
    let listType: 'ul' | 'ol' | null = null;

    const flushList = () => {
      if (listItems.length > 0 && listType) {
        const ListTag = listType;
        elements.push(
          <ListTag key={elements.length}>
            {listItems.map((item, i) => (
              <li key={i}>{renderInline(item)}</li>
            ))}
          </ListTag>
        );
        listItems = [];
        listType = null;
      }
    };

    const renderInline = (text: string): React.ReactNode => {
      // Handle bold (**text** or __text__)
      let result: React.ReactNode[] = [];
      const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__)/g);

      parts.forEach((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          result.push(<strong key={i}>{part.slice(2, -2)}</strong>);
        } else if (part.startsWith('__') && part.endsWith('__')) {
          result.push(<strong key={i}>{part.slice(2, -2)}</strong>);
        } else {
          // Handle citation references [N]
          const citeParts = part.split(/(\[\d+\])/g);
          citeParts.forEach((citePart, j) => {
            if (/^\[\d+\]$/.test(citePart)) {
              result.push(
                <sup key={`${i}-${j}`} className="ask-cite-ref">{citePart}</sup>
              );
            } else if (citePart) {
              result.push(citePart);
            }
          });
        }
      });

      return result.length === 1 ? result[0] : <>{result}</>;
    };

    lines.forEach((line, i) => {
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
      elements.push(<p key={i}>{renderInline(line)}</p>);
    });

    // Flush any remaining list
    flushList();

    return elements;
  };

  return <>{renderMarkdown(content)}</>;
}

export default AskMainPanel;
