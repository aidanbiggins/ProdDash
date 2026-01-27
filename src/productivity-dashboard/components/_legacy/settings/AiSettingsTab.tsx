// AI Settings Tab - Full page for AI configuration
import React, { useState } from 'react';
import { PageShell, PageHeader, GlassPanel, SectionHeader } from '../layout';
import { AiProviderSettings } from './AiProviderSettings';
import { AiProviderConfig, AiProvider, DEFAULT_AI_CONFIG } from '../../../types/aiTypes';
import { useAuth } from '../../../../contexts/AuthContext';
import { useDashboard } from '../../../hooks/useDashboardContext';

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
      />

      <SectionHeader title="AI Provider Settings">
        <GlassPanel>
          <div className="p-4">
            {/* Intro Section */}
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Bring Your Own Key (BYOK)
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                PlatoVue supports AI-powered features like summaries and draft messages.
                Configure your preferred AI provider below. Your API keys are encrypted
                and can optionally be synced across devices using a secure vault.
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid gap-4 mb-6">
              <div className="flex items-start gap-3 p-3 bg-white/[0.03] rounded-lg">
                <i className="bi bi-chat-text text-xl text-accent pt-0.5" />
                <div>
                  <strong className="block text-foreground mb-1">AI Summaries</strong>
                  <p className="text-sm text-muted-foreground m-0">Get AI-generated insights for metrics and performance data</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-white/[0.03] rounded-lg">
                <i className="bi bi-envelope text-xl text-accent pt-0.5" />
                <div>
                  <strong className="block text-foreground mb-1">Draft Messages</strong>
                  <p className="text-sm text-muted-foreground m-0">Generate draft emails and messages for outreach</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-white/[0.03] rounded-lg">
                <i className="bi bi-shield-lock text-xl text-accent pt-0.5" />
                <div>
                  <strong className="block text-foreground mb-1">PII Redaction</strong>
                  <p className="text-sm text-muted-foreground m-0">Personal data is automatically redacted before sending to AI</p>
                </div>
              </div>
            </div>

            {/* Status indicator */}
            {isAiEnabled && aiConfig && (
              <div className="flex items-center gap-2 p-3 bg-good-bg border border-good/30 rounded-lg mb-4 text-good">
                <i className="bi bi-check-circle-fill" />
                <span className="text-sm">
                  AI enabled via <strong className="capitalize">{aiConfig.provider}</strong>
                  {aiConfig.model && ` (${aiConfig.model})`}
                </span>
              </div>
            )}

            <button
              className="px-4 py-2 rounded-md font-medium bg-accent text-accent-foreground hover:bg-accent/90 transition-colors"
              onClick={() => setShowSettings(true)}
            >
              <i className="bi bi-gear mr-2" />
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
    </PageShell>
  );
}

export default AiSettingsTab;
