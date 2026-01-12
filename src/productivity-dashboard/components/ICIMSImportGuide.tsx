// iCIMS Import Guide Component

import React, { useState } from 'react';

interface ICIMSImportGuideProps {
  onClose: () => void;
}

export function ICIMSImportGuide({ onClose }: ICIMSImportGuideProps) {
  const [activeSection, setActiveSection] = useState<'universal' | 'overview' | 'reqs' | 'candidates' | 'events' | 'users'>('universal');

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">iCIMS Import Guide</h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose} />
          </div>
          <div className="modal-body">
            {/* Navigation Tabs */}
            <ul className="nav nav-tabs mb-4">
              <li className="nav-item">
                <button
                  className={`nav-link ${activeSection === 'universal' ? 'active fw-bold' : ''}`}
                  onClick={() => setActiveSection('universal')}
                >
                  Universal Report (Recommended)
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link ${activeSection === 'overview' ? 'active' : ''}`}
                  onClick={() => setActiveSection('overview')}
                >
                  Legacy (Multi-File)
                </button>
              </li>
              {/* Only show sub-tabs for legacy if overview or a legacy tab is active? 
                  For simplicity, let's keep them all but maybe visually separate or just list them.
                  Actually, let's keep it simple: Universal | Overview | Reqs | ... 
              */}
              <li className="nav-item">
                <button
                  className={`nav-link ${activeSection === 'reqs' ? 'active' : ''}`}
                  onClick={() => setActiveSection('reqs')}
                >
                  Reqs (Legacy)
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link ${activeSection === 'candidates' ? 'active' : ''}`}
                  onClick={() => setActiveSection('candidates')}
                >
                  Candidates (Legacy)
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link ${activeSection === 'events' ? 'active' : ''}`}
                  onClick={() => setActiveSection('events')}
                >
                  Events (Legacy)
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link ${activeSection === 'users' ? 'active' : ''}`}
                  onClick={() => setActiveSection('users')}
                >
                  Users (Legacy)
                </button>
              </li>
            </ul>

            {/* Universal Report Section */}
            {activeSection === 'universal' && (
              <div>
                <h5>Universal Application Report (Recommended)</h5>
                <p className="text-muted">
                  The easiest way to import data. Export a single "Recruiting Workflow" search from iCIMS.
                  The system will automatically extract jobs, candidates, and users from this one file.
                </p>

                <div className="alert alert-info mb-4">
                  <strong>How iCIMS Works:</strong> In iCIMS, candidate status is determined by their
                  <strong> bin placement</strong> in the recruiting workflow. There's no separate "status" field —
                  the bin (stage) they're in IS their status.
                </div>

                <div className="card mb-4 border-success">
                  <div className="card-header bg-success text-white bg-opacity-75">
                    <strong>How to Export</strong>
                  </div>
                  <div className="card-body">
                    <ol>
                      <li>Go to <strong>Search &gt; Recruiting Workflow Search</strong> in iCIMS.</li>
                      <li>Add the following columns to your export:
                        <div className="row mt-2">
                          <div className="col-md-6">
                            <strong>Job Info:</strong>
                            <ul className="small text-muted">
                              <li>Job ID (Required)</li>
                              <li>Job Title</li>
                              <li>Job Created Date / Posted Date</li>
                              <li>Job Function / Department</li>
                              <li>Recruiter Name</li>
                              <li>Hiring Manager Name</li>
                            </ul>
                          </div>
                          <div className="col-md-6">
                            <strong>Candidate/Workflow Info:</strong>
                            <ul className="small text-muted">
                              <li>Person ID (Required)</li>
                              <li><strong>Currently in Standard Stage [X]</strong> — This is the bin/stage!</li>
                              <li>Last Updated Date in Standard Stage [X]</li>
                              <li>Application Date / Submittal Date</li>
                              <li>Source (Workflow Tab)</li>
                            </ul>
                          </div>
                        </div>
                      </li>
                      <li><strong>Click Search</strong>, then <strong>Export &gt; Excel (CSV)</strong>.</li>
                      <li>Drag and drop that single file into the upload box!</li>
                    </ol>
                  </div>
                </div>

                <div className="alert alert-warning mb-4">
                  <strong>About "Currently in Standard Stage":</strong> iCIMS shows bin placement as boolean columns
                  ("Currently in Standard Stage Hired", "Currently in Standard Stage Screen", etc.). The system will
                  detect which stage each candidate is in by checking these columns.
                </div>

                <h6>Column Mapping Reference</h6>
                <table className="table table-sm table-striped table-bordered">
                  <thead className="table-light">
                    <tr>
                      <th>Dashboard Field</th>
                      <th>iCIMS Column Names</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><code>req_id</code></td>
                      <td>Job ID, Job: System ID</td>
                      <td>Unique job identifier</td>
                    </tr>
                    <tr>
                      <td><code>candidate_id</code></td>
                      <td>Person ID, Person: System ID</td>
                      <td>Unique candidate identifier</td>
                    </tr>
                    <tr>
                      <td><code>current_stage</code></td>
                      <td>Currently in Standard Stage [X]</td>
                      <td>iCIMS uses bin placement — check which stage column is true</td>
                    </tr>
                    <tr>
                      <td><code>current_stage_entered_at</code></td>
                      <td>Last Updated Date in Standard Stage [X]</td>
                      <td>When candidate entered their current bin</td>
                    </tr>
                    <tr>
                      <td><code>recruiter_id</code></td>
                      <td>Recruiter, Primary Recruiter</td>
                      <td>Assigned recruiter name</td>
                    </tr>
                    <tr>
                      <td><code>hiring_manager_id</code></td>
                      <td>Hiring Manager, Job: Hiring Manager</td>
                      <td>Hiring manager name</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Overview Section */}
            {activeSection === 'overview' && (
              <div>
                <h5>Legacy Multi-File Import</h5>
                <p className="text-muted">
                  Use this method if you need 100% accurate event history (time-in-stage) or have a very large dataset
                  split across multiple reports.
                </p>
                <div className="alert alert-info">
                  <strong>Note:</strong> This requires exporting 4 separate files and matching IDs manually.
                </div>

                <h6 className="mt-4">Required Reports from iCIMS:</h6>
                <div className="row g-3">
                  <div className="col-md-6">
                    <div className="card h-100">
                      <div className="card-body">
                        <h6 className="card-title">1. Requisitions Export</h6>
                        <p className="card-text small">
                          Go to <strong>Reporting &gt; Job Reports</strong> and export all jobs with:
                        </p>
                        <ul className="small mb-0">
                          <li>Job ID, Title, Department</li>
                          <li>Open Date, Status</li>
                          <li>Recruiter, Hiring Manager</li>
                          <li>Location info (optional)</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="card h-100">
                      <div className="card-body">
                        <h6 className="card-title">2. Candidates Export</h6>
                        <p className="card-text small">
                          Go to <strong>Reporting &gt; Person Reports</strong> and export candidates with:
                        </p>
                        <ul className="small mb-0">
                          <li>Person ID, Job ID</li>
                          <li>Current Status/Stage</li>
                          <li>Source, Application Date</li>
                          <li>Hire Date (if applicable)</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="card h-100">
                      <div className="card-body">
                        <h6 className="card-title">3. Activity/Events Export</h6>
                        <p className="card-text small">
                          Go to <strong>Reporting &gt; Activity Reports</strong> and export:
                        </p>
                        <ul className="small mb-0">
                          <li>Activity ID, Person ID, Job ID</li>
                          <li>Activity Type, Date</li>
                          <li>Performed By (user)</li>
                          <li>Status changes (from/to)</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="card h-100">
                      <div className="card-body">
                        <h6 className="card-title">4. Users Export</h6>
                        <p className="card-text small">
                          Go to <strong>Admin &gt; Users</strong> or create a user report:
                        </p>
                        <ul className="small mb-0">
                          <li>User ID, Name</li>
                          <li>Role (Recruiter, HM, etc.)</li>
                          <li>Team/Department (optional)</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="alert alert-info mt-4">
                  <strong>Tip:</strong> If you can't get an Events/Activity export, you can still use the dashboard
                  with just Requisitions, Candidates, and Users. Some metrics like stage conversion times won't be available.
                </div>
              </div>
            )}

            {/* Requisitions Section */}
            {activeSection === 'reqs' && (
              <div>
                <h5>Requisitions CSV</h5>
                <p className="text-muted">Map your iCIMS Job export to these fields.</p>

                <table className="table table-sm table-bordered">
                  <thead className="table-light">
                    <tr>
                      <th>Our Field</th>
                      <th>iCIMS Field Names (auto-detected)</th>
                      <th>Required?</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><code>req_id</code></td>
                      <td>Job ID, Requisition ID, Position ID, iCIMS ID</td>
                      <td><span className="badge bg-danger">Required</span></td>
                      <td>Unique job identifier</td>
                    </tr>
                    <tr>
                      <td><code>opened_at</code></td>
                      <td>Open Date, Created Date, Posted Date</td>
                      <td><span className="badge bg-danger">Required</span></td>
                      <td>Date format: YYYY-MM-DD or MM/DD/YYYY</td>
                    </tr>
                    <tr>
                      <td><code>status</code></td>
                      <td>Status, Job Status, Requisition Status</td>
                      <td><span className="badge bg-danger">Required</span></td>
                      <td>Open, Closed, OnHold, Canceled</td>
                    </tr>
                    <tr>
                      <td><code>recruiter_id</code></td>
                      <td>Recruiter, Assigned Recruiter, Owner, TA Owner</td>
                      <td><span className="badge bg-danger">Required</span></td>
                      <td>Must match user_id in Users CSV</td>
                    </tr>
                    <tr>
                      <td><code>req_title</code></td>
                      <td>Job Title, Title, Position Title</td>
                      <td><span className="badge bg-secondary">Optional</span></td>
                      <td>Defaults to empty</td>
                    </tr>
                    <tr>
                      <td><code>function</code></td>
                      <td>Department, Business Function, Org</td>
                      <td><span className="badge bg-secondary">Optional</span></td>
                      <td>E.g., Engineering, Sales</td>
                    </tr>
                    <tr>
                      <td><code>job_family</code></td>
                      <td>Job Category, Category, Job Type</td>
                      <td><span className="badge bg-secondary">Optional</span></td>
                      <td>E.g., Backend, Frontend</td>
                    </tr>
                    <tr>
                      <td><code>level</code></td>
                      <td>Job Level, Grade, Band, Career Level</td>
                      <td><span className="badge bg-secondary">Optional</span></td>
                      <td>E.g., IC3, M2</td>
                    </tr>
                    <tr>
                      <td><code>hiring_manager_id</code></td>
                      <td>Hiring Manager, HM, Manager ID</td>
                      <td><span className="badge bg-secondary">Optional</span></td>
                      <td>Must match user_id in Users CSV</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Candidates Section */}
            {activeSection === 'candidates' && (
              <div>
                <h5>Candidates CSV</h5>
                <p className="text-muted">Map your iCIMS Person/Candidate export to these fields.</p>

                <table className="table table-sm table-bordered">
                  <thead className="table-light">
                    <tr>
                      <th>Our Field</th>
                      <th>iCIMS Field Names (auto-detected)</th>
                      <th>Required?</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><code>candidate_id</code></td>
                      <td>Person ID, Applicant ID, Profile ID</td>
                      <td><span className="badge bg-danger">Required</span></td>
                      <td>Unique candidate identifier</td>
                    </tr>
                    <tr>
                      <td><code>req_id</code></td>
                      <td>Job ID, Requisition ID, Position ID</td>
                      <td><span className="badge bg-danger">Required</span></td>
                      <td>Must match req_id in Requisitions CSV</td>
                    </tr>
                    <tr>
                      <td><code>current_stage</code></td>
                      <td>Stage, Status, Workflow Status, Pipeline Stage</td>
                      <td><span className="badge bg-danger">Required</span></td>
                      <td>Current pipeline stage name</td>
                    </tr>
                    <tr>
                      <td><code>source</code></td>
                      <td>Source, Candidate Source, Origin</td>
                      <td><span className="badge bg-secondary">Optional</span></td>
                      <td>Referral, Inbound, Sourced, Agency</td>
                    </tr>
                    <tr>
                      <td><code>applied_at</code></td>
                      <td>Application Date, Apply Date, Submitted Date</td>
                      <td><span className="badge bg-secondary">Optional</span></td>
                      <td>When candidate applied</td>
                    </tr>
                    <tr>
                      <td><code>disposition</code></td>
                      <td>Outcome, Result, Final Status</td>
                      <td><span className="badge bg-secondary">Optional</span></td>
                      <td>Active, Rejected, Withdrawn, Hired</td>
                    </tr>
                    <tr>
                      <td><code>hired_at</code></td>
                      <td>Hire Date, Start Date, Onboard Date</td>
                      <td><span className="badge bg-secondary">Optional</span></td>
                      <td>For hired candidates</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Events Section */}
            {activeSection === 'events' && (
              <div>
                <h5>Events CSV</h5>
                <p className="text-muted">Map your iCIMS Activity export to these fields.</p>

                <div className="alert alert-warning">
                  <strong>Note:</strong> Events data enables time-based metrics like recruiter response time and
                  HM feedback latency. If you can't export this from iCIMS, you can create a minimal file with
                  just stage changes derived from candidate history.
                </div>

                <table className="table table-sm table-bordered">
                  <thead className="table-light">
                    <tr>
                      <th>Our Field</th>
                      <th>iCIMS Field Names (auto-detected)</th>
                      <th>Required?</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><code>event_id</code></td>
                      <td>Activity ID, Action ID, ID</td>
                      <td><span className="badge bg-danger">Required</span></td>
                      <td>Unique event identifier</td>
                    </tr>
                    <tr>
                      <td><code>req_id</code></td>
                      <td>Job ID, Requisition ID</td>
                      <td><span className="badge bg-danger">Required</span></td>
                      <td>Associated job</td>
                    </tr>
                    <tr>
                      <td><code>event_type</code></td>
                      <td>Activity Type, Action Type, Type</td>
                      <td><span className="badge bg-danger">Required</span></td>
                      <td>STAGE_CHANGE, FEEDBACK_SUBMITTED, etc.</td>
                    </tr>
                    <tr>
                      <td><code>event_at</code></td>
                      <td>Activity Date, Action Date, Timestamp, Date</td>
                      <td><span className="badge bg-danger">Required</span></td>
                      <td>When the event occurred</td>
                    </tr>
                    <tr>
                      <td><code>candidate_id</code></td>
                      <td>Person ID, Applicant ID</td>
                      <td><span className="badge bg-secondary">Optional</span></td>
                      <td>Associated candidate</td>
                    </tr>
                    <tr>
                      <td><code>actor_user_id</code></td>
                      <td>Performed By, Created By, Owner</td>
                      <td><span className="badge bg-secondary">Optional</span></td>
                      <td>Who performed the action</td>
                    </tr>
                    <tr>
                      <td><code>from_stage</code></td>
                      <td>Previous Stage, Old Stage</td>
                      <td><span className="badge bg-secondary">Optional</span></td>
                      <td>For stage changes</td>
                    </tr>
                    <tr>
                      <td><code>to_stage</code></td>
                      <td>New Stage, Next Stage</td>
                      <td><span className="badge bg-secondary">Optional</span></td>
                      <td>For stage changes</td>
                    </tr>
                  </tbody>
                </table>

                <h6 className="mt-4" style={{ color: '#F8FAFC' }}>Supported Event Types:</h6>
                <div className="d-flex flex-wrap gap-2">
                  {['STAGE_CHANGE', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED', 'FEEDBACK_SUBMITTED',
                    'OFFER_EXTENDED', 'OFFER_ACCEPTED', 'OFFER_DECLINED', 'OUTREACH_SENT', 'SCREEN_COMPLETED'].map(type => (
                      <span key={type} className="badge" style={{ background: 'rgba(30, 41, 59, 0.7)', color: '#F8FAFC', border: '1px solid rgba(255,255,255,0.2)' }}>{type}</span>
                    ))}
                </div>
              </div>
            )}

            {/* Users Section */}
            {activeSection === 'users' && (
              <div>
                <h5>Users CSV</h5>
                <p className="text-muted">Export your recruiters, hiring managers, and other users.</p>

                <table className="table table-sm table-bordered">
                  <thead className="table-light">
                    <tr>
                      <th>Our Field</th>
                      <th>iCIMS Field Names (auto-detected)</th>
                      <th>Required?</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><code>user_id</code></td>
                      <td>User ID, Employee ID, Person ID, ID</td>
                      <td><span className="badge bg-danger">Required</span></td>
                      <td>Must match IDs used in other CSVs</td>
                    </tr>
                    <tr>
                      <td><code>name</code></td>
                      <td>Name, Full Name, Display Name</td>
                      <td><span className="badge bg-danger">Required</span></td>
                      <td>User's display name</td>
                    </tr>
                    <tr>
                      <td><code>role</code></td>
                      <td>Role, User Role, Type</td>
                      <td><span className="badge bg-secondary">Optional</span></td>
                      <td>Recruiter, HiringManager, Sourcer, Admin</td>
                    </tr>
                    <tr>
                      <td><code>team</code></td>
                      <td>Team, Group, Department</td>
                      <td><span className="badge bg-secondary">Optional</span></td>
                      <td>For grouping recruiters</td>
                    </tr>
                    <tr>
                      <td><code>email</code></td>
                      <td>Email, Email Address, Work Email</td>
                      <td><span className="badge bg-secondary">Optional</span></td>
                      <td>User's email</td>
                    </tr>
                  </tbody>
                </table>

                <div className="alert alert-info mt-4">
                  <strong>Tip:</strong> Make sure the user IDs in this file match exactly with the recruiter_id,
                  hiring_manager_id, and actor_user_id fields in your other CSVs. The dashboard uses these to
                  link activities to people.
                </div>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
