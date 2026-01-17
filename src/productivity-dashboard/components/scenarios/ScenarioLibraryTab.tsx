/**
 * Scenario Library Tab
 *
 * Main container for the "What If" scenario planning feature.
 * Allows users to configure and run recruiting scenarios to understand
 * impact before making decisions.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader, GlassPanel, SectionHeader, HelpButton, HelpDrawer } from '../common';
import { useDashboard } from '../../hooks/useDashboardContext';
import ScenarioSelector from './ScenarioSelector';
import SpinUpTeamForm from './parameters/SpinUpTeamForm';
import HiringFreezeForm from './parameters/HiringFreezeForm';
import RecruiterLeavesForm from './parameters/RecruiterLeavesForm';
import ScenarioOutputPanel from './output/ScenarioOutputPanel';
import { runScenario } from '../../services/scenarioEngine';
import { buildScenarioContext } from '../../services/scenarioContextBuilder';
import {
  ScenarioId,
  ScenarioInput,
  ScenarioOutput,
  ScenarioParameters,
  SpinUpTeamParams,
  HiringFreezeParams,
  RecruiterLeavesParams,
} from '../../types/scenarioTypes';
import { SCENARIOS_PAGE_HELP } from './scenariosHelpContent';

import './scenario-library.css';

interface ScenarioLibraryTabProps {
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

export default function ScenarioLibraryTab({ className = '' }: ScenarioLibraryTabProps) {
  const [showPageHelp, setShowPageHelp] = useState(false);
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
  const handleSelectScenario = useCallback((scenarioId: ScenarioId) => {
    const params = new URLSearchParams(searchParams);
    params.set('scenario', scenarioId);
    setSearchParams(params);
    setScenarioOutput(null);
    setError(null);
  }, [searchParams, setSearchParams]);

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
  const handleRunScenario = useCallback((params: ScenarioParameters) => {
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
  }, [selectedScenarioId, scenarioContext, dashboardState.filters]);

  // Render appropriate form based on selected scenario
  const renderParameterForm = () => {
    if (!selectedScenarioId) return null;

    switch (selectedScenarioId) {
      case 'spin_up_team':
        return (
          <SpinUpTeamForm
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
          <HiringFreezeForm
            onSubmit={(params: HiringFreezeParams) => handleRunScenario(params)}
            isRunning={isRunning}
          />
        );
      case 'recruiter_leaves':
        return (
          <RecruiterLeavesForm
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

  return (
    <div className={`scenario-library-tab ${className}`}>
      <PageHeader
        title="Scenario Library"
        subtitle="Model recruiting changes before making decisions"
        actions={<HelpButton onClick={() => setShowPageHelp(true)} ariaLabel="Open page help" />}
      />
      <HelpDrawer
        isOpen={showPageHelp}
        onClose={() => setShowPageHelp(false)}
        title="What-If Scenarios"
        content={SCENARIOS_PAGE_HELP}
      />

      {!hasData ? (
        <GlassPanel className="scenario-no-data">
          <div className="text-center py-5">
            <i className="bi bi-database-x display-4 text-secondary mb-3" />
            <h5>No Data Available</h5>
            <p className="text-secondary">
              Import recruiting data to start modeling scenarios.
            </p>
          </div>
        </GlassPanel>
      ) : !selectedScenarioId ? (
        <ScenarioSelector
          scenarios={SCENARIO_METADATA}
          onSelect={handleSelectScenario}
        />
      ) : (
        <div className="scenario-workspace">
          <div className="scenario-header">
            <button
              className="btn btn-link text-secondary p-0"
              onClick={handleBack}
            >
              <i className="bi bi-arrow-left me-2" />
              Back to scenarios
            </button>
            <SectionHeader
              title={(
                <>
                  <i className={`bi bi-${SCENARIO_METADATA[selectedScenarioId].icon} me-2`} />
                  {SCENARIO_METADATA[selectedScenarioId].title}
                </>
              )}
              className="mt-2"
            />
            <p className="scenario-description text-secondary">
              {SCENARIO_METADATA[selectedScenarioId].description}
            </p>
          </div>

          <div className="scenario-content">
            <GlassPanel className="scenario-parameters-panel">
              <h5 className="panel-title">
                <i className="bi bi-sliders me-2" />
                Configure Scenario
              </h5>
              {renderParameterForm()}
            </GlassPanel>

            {error && (
              <div className="alert alert-danger mt-3">
                <i className="bi bi-exclamation-triangle me-2" />
                {error}
              </div>
            )}

            {scenarioOutput && (
              <ScenarioOutputPanel
                output={scenarioOutput}
                scenarioMeta={SCENARIO_METADATA[selectedScenarioId]}
                datasetId="default"
              />
            )}
          </div>
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
      return new Date(now.getTime() + (params as SpinUpTeamParams).target_days * 24 * 60 * 60 * 1000);
    case 'hiring_freeze':
      return new Date(now.getTime() + (params as HiringFreezeParams).freeze_weeks * 7 * 24 * 60 * 60 * 1000);
    case 'recruiter_leaves':
      return (params as RecruiterLeavesParams).departure_date;
    default:
      return new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // Default 60 days
  }
}
