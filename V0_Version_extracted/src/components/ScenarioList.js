import React from 'react';

const ScenarioList = ({ scenarios, selectScenario }) => {
  return (
    <div className="card">
      <div className="card-header">Scenarios</div>
      <ul className="list-group list-group-flush">
        {scenarios.length === 0 && <li className="list-group-item">No scenarios available</li>}
        {scenarios.map(scenario => (
          <li key={scenario.id} className="list-group-item d-flex justify-content-between align-items-center">
            <div>
              <strong>{scenario.title}</strong>
              <br />
              <small>{scenario.description}</small>
            </div>
            <button className="btn btn-sm btn-secondary" onClick={() => selectScenario(scenario)}>Edit</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ScenarioList;
