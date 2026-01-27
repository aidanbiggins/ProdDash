'use client';

import React, { useState } from 'react';
import {
  Users,
  TrendingUp,
  Layers,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Scale,
  Target,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

// Sub-view types for Plan tab
export type PlanSubView = 'capacity' | 'forecasting' | 'scenarios' | 'rebalancer';

interface PlanTabV2Props {
  defaultSubView?: PlanSubView;
  onSubViewChange?: (subView: PlanSubView) => void;
}

const subViews: { id: PlanSubView; label: string; icon: React.ReactNode }[] = [
  { id: 'capacity', label: 'Capacity', icon: <Users className="w-4 h-4" /> },
  { id: 'rebalancer', label: 'Rebalancer', icon: <Scale className="w-4 h-4" /> },
  { id: 'forecasting', label: 'Forecasting', icon: <TrendingUp className="w-4 h-4" /> },
  { id: 'scenarios', label: 'Scenarios', icon: <Layers className="w-4 h-4" /> },
];

// Sample capacity data
interface TeamCapacityData {
  team: string;
  headcount: number;
  totalCapacity: number;
  usedCapacity: number;
  openReqs: number;
  avgReqLoad: number;
  trend: 'up' | 'down' | 'flat';
}

const sampleTeamCapacity: TeamCapacityData[] = [
  { team: 'Engineering', headcount: 4, totalCapacity: 40, usedCapacity: 38, openReqs: 12, avgReqLoad: 3, trend: 'up' },
  { team: 'Product', headcount: 2, totalCapacity: 20, usedCapacity: 16, openReqs: 5, avgReqLoad: 2.5, trend: 'flat' },
  { team: 'Sales', headcount: 3, totalCapacity: 30, usedCapacity: 24, openReqs: 8, avgReqLoad: 2.7, trend: 'down' },
  { team: 'Marketing', headcount: 1, totalCapacity: 10, usedCapacity: 8, openReqs: 3, avgReqLoad: 3, trend: 'flat' },
];

// Sample forecast data
interface ForecastData {
  quarter: string;
  expectedHires: number;
  targetHires: number;
  confidence: 'high' | 'medium' | 'low';
  gap: number;
}

const sampleForecast: ForecastData[] = [
  { quarter: 'Q1 2026', expectedHires: 15, targetHires: 18, confidence: 'high', gap: -3 },
  { quarter: 'Q2 2026', expectedHires: 22, targetHires: 25, confidence: 'medium', gap: -3 },
  { quarter: 'Q3 2026', expectedHires: 18, targetHires: 20, confidence: 'low', gap: -2 },
];

// Sample scenario data
interface ScenarioData {
  id: string;
  name: string;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
  hiresDelta: number;
  costDelta: number;
  status: 'draft' | 'active' | 'archived';
}

const sampleScenarios: ScenarioData[] = [
  {
    id: 'scen-1',
    name: 'Add Contract Recruiter',
    description: 'Bring on 1 contract recruiter for Q2 Engineering surge',
    impact: 'positive',
    hiresDelta: +5,
    costDelta: 45000,
    status: 'active',
  },
  {
    id: 'scen-2',
    name: 'Reduce Job Board Spend',
    description: 'Shift 30% of job board budget to referral bonuses',
    impact: 'neutral',
    hiresDelta: 0,
    costDelta: -15000,
    status: 'draft',
  },
  {
    id: 'scen-3',
    name: 'Hiring Freeze Impact',
    description: 'Model impact of 60-day hiring pause',
    impact: 'negative',
    hiresDelta: -8,
    costDelta: -120000,
    status: 'draft',
  },
];

const trendIcon = {
  up: <ArrowUpRight className="w-4 h-4 text-[#22c55e]" />,
  down: <ArrowDownRight className="w-4 h-4 text-[#ef4444]" />,
  flat: <Minus className="w-4 h-4 text-[#94a3b8]" />,
};

const confidenceConfig = {
  high: { color: 'text-[#22c55e]', bg: 'bg-[rgba(34,197,94,0.1)]', label: 'High' },
  medium: { color: 'text-[#f59e0b]', bg: 'bg-[rgba(245,158,11,0.1)]', label: 'Medium' },
  low: { color: 'text-[#ef4444]', bg: 'bg-[rgba(239,68,68,0.1)]', label: 'Low' },
};

function CapacityView() {
  const totalCapacity = sampleTeamCapacity.reduce((acc, t) => acc + t.totalCapacity, 0);
  const usedCapacity = sampleTeamCapacity.reduce((acc, t) => acc + t.usedCapacity, 0);
  const totalHeadcount = sampleTeamCapacity.reduce((acc, t) => acc + t.headcount, 0);
  const totalReqs = sampleTeamCapacity.reduce((acc, t) => acc + t.openReqs, 0);
  const overallUtilization = Math.round((usedCapacity / totalCapacity) * 100);

  return (
    <>
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="glass-panel p-4">
          <div className="text-xs font-medium text-[#94a3b8] uppercase tracking-wider mb-1">
            Team Size
          </div>
          <div className="text-2xl font-bold text-[#f8fafc] font-mono">{totalHeadcount}</div>
        </div>
        <div className="glass-panel p-4">
          <div className="text-xs font-medium text-[#94a3b8] uppercase tracking-wider mb-1">
            Open Reqs
          </div>
          <div className="text-2xl font-bold text-[#f8fafc] font-mono">{totalReqs}</div>
        </div>
        <div className="glass-panel p-4">
          <div className="text-xs font-medium text-[#94a3b8] uppercase tracking-wider mb-1">
            Utilization
          </div>
          <div className={`text-2xl font-bold font-mono ${overallUtilization > 90 ? 'text-[#ef4444]' : overallUtilization > 75 ? 'text-[#f59e0b]' : 'text-[#22c55e]'}`}>
            {overallUtilization}%
          </div>
        </div>
        <div className="glass-panel p-4">
          <div className="text-xs font-medium text-[#94a3b8] uppercase tracking-wider mb-1">
            Avg Req Load
          </div>
          <div className="text-2xl font-bold text-[#f8fafc] font-mono">
            {(totalReqs / totalHeadcount).toFixed(1)}
          </div>
        </div>
      </div>

      {/* Team Breakdown */}
      <div className="glass-panel p-4">
        <h3 className="text-sm font-semibold text-[#f8fafc] mb-4">Team Capacity Breakdown</h3>
        <div className="space-y-4">
          {sampleTeamCapacity.map((team) => {
            const utilization = Math.round((team.usedCapacity / team.totalCapacity) * 100);
            return (
              <div key={team.team} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#f8fafc]">{team.team}</span>
                    {trendIcon[team.trend]}
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-[#94a3b8]">{team.headcount} recruiters</span>
                    <span className="text-[#94a3b8]">{team.openReqs} reqs</span>
                    <span className={`font-mono font-medium ${utilization > 90 ? 'text-[#ef4444]' : utilization > 75 ? 'text-[#f59e0b]' : 'text-[#22c55e]'}`}>
                      {utilization}%
                    </span>
                  </div>
                </div>
                <Progress
                  value={utilization}
                  className="h-2 bg-white/[0.06]"
                />
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function ForecastingView() {
  return (
    <>
      {/* Forecast Summary */}
      <div className="glass-panel p-4 mb-6">
        <h3 className="text-sm font-semibold text-[#f8fafc] mb-4">Quarterly Hiring Forecast</h3>
        <div className="space-y-4">
          {sampleForecast.map((f) => {
            const config = confidenceConfig[f.confidence];
            const gapPercent = Math.round((f.gap / f.targetHires) * 100);
            return (
              <div key={f.quarter} className="glass-panel p-4 border border-white/[0.06]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-[#94a3b8]" />
                    <span className="text-sm font-medium text-[#f8fafc]">{f.quarter}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${config.bg} ${config.color}`}>
                      {config.label} Confidence
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-xs text-[#94a3b8] mb-1">Expected</div>
                    <div className="text-lg font-bold text-[#f8fafc] font-mono">{f.expectedHires}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[#94a3b8] mb-1">Target</div>
                    <div className="text-lg font-bold text-[#f8fafc] font-mono">{f.targetHires}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[#94a3b8] mb-1">Gap</div>
                    <div className={`text-lg font-bold font-mono ${f.gap >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                      {f.gap >= 0 ? '+' : ''}{f.gap} ({gapPercent}%)
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Risk Callout */}
      <div className="glass-panel p-4 border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.05)]">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#fca5a5] mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-[#fca5a5] mb-1">Gap to Goal Risk</h4>
            <p className="text-xs text-[#94a3b8]">
              Current pipeline supports 55 hires vs 63 target. Consider activating sourcing campaigns
              or adjusting hiring plans to close the gap.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function ScenariosView() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#f8fafc]">Scenario Library</h3>
        <Button
          variant="outline"
          size="sm"
          className="bg-transparent border-white/[0.08] text-[#f8fafc] hover:bg-white/[0.06]"
        >
          + New Scenario
        </Button>
      </div>

      {sampleScenarios.map((scenario) => (
        <div
          key={scenario.id}
          className={`glass-panel p-4 border ${
            scenario.impact === 'positive'
              ? 'border-[rgba(34,197,94,0.3)]'
              : scenario.impact === 'negative'
              ? 'border-[rgba(239,68,68,0.3)]'
              : 'border-white/[0.08]'
          }`}
        >
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-sm font-medium text-[#f8fafc]">{scenario.name}</h4>
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                  scenario.status === 'active'
                    ? 'bg-[rgba(34,197,94,0.2)] text-[#86efac]'
                    : 'bg-white/[0.06] text-[#94a3b8]'
                }`}>
                  {scenario.status}
                </span>
              </div>
              <p className="text-xs text-[#94a3b8]">{scenario.description}</p>
            </div>
            <Layers className="w-4 h-4 text-[#94a3b8]" />
          </div>

          <div className="flex items-center gap-6 mt-3 text-xs">
            <div>
              <span className="text-[#64748b]">Hires Impact: </span>
              <span className={`font-mono font-medium ${
                scenario.hiresDelta > 0
                  ? 'text-[#22c55e]'
                  : scenario.hiresDelta < 0
                  ? 'text-[#ef4444]'
                  : 'text-[#94a3b8]'
              }`}>
                {scenario.hiresDelta > 0 ? '+' : ''}{scenario.hiresDelta}
              </span>
            </div>
            <div>
              <span className="text-[#64748b]">Cost Impact: </span>
              <span className={`font-mono font-medium ${
                scenario.costDelta < 0
                  ? 'text-[#22c55e]'
                  : scenario.costDelta > 0
                  ? 'text-[#f59e0b]'
                  : 'text-[#94a3b8]'
              }`}>
                {scenario.costDelta >= 0 ? '+' : ''}${(scenario.costDelta / 1000).toFixed(0)}k
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function RebalancerPlaceholder() {
  return (
    <div className="glass-panel p-6 text-center">
      <Scale className="w-12 h-12 text-[#94a3b8] mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-[#f8fafc] mb-2">Capacity Rebalancer</h3>
      <p className="text-sm text-[#94a3b8] max-w-md mx-auto">
        Simulate workload redistribution across your recruiting team.
        This view will integrate with the existing v1 capacity rebalancer component.
      </p>
    </div>
  );
}

export function PlanTabV2({ defaultSubView = 'capacity', onSubViewChange }: PlanTabV2Props) {
  const [activeSubView, setActiveSubView] = useState<PlanSubView>(defaultSubView);

  const handleSubViewChange = (subView: PlanSubView) => {
    setActiveSubView(subView);
    onSubViewChange?.(subView);
  };

  const renderContent = () => {
    switch (activeSubView) {
      case 'capacity':
        return <CapacityView />;
      case 'forecasting':
        return <ForecastingView />;
      case 'scenarios':
        return <ScenariosView />;
      case 'rebalancer':
        return <RebalancerPlaceholder />;
      default:
        return <CapacityView />;
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-[#f8fafc] tracking-tight mb-1">
          Plan
        </h1>
        <p className="text-xs md:text-sm text-[#94a3b8]">
          Capacity planning, forecasting, and scenario modeling
        </p>
      </div>

      {/* Sub-navigation */}
      <div className="flex gap-1 overflow-x-auto pb-2 mb-6 -mx-4 px-4 md:mx-0 md:px-0">
        {subViews.map((view) => (
          <button
            key={view.id}
            type="button"
            onClick={() => handleSubViewChange(view.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              activeSubView === view.id
                ? 'bg-[#06b6d4]/10 text-[#06b6d4]'
                : 'text-[#94a3b8] hover:bg-white/[0.06] hover:text-[#f8fafc]'
            }`}
          >
            {view.icon}
            <span>{view.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {renderContent()}
    </div>
  );
}

export default PlanTabV2;
