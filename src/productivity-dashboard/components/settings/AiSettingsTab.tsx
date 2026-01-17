// AI Settings Tab - Full page for AI configuration
import React, { useState } from 'react';
import { PageShell, PageHeader, GlassPanel, SectionHeader } from '../layout';
import { AiProviderSettings } from './AiProviderSettings';
import { AiProviderConfig, AiProvider, DEFAULT_AI_CONFIG } from '../../types/aiTypes';
import { useAuth } from '../../../contexts/AuthContext';
import { useDashboard } from '../../hooks/useDashboardContext';

export function AiSettingsTab() {
  const { user, currentOrg, canManageMembers } = useAuth();
  const { aiConfig, setAiConfig, isAiEnabled } = useDashboard();
  const [showSettings, setShowSettings] = useState(false);

  const handleSave = (config: AiProviderConfig) => {
    // Update global aiConfig so all components can use it
    setAiConfig(config);
  };

  const handleClear = () => {
    setAiConfig(null);
  };

  return (
    <PageShell>
      <PageHeader
        title="AI Configuration"
        description="Configure your AI provider settings and API keys"
        breadcrumbs={[
          { label: 'Settings', href: '/settings' },
          { label: 'AI Configuration' }
        ]}
      />

      <SectionHeader title="AI Provider Settings">
        <GlassPanel>
          <div className="ai-settings-content">
            <div className="ai-settings-intro">
              <h3>Bring Your Own Key (BYOK)</h3>
              <p>
                ProdDash supports AI-powered features like summaries and draft messages.
                Configure your preferred AI provider below. Your API keys are encrypted
                and can optionally be synced across devices using a secure vault.
              </p>
            </div>

            <div className="ai-settings-features">
              <div className="ai-feature">
                <i className="bi bi-chat-text" />
                <div>
                  <strong>AI Summaries</strong>
                  <p>Get AI-generated insights for metrics and performance data</p>
                </div>
              </div>
              <div className="ai-feature">
                <i className="bi bi-envelope" />
                <div>
                  <strong>Draft Messages</strong>
                  <p>Generate draft emails and messages for outreach</p>
                </div>
              </div>
              <div className="ai-feature">
                <i className="bi bi-shield-lock" />
                <div>
                  <strong>PII Redaction</strong>
                  <p>Personal data is automatically redacted before sending to AI</p>
                </div>
              </div>
            </div>

            {/* Status indicator */}
            {isAiEnabled && aiConfig && (
              <div className="ai-status-enabled">
                <i className="bi bi-check-circle-fill" />
                <span>
                  AI enabled via <strong>{aiConfig.provider}</strong>
                  {aiConfig.model && ` (${aiConfig.model})`}
                </span>
              </div>
            )}

            <button
              className="btn btn-primary"
              onClick={() => setShowSettings(true)}
            >
              <i className="bi bi-gear me-2" />
              {isAiEnabled ? 'Update AI Settings' : 'Configure AI Provider'}
            </button>
          </div>
        </GlassPanel>
      </SectionHeader>

      {/* AI Provider Settings Modal */}
      <AiProviderSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        currentConfig={aiConfig}
        onSave={handleSave}
        onClear={handleClear}
        orgId={currentOrg?.id}
        userId={user?.id}
        canSetOrgKey={canManageMembers}
      />

      <style>{`
        .ai-settings-content {
          padding: var(--space-4, 1rem);
        }

        .ai-settings-intro {
          margin-bottom: var(--space-6, 1.5rem);
        }

        .ai-settings-intro h3 {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.25rem;
          margin-bottom: var(--space-2, 0.5rem);
          color: var(--text-primary, #f8f9fa);
        }

        .ai-settings-intro p {
          color: var(--text-muted, #6c757d);
          line-height: 1.6;
        }

        .ai-settings-features {
          display: grid;
          gap: var(--space-4, 1rem);
          margin-bottom: var(--space-6, 1.5rem);
        }

        .ai-feature {
          display: flex;
          align-items: flex-start;
          gap: var(--space-3, 0.75rem);
          padding: var(--space-3, 0.75rem);
          background: rgba(255, 255, 255, 0.03);
          border-radius: var(--radius-md, 8px);
        }

        .ai-feature i {
          font-size: 1.25rem;
          color: var(--primary, #d4a373);
          padding-top: 2px;
        }

        .ai-feature strong {
          display: block;
          color: var(--text-primary, #f8f9fa);
          margin-bottom: var(--space-1, 0.25rem);
        }

        .ai-feature p {
          color: var(--text-muted, #6c757d);
          font-size: 0.875rem;
          margin: 0;
        }

        .ai-status-enabled {
          display: flex;
          align-items: center;
          gap: var(--space-2, 0.5rem);
          padding: var(--space-3, 0.75rem);
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: var(--radius-md, 8px);
          margin-bottom: var(--space-4, 1rem);
          color: #22c55e;
        }

        .ai-status-enabled i {
          font-size: 1rem;
        }

        .ai-status-enabled span {
          font-size: 0.875rem;
        }

        .ai-status-enabled strong {
          text-transform: capitalize;
        }
      `}</style>
    </PageShell>
  );
}

export default AiSettingsTab;
