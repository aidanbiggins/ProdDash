// Ultimate Demo Modal
// Simple one-click modal for loading demo data

import React, { useMemo, useCallback } from 'react';
import { Sparkles, Play, X } from 'lucide-react';
import { DEFAULT_PACK_CONFIG } from '../../types/demoTypes';
import { generateUltimateDemo } from '../../services/ultimateDemoGenerator';

interface UltimateDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadDemo: (bundle: ReturnType<typeof generateUltimateDemo>) => void;
  isLoading?: boolean;
}

const DEMO_SEED = 'ultimate-demo-v1';

export function UltimateDemoModal({
  isOpen,
  onClose,
  onLoadDemo,
  isLoading = false,
}: UltimateDemoModalProps) {
  // Pre-generate to show stats
  const previewBundle = useMemo(() => {
    return generateUltimateDemo(DEMO_SEED, DEFAULT_PACK_CONFIG);
  }, []);

  const handleLoad = useCallback(() => {
    onLoadDemo(previewBundle);
  }, [previewBundle, onLoadDemo]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 flex items-center justify-center z-50 p-4"
        tabIndex={-1}
        role="dialog"
      >
        <div className="w-full max-w-sm">
          <div className="glass-panel rounded-xl overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-border flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/20 text-primary">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="text-base font-semibold text-foreground">
                    Load Demo Data
                  </h5>
                  <p className="text-sm text-muted-foreground">
                    Explore PlatoVue with sample data
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                onClick={onClose}
                disabled={isLoading}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5">
              <p className="text-sm text-muted-foreground mb-4">
                This will load synthetic recruiting data including requisitions, candidates, and events to demonstrate all features.
              </p>

              {/* Quick stats */}
              <div className="grid grid-cols-4 gap-3 mb-5 p-3 rounded-lg bg-muted/30">
                <DataStat label="Reqs" value={previewBundle.requisitions.length} />
                <DataStat label="Candidates" value={previewBundle.candidates.length} />
                <DataStat label="Events" value={previewBundle.events.length} />
                <DataStat label="Users" value={previewBundle.users.length} />
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-md bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors"
                  onClick={onClose}
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-md bg-primary hover:bg-primary/90 text-primary-foreground inline-flex items-center justify-center gap-2 transition-colors"
                  onClick={handleLoad}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-current border-r-transparent rounded-full animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Load Demo
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Data stat component
function DataStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-base font-semibold text-foreground font-mono">
        {value.toLocaleString()}
      </div>
      <div className="text-[0.65rem] text-muted-foreground">{label}</div>
    </div>
  );
}

export default UltimateDemoModal;
