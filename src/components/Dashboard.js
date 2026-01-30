import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ScenarioForm from './ScenarioForm';
import ScenarioList from './ScenarioList';
import ChartView from './ChartView';
import { Link } from 'react-router-dom';

const Dashboard = ({ user, socket }) => {
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://polar-meadow-81750-3a24506a4c88.herokuapp.com';

  const fetchScenarios = async () => {
    try {
      const res = await axios.get(`${backendUrl}/api/scenarios`, { withCredentials: true });
      setScenarios(res.data);
    } catch (err) {
      console.log('Backend unavailable: Using mock scenarios');
      setScenarios([
        { id: 1, title: 'Q1 Hiring Plan', hires: 12, timeline_days: 45, cost: 50000 },
        { id: 2, title: 'Aggressive Growth', hires: 30, timeline_days: 30, cost: 120000 },
        { id: 3, title: 'Conservative', hires: 5, timeline_days: 60, cost: 20000 }
      ]);
    }
  };

  useEffect(() => {
    fetchScenarios();

    if (!socket) return;

    // Listen for real-time events from Socket.io
    socket.on('scenario:created', (newScenario) => {
      setScenarios(prev => [...prev, newScenario]);
    });
    socket.on('scenario:updated', (updateInfo) => {
      setScenarios(prev => prev.map(s => s.id === updateInfo.id ? { ...s, ...updateInfo.updatedFields } : s));
      if (selectedScenario && selectedScenario.id === updateInfo.id) {
        setSelectedScenario(prev => ({ ...prev, ...updateInfo.updatedFields }));
      }
    });
    socket.on('scenario:deleted', (deleteInfo) => {
      setScenarios(prev => prev.filter(s => s.id !== deleteInfo.id));
    });

    return () => {
      socket.off('scenario:created');
      socket.off('scenario:updated');
      socket.off('scenario:deleted');
    };
  }, [socket, selectedScenario]);

  return (
    <div className="max-w-7xl mx-auto px-4">
      <header className="my-4">
        <h1>Welcome, {user.name}</h1>
        <Link to="/compare" className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md bg-white/10 text-foreground border border-border hover:bg-white/15">Compare Scenarios</Link>
      </header>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-6">
          <ScenarioForm user={user} onSuccess={fetchScenarios} selectedScenario={selectedScenario} clearSelection={() => setSelectedScenario(null)} />
        </div>
        <div className="col-span-12 md:col-span-6">
          <ScenarioList scenarios={scenarios} selectScenario={setSelectedScenario} />
        </div>
      </div>
      {selectedScenario && (
        <div className="mt-4">
          <h3>Real-Time Scenario Editing: {selectedScenario.title}</h3>
          <ChartView scenario={selectedScenario} socket={socket} />
        </div>
      )}
    </div>
  );
};

export default Dashboard;