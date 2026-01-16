// Ask Blocked State - Displayed when Ask ProdDash is blocked due to missing data
import React from 'react';
import { CoverageIssue } from '../../services/askCoverageGateService';

export interface AskBlockedStateProps {
  issues: CoverageIssue[];
  onNavigateToTab: (tab: string) => void;
}

export function AskBlockedState({ issues, onNavigateToTab }: AskBlockedStateProps) {
  return (
    <div className="ask-blocked-state">
      <div className="ask-blocked-content">
        <div className="ask-blocked-icon">
          <i className="bi bi-exclamation-triangle-fill" />
        </div>

        <h2 className="ask-blocked-title">Ask ProdDash Requires More Data</h2>

        <p className="ask-blocked-description">
          To enable intelligent insights, Ask ProdDash needs the following data to be available:
        </p>

        <div className="ask-blocked-issues">
          {issues.map((issue, index) => (
            <div key={index} className="ask-blocked-issue">
              <div className="issue-header">
                <span className="issue-code">{issue.code}</span>
                <span className="issue-message">{issue.message}</span>
              </div>
              <div className="issue-fix">
                <i className="bi bi-lightbulb" />
                <span>{issue.howToFix}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="ask-blocked-actions">
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            <i className="bi bi-arrow-clockwise me-2" />
            Refresh Data
          </button>
          <button className="btn btn-outline-secondary" onClick={() => onNavigateToTab('data-health')}>
            <i className="bi bi-upload me-2" />
            Go to Import
          </button>
        </div>

        <div className="ask-blocked-help">
          <p>
            <strong>Why is this required?</strong> Ask ProdDash uses deterministic analytics
            to answer questions about your recruiting data. Without recruiter and hiring manager
            assignments, it cannot provide accurate insights about team performance and ownership.
          </p>
        </div>
      </div>
    </div>
  );
}

export default AskBlockedState;
