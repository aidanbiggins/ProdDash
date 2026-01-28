'use client';

/**
 * AI Settings Tab V2 - Configure AI provider settings and API keys
 *
 * V2 component that renders as a sub-view within SettingsTabV2.
 * Uses V2 design patterns: glass-panel, Tailwind tokens, lucide-react icons.
 */

import React, { useState } from 'react';
import { MessageSquare, Mail, Shield, CheckCircle, Settings } from 'lucide-react';
import { AiProviderSettings } from '../_legacy/settings/AiProviderSettings';
import { AiProviderConfig } from '../../types/aiTypes';
import { useAuth } from '../../../contexts/AuthContext';
import { useDashboard } from '../../hooks/useDashboardContext';

export function AiSettingsTabV2() {
  const { user, currentOrg, canManageMembers } = useAuth();
  const { aiConfig, setAiConfig, isAiEnabled } = useDashboard();
  const [showSettings, setShowSettings] = useState(false);

  const handleSave = (config: AiProviderConfig) => {
    setAiConfig(config);
  };

  const handleClear = () => {
    setAiConfig(null);
  };

  return (
    <div className="space-y-6">
      {/* AI Provider Settings Section */}
      <div className="glass-panel p-5">
        {/* Section Header */}
        <div className="mb-5 pb-3 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">AI Provider Settings</h2>
        </div>

        {/* Intro Section */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Bring Your Own Key (BYOK)
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            PlatoVue supports AI-powered features like summaries and draft messages.
            Configure your preferred AI provider below. Your API keys are encrypted
            and can optionally be synced across devices using a secure vault.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid gap-3 mb-6">
          <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
            <MessageSquare className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <strong className="block text-sm text-foreground mb-0.5">AI Summaries</strong>
              <p className="text-xs text-muted-foreground m-0">Get AI-generated insights for metrics and performance data</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
            <Mail className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <strong className="block text-sm text-foreground mb-0.5">Draft Messages</strong>
              <p className="text-xs text-muted-foreground m-0">Generate draft emails and messages for outreach</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
            <Shield className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <strong className="block text-sm text-foreground mb-0.5">PII Redaction</strong>
              <p className="text-xs text-muted-foreground m-0">Personal data is automatically redacted before sending to AI</p>
            </div>
          </div>
        </div>

        {/* Status indicator */}
        {isAiEnabled && aiConfig && (
          <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg mb-4 text-green-400">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm">
              AI enabled via <strong className="capitalize">{aiConfig.provider}</strong>
              {aiConfig.model && ` (${aiConfig.model})`}
            </span>
          </div>
        )}

        <button
          className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-md font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          onClick={() => setShowSettings(true)}
        >
          <Settings className="w-4 h-4" />
          {isAiEnabled ? 'Update AI Settings' : 'Configure AI Provider'}
        </button>
      </div>

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
    </div>
  );
}

export default AiSettingsTabV2;
