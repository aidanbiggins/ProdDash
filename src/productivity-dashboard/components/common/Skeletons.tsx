// Skeleton Components for Progressive Loading

import React from 'react';
import { LogoSpinner } from './LogoSpinner';

// Shimmer animation keyframes (inline style)
const shimmerStyle: React.CSSProperties = {
  background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.05) 100%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
};

// Inject shimmer keyframes on first render
if (typeof document !== 'undefined') {
  const styleId = 'skeleton-shimmer-keyframes';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      @keyframes pulse {
        0%, 100% { opacity: 0.4; }
        50% { opacity: 0.7; }
      }
    `;
    document.head.appendChild(style);
  }
}

// Base skeleton block
interface SkeletonBlockProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export function SkeletonBlock({
  width = '100%',
  height = 16,
  borderRadius = 4,
  className = '',
  style = {}
}: SkeletonBlockProps) {
  return (
    <div
      className={className}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius,
        backgroundColor: 'rgba(255,255,255,0.1)',
        ...shimmerStyle,
        ...style
      }}
    />
  );
}

// KPI Card Skeleton
interface KPISkeletonProps {
  count?: number;
}

export function KPISkeleton({ count = 4 }: KPISkeletonProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <div
            className="h-full rounded-xl p-5"
            style={{
              background: 'linear-gradient(135deg, rgba(30,30,46,0.8) 0%, rgba(45,45,68,0.8) 100%)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            {/* Label */}
            <SkeletonBlock width={80} height={12} style={{ marginBottom: 12 }} />
            {/* Value */}
            <SkeletonBlock width={120} height={36} borderRadius={6} style={{ marginBottom: 8 }} />
            {/* Subtext */}
            <SkeletonBlock width={100} height={10} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Chart Skeleton
interface ChartSkeletonProps {
  height?: number;
  type?: 'bar' | 'line' | 'pie' | 'funnel';
}

export function ChartSkeleton({ height = 300, type = 'bar' }: ChartSkeletonProps) {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: 'linear-gradient(135deg, rgba(30,30,46,0.8) 0%, rgba(45,45,68,0.8) 100%)',
        border: '1px solid rgba(255,255,255,0.1)',
        height: `${height}px`
      }}
    >
      {/* Chart title */}
      <SkeletonBlock width={150} height={18} style={{ marginBottom: 20 }} />

      {/* Chart content based on type */}
      {type === 'bar' && (
        <div className="flex items-end justify-around" style={{ height: 'calc(100% - 50px)' }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <SkeletonBlock
              key={i}
              width={40}
              height={`${30 + Math.random() * 60}%`}
              borderRadius={4}
            />
          ))}
        </div>
      )}

      {type === 'line' && (
        <div style={{ height: 'calc(100% - 50px)', position: 'relative' }}>
          <svg width="100%" height="100%" viewBox="0 0 400 200" preserveAspectRatio="none">
            <path
              d="M 0 150 Q 50 120, 100 100 T 200 80 T 300 60 T 400 40"
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="3"
              style={{ animation: 'pulse 1.5s infinite' }}
            />
          </svg>
        </div>
      )}

      {type === 'pie' && (
        <div className="flex justify-center items-center" style={{ height: 'calc(100% - 50px)' }}>
          <div
            style={{
              width: Math.min(height - 100, 200),
              height: Math.min(height - 100, 200),
              borderRadius: '50%',
              ...shimmerStyle,
              backgroundColor: 'rgba(255,255,255,0.1)'
            }}
          />
        </div>
      )}

      {type === 'funnel' && (
        <div className="flex flex-col items-center gap-2" style={{ height: 'calc(100% - 50px)' }}>
          {[100, 80, 60, 45, 30].map((width, i) => (
            <SkeletonBlock
              key={i}
              width={`${width}%`}
              height={30}
              borderRadius={6}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Table Skeleton
interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 5, columns = 5 }: TableSkeletonProps) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(30,30,46,0.8) 0%, rgba(45,45,68,0.8) 100%)',
        border: '1px solid rgba(255,255,255,0.1)'
      }}
    >
      {/* Table header */}
      <div
        className="flex gap-3 p-3 border-b border-white/10"
        style={{ background: 'rgba(0,0,0,0.2)' }}
      >
        {Array.from({ length: columns }).map((_, i) => (
          <SkeletonBlock
            key={i}
            width={i === 0 ? 150 : 80}
            height={14}
            style={{ flex: i === 0 ? 2 : 1 }}
          />
        ))}
      </div>

      {/* Table rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="flex gap-3 p-3"
          style={{ borderBottom: rowIndex < rows - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <SkeletonBlock
              key={colIndex}
              width={colIndex === 0 ? 150 : 80}
              height={12}
              style={{ flex: colIndex === 0 ? 2 : 1 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// Full Tab Content Skeleton - combines KPIs, chart, and table
interface TabSkeletonProps {
  showKPIs?: boolean;
  showChart?: boolean;
  showTable?: boolean;
  kpiCount?: number;
  chartType?: 'bar' | 'line' | 'pie' | 'funnel';
  tableRows?: number;
  tableColumns?: number;
}

export function TabSkeleton({
  showKPIs = true,
  showChart = true,
  showTable = true,
  kpiCount = 4,
  chartType = 'bar',
  tableRows = 5,
  tableColumns = 5
}: TabSkeletonProps) {
  return (
    <div className="p-4">
      {showKPIs && <KPISkeleton count={kpiCount} />}

      {showChart && (
        <div className="mb-4">
          <ChartSkeleton type={chartType} />
        </div>
      )}

      {showTable && <TableSkeleton rows={tableRows} columns={tableColumns} />}
    </div>
  );
}

// Inline loading message with spinner
interface LoadingMessageProps {
  message?: string;
}

export function LoadingMessage({ message = 'Loading...' }: LoadingMessageProps) {
  return (
    <div className="flex items-center gap-2 p-3">
      <LogoSpinner size={24} message={message} />
    </div>
  );
}

// Empty state placeholder
interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: string;
}

export function EmptyState({
  title = 'No data available',
  message = 'Data will appear here once loaded',
  icon = '📊'
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-5 min-h-[200px]">
      <div className="text-5xl mb-4 opacity-50">{icon}</div>
      <h5 className="text-white/80 mb-2">{title}</h5>
      <p className="text-white/50 m-0">{message}</p>
    </div>
  );
}
