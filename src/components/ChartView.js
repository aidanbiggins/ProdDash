import React, { useEffect, useState } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import { Chart, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend } from 'chart.js';

Chart.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend);

const ChartView = ({ scenario, socket }) => {
  const [chartType, setChartType] = useState('line');
  const [chartData, setChartData] = useState(null);

  const computeMetrics = (scenarioData) => {
    const totalRecruiterHours = scenarioData.numRecruiters * scenarioData.hoursPerWeek * scenarioData.weeksPeriod;
    const forecastedCapacity = totalRecruiterHours / scenarioData.avgHoursPerHire;
    const candidatesNeeded = scenarioData.conversionRate > 0 ? forecastedCapacity / (scenarioData.conversionRate / 100) : null;
    return { totalRecruiterHours, forecastedCapacity, candidatesNeeded };
  };

  useEffect(() => {
    if (scenario && scenario.data) {
      const metrics = computeMetrics(scenario.data);
      const labels = [];
      const forecastData = [];
      const totalHoursData = [];
      for (let week = 1; week <= scenario.data.weeksPeriod; week++) {
        labels.push(`Week ${week}`);
        forecastData.push(metrics.forecastedCapacity);
        totalHoursData.push((scenario.data.numRecruiters * scenario.data.hoursPerWeek * week));
      }
      setChartData({
        labels,
        datasets: [
          {
            label: 'Forecasted Capacity (Hires)',
            data: forecastData,
            borderColor: 'rgba(75,192,192,1)',
            fill: false,
            tension: 0.1,
          },
          {
            label: 'Total Recruiter Hours',
            data: totalHoursData,
            borderColor: 'rgba(153,102,255,1)',
            fill: false,
            tension: 0.1,
          }
        ]
      });
    }
  }, [scenario]);

  return (
    <div>
      <div className="mb-3">
        <label className="me-2">Chart Type:</label>
        <select value={chartType} onChange={(e) => setChartType(e.target.value)}>
          <option value="line">Line Chart</option>
          <option value="bar">Bar Chart</option>
        </select>
      </div>
      {chartData && (chartType === 'line' ? <Line data={chartData} /> : <Bar data={chartData} />)}
    </div>
  );
};

export default ChartView;