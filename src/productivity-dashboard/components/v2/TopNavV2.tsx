'use client';

import React, { useState } from 'react';
import {
  LayoutDashboard,
  MessageSquare,
  Stethoscope,
  CalendarClock,
  Settings,
  Menu,
  X,
  Search
} from 'lucide-react';

export type TabId = 'command-center' | 'ask-platovue' | 'diagnose' | 'plan' | 'settings';

interface TopNavV2Props {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const navItems: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'command-center', label: 'Command Center', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'ask-platovue', label: 'Ask PlatoVue', icon: <MessageSquare className="w-4 h-4" /> },
  { id: 'diagnose', label: 'Diagnose', icon: <Stethoscope className="w-4 h-4" /> },
  { id: 'plan', label: 'Plan', icon: <CalendarClock className="w-4 h-4" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
];

export function TopNavV2({ activeTab, onTabChange }: TopNavV2Props) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 h-[52px] border-b border-white/[0.06] bg-[rgba(15,23,42,0.97)] backdrop-blur-xl">
      <div className="flex h-full items-center justify-between px-4 mx-auto max-w-[1600px]">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onTabChange('command-center')}
            className="text-base font-semibold tracking-tight text-[#f8fafc] hover:text-[#06b6d4] transition-colors"
          >
            PlatoVue
          </button>
          <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-purple-500/20 text-purple-400 border border-purple-500/30">
            AI
          </span>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === item.id
                  ? 'bg-[#06b6d4]/10 text-[#06b6d4]'
                  : 'text-[#94a3b8] hover:bg-white/[0.06] hover:text-[#f8fafc]'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-[#94a3b8] bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.12] transition-colors"
          >
            <Search className="w-4 h-4" />
            <span className="text-xs opacity-60 font-mono">Ctrl+K</span>
          </button>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-[#f8fafc]"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
            onKeyDown={(e) => e.key === 'Escape' && setMobileMenuOpen(false)}
            role="button"
            tabIndex={0}
            aria-label="Close menu"
          />
          <div className="fixed top-0 left-0 bottom-0 w-[280px] max-w-[85vw] bg-[rgba(26,26,26,0.98)] backdrop-blur-xl border-r border-white/[0.1] z-50 md:hidden animate-in slide-in-from-left">
            <div className="p-4 border-b border-white/[0.1]">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-[#f8fafc]">PlatoVue</span>
                <button type="button" onClick={() => setMobileMenuOpen(false)} className="p-2">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onTabChange(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                    activeTab === item.id
                      ? 'bg-[#06b6d4]/10 text-[#06b6d4]'
                      : 'text-[#94a3b8] hover:bg-white/[0.06] hover:text-[#f8fafc]'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
