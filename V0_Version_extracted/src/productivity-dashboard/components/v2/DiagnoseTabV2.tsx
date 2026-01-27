'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingDown,
  Users,
  Target,
  Zap,
  BarChart3,
  RefreshCw,
  ChevronRight,
  Activity,
  UserCheck,
  GitBranch,
  Gauge
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// Sub-view types for Diagnose tab
export type DiagnoseSubView =
  | 'overview'
  | 'recruiter'
  | 'hm-friction'
  | 'hiring-managers'
  | 'bottlenecks'
  | 'quality'
  | 'source-mix'
  | 'velocity';

interface DiagnoseTabV2Props {
  defaultSubView?: DiagnoseSubView;
  onSubViewChange?: (subView: DiagnoseSubView) => void;
}

interface DiagnosticItem {
  id: string;
  category: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
  metric: string;
  value: string | number;
  benchmark?: string;
  recommendation: string;
  affectedItems: string[];
  linkTo?: DiagnoseSubView;
}

const subViews: { id: DiagnoseSubView; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <Activity className="w-4 h-4" /> },
  { id: 'recruiter', label: 'Recruiter', icon: <UserCheck className="w-4 h-4" /> },
  { id: 'hm-friction', label: 'HM Friction', icon: <Clock className="w-4 h-4" /> },
  { id: 'hiring-managers', label: 'Hiring Managers', icon: <Users className="w-4 h-4" /> },
  { id: 'bottlenecks', label: 'Bottlenecks', icon: <GitBranch className="w-4 h-4" /> },
  { id: 'quality', label: 'Quality', icon: <Target className="w-4 h-4" /> },
  { id: 'source-mix', label: 'Source Mix', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'velocity', label: 'Velocity', icon: <Gauge className="w-4 h-4" /> },
];

// Sample diagnostics - in real implementation, these would come from the dashboard context
const sampleDiagnostics: DiagnosticItem[] = [
  {
    id: 'diag-1',
    category: 'critical',
    title: 'Interview Scheduling Bottleneck',
    description: 'Technical interview wait times have exceeded SLA thresholds',
    metric: 'Average Wait Time',
    value: '8.5 days',
    benchmark: 'Target: 3 days',
    recommendation: 'Increase interviewer panel availability by 20% or implement async coding assessments',
    affectedItems: ['Senior Backend Engineer', 'ML Engineer', 'Staff Frontend Engineer'],
    linkTo: 'bottlenecks',
  },
  {
    id: 'diag-2',
    category: 'critical',
    title: 'Recruiter Capacity Overload',
    description: '2 recruiters are above 100% utilization, risking burnout and quality issues',
    metric: 'Overloaded Recruiters',
    value: 2,
    benchmark: 'Target: 0',
    recommendation: 'Redistribute workload or bring on contract support for Engineering roles',
    affectedItems: ['Recruiter A (112%)', 'Recruiter B (105%)'],
    linkTo: 'recruiter',
  },
  {
    id: 'diag-3',
    category: 'warning',
    title: 'Declining Conversion Rate',
    description: 'Engineering screening-to-interview conversion has dropped below target',
    metric: 'Conversion Rate',
    value: '28%',
    benchmark: 'Target: 35%',
    recommendation: 'Review job descriptions and sourcing channels for better candidate matching',
    affectedItems: ['Engineering Department', '6 Open Requisitions'],
    linkTo: 'quality',
  },
  {
    id: 'diag-4',
    category: 'warning',
    title: 'HM Feedback Delays',
    description: '3 hiring managers have feedback pending for more than 3 days',
    metric: 'Pending Feedback',
    value: 3,
    benchmark: 'Target: 0',
    recommendation: 'Schedule recurring feedback sync with slow responders',
    affectedItems: ['Manager A', 'Manager B', 'Manager C'],
    linkTo: 'hm-friction',
  },
  {
    id: 'diag-5',
    category: 'info',
    title: 'Offer Stage Velocity',
    description: 'Time from final interview to offer is within acceptable range but could improve',
    metric: 'Offer Cycle Time',
    value: '5 days',
    benchmark: 'Target: 3 days',
    recommendation: 'Pre-stage offer approvals for candidates in final rounds',
    affectedItems: ['2 candidates in offer stage'],
    linkTo: 'velocity',
  },
  {
    id: 'diag-6',
    category: 'success',
    title: 'Strong Referral Performance',
    description: 'Employee referrals are performing above benchmark',
    metric: 'Referral Conversion',
    value: '45%',
    benchmark: 'Benchmark: 30%',
    recommendation: 'Consider expanding referral bonus program to capitalize on this channel',
    affectedItems: ['4 hires from referrals this quarter'],
    linkTo: 'source-mix',
  },
];

