// AI Provider Settings Modal
// Clean BYOK form matching the AI BYOK Multi-Provider Integration Plan layout
// Supports: OpenAI, Anthropic, Gemini, OpenAI-Compatible

import React, { useState, useEffect } from 'react';
import {
  AiProvider,
  AiProviderConfig,
  AiKeyScope,
  PROVIDER_MODELS,
  PROVIDER_LABELS,
  DEFAULT_AI_CONFIG,
} from '../../types/aiTypes';
import { useAiKeys } from '../../hooks/useAiVault';
import { Bot, Key, Shield, Settings2, Zap, ChevronDown, ChevronRight, Check, X, AlertTriangle, Loader2, Eye, EyeOff } from 'lucide-react';
import { ToggleSwitch, Checkbox, Radio } from '../../../components/ui/toggles';

interface AiProviderSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: AiProviderConfig | null;
  onSave: (config: AiProviderConfig) => void;
  onClear: () => void;
  orgId?: string | null;
  userId?: string;
  canSetOrgKey?: boolean;
  onAiEnabledChange?: (enabled: boolean) => void;
}

export function AiProviderSettings({
  isOpen,
  onClose,
  currentConfig,
  onSave,
  onClear,
  orgId,
  userId,
  canSetOrgKey = false,
  onAiEnabledChange,
}: AiProviderSettingsProps) {
  // Form state
  const [provider, setProvider] = useState<AiProvider>(currentConfig?.provider ?? DEFAULT_AI_CONFIG.provider);
  const [model, setModel] = useState(currentConfig?.model ?? DEFAULT_AI_CONFIG.model);
  const [apiKey, setApiKey] = useState(currentConfig?.apiKey ?? '');
  const [baseUrl, setBaseUrl] = useState(currentConfig?.baseUrl ?? '');
  const [redactPii, setRedactPii] = useState(currentConfig?.redactPii ?? DEFAULT_AI_CONFIG.redactPii);
  const [temperature, setTemperature] = useState(currentConfig?.temperature ?? DEFAULT_AI_CONFIG.temperature);
  const [maxTokens, setMaxTokens] = useState(currentConfig?.maxTokens ?? DEFAULT_AI_CONFIG.maxTokens);
  const [aiEnabled, setAiEnabled] = useState(currentConfig?.aiEnabled ?? DEFAULT_AI_CONFIG.aiEnabled);

  // UI state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Storage
  const [saveScope, setSaveScope] = useState<AiKeyScope>('user');
  const [shouldPersist, setShouldPersist] = useState(true);

  // AI Keys hook
  const { keyState, loadKeys, saveKey, deleteKey, getEffectiveKey, clearError } = useAiKeys();

  // Load keys on mount
  useEffect(() => {
    if (isOpen) {
      loadKeys(orgId ?? null).catch(err => {
        console.warn('[AiProviderSettings] Failed to load keys:', err);
      });
    }
  }, [isOpen, orgId, loadKeys]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setProvider(currentConfig?.provider ?? DEFAULT_AI_CONFIG.provider);
      setModel(currentConfig?.model ?? DEFAULT_AI_CONFIG.model);
      setApiKey(currentConfig?.apiKey ?? '');
      setBaseUrl(currentConfig?.baseUrl ?? '');
      setRedactPii(currentConfig?.redactPii ?? DEFAULT_AI_CONFIG.redactPii);
      setTemperature(currentConfig?.temperature ?? DEFAULT_AI_CONFIG.temperature);
      setMaxTokens(currentConfig?.maxTokens ?? DEFAULT_AI_CONFIG.maxTokens);
      setAiEnabled(currentConfig?.aiEnabled ?? DEFAULT_AI_CONFIG.aiEnabled);
      setTestResult(null);
      clearError();
    }
  }, [isOpen, currentConfig, clearError]);

  // Update model when provider changes
  useEffect(() => {
    const models = PROVIDER_MODELS[provider];
    if (models.length > 0 && !models.find(m => m.id === model)) {
      setModel(models[0].id);
    }
  }, [provider, model]);

  // Load stored key when provider changes
  useEffect(() => {
    if (isOpen) {
      const storedKey = getEffectiveKey(provider);
      if (storedKey) {
        setApiKey(storedKey.apiKey);
        if (storedKey.model) setModel(storedKey.model);
        if (storedKey.baseUrl) setBaseUrl(storedKey.baseUrl);
      }
    }
  }, [isOpen, provider, getEffectiveKey]);

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      setTestResult({ success: false, message: 'Please enter an API key first' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      // Simple validation - check key format
      const keyPrefix = apiKey.trim().substring(0, 10);

      if (provider === 'openai' && !apiKey.startsWith('sk-')) {
        setTestResult({ success: false, message: 'OpenAI keys should start with "sk-"' });
        return;
      }
      if (provider === 'anthropic' && !apiKey.startsWith('sk-ant-')) {
        setTestResult({ success: false, message: 'Anthropic keys should start with "sk-ant-"' });
        return;
      }

      // For now, just validate format - actual API test would require edge function
      setTestResult({ success: true, message: 'Key format looks valid. Save to enable AI features.' });
    } catch (err) {
      setTestResult({ success: false, message: err instanceof Error ? err.message : 'Connection test failed' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) return;

    const config: AiProviderConfig = {
      provider,
      model: provider === 'openai_compatible' && !model ? 'custom' : model,
      apiKey: apiKey.trim(),
      baseUrl: provider === 'openai_compatible' ? baseUrl.trim() : undefined,
      redactPii,
      temperature,
      maxTokens,
      aiEnabled,
    };

    localStorage.removeItem('platovue_ai_cleared');
    onSave(config);
    onClose();

    if (shouldPersist) {
      saveKey(provider, apiKey.trim(), saveScope, orgId, userId, { model, baseUrl: baseUrl || undefined })
        .catch(err => console.warn('Failed to persist AI key:', err));
    }
  };

  const handleClear = () => {
    localStorage.setItem('platovue_ai_cleared', 'true');
    onClear();
    setApiKey('');
    setBaseUrl('');
    onClose();

    const storedKey = getEffectiveKey(provider);
    if (storedKey) {
      deleteKey(provider, storedKey.scope, orgId).catch(err => {
        console.warn('[AiProviderSettings] Failed to delete key:', err);
      });
    }
  };

  if (!isOpen) return null;

  const models = PROVIDER_MODELS[provider];
  const isValid = apiKey.trim().length > 0 && (provider !== 'openai_compatible' || baseUrl.trim().length > 0);
  const existingUserKey = keyState.userKeys.get(provider);
  const existingOrgKey = keyState.orgKeys.get(provider);
  const hasStoredKey = existingUserKey || existingOrgKey;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1050]" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-[1055] flex items-center justify-center p-4">
        <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-[#0f172a] border border-white/10 rounded-xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                <Bot className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">AI Provider Settings</h2>
                <p className="text-xs text-white/50">Configure your AI provider and API key</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body - Scrollable */}
          <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">

            {/* AI Enable Toggle */}
            <div className={`p-4 rounded-lg border mb-6 transition-all ${aiEnabled ? 'bg-accent/15 border-accent/40' : 'bg-white/5 border-white/20'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${aiEnabled ? 'bg-accent/20' : 'bg-white/10'}`}>
                    <Zap className={`w-5 h-5 ${aiEnabled ? 'text-accent' : 'text-white/40'}`} />
                  </div>
                  <div>
                    <div className={`font-semibold ${aiEnabled ? 'text-accent' : 'text-white'}`}>
                      {aiEnabled ? 'AI Mode Enabled' : 'AI Mode Disabled'}
                    </div>
                    <div className="text-sm text-white/60">
                      {aiEnabled ? 'AI generates dynamic responses' : 'Using deterministic fallback mode'}
                    </div>
                  </div>
                </div>
                <ToggleSwitch
                  checked={aiEnabled}
                  onChange={(checked) => {
                    setAiEnabled(checked);
                    onAiEnabledChange?.(checked);
                  }}
                  size="md"
                />
              </div>
            </div>

            {/* Error Display */}
            {keyState.error && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-red-400">{keyState.error}</span>
              </div>
            )}

            {/* Provider Selection */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-white/60 uppercase tracking-wider mb-2">
                Provider
              </label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as AiProvider)}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50"
              >
                {(Object.keys(PROVIDER_LABELS) as AiProvider[]).map((p) => (
                  <option key={p} value={p} className="bg-[#1e293b]">
                    {PROVIDER_LABELS[p]}
                    {keyState.userKeys.has(p) ? ' (your key)' : keyState.orgKeys.has(p) ? ' (org key)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Model Selection */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-white/60 uppercase tracking-wider mb-2">
                Model
              </label>
              {provider === 'openai_compatible' ? (
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g., llama-3-70b-instruct"
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50"
                />
              ) : (
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50"
                >
                  {(() => {
                    const categories = new Map<string, typeof models>();
                    models.forEach((m) => {
                      const cat = m.category || 'Other';
                      if (!categories.has(cat)) categories.set(cat, []);
                      categories.get(cat)!.push(m);
                    });
                    return Array.from(categories.entries()).map(([category, categoryModels]) => (
                      <optgroup key={category} label={category} className="bg-[#1e293b]">
                        {categoryModels.map((m) => (
                          <option key={m.id} value={m.id} className="bg-[#1e293b]">
                            {m.name} {m.description ? `- ${m.description}` : ''}
                          </option>
                        ))}
                      </optgroup>
                    ));
                  })()}
                </select>
              )}
            </div>

            {/* API Key */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-white/60 uppercase tracking-wider mb-2">
                API Key
              </label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setTestResult(null);
                    }}
                    placeholder={`Enter your ${PROVIDER_LABELS[provider]} API key`}
                    className="w-full pl-10 pr-10 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={!apiKey.trim() || isTesting}
                  className="px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  {isTesting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  Test
                </button>
              </div>

              {/* Key info/status */}
              <div className="mt-2 flex items-center gap-2 text-xs">
                {testResult ? (
                  <span className={testResult.success ? 'text-green-400' : 'text-red-400'}>
                    {testResult.success ? <Check className="w-3 h-3 inline mr-1" /> : <X className="w-3 h-3 inline mr-1" />}
                    {testResult.message}
                  </span>
                ) : hasStoredKey ? (
                  <span className="text-accent">
                    <Check className="w-3 h-3 inline mr-1" />
                    Key loaded from {existingUserKey ? 'your saved keys' : 'organization'}
                  </span>
                ) : (
                  <span className="text-white/40">
                    Key stored in browser session only
                  </span>
                )}
              </div>
            </div>

            {/* Base URL for OpenAI-Compatible */}
            {provider === 'openai_compatible' && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-white/60 uppercase tracking-wider mb-2">
                  Base URL
                </label>
                <input
                  type="url"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.together.xyz/v1"
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 font-mono text-sm"
                />
                <p className="mt-1 text-xs text-white/40">Must be on the approved host list</p>
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-white/10 my-6"></div>

            {/* Privacy Settings Section */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-4 h-4 text-white/60" />
                <span className="text-sm font-medium text-white/80">Privacy Settings</span>
              </div>

              <div
                onClick={() => setRedactPii(!redactPii)}
                className={`flex items-start gap-3 p-4 rounded-lg cursor-pointer transition-colors ${redactPii ? 'bg-green-500/10 border border-green-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}
              >
                <div className="mt-0.5">
                  <Checkbox
                    checked={redactPii}
                    onChange={setRedactPii}
                  />
                </div>
                <div>
                  <div className="font-medium text-white">Redact PII before sending to AI</div>
                  <div className={`text-sm mt-1 ${redactPii ? 'text-white/50' : 'text-amber-400'}`}>
                    {redactPii
                      ? 'Names, emails, and phone numbers will be replaced with placeholders before sending to the AI provider.'
                      : 'Warning: Real PII will be sent to the AI provider.'}
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-white/10 my-6"></div>

            {/* Save Options */}
            <div className="mb-6">
              <div
                onClick={() => setShouldPersist(!shouldPersist)}
                className="flex items-center gap-3 cursor-pointer"
              >
                <Checkbox
                  checked={shouldPersist}
                  onChange={setShouldPersist}
                />
                <span className="text-sm text-white">Save API key for future sessions</span>
              </div>

              {shouldPersist && (
                <div className="mt-3 ml-8 space-y-3">
                  <div
                    onClick={() => setSaveScope('user')}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <Radio
                      checked={saveScope === 'user'}
                      onChange={() => setSaveScope('user')}
                      name="saveScope"
                    />
                    <span className="text-sm text-white/70">Save for me only</span>
                  </div>
                  {canSetOrgKey && (
                    <div
                      onClick={() => setSaveScope('org')}
                      className="flex items-center gap-3 cursor-pointer"
                    >
                      <Radio
                        checked={saveScope === 'org'}
                        onChange={() => setSaveScope('org')}
                        name="saveScope"
                      />
                      <span className="text-sm text-white/70">Share with entire organization</span>
                    </div>
                  )}
                  <p className="text-xs text-white/40 mt-2">
                    {saveScope === 'user' ? 'Key will be saved to your account only.' : 'All organization members will be able to use this key.'}
                  </p>
                </div>
              )}
            </div>

            {/* Advanced Settings */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
              >
                {showAdvanced ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <Settings2 className="w-4 h-4" />
                Advanced Settings
              </button>

              {showAdvanced && (
                <div className="mt-4 pl-4 border-l border-white/10 space-y-4">
                  {/* Temperature */}
                  <div>
                    <label className="block text-xs font-medium text-white/60 mb-2">
                      Temperature: <span className="text-accent">{temperature.toFixed(1)}</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-accent"
                    />
                    <div className="flex justify-between text-xs text-white/40 mt-1">
                      <span>Precise (0)</span>
                      <span>Creative (1)</span>
                    </div>
                  </div>

                  {/* Max Tokens */}
                  <div>
                    <label className="block text-xs font-medium text-white/60 mb-2">Max Output Tokens</label>
                    <input
                      type="number"
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(parseInt(e.target.value) || 1024)}
                      min={256}
                      max={4096}
                      step={256}
                      className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50"
                    />
                    <p className="text-xs text-white/40 mt-1">Controls maximum response length (256-4096)</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 flex-shrink-0 bg-white/[0.02]">
            {currentConfig && (
              <button
                type="button"
                onClick={handleClear}
                className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors text-sm font-medium"
              >
                Clear Config
              </button>
            )}
            <div className="flex items-center gap-3 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!isValid}
                className="px-6 py-2 rounded-lg bg-accent text-[#0f172a] font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Save Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Badge component to show AI status
export function AiEnabledBadge({ isEnabled, onClick }: { isEnabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={isEnabled ? 'AI enabled - click to configure' : 'Configure AI provider'}
      className={`text-xs px-2 py-1 rounded flex items-center gap-1 transition-colors ${
        isEnabled
          ? 'bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20'
          : 'bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white/70'
      }`}
    >
      <Bot className="w-3 h-3" />
      {isEnabled ? 'AI On' : 'AI Settings'}
    </button>
  );
}

// Legacy export for backwards compatibility
export function VaultLockedBanner({
  onUnlock,
  storedProviders,
}: {
  onUnlock: () => void;
  storedProviders: AiProvider[];
}) {
  return null;
}
