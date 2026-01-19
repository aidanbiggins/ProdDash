// Import Guide Component - Comprehensive data requirements guide
// Shows what data enables which features

import React, { useState } from 'react';

interface ImportGuideProps {
  onClose: () => void;
}

type TabType = 'requirements' | 'icims' | 'greenhouse' | 'lever' | 'generic';

export function ImportGuide({ onClose }: ImportGuideProps) {
  const [activeTab, setActiveTab] = useState<TabType>('requirements');

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable modal-dialog-centered">
        <div className="modal-content glass-panel" style={{ maxHeight: '90vh' }}>
          <div className="modal-header border-secondary">
            <h5 className="modal-title">Data Import Guide</h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose} />
          </div>

          {/* Navigation Tabs */}
          <div className="border-bottom border-secondary px-3">
            <ul className="nav nav-tabs border-0">
              <li className="nav-item">
                <button
                  className={`nav-link ${activeTab === 'requirements' ? 'active' : ''}`}
                  onClick={() => setActiveTab('requirements')}
                  style={{ color: activeTab === 'requirements' ? '#d4a373' : '#94a3b8' }}
                >
                  What Data Do I Need?
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link ${activeTab === 'icims' ? 'active' : ''}`}
                  onClick={() => setActiveTab('icims')}
                  style={{ color: activeTab === 'icims' ? '#d4a373' : '#94a3b8' }}
                >
                  iCIMS
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link ${activeTab === 'greenhouse' ? 'active' : ''}`}
                  onClick={() => setActiveTab('greenhouse')}
                  style={{ color: activeTab === 'greenhouse' ? '#d4a373' : '#94a3b8' }}
                >
                  Greenhouse
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link ${activeTab === 'lever' ? 'active' : ''}`}
                  onClick={() => setActiveTab('lever')}
                  style={{ color: activeTab === 'lever' ? '#d4a373' : '#94a3b8' }}
                >
                  Lever
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link ${activeTab === 'generic' ? 'active' : ''}`}
                  onClick={() => setActiveTab('generic')}
                  style={{ color: activeTab === 'generic' ? '#d4a373' : '#94a3b8' }}
                >
                  Other ATS
                </button>
              </li>
            </ul>
          </div>

          <div className="modal-body" style={{ overflowY: 'auto' }}>
            {activeTab === 'requirements' && <RequirementsTab />}
            {activeTab === 'icims' && <ICIMSTab />}
            {activeTab === 'greenhouse' && <GreenhouseTab />}
            {activeTab === 'lever' && <LeverTab />}
            {activeTab === 'generic' && <GenericTab />}
          </div>

          <div className="modal-footer border-secondary">
            <button className="btn btn-outline-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RequirementsTab() {
  return (
    <div>
      <h5 className="mb-4">What Data Enables What Features?</h5>

      <p className="text-muted mb-4">
        ProdDash analyzes your recruiting data to surface insights. The more complete your data,
        the more features you unlock. Here's exactly what you need for each capability.
      </p>

      {/* Critical Fields */}
      <div className="glass-panel p-4 mb-4" style={{ borderLeft: '4px solid #ef4444' }}>
        <h6 className="text-danger mb-3">CRITICAL - Without These, Dashboard Won't Work</h6>
        <div className="row g-3">
          <div className="col-md-6">
            <div className="p-3 rounded" style={{ background: 'rgba(239,68,68,0.1)' }}>
              <strong>Requisitions must have:</strong>
              <ul className="mb-0 small mt-2">
                <li><code>req_id</code> - Unique job identifier</li>
                <li><code>opened_at</code> - When the job was opened (for time filtering)</li>
              </ul>
            </div>
          </div>
          <div className="col-md-6">
            <div className="p-3 rounded" style={{ background: 'rgba(239,68,68,0.1)' }}>
              <strong>Candidates must have:</strong>
              <ul className="mb-0 small mt-2">
                <li><code>candidate_id</code> - Unique person identifier</li>
                <li><code>req_id</code> - Which job they applied to</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Requirements Matrix */}
      <h6 className="mb-3">Feature Requirements Matrix</h6>
      <div className="table-responsive">
        <table className="table table-dark table-sm">
          <thead>
            <tr>
              <th>Dashboard Feature</th>
              <th>Required Fields</th>
              <th>Impact if Missing</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Command Center KPIs</strong></td>
              <td>
                <code>opened_at</code>, <code>status</code>, <code>hired_at</code>
              </td>
              <td>Shows "--" for metrics</td>
            </tr>
            <tr>
              <td><strong>Time-to-Fill (TTF)</strong></td>
              <td>
                <code>opened_at</code>, <code>hired_at</code> or <code>closed_at</code>
              </td>
              <td>Cannot calculate TTF</td>
            </tr>
            <tr>
              <td><strong>Recruiter Metrics</strong></td>
              <td>
                <code>recruiter_id</code> on requisitions
              </td>
              <td>All reqs show "Unassigned"</td>
            </tr>
            <tr>
              <td><strong>HM Latency / Friction</strong></td>
              <td>
                <code>hiring_manager_id</code>, <code>current_stage_entered_at</code>
              </td>
              <td>HM tabs disabled</td>
            </tr>
            <tr>
              <td><strong>Pipeline Analysis</strong></td>
              <td>
                <code>current_stage</code> on candidates
              </td>
              <td>No funnel or stage breakdown</td>
            </tr>
            <tr>
              <td><strong>Source Effectiveness</strong></td>
              <td>
                <code>source</code> on candidates
              </td>
              <td>Source tab disabled</td>
            </tr>
            <tr>
              <td><strong>Offer Analytics</strong></td>
              <td>
                <code>offer_extended_at</code>, <code>offer_accepted_at</code> or <code>hired_at</code>
              </td>
              <td>Accept rate shows "--"</td>
            </tr>
            <tr>
              <td><strong>Candidate Quality</strong></td>
              <td>
                <code>disposition</code>, <code>current_stage</code>
              </td>
              <td>Quality tab limited</td>
            </tr>
            <tr>
              <td><strong>Velocity / Stage Timing</strong></td>
              <td>
                <code>applied_at</code>, <code>current_stage_entered_at</code>, stage timestamps
              </td>
              <td>Velocity insights disabled</td>
            </tr>
            <tr>
              <td><strong>Risk Detection</strong></td>
              <td>
                <code>current_stage_entered_at</code>, <code>opened_at</code>
              </td>
              <td>Stalled/zombie detection limited</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Ideal Export Checklist */}
      <h6 className="mt-4 mb-3">Ideal Export Checklist</h6>
      <div className="row g-3">
        <div className="col-md-6">
          <div className="glass-panel p-3">
            <h6 className="text-success">Requisitions / Jobs</h6>
            <div className="small">
              <div className="form-check">
                <input className="form-check-input" type="checkbox" checked readOnly />
                <label className="form-check-label">Job ID / Requisition ID</label>
              </div>
              <div className="form-check">
                <input className="form-check-input" type="checkbox" checked readOnly />
                <label className="form-check-label">Job Title</label>
              </div>
              <div className="form-check">
                <input className="form-check-input" type="checkbox" checked readOnly />
                <label className="form-check-label">Open Date / Created Date</label>
              </div>
              <div className="form-check">
                <input className="form-check-input" type="checkbox" checked readOnly />
                <label className="form-check-label">Status (Open/Closed/On Hold)</label>
              </div>
              <div className="form-check">
                <input className="form-check-input" type="checkbox" checked readOnly />
                <label className="form-check-label">Close Date / Filled Date</label>
              </div>
              <div className="form-check">
                <input className="form-check-input" type="checkbox" checked readOnly />
                <label className="form-check-label">Recruiter Name</label>
              </div>
              <div className="form-check">
                <input className="form-check-input" type="checkbox" checked readOnly />
                <label className="form-check-label">Hiring Manager Name</label>
              </div>
              <div className="form-check">
                <input className="form-check-input" type="checkbox" readOnly />
                <label className="form-check-label text-muted">Department / Function</label>
              </div>
              <div className="form-check">
                <input className="form-check-input" type="checkbox" readOnly />
                <label className="form-check-label text-muted">Level / Grade</label>
              </div>
              <div className="form-check">
                <input className="form-check-input" type="checkbox" readOnly />
                <label className="form-check-label text-muted">Location</label>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="glass-panel p-3">
            <h6 className="text-info">Candidates / Applications</h6>
            <div className="small">
              <div className="form-check">
                <input className="form-check-input" type="checkbox" checked readOnly />
                <label className="form-check-label">Candidate ID / Person ID</label>
              </div>
              <div className="form-check">
                <input className="form-check-input" type="checkbox" checked readOnly />
                <label className="form-check-label">Job ID (to link to requisition)</label>
              </div>
              <div className="form-check">
                <input className="form-check-input" type="checkbox" checked readOnly />
                <label className="form-check-label">Current Stage / Status</label>
              </div>
              <div className="form-check">
                <input className="form-check-input" type="checkbox" checked readOnly />
                <label className="form-check-label">Application Date</label>
              </div>
              <div className="form-check">
                <input className="form-check-input" type="checkbox" checked readOnly />
                <label className="form-check-label">Stage Entry Date (when entered current stage)</label>
              </div>
              <div className="form-check">
                <input className="form-check-input" type="checkbox" checked readOnly />
                <label className="form-check-label">Source (where they came from)</label>
              </div>
              <div className="form-check">
                <input className="form-check-input" type="checkbox" checked readOnly />
                <label className="form-check-label">Hire Date (if hired)</label>
              </div>
              <div className="form-check">
                <input className="form-check-input" type="checkbox" checked readOnly />
                <label className="form-check-label">Offer Date (if offered)</label>
              </div>
              <div className="form-check">
                <input className="form-check-input" type="checkbox" readOnly />
                <label className="form-check-label text-muted">Candidate Name</label>
              </div>
              <div className="form-check">
                <input className="form-check-input" type="checkbox" readOnly />
                <label className="form-check-label text-muted">Rejection Date / Reason</label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="alert alert-info mt-4">
        <strong>Pro Tip:</strong> Export more columns than you think you need. ProdDash will ignore
        columns it doesn't recognize, but having extra data means you won't need to re-export later.
      </div>
    </div>
  );
}