const categoryConfig = {
  critical: {
    icon: <AlertTriangle className="w-5 h-5" />,
    bg: 'bg-[rgba(239,68,68,0.1)]',
    border: 'border-[rgba(239,68,68,0.3)]',
    text: 'text-[#fca5a5]',
    badge: 'bg-[rgba(239,68,68,0.2)] text-[#fca5a5]',
    label: 'Critical',
  },
  warning: {
    icon: <Clock className="w-5 h-5" />,
    bg: 'bg-[rgba(245,158,11,0.1)]',
    border: 'border-[rgba(245,158,11,0.3)]',
    text: 'text-[#fcd34d]',
    badge: 'bg-[rgba(245,158,11,0.2)] text-[#fcd34d]',
    label: 'Warning',
  },
  info: {
    icon: <TrendingDown className="w-5 h-5" />,
    bg: 'bg-[rgba(59,130,246,0.1)]',
    border: 'border-[rgba(59,130,246,0.3)]',
    text: 'text-[#93c5fd]',
    badge: 'bg-[rgba(59,130,246,0.2)] text-[#93c5fd]',
    label: 'Info',
  },
  success: {
    icon: <CheckCircle className="w-5 h-5" />,
    bg: 'bg-[rgba(34,197,94,0.1)]',
    border: 'border-[rgba(34,197,94,0.3)]',
    text: 'text-[#86efac]',
    badge: 'bg-[rgba(34,197,94,0.2)] text-[#86efac]',
    label: 'Healthy',
  },
};

// Placeholder content for sub-views
function SubViewPlaceholder({ viewId, viewLabel }: { viewId: DiagnoseSubView; viewLabel: string }) {
  return (
    <div className="glass-panel p-6">
      <h3 className="text-lg font-semibold text-[#f8fafc] mb-2">{viewLabel} View</h3>
      <p className="text-[#94a3b8] text-sm">
        Detailed {viewLabel.toLowerCase()} analytics will be displayed here.
        This view will integrate with the existing v1 {viewId} component.
      </p>
    </div>
  );
}

