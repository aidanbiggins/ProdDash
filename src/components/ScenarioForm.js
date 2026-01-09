import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ScenarioForm = ({ user, onSuccess, selectedScenario, clearSelection }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    data: {
      numRecruiters: '',
      hoursPerWeek: '',
      weeksPeriod: 4,
      avgHoursPerHire: '',
      conversionRate: '',
      hiringTarget: ''
    }
  });
  
  useEffect(() => {
    if (selectedScenario) {
      setFormData({
        title: selectedScenario.title,
        description: selectedScenario.description,
        data: selectedScenario.data
      });
    } else {
      setFormData({
        title: '',
        description: '',
        data: {
          numRecruiters: '',
          hoursPerWeek: '',
          weeksPeriod: 4,
          avgHoursPerHire: '',
          conversionRate: '',
          hiringTarget: ''
        }
      });
    }
  }, [selectedScenario]);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (formData.data.hasOwnProperty(name)) {
      setFormData({
        ...formData,
        data: { ...formData.data, [name]: value }
      });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://polar-meadow-81750-3a24506a4c88.herokuapp.com';
    try {
      if (selectedScenario) {
        await axios.put(`${backendUrl}/api/scenarios/${selectedScenario.id}`, formData, { withCredentials: true });
      } else {
        await axios.post(`${backendUrl}/api/scenarios`, formData, { withCredentials: true });
      }
      onSuccess();
      clearSelection();
      setFormData({
        title: '',
        description: '',
        data: {
          numRecruiters: '',
          hoursPerWeek: '',
          weeksPeriod: 4,
          avgHoursPerHire: '',
          conversionRate: '',
          hiringTarget: ''
        }
      });
    } catch (err) {
      console.error('Error saving scenario', err);
    }
  };
  
  return (
    <div className="card mb-4">
      <div className="card-header">{selectedScenario ? 'Edit Scenario' : 'Add New Scenario'}</div>
      <div className="card-body">
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label">Title</label>
            <input type="text" name="title" value={formData.title} onChange={handleChange} className="form-control" required />
          </div>
          <div className="mb-3">
            <label className="form-label">Description</label>
            <textarea name="description" value={formData.description} onChange={handleChange} className="form-control" />
          </div>
          {/* Scenario planning fields */}
          <div className="mb-3">
            <label className="form-label">Number of Recruiters</label>
            <input type="number" name="numRecruiters" value={formData.data.numRecruiters} onChange={handleChange} className="form-control" required />
          </div>
          <div className="mb-3">
            <label className="form-label">Hours per Recruiter per Week</label>
            <input type="number" name="hoursPerWeek" value={formData.data.hoursPerWeek} onChange={handleChange} className="form-control" required />
          </div>
          <div className="mb-3">
            <label className="form-label">Weeks in the Period</label>
            <input type="number" name="weeksPeriod" value={formData.data.weeksPeriod} onChange={handleChange} className="form-control" required />
          </div>
          <div className="mb-3">
            <label className="form-label">Average Hours per Hire</label>
            <input type="number" name="avgHoursPerHire" value={formData.data.avgHoursPerHire} onChange={handleChange} className="form-control" required />
          </div>
          <div className="mb-3">
            <label className="form-label">Candidate Conversion Rate (%)</label>
            <input type="number" name="conversionRate" value={formData.data.conversionRate} onChange={handleChange} className="form-control" required />
          </div>
          <div className="mb-3">
            <label className="form-label">Hiring Target (Optional)</label>
            <input type="number" name="hiringTarget" value={formData.data.hiringTarget} onChange={handleChange} className="form-control" />
          </div>
          <button type="submit" className="btn btn-primary">{selectedScenario ? 'Update' : 'Add'} Scenario</button>
        </form>
      </div>
    </div>
  );
};

export default ScenarioForm;