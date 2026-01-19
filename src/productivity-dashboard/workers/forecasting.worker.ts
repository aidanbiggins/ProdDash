/**
 * Forecasting Worker
 * 
 * Runs heavy Monte Carlo simulations off the main thread to keep the UI responsive.
 * Receives simulation parameters and returns forecast results.
 */

// We need to import the engine. 
// Note: In CRA/Webpack environments, workers often need specific loader setups.
// For now, we'll assume standard worker-loader or similar is present.
// Since we are compiling TS, we may need to use 'importScripts' or bundle this separately.
// For simplicity in this environment, we will import the logic directly if the bundler supports it.
// If direct import fails in the worker context, we might need to duplicate the engine logic 
// or use a comlink approach. 

import { runSimulation, ForecastInput, SimulationParameters, ForecastResult } from '../services/probabilisticEngine';

/* eslint-disable no-restricted-globals */
const ctx: Worker = self as any;

interface WorkerMessage {
    id: string; // Correlation ID
    inputs: ForecastInput[]; // Array of candidates to simulate
    params: SimulationParameters;
}

interface WorkerResponse {
    id: string;
    results: (ForecastResult | null)[];
    error?: string;
}

ctx.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
    const { id, inputs, params } = event.data;

    try {
        const results = inputs.map(input => {
            try {
                return runSimulation(input, params);
            } catch (e) {
                console.error('Simulation failed for input:', input, e);
                return null;
            }
        });

        const response: WorkerResponse = {
            id,
            results
        };

        ctx.postMessage(response);
    } catch (err) {
        ctx.postMessage({
            id,
            results: [],
            error: err instanceof Error ? err.message : String(err)
        });
    }
});