function ICIMSTab() {
  return (
    <div>
      <h5 className="mb-4">Exporting from iCIMS</h5>

      <div className="alert alert-success mb-4">
        <strong>Best Method: Recruiting Workflow Search</strong><br />
        This single export contains jobs AND candidates together - one file does it all.
      </div>

      <div className="glass-panel p-4 mb-4">
        <h6>Step-by-Step: Recruiting Workflow Export</h6>
        <ol className="mb-0">
          <li className="mb-2">
            Go to <strong>Search &gt; Recruiting Workflow Search</strong>
          </li>
          <li className="mb-2">
            Set your date range and any filters (e.g., specific recruiters or departments)
          </li>
          <li className="mb-2">
            <strong>Add these columns</strong> (use "Modify Columns"):
            <div className="row mt-2 g-2">
              <div className="col-md-4">
                <div className="p-2 rounded" style={{ background: 'rgba(16,185,129,0.1)' }}>
                  <strong className="small text-success">Job Fields:</strong>
                  <ul className="small mb-0">
                    <li>Job: System ID</li>
                    <li>Job: Job Title</li>
                    <li>Job: Date Opened</li>
                    <li>Job: Status</li>
                    <li>Recruiter (Full Name)</li>
                    <li>Hiring Manager (Full Name)</li>
                    <li>Job: Department</li>
                  </ul>
                </div>
              </div>
              <div className="col-md-4">
                <div className="p-2 rounded" style={{ background: 'rgba(59,130,246,0.1)' }}>
                  <strong className="small text-info">Candidate Fields:</strong>
                  <ul className="small mb-0">
                    <li>Person: System ID</li>
                    <li>Person: Full Name</li>
                    <li>Submittal Date</li>
                    <li>Source</li>
                    <li>Hire/Rehire Date</li>
                  </ul>
                </div>
              </div>
              <div className="col-md-4">
                <div className="p-2 rounded" style={{ background: 'rgba(245,158,11,0.1)' }}>
                  <strong className="small text-warning">Stage/Status Fields:</strong>
                  <ul className="small mb-0">
                    <li>Workflow Status</li>
                    <li>Last Updated Date</li>
                    <li>Rejection Date (if filtered)</li>
                    <li>Interview dates (any "Date First Interviewed:" columns)</li>
                  </ul>
                </div>
              </div>
            </div>
          </li>
          <li className="mb-2">
            Click <strong>Search</strong>, then <strong>Export &gt; Excel</strong>
          </li>
          <li>
            Drop the exported file into ProdDash
          </li>
        </ol>
      </div>

      <h6 className="mb-3">iCIMS Column Mapping</h6>
      <p className="small text-muted">
        ProdDash automatically recognizes these iCIMS column names:
      </p>
      <div className="table-responsive">
        <table className="table table-dark table-sm">
          <thead>
            <tr>
              <th>iCIMS Column</th>
              <th>Maps To</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Job: System ID, Job: Requisition ID</td><td><code>req_id</code></td><td></td></tr>
            <tr><td>Job: Job Title and Job Code</td><td><code>req_title</code></td><td></td></tr>
            <tr><td>Job: Date Opened, Posted Date</td><td><code>opened_at</code></td><td></td></tr>
            <tr><td>Job: Status</td><td><code>status</code></td><td>"Open", "Closed", etc.</td></tr>
            <tr><td>Recruiter Full Name, Primary Recruiter</td><td><code>recruiter_id</code></td><td></td></tr>
            <tr><td>Hiring Manager Full Name</td><td><code>hiring_manager_id</code></td><td></td></tr>
            <tr><td>Person: System ID</td><td><code>candidate_id</code></td><td></td></tr>
            <tr><td>Submittal Date, Application Date</td><td><code>applied_at</code></td><td></td></tr>
            <tr><td>Workflow Status, Current Status</td><td><code>current_stage</code></td><td></td></tr>
            <tr><td>Last Updated Date, Status Date</td><td><code>current_stage_entered_at</code></td><td></td></tr>
            <tr><td>Source</td><td><code>source</code></td><td></td></tr>
            <tr><td>Hire/Rehire Date</td><td><code>hired_at</code></td><td></td></tr>
            <tr><td>Date First Interviewed: Offer Letter</td><td><code>offer_extended_at</code></td><td></td></tr>
          </tbody>
        </table>
      </div>

      <div className="alert alert-warning mt-4">
        <strong>Common iCIMS Issues:</strong>
        <ul className="mb-0 small">
          <li>If "Job: System ID" shows as blank, try "Job: Requisition ID" instead</li>
          <li>Stage columns like "Currently in Standard Stage X" are boolean - we detect which one is TRUE</li>
          <li>Date formats vary - we handle MM/DD/YYYY, YYYY-MM-DD, and ISO formats</li>
        </ul>
      </div>
    </div>
  );
}

