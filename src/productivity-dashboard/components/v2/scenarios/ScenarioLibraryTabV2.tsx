/**
 * ScenarioLibraryTabV2
 *
 * Main container for the "What If" scenario planning feature.
 * Allows users to configure and run recruiting scenarios to understand
 * impact before making decisions.
 *
 * V2 version using SubViewHeader, glass-panel, and Tailwind tokens.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, Users, PauseCircle, UserMinus, SlidersHorizontal, Database } from 'lucide-react';
import { SectionHeader } from '../../common';
import { SubViewHeader } from '../SubViewHeader';
import { useDashboard } from '../../../hooks/useDashboardContext';
import { ScenarioSelectorV2 } from './ScenarioSelectorV2';
import { SpinUpTeamFormV2 } from './parameters/SpinUpTeamFormV2';
import { HiringFreezeFormV2 } from './parameters/HiringFreezeFormV2';
import { RecruiterLeavesFormV2 } from './parameters/RecruiterLeavesFormV2';
import { ScenarioOutputPanelV2 } from './output/ScenarioOutputPanelV2';
import { runScenario } from '../../../services/scenarioEngine';
import { buildScenarioContext } from '../../../services/scenarioContextBuilder';
import {
  ScenarioId,
  ScenarioInput,
  ScenarioOutput,
  ScenarioParameters,
  SpinUpTeamParams,
  HiringFreezeParams,
  RecruiterLeavesParams,
} from '../../../types/scenarioTypes';
import { SCENARIOS_PAGE_HELP } from './scenariosHelpContent';

interface ScenarioLibraryTabV2Props {
  className?: string;
}

const SCENARIO_METADATA: Record<ScenarioId, { title: string; description: string; icon: string }> = {
  spin_up_team: {
    title: 'Spin Up Team',
    description: 'Model hiring X people for a new team by target date',
    icon: 'people-fill',
  },
  hiring_freeze: {
    title: 'Hiring Freeze',
    description: 'Model the impact of pausing hiring for X weeks',
    icon: 'pause-circle-fill',
  },
  recruiter_leaves: {
    title: 'Recruiter Departs',
    description: 'Plan workload redistribution when a recruiter leaves',
    icon: 'person-dash-fill',
  },
};

const SCENARIO_ICONS: Record<ScenarioId, typeof Users> = {
  spin_up_team: Users,
  hiring_freeze: PauseCircle,
  recruiter_leaves: UserMinus,
};

export function ScenarioLibraryTabV2({ className = '' }: ScenarioLibraryTabV2Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { state: dashboardState } = useDashboard();

  // Selected scenario from URL or null
  const selectedScenarioId = searchParams.get('scenario') as ScenarioId | null;
  const prefilledRecruiterId = searchParams.get('recruiter_id') || undefined;
  const prefilledFunction = searchParams.get('function') || undefined;
  const prefilledLevel = searchParams.get('level') || undefined;

  // Scenario execution state
  const [scenarioOutput, setScenarioOutput] = useState<ScenarioOutput | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle scenario selection
  const handleSelectScenario = useCallback(
    (scenarioId: ScenarioId) => {
      const params = new URLSearchParams(searchParams);
      params.set('scenario', scenarioId);
      setSearchParams(params);
      setScenarioOutput(null);
      setError(null);
    },
    [searchParams, setSearchParams]
  );

  // Handle back to selector
  const handleBack = useCallback(() => {
    const params = new URLSearchParams();
    setSearchParams(params);
    setScenarioOutput(null);
    setError(null);
  }, [setSearchParams]);

  // Build scenario context from dashboard state
  const scenarioContext = useMemo(() => {
    if (!dashboardState.dataStore.requisitions.length) return null;
    return buildScenarioContext(dashboardState);
  }, [dashboardState]);

  // Run scenario with given parameters
  const handleRunScenario = useCallback(
    (params: ScenarioParameters) => {
      if (!selectedScenarioId || !scenarioContext) return;

      setIsRunning(true);
      setError(null);

      try {
        const input: ScenarioInput = {
          scenario_id: selectedScenarioId,
          date_range: {
            start_date: new Date(),
            end_date: getEndDate(selectedScenarioId, params),
          },
          parameters: params,
          context: {
            org_id: 'default',
            dataset_id: 'default',
            current_filters: dashboardState.filters,
          },
        };

        const output = runScenario(input, scenarioContext);
        setScenarioOutput(output);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to run scenario');
      } finally {
        setIsRunning(false);
      }
    },
    [selectedScenarioId, scenarioContext, dashboardState.filters]
  );

  // Render appropriate form based on selected scenario
  const renderParameterForm = () => {
    if (!selectedScenarioId) return null;

    switch (selectedScenarioId) {
      case 'spin_up_team':
        return (
          <SpinUpTeamFormV2
            recruiters={scenarioContext?.recruiters || []}
            hiringManagers={scenarioContext?.hiringManagers || []}
            defaultFunction={prefilledFunction}
            defaultLevel={prefilledLevel}
            onSubmit={(params: SpinUpTeamParams) => handleRunScenario(params)}
            isRunning={isRunning}
          />
        );
      case 'hiring_freeze':
        return (
          <HiringFreezeFormV2
            onSubmit={(params: HiringFreezeParams) => handleRunScenario(params)}
            isRunning={isRunning}
          />
        );
      case 'recruiter_leaves':
        return (
          <RecruiterLeavesFormV2
            recruiters={scenarioContext?.recruiters || []}
            defaultRecruiterId={prefilledRecruiterId}
            onSubmit={(params: RecruiterLeavesParams) => handleRunScenario(params)}
            isRunning={isRunning}
          />
        );
      default:
        return null;
    }
  };

  // Check if dashboard has data
  const hasData = dashboardState.dataStore.requisitions.length > 0;

  // Get the icon component for the selected scenario
  const ScenarioIcon = selectedScenarioId ? SCENARIO_ICONS[selectedScenarioId] : null;

  return (
    <div className={`space-y-4 ${className}`}>
      <SubViewHeader
        title="Scenario Library"
        subtitle="Model recruiting changes before making decisions"
        helpContent={SCENARIOS_PAGE_HELP}
      />

      {!hasData ? (
        <div className="glass-panel p-8 text-center">
          <Database size={48} className="text-muted-foreground mx-auto mb-3" />
          <h5 className="text-lg font-semibold text-foreground mb-2">No Data Available</h5>
          <p className="text-muted-foreground">
            Import recruiting data to start modeling scenarios.
          </p>
        </div>
      ) : !selectedScenarioId ? (
        <ScenarioSelectorV2 scenarios={SCENARIO_METADATA} onSelect={handleSelectScenario} />
      ) : (
        <div className="space-y-4">
          {/* Scenario header */}
          <div>
            <button
              className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors mb-3 min-h-[44px] px-2 -ml-2"
              onClick={handleBack}
            >
              <ArrowLeft size={16} className="mr-2" />
              Back to scenarios
            </button>
            <div className="flex items-center gap-3">
              {ScenarioIcon && <ScenarioIcon size={24} className="text-accent" />}
              <SectionHeader title={SCENARIO_METADATA[selectedScenarioId].title} />
            </div>
            <p className="text-muted-foreground mt-1">
              {SCENARIO_METADATA[selectedScenarioId].description}
            </p>
          </div>

          {/* Parameter form */}
          <div className="glass-panel p-4">
            <div className="flex items-center gap-2 mb-4">
              <SlidersHorizontal size={18} className="text-muted-foreground" />
              <h5 className="text-lg font-semibold text-foreground">Configure Scenario</h5>
            </div>
            {renderParameterForm()}
          </div>

          {/* Error display */}
          {error && (
            <div className="p-3 rounded-lg bg-bad/10 text-bad flex items-start">
              <span className="font-medium mr-2">Error:</span>
              {error}
            </div>
          )}

          {/* Output panel */}
          {scenarioOutput && (
            <ScenarioOutputPanelV2
              output={scenarioOutput}
              scenarioMeta={SCENARIO_METADATA[selectedScenarioId]}
              datasetId="default"
            />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Calculate end date based on scenario type and parameters
 */
function getEndDate(scenarioId: ScenarioId, params: ScenarioParameters): Date {
  const now = new Date();

  switch (scenarioId) {
    case 'spin_up_team':
      return new Date(
        now.getTime() + (params as SpinUpTeamParams).target_days * 24 * 60 * 60 * 1000
      );
    case 'hiring_freeze':
      return new Date(
        now.getTime() + (params as HiringFreezeParams).freeze_weeks * 7 * 24 * 60 * 60 * 1000
      );
    case 'recruiter_leaves':
      return (params as RecruiterLeavesParams).departure_date;
    default:
      return new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // Default 60 days
  }
}

export default ScenarioLibraryTabV2;