export function DiagnoseTabV2({ defaultSubView = 'overview', onSubViewChange }: DiagnoseTabV2Props) {
  const [activeSubView, setActiveSubView] = useState<DiagnoseSubView>(defaultSubView);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isScanning, setIsScanning] = useState(false);

  const handleSubViewChange = (subView: DiagnoseSubView) => {
    setActiveSubView(subView);
    onSubViewChange?.(subView);
  };

  const filteredDiagnostics = selectedCategory === 'all'
    ? sampleDiagnostics
    : sampleDiagnostics.filter(d => d.category === selectedCategory);

  const criticalCount = sampleDiagnostics.filter(d => d.category === 'critical').length;
  const warningCount = sampleDiagnostics.filter(d => d.category === 'warning').length;
  const healthyCount = sampleDiagnostics.filter(d => d.category === 'success').length;
  const infoCount = sampleDiagnostics.filter(d => d.category === 'info').length;

  const healthScore = Math.round(
    ((healthyCount * 100) + (infoCount * 70) + (warningCount * 40) + (criticalCount * 10)) /
    sampleDiagnostics.length
  );

  const handleScan = () => {
    setIsScanning(true);
    setTimeout(() => setIsScanning(false), 2000);
  };

  // Render the overview/diagnostics view
  const renderDiagnosticsView = () => (
    <>
      {/* Health Score Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`glass-panel p-4 text-left transition-all ${
            selectedCategory === 'all' ? 'ring-1 ring-[#06b6d4]' : ''
          }`}
        >
          <div className="text-xs font-medium text-[#94a3b8] uppercase tracking-wider mb-1">
            Health Score
          </div>
          <div className="text-2xl font-bold text-[#f8fafc] font-mono">{healthScore}%</div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedCategory('critical')}
          className={`glass-panel p-4 text-left transition-all ${
            selectedCategory === 'critical' ? 'ring-1 ring-[#ef4444]' : ''
          }`}
        >
          <div className="text-xs font-medium text-[#fca5a5] uppercase tracking-wider mb-1">
            Critical
          </div>
          <div className="text-2xl font-bold text-[#fca5a5] font-mono">{criticalCount}</div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedCategory('warning')}
          className={`glass-panel p-4 text-left transition-all ${
            selectedCategory === 'warning' ? 'ring-1 ring-[#f59e0b]' : ''
          }`}
        >
          <div className="text-xs font-medium text-[#fcd34d] uppercase tracking-wider mb-1">
            Warnings
          </div>
          <div className="text-2xl font-bold text-[#fcd34d] font-mono">{warningCount}</div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedCategory('success')}
          className={`glass-panel p-4 text-left transition-all ${
            selectedCategory === 'success' ? 'ring-1 ring-[#22c55e]' : ''
          }`}
        >
          <div className="text-xs font-medium text-[#86efac] uppercase tracking-wider mb-1">
            Healthy
          </div>
          <div className="text-2xl font-bold text-[#86efac] font-mono">{healthyCount}</div>
        </button>
      </div>

      {/* Diagnostics List */}
      <div className="space-y-3">
        {filteredDiagnostics.map((diag) => {
          const config = categoryConfig[diag.category];
          return (
            <div
              key={diag.id}
              className={`glass-panel p-4 border ${config.border} ${config.bg}`}
            >
              <div className="flex items-start gap-3">
                <div className={`${config.text} mt-0.5`}>
                  {config.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${config.badge}`}>
                      {config.label}
                    </span>
                    <h4 className="text-sm font-medium text-[#f8fafc]">{diag.title}</h4>
                  </div>
                  <p className="text-xs text-[#94a3b8] mb-2">{diag.description}</p>

                  <div className="flex flex-wrap gap-4 text-xs mb-2">
                    <div>
                      <span className="text-[#64748b]">{diag.metric}: </span>
                      <span className="text-[#f8fafc] font-mono font-medium">{diag.value}</span>
                    </div>
                    {diag.benchmark && (
                      <div className="text-[#64748b]">{diag.benchmark}</div>
                    )}
                  </div>

                  <div className="text-xs text-[#94a3b8] mb-2">
                    <span className="text-[#64748b]">Recommendation: </span>
                    {diag.recommendation}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-[#64748b]">Affected:</span>
                    {diag.affectedItems.slice(0, 3).map((item, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded text-[10px] bg-white/[0.06] text-[#94a3b8]"
                      >
                        {item}
                      </span>
                    ))}
                    {diag.affectedItems.length > 3 && (
                      <span className="text-[10px] text-[#64748b]">
                        +{diag.affectedItems.length - 3} more
                      </span>
                    )}
                  </div>
                </div>

                {diag.linkTo && (
                  <button
                    type="button"
                    onClick={() => handleSubViewChange(diag.linkTo!)}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[#06b6d4] hover:bg-[#06b6d4]/10 transition-colors"
                  >
                    View Details
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#f8fafc] tracking-tight mb-1">
            Diagnose
          </h1>
          <p className="text-xs md:text-sm text-[#94a3b8]">
            System health diagnostics and pipeline analysis
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleScan}
          disabled={isScanning}
          className="bg-transparent border-white/[0.08] text-[#f8fafc] hover:bg-white/[0.06]"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
          {isScanning ? 'Scanning...' : 'Run Diagnostics'}
        </Button>
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
      {activeSubView === 'overview' ? (
        renderDiagnosticsView()
      ) : (
        <SubViewPlaceholder
          viewId={activeSubView}
          viewLabel={subViews.find(v => v.id === activeSubView)?.label || activeSubView}
        />
      )}
    </div>
  );
}

export default DiagnoseTabV2;
