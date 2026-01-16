// Ask Left Rail - Suggested questions and conversation history
import React from 'react';
import { IntentResponse } from '../../types/askTypes';

interface SuggestedQuestion {
  category: string;
  question: string;
}

interface ConversationItem {
  query: string;
  response: IntentResponse;
  timestamp: Date;
}

interface AskLeftRailProps {
  suggestedQuestions: SuggestedQuestion[];
  onQuestionClick: (question: string) => void;
  conversationHistory: ConversationItem[];
  onHistoryClick: (item: ConversationItem) => void;
}

export function AskLeftRail({
  suggestedQuestions,
  onQuestionClick,
  conversationHistory,
  onHistoryClick,
}: AskLeftRailProps) {
  // Group questions by category
  const questionsByCategory = suggestedQuestions.reduce((acc, q) => {
    if (!acc[q.category]) acc[q.category] = [];
    acc[q.category].push(q);
    return acc;
  }, {} as Record<string, SuggestedQuestion[]>);

  return (
    <aside className="ask-left-rail">
      {/* Suggested Questions */}
      <div className="ask-section">
        <h3 className="ask-section-title">Suggested Questions</h3>
        {Object.entries(questionsByCategory).map(([category, questions]) => (
          <div key={category} className="ask-category">
            <span className="ask-category-label">{category}</span>
            <div className="ask-questions-list">
              {questions.map((q, idx) => (
                <button
                  key={idx}
                  className="ask-question-chip"
                  onClick={() => onQuestionClick(q.question)}
                >
                  {q.question}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Conversation History */}
      {conversationHistory.length > 0 && (
        <div className="ask-section">
          <h3 className="ask-section-title">Recent Questions</h3>
          <div className="ask-history-list">
            {conversationHistory.slice(-5).reverse().map((item, idx) => (
              <button
                key={idx}
                className="ask-history-item"
                onClick={() => onHistoryClick(item)}
              >
                <span className="ask-history-query">{item.query}</span>
                <span className="ask-history-time">
                  {formatTimeAgo(item.timestamp)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return date.toLocaleDateString();
}

export default AskLeftRail;
