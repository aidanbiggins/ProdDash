'use client';

import React, { useState } from 'react';
import { TopNavV2, TabId } from './TopNavV2';
import { CommandCenterV2 } from './CommandCenterV2';

// Placeholder components for tabs - will be replaced with full implementations
function AskPlatoVuePlaceholder() {
  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      <div className="glass-panel p-8 text-center">
        <h2 className="text-xl font-semibold text-[#f8fafc] mb-2">Ask PlatoVue</h2>
        <p className="text-[#94a3b8]">
          AI-powered conversational interface coming soon...
        </p>
      </div>
    </div>
  );
}

function DiagnosePlaceholder() {
  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      <div className="glass-panel p-8 text-center">
        <h2 className="text-xl font-semibold text-[#f8fafc] mb-2">Diagnose</h2>
        <p className="text-[#94a3b8]">
          System health diagnostics and issue identification coming soon...
        </p>
      </div>
    </div>
  );
}

function PlanPlaceholder() {
  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      <div className="glass-panel p-8 text-center">
        <h2 className="text-xl font-semibold text-[#f8fafc] mb-2">Plan</h2>
        <p className="text-[#94a3b8]">
          Capacity planning and forecasting tools coming soon...
        </p>
      </div>
    </div>
  );
}

function SettingsPlaceholder() {
  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      <div className="glass-panel p-8 text-center">
        <h2 className="text-xl font-semibold text-[#f8fafc] mb-2">Settings</h2>
        <p className="text-[#94a3b8]">
          Configuration and preferences coming soon...
        </p>
      </div>
    </div>
  );
}

interface AppLayoutV2Props {
  defaultTab?: TabId;
}

export function AppLayoutV2({ defaultTab = 'command-center' }: AppLayoutV2Props) {
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'command-center':
        return <CommandCenterV2 />;
      case 'ask-platovue':
        return <AskPlatoVuePlaceholder />;
      case 'diagnose':
        return <DiagnosePlaceholder />;
      case 'plan':
        return <PlanPlaceholder />;
      case 'settings':
        return <SettingsPlaceholder />;
      default:
        return <CommandCenterV2 />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#020617] to-[#0f172a]">
      <TopNavV2 activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="animate-in fade-in duration-300">
        {renderTabContent()}
      </main>
    </div>
  );
}

export default AppLayoutV2;