function GreenhouseTab() {
  return (
    <div>
      <h5 className="mb-4">Exporting from Greenhouse</h5>

      <div className="glass-panel p-4 mb-4">
        <h6>Recommended: Custom Report</h6>
        <ol className="mb-0">
          <li className="mb-2">Go to <strong>Reports &gt; Build Your Own</strong></li>
          <li className="mb-2">Select <strong>Applications</strong> as your data source</li>
          <li className="mb-2">Add columns:
            <div className="row mt-2 g-2">
              <div className="col-md-6">
                <ul className="small">
                  <li>Job ID, Job Name</li>
                  <li>Job Opening Date, Job Status</li>
                  <li>Recruiter, Hiring Manager</li>
                  <li>Department, Office</li>
                </ul>
              </div>
              <div className="col-md-6">
                <ul className="small">
                  <li>Candidate ID, Candidate Name</li>
                  <li>Application Date, Current Stage</li>
                  <li>Source, Sourcer</li>
                  <li>Offer Date, Start Date, Rejection Date</li>
                </ul>
              </div>
            </div>
          </li>
          <li className="mb-2">Export as CSV or Excel</li>
        </ol>
      </div>

      <h6 className="mb-3">Greenhouse Column Mapping</h6>
      <div className="table-responsive">
        <table className="table table-dark table-sm">
          <thead>
            <tr><th>Greenhouse Column</th><th>Maps To</th></tr>
          </thead>
          <tbody>
            <tr><td>Job ID, Requisition ID</td><td><code>req_id</code></td></tr>
            <tr><td>Job Name, Job Title</td><td><code>req_title</code></td></tr>
            <tr><td>Opening Date, Job Created</td><td><code>opened_at</code></td></tr>
            <tr><td>Closed Date, Date Closed</td><td><code>closed_at</code></td></tr>
            <tr><td>Recruiter</td><td><code>recruiter_id</code></td></tr>
            <tr><td>Hiring Manager, Hiring Lead</td><td><code>hiring_manager_id</code></td></tr>
            <tr><td>Candidate ID, Application ID</td><td><code>candidate_id</code></td></tr>
            <tr><td>Applied On, Application Date</td><td><code>applied_at</code></td></tr>
            <tr><td>Current Stage, Stage</td><td><code>current_stage</code></td></tr>
            <tr><td>Source, Source Name</td><td><code>source</code></td></tr>
            <tr><td>Start Date</td><td><code>hired_at</code></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LeverTab() {
  return (
    <div>
      <h5 className="mb-4">Exporting from Lever</h5>

      <div className="glass-panel p-4 mb-4">
        <h6>Recommended: Data Export</h6>
        <ol className="mb-0">
          <li className="mb-2">Go to <strong>Settings &gt; Data Export</strong> or use Lever's API</li>
          <li className="mb-2">Export <strong>Opportunities</strong> (this includes candidates + postings)</li>
          <li className="mb-2">Include fields:
            <ul className="small">
              <li>Opportunity ID, Posting ID</li>
              <li>Posting Title, Posting State</li>
              <li>Candidate Name, Stage, Origin (source)</li>
              <li>Created At, Stage Changed At</li>
              <li>Owner (recruiter), Hiring Manager</li>
              <li>Archived Reason (for rejections)</li>
            </ul>
          </li>
        </ol>
      </div>

      <h6 className="mb-3">Lever Column Mapping</h6>
      <div className="table-responsive">
        <table className="table table-dark table-sm">
          <thead>
            <tr><th>Lever Column</th><th>Maps To</th></tr>
          </thead>
          <tbody>
            <tr><td>Posting ID, Requisition ID</td><td><code>req_id</code></td></tr>
            <tr><td>Posting Title</td><td><code>req_title</code></td></tr>
            <tr><td>Posting Created At</td><td><code>opened_at</code></td></tr>
            <tr><td>Posting State</td><td><code>status</code></td></tr>
            <tr><td>Owner</td><td><code>recruiter_id</code></td></tr>
            <tr><td>Hiring Manager</td><td><code>hiring_manager_id</code></td></tr>
            <tr><td>Opportunity ID, Candidate ID</td><td><code>candidate_id</code></td></tr>
            <tr><td>Created At (opportunity)</td><td><code>applied_at</code></td></tr>
            <tr><td>Stage</td><td><code>current_stage</code></td></tr>
            <tr><td>Stage Changed At</td><td><code>current_stage_entered_at</code></td></tr>
            <tr><td>Origin, Source</td><td><code>source</code></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GenericTab() {
  return (
    <div>
      <h5 className="mb-4">Any ATS / Custom Export</h5>

      <p className="text-muted mb-4">
        ProdDash works with any ATS that can export to CSV or Excel. Here's how to prepare your data.
      </p>

      <div className="glass-panel p-4 mb-4">
        <h6>Option 1: Single Combined File (Recommended)</h6>
        <p className="small text-muted">
          One row per candidate-job combination. Include job info repeated for each candidate.
        </p>
        <div className="table-responsive">
          <table className="table table-dark table-sm">
            <thead>
              <tr>
                <th>Column Name</th>
                <th>Example Value</th>
                <th>Required?</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>job_id, req_id, requisition_id</td><td>REQ-2024-001</td><td className="text-danger">Yes</td></tr>
              <tr><td>job_title, title</td><td>Senior Engineer</td><td>Recommended</td></tr>
              <tr><td>open_date, opened_at, created_date</td><td>2024-01-15</td><td className="text-danger">Yes</td></tr>
              <tr><td>status, job_status</td><td>Open</td><td>Recommended</td></tr>
              <tr><td>close_date, closed_at, filled_date</td><td>2024-03-01</td><td>For TTF</td></tr>
              <tr><td>recruiter, recruiter_name</td><td>Jane Smith</td><td>Recommended</td></tr>
              <tr><td>hiring_manager, hm</td><td>Bob Johnson</td><td>For HM metrics</td></tr>
              <tr><td>candidate_id, person_id, applicant_id</td><td>CAND-12345</td><td className="text-danger">Yes</td></tr>
              <tr><td>candidate_name, name</td><td>Alice Williams</td><td>Optional</td></tr>
              <tr><td>applied_at, application_date</td><td>2024-01-20</td><td>Recommended</td></tr>
              <tr><td>current_stage, stage, status</td><td>Onsite Interview</td><td>Recommended</td></tr>
              <tr><td>stage_date, stage_entered_at</td><td>2024-02-10</td><td>For velocity</td></tr>
              <tr><td>source</td><td>LinkedIn, Referral</td><td>For source analysis</td></tr>
              <tr><td>hired_at, hire_date, start_date</td><td>2024-03-15</td><td>For TTF/offers</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-panel p-4 mb-4">
        <h6>Option 2: Separate Files</h6>
        <p className="small text-muted">
          If your ATS exports jobs and candidates separately, that works too.
          Just make sure the Job ID matches between files.
        </p>
        <div className="row g-3">
          <div className="col-md-6">
            <div className="p-3 rounded" style={{ background: 'rgba(16,185,129,0.1)' }}>
              <strong>jobs.csv / requisitions.csv</strong>
              <ul className="small mb-0 mt-2">
                <li>job_id (unique identifier)</li>
                <li>title, open_date, status</li>
                <li>recruiter, hiring_manager</li>
                <li>close_date, department</li>
              </ul>
            </div>
          </div>
          <div className="col-md-6">
            <div className="p-3 rounded" style={{ background: 'rgba(59,130,246,0.1)' }}>
              <strong>candidates.csv / applications.csv</strong>
              <ul className="small mb-0 mt-2">
                <li>candidate_id, job_id (must match!)</li>
                <li>name, applied_at, current_stage</li>
                <li>source, hired_at</li>
                <li>stage_entered_at</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="alert alert-info">
        <strong>Date Formats We Support:</strong>
        <ul className="small mb-0">
          <li>ISO: 2024-01-15 or 2024-01-15T10:30:00Z</li>
          <li>US: 01/15/2024 or 1/15/2024</li>
          <li>With time: 2024-01-15 10:30:00</li>
        </ul>
      </div>

      <div className="alert alert-warning">
        <strong>Common Issues:</strong>
        <ul className="small mb-0">
          <li><strong>IDs don't match</strong> - Make sure job_id in candidates file exactly matches job_id in jobs file</li>
          <li><strong>Missing dates</strong> - open_date is critical for time-based filtering</li>
          <li><strong>Status values</strong> - Use "Open", "Closed", "On Hold", or "Canceled"</li>
        </ul>
      </div>
    </div>
  );
}

export default ImportGuide;
