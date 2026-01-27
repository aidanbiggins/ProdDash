import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ComparisonView = ({ socket }) => {
  const [scenarios, setScenarios] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [comparisonData, setComparisonData] = useState([]);
  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

  useEffect(() => {
    axios.get(`${backendUrl}/api/scenarios`, { withCredentials: true })
      .then(res => setScenarios(res.data))
      .catch(err => console.error(err));
  }, [backendUrl]);

  const handleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  useEffect(() => {
    Promise.all(selectedIds.map(id => axios.get(`${backendUrl}/api/scenarios/${id}`, { withCredentials: true })))
      .then(results => setComparisonData(results.map(r => r.data)))
      .catch(err => console.error(err));
  }, [selectedIds, backendUrl]);

  const renderComparison = () => {
    if (comparisonData.length < 2) {
      return <p>Select at least two scenarios for comparison.</p>;
    }
    const metrics = comparisonData.map(scenario => {
      const scenarioData = scenario.data;
      const totalRecruiterHours = scenarioData.numRecruiters * scenarioData.hoursPerWeek * scenarioData.weeksPeriod;
      const forecastedCapacity = totalRecruiterHours / scenarioData.avgHoursPerHire;
      return { title: scenario.title, totalRecruiterHours, forecastedCapacity };
    });
    
    return (
      <table className="w-full border border-glass-border">
        <thead>
          <tr>
            <th>Metric</th>
            {metrics.map(m => <th key={m.title}>{m.title}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Total Recruiter Hours</td>
            {metrics.map(m => <td key={m.title}>{m.totalRecruiterHours}</td>)}
          </tr>
          <tr>
            <td>Forecasted Capacity (Hires)</td>
            {metrics.map(m => <td key={m.title}>{m.forecastedCapacity.toFixed(2)}</td>)}
          </tr>
        </tbody>
      </table>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 mt-4">
      <h2>Scenario Comparison</h2>
      <div className="mb-3">
        <h5>Select Scenarios:</h5>
        {scenarios.map(scenario => (
          <div key={scenario.id}>
            <input type="checkbox" value={scenario.id} onChange={() => handleSelect(scenario.id)} checked={selectedIds.includes(scenario.id)} />
            <label className="ml-2">{scenario.title}</label>
          </div>
        ))}
      </div>
      {renderComparison()}
    </div>
  );
};

export default ComparisonView;
