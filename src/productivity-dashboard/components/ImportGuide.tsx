// Import Guide Component - Comprehensive data requirements guide
// Shows what data enables which features

import React, { useState } from 'react';
import { Checkbox } from '../../components/ui/toggles';

interface ImportGuideProps {
  onClose: () => void;
}

type TabType = 'requirements' | 'icims' | 'greenhouse' | 'lever' | 'generic';

export function ImportGuide({ onClose }: ImportGuideProps) {
  const [activeTab, setActiveTab] = useState<TabType>('requirements');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85">
      <div className="w-full max-w-5xl mx-4 flex flex-col max-h-[90vh]">
        <div className="bg-bg-surface border border-glass-border rounded-lg shadow-glass-elevated flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-glass-border">
            <h5 className="font-semibold text-foreground">Data Import Guide</h5>
            <button type="button" className="text-muted-foreground hover:text-foreground" onClick={onClose}>&times;</button>
          </div>

          {/* Navigation Tabs */}
          <div className="border-b border-glass-border px-3">
            <div className="flex gap-1">
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'requirements' ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                onClick={() => setActiveTab('requirements')}
              >
                What Data Do I Need?
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'icims' ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                onClick={() => setActiveTab('icims')}
              >
                iCIMS
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'greenhouse' ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                onClick={() => setActiveTab('greenhouse')}
              >
                Greenhouse
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'lever' ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                onClick={() => setActiveTab('lever')}
              >
                Lever
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'generic' ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                onClick={() => setActiveTab('generic')}
              >
                Other ATS
              </button>
            </div>
          </div>

          <div className="p-4 overflow-y-auto flex-1">
            {activeTab === 'requirements' && <RequirementsTab />}
            {activeTab === 'icims' && <ICIMSTab />}
            {activeTab === 'greenhouse' && <GreenhouseTab />}
            {activeTab === 'lever' && <LeverTab />}
            {activeTab === 'generic' && <GenericTab />}
          </div>

          <div className="flex justify-end gap-2 p-4 border-t border-glass-border">
            <button className="px-4 py-2 text-sm font-medium rounded-md border border-glass-border text-muted-foreground hover:text-foreground hover:bg-bg-elevated" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RequirementsTab() {
  return (
    <div>
      <h5 className="mb-4 font-semibold text-foreground">What Data Enables What Features?</h5>

      <p className="text-muted-foreground mb-4">
        PlatoVue analyzes your recruiting data to surface insights. The more complete your data,
        the more features you unlock. Here's exactly what you need for each capability.
      </p>

      {/* Critical Fields */}
      <div className="glass-panel p-4 mb-4 border-l-4 border-bad">
        <h6 className="text-bad mb-3 font-semibold">CRITICAL - Without These, Dashboard Won't Work</h6>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 rounded bg-bad/10">
            <strong className="text-foreground">Requisitions must have:</strong>
            <ul className="mb-0 text-sm mt-2 text-foreground list-disc list-inside">
              <li><code className="text-accent">req_id</code> - Unique job identifier</li>
              <li><code className="text-accent">opened_at</code> - When the job was opened (for time filtering)</li>
            </ul>
          </div>
          <div className="p-3 rounded bg-bad/10">
            <strong className="text-foreground">Candidates must have:</strong>
            <ul className="mb-0 text-sm mt-2 text-foreground list-disc list-inside">
              <li><code className="text-accent">candidate_id</code> - Unique person identifier</li>
              <li><code className="text-accent">req_id</code> - Which job they applied to</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Feature Requirements Matrix */}
      <h6 className="mb-3 font-semibold text-foreground">Feature Requirements Matrix</h6>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-glass-border bg-bg-elevated">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Dashboard Feature</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Required Fields</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Impact if Missing</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-glass-border">
              <td className="px-3 py-2"><strong className="text-foreground">Command Center KPIs</strong></td>
              <td className="px-3 py-2">
                <code className="text-accent">opened_at</code>, <code className="text-accent">status</code>, <code className="text-accent">hired_at</code>
              </td>
              <td className="px-3 py-2 text-muted-foreground">Shows "--" for metrics</td>
            </tr>
            <tr className="border-b border-glass-border">
              <td className="px-3 py-2"><strong className="text-foreground">Time-to-Fill (TTF)</strong></td>
              <td className="px-3 py-2">
                <code className="text-accent">opened_at</code>, <code className="text-accent">hired_at</code> or <code className="text-accent">closed_at</code>
              </td>
              <td className="px-3 py-2 text-muted-foreground">Cannot calculate TTF</td>
            </tr>
            <tr className="border-b border-glass-border">
              <td className="px-3 py-2"><strong className="text-foreground">Recruiter Metrics</strong></td>
              <td className="px-3 py-2">
                <code className="text-accent">recruiter_id</code> on requisitions
              </td>
              <td className="px-3 py-2 text-muted-foreground">All reqs show "Unassigned"</td>
            </tr>
            <tr className="border-b border-glass-border">
              <td className="px-3 py-2"><strong className="text-foreground">HM Latency / Friction</strong></td>
              <td className="px-3 py-2">
                <code className="text-accent">hiring_manager_id</code>, <code className="text-accent">current_stage_entered_at</code>
              </td>
              <td className="px-3 py-2 text-muted-foreground">HM tabs disabled</td>
            </tr>
            <tr className="border-b border-glass-border">
              <td className="px-3 py-2"><strong className="text-foreground">Pipeline Analysis</strong></td>
              <td className="px-3 py-2">
                <code className="text-accent">current_stage</code> on candidates
              </td>
              <td className="px-3 py-2 text-muted-foreground">No funnel or stage breakdown</td>
            </tr>
            <tr className="border-b border-glass-border">
              <td className="px-3 py-2"><strong className="text-foreground">Source Effectiveness</strong></td>
              <td className="px-3 py-2">
                <code className="text-accent">source</code> on candidates
              </td>
              <td className="px-3 py-2 text-muted-foreground">Source tab disabled</td>
            </tr>
            <tr className="border-b border-glass-border">
              <td className="px-3 py-2"><strong className="text-foreground">Offer Analytics</strong></td>
              <td className="px-3 py-2">
                <code className="text-accent">offer_extended_at</code>, <code className="text-accent">offer_accepted_at</code> or <code className="text-accent">hired_at</code>
              </td>
              <td className="px-3 py-2 text-muted-foreground">Accept rate shows "--"</td>
            </tr>
            <tr className="border-b border-glass-border">
              <td className="px-3 py-2"><strong className="text-foreground">Candidate Quality</strong></td>
              <td className="px-3 py-2">
                <code className="text-accent">disposition</code>, <code className="text-accent">current_stage</code>
              </td>
              <td className="px-3 py-2 text-muted-foreground">Quality tab limited</td>
            </tr>
            <tr className="border-b border-glass-border">
              <td className="px-3 py-2"><strong className="text-foreground">Velocity / Stage Timing</strong></td>
              <td className="px-3 py-2">
                <code className="text-accent">applied_at</code>, <code className="text-accent">current_stage_entered_at</code>, stage timestamps
              </td>
              <td className="px-3 py-2 text-muted-foreground">Velocity insights disabled</td>
            </tr>
            <tr className="border-b border-glass-border">
              <td className="px-3 py-2"><strong className="text-foreground">Risk Detection</strong></td>
              <td className="px-3 py-2">
                <code className="text-accent">current_stage_entered_at</code>, <code className="text-accent">opened_at</code>
              </td>
              <td className="px-3 py-2 text-muted-foreground">Stalled/zombie detection limited</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Ideal Export Checklist */}
      <h6 className="mt-4 mb-3 font-semibold text-foreground">Ideal Export Checklist</h6>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="glass-panel p-3">
          <h6 className="text-good font-semibold mb-2">Requisitions / Jobs</h6>
          <div className="text-sm space-y-2">
            <div className="flex items-center gap-2 text-foreground"><Checkbox checked={true} onChange={() => {}} disabled /> Job ID / Requisition ID</div>
            <div className="flex items-center gap-2 text-foreground"><Checkbox checked={true} onChange={() => {}} disabled /> Job Title</div>
            <div className="flex items-center gap-2 text-foreground"><Checkbox checked={true} onChange={() => {}} disabled /> Open Date / Created Date</div>
            <div className="flex items-center gap-2 text-foreground"><Checkbox checked={true} onChange={() => {}} disabled /> Status (Open/Closed/On Hold)</div>
            <div className="flex items-center gap-2 text-foreground"><Checkbox checked={true} onChange={() => {}} disabled /> Close Date / Filled Date</div>
            <div className="flex items-center gap-2 text-foreground"><Checkbox checked={true} onChange={() => {}} disabled /> Recruiter Name</div>
            <div className="flex items-center gap-2 text-foreground"><Checkbox checked={true} onChange={() => {}} disabled /> Hiring Manager Name</div>
            <div className="flex items-center gap-2 text-muted-foreground"><Checkbox checked={false} onChange={() => {}} disabled /> Department / Function</div>
            <div className="flex items-center gap-2 text-muted-foreground"><Checkbox checked={false} onChange={() => {}} disabled /> Level / Grade</div>
            <div className="flex items-center gap-2 text-muted-foreground"><Checkbox checked={false} onChange={() => {}} disabled /> Location</div>
          </div>
        </div>
        <div className="glass-panel p-3">
          <h6 className="text-accent font-semibold mb-2">Candidates / Applications</h6>
          <div className="text-sm space-y-2">
            <div className="flex items-center gap-2 text-foreground"><Checkbox checked={true} onChange={() => {}} disabled /> Candidate ID / Person ID</div>
            <div className="flex items-center gap-2 text-foreground"><Checkbox checked={true} onChange={() => {}} disabled /> Job ID (to link to requisition)</div>
            <div className="flex items-center gap-2 text-foreground"><Checkbox checked={true} onChange={() => {}} disabled /> Current Stage / Status</div>
            <div className="flex items-center gap-2 text-foreground"><Checkbox checked={true} onChange={() => {}} disabled /> Application Date</div>
            <div className="flex items-center gap-2 text-foreground"><Checkbox checked={true} onChange={() => {}} disabled /> Stage Entry Date (when entered current stage)</div>
            <div className="flex items-center gap-2 text-foreground"><Checkbox checked={true} onChange={() => {}} disabled /> Source (where they came from)</div>
            <div className="flex items-center gap-2 text-foreground"><Checkbox checked={true} onChange={() => {}} disabled /> Hire Date (if hired)</div>
            <div className="flex items-center gap-2 text-foreground"><Checkbox checked={true} onChange={() => {}} disabled /> Offer Date (if offered)</div>
            <div className="flex items-center gap-2 text-muted-foreground"><Checkbox checked={false} onChange={() => {}} disabled /> Candidate Name</div>
            <div className="flex items-center gap-2 text-muted-foreground"><Checkbox checked={false} onChange={() => {}} disabled /> Rejection Date / Reason</div>
          </div>
        </div>
      </div>

      <div className="p-3 rounded-lg bg-accent/10 border border-accent/30 text-foreground mt-4">
        <strong>Pro Tip:</strong> Export more columns than you think you need. PlatoVue will ignore
        columns it doesn't recognize, but having extra data means you won't need to re-export later.
      </div>
    </div>
  );
}

function ICIMSTab() {
  return (
    <div>
      <h5 className="mb-4 font-semibold text-foreground">Exporting from iCIMS</h5>

      <div className="p-3 rounded-lg bg-good/10 border border-good/30 text-foreground mb-4">
        <strong>Best Method: Recruiting Workflow Search</strong><br />
        This single export contains jobs AND candidates together - one file does it all.
      </div>

      <div className="glass-panel p-4 mb-4">
        <h6 className="font-semibold text-foreground mb-2">Step-by-Step: Recruiting Workflow Export</h6>
        <ol className="mb-0 list-decimal list-inside space-y-2 text-foreground">
          <li>
            Go to <strong>Search &gt; Recruiting Workflow Search</strong>
          </li>
          <li>
            Set your date range and any filters (e.g., specific recruiters or departments)
          </li>
          <li>
            <strong>Add these columns</strong> (use "Modify Columns"):
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
              <div className="p-2 rounded bg-good/10">
                <strong className="text-xs text-good">Job Fields:</strong>
                <ul className="text-sm mb-0 list-disc list-inside">
                  <li>Job: System ID</li>
                  <li>Job: Job Title</li>
                  <li>Job: Date Opened</li>
                  <li>Job: Status</li>
                  <li>Recruiter (Full Name)</li>
                  <li>Hiring Manager (Full Name)</li>
                  <li>Job: Department</li>
                </ul>
              </div>
              <div className="p-2 rounded bg-accent/10">
                <strong className="text-xs text-accent">Candidate Fields:</strong>
                <ul className="text-sm mb-0 list-disc list-inside">
                  <li>Person: System ID</li>
                  <li>Person: Full Name</li>
                  <li>Submittal Date</li>
                  <li>Source</li>
                  <li>Hire/Rehire Date</li>
                </ul>
              </div>
              <div className="p-2 rounded bg-warn/10">
                <strong className="text-xs text-warn">Stage/Status Fields:</strong>
                <ul className="text-sm mb-0 list-disc list-inside">
                  <li>Workflow Status</li>
                  <li>Last Updated Date</li>
                  <li>Rejection Date (if filtered)</li>
                  <li>Interview dates (any "Date First Interviewed:" columns)</li>
                </ul>
              </div>
            </div>
          </li>
          <li>
            Click <strong>Search</strong>, then <strong>Export &gt; Excel</strong>
          </li>
          <li>
            Drop the exported file into PlatoVue
          </li>
        </ol>
      </div>

      <h6 className="mb-3 font-semibold text-foreground">iCIMS Column Mapping</h6>
      <p className="text-sm text-muted-foreground mb-2">
        PlatoVue automatically recognizes these iCIMS column names:
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-glass-border bg-bg-elevated">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">iCIMS Column</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Maps To</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">Job: System ID, Job: Requisition ID</td><td className="px-3 py-2"><code className="text-accent">req_id</code></td><td className="px-3 py-2 text-muted-foreground"></td></tr>
            <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">Job: Job Title and Job Code</td><td className="px-3 py-2"><code className="text-accent">req_title</code></td><td className="px-3 py-2 text-muted-foreground"></td></tr>
            <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">Job: Date Opened, Posted Date</td><td className="px-3 py-2"><code className="text-accent">opened_at</code></td><td className="px-3 py-2 text-muted-foreground"></td></tr>
            <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">Job: Status</td><td className="px-3 py-2"><code className="text-accent">status</code></td><td className="px-3 py-2 text-muted-foreground">"Open", "Closed", etc.</td></tr>
            <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">Recruiter Full Name, Primary Recruiter</td><td className="px-3 py-2"><code className="text-accent">recruiter_id</code></td><td className="px-3 py-2 text-muted-foreground"></td></tr>
            <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">Hiring Manager Full Name</td><td className="px-3 py-2"><code className="text-accent">hiring_manager_id</code></td><td className="px-3 py-2 text-muted-foreground"></td></tr>
            <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">Person: System ID</td><td className="px-3 py-2"><code className="text-accent">candidate_id</code></td><td className="px-3 py-2 text-muted-foreground"></td></tr>
            <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">Submittal Date, Application Date</td><td className="px-3 py-2"><code className="text-accent">applied_at</code></td><td className="px-3 py-2 text-muted-foreground"></td></tr>
            <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">Workflow Status, Current Status</td><td className="px-3 py-2"><code className="text-accent">current_stage</code></td><td className="px-3 py-2 text-muted-foreground"></td></tr>
            <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">Last Updated Date, Status Date</td><td className="px-3 py-2"><code className="text-accent">current_stage_entered_at</code></td><td className="px-3 py-2 text-muted-foreground"></td></tr>
            <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">Source</td><td className="px-3 py-2"><code className="text-accent">source</code></td><td className="px-3 py-2 text-muted-foreground"></td></tr>
            <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">Hire/Rehire Date</td><td className="px-3 py-2"><code className="text-accent">hired_at</code></td><td className="px-3 py-2 text-muted-foreground"></td></tr>
            <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">Date First Interviewed: Offer Letter</td><td className="px-3 py-2"><code className="text-accent">offer_extended_at</code></td><td className="px-3 py-2 text-muted-foreground"></td></tr>
          </tbody>
        </table>
      </div>

      <div className="p-3 rounded-lg bg-warn/10 border border-warn/30 text-foreground mt-4">
        <strong>Common iCIMS Issues:</strong>
        <ul className="mb-0 text-sm list-disc list-inside mt-1">
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
      <h5 className="mb-4 font-semibold text-foreground">Exporting from Greenhouse</h5>

      <div className="glass-panel p-4 mb-4">
        <h6 className="font-semibold text-foreground mb-2">Recommended: Custom Report</h6>
        <ol className="mb-0 list-decimal list-inside space-y-2 text-foreground">
          <li>Go to <strong>Reports &gt; Build Your Own</strong></li>
          <li>Select <strong>Applications</strong> as your data source</li>
          <li>Add columns:
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
              <ul className="text-sm list-disc list-inside">
                <li>Job ID, Job Name</li>
                <li>Job Opening Date, Job Status</li>
                <li>Recruiter, Hiring Manager</li>
                <li>Department, Office</li>
              </ul>
              <ul className="text-sm list-disc list-inside">
                <li>Candidate ID, Candidate Name</li>
                <li>Application Date, Current Stage</li>
                <li>Source, Sourcer</li>
                <li>Offer Date, Start Date, Rejection Date</li>
              </ul>
            </div>
          </li>
          <li>Export as CSV or Excel</li>
        </ol>
      </div>

      <h6 className="mb-3 font-semibold text-foreground">Greenhouse Column Mapping</h6>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-glass-border bg-bg-elevated">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Greenhouse Column</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Maps To</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">Job ID, Requisition ID</td><td className="px-3 py-2"><code className="text-accent">req_id</code></td></tr>
            <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">Job Name, Job Title</td><td className="px-3 py-2"><code className="text-accent">req_title</code></td></tr>
            <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">Opening Date, Job Created</td><td className="px-3 py-2"><code className="text-accent">opened_at</code></td></tr>
            <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">Closed Date, Date Closed</td><td className="px-3 py-2"><code className="text-accent">closed_at</code></td></tr>
            <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">Recruiter</td><td className="px-3 py-2"><code className="text-accent">recruiter_id</code></td></tr>
            <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">Hiring Manager, Hiring Lead</td><td className="px-3 py-2"><code className="text-accent">hiring_manager_id</code></td></tr>
            <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">Candidate ID, Application ID</td><td className="px-3 py-2"><code className="text-accent">candidate_id</code></td></tr>
            <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">Applied On, Application Date</td><td className="px-3 py-2"><code className="text-accent">applied_at</code></td></tr>
            <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">Current Stage, Stage</td><td className="px-3 py-2"><code className="text-accent">current_stage</code></td></tr>
            <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">Source, Source Name</td><td className="px-3 py-2"><code className="text-accent">source</code></td></tr>
            <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">Start Date</td><td className="px-3 py-2"><code className="text-accent">hired_at</code></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LeverTab() {
  return (
    <div>
      <h5 className="mb-4 font-semibold text-foreground">Exporting from Lever</h5>

      <div className="glass-panel p-4 mb-4">
        <h6 className="font-semibold text-foreground mb-2">Recommended: Data Export</h6>
        <ol className="mb-0 list-decimal list-inside space-y-2 text-foreground">
          <li>Go to <strong>Settings &gt; Data Export</strong> or use Lever's API</li>
          <li>Export <strong>Opportunities</strong> (this includes candidates + postings)</li>
          <li>Include fields:
            <ul className="text-sm list-disc list-inside ml-4 mt-1">
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

      <h6 className="mb-3 font-semibold text-foreground">Lever Column Mapping</h6>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-glass-border bg-bg-elevated">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Lever Column</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Maps To</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">Posting ID, Requisition ID</td><td className="px-3 py-2"><code className="text-accent">req_id</code></td></tr>
            <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">Posting Title</td><td className="px-3 py-2"><code className="text-accent">req_title</code></td></tr>
            <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">Posting Created At</td><td className="px-3 py-2"><code className="text-accent">opened_at</code></td></tr>
            <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">Posting State</td><td className="px-3 py-2"><code className="text-accent">status</code></td></tr>
            <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">Owner</td><td className="px-3 py-2"><code className="text-accent">recruiter_id</code></td></tr>
            <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">Hiring Manager</td><td className="px-3 py-2"><code className="text-accent">hiring_manager_id</code></td></tr>
            <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">Opportunity ID, Candidate ID</td><td className="px-3 py-2"><code className="text-accent">candidate_id</code></td></tr>
            <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">Created At (opportunity)</td><td className="px-3 py-2"><code className="text-accent">applied_at</code></td></tr>
            <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">Stage</td><td className="px-3 py-2"><code className="text-accent">current_stage</code></td></tr>
            <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">Stage Changed At</td><td className="px-3 py-2"><code className="text-accent">current_stage_entered_at</code></td></tr>
            <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">Origin, Source</td><td className="px-3 py-2"><code className="text-accent">source</code></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GenericTab() {
  return (
    <div>
      <h5 className="mb-4 font-semibold text-foreground">Any ATS / Custom Export</h5>

      <p className="text-muted-foreground mb-4">
        PlatoVue works with any ATS that can export to CSV or Excel. Here's how to prepare your data.
      </p>

      <div className="glass-panel p-4 mb-4">
        <h6 className="font-semibold text-foreground mb-2">Option 1: Single Combined File (Recommended)</h6>
        <p className="text-sm text-muted-foreground mb-2">
          One row per candidate-job combination. Include job info repeated for each candidate.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-glass-border bg-bg-elevated">
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Column Name</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Example Value</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Required?</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">job_id, req_id, requisition_id</td><td className="px-3 py-2 text-muted-foreground">REQ-2024-001</td><td className="px-3 py-2 text-bad font-medium">Yes</td></tr>
              <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">job_title, title</td><td className="px-3 py-2 text-muted-foreground">Senior Engineer</td><td className="px-3 py-2 text-foreground">Recommended</td></tr>
              <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">open_date, opened_at, created_date</td><td className="px-3 py-2 text-muted-foreground">2024-01-15</td><td className="px-3 py-2 text-bad font-medium">Yes</td></tr>
              <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">status, job_status</td><td className="px-3 py-2 text-muted-foreground">Open</td><td className="px-3 py-2 text-foreground">Recommended</td></tr>
              <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">close_date, closed_at, filled_date</td><td className="px-3 py-2 text-muted-foreground">2024-03-01</td><td className="px-3 py-2 text-foreground">For TTF</td></tr>
              <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">recruiter, recruiter_name</td><td className="px-3 py-2 text-muted-foreground">Jane Smith</td><td className="px-3 py-2 text-foreground">Recommended</td></tr>
              <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">hiring_manager, hm</td><td className="px-3 py-2 text-muted-foreground">Bob Johnson</td><td className="px-3 py-2 text-foreground">For HM metrics</td></tr>
              <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">candidate_id, person_id, applicant_id</td><td className="px-3 py-2 text-muted-foreground">CAND-12345</td><td className="px-3 py-2 text-bad font-medium">Yes</td></tr>
              <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">candidate_name, name</td><td className="px-3 py-2 text-muted-foreground">Alice Williams</td><td className="px-3 py-2 text-foreground">Optional</td></tr>
              <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">applied_at, application_date</td><td className="px-3 py-2 text-muted-foreground">2024-01-20</td><td className="px-3 py-2 text-foreground">Recommended</td></tr>
              <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">current_stage, stage, status</td><td className="px-3 py-2 text-muted-foreground">Onsite Interview</td><td className="px-3 py-2 text-foreground">Recommended</td></tr>
              <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">stage_date, stage_entered_at</td><td className="px-3 py-2 text-muted-foreground">2024-02-10</td><td className="px-3 py-2 text-foreground">For velocity</td></tr>
              <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">source</td><td className="px-3 py-2 text-muted-foreground">LinkedIn, Referral</td><td className="px-3 py-2 text-foreground">For source analysis</td></tr>
              <tr className="border-b border-glass-border"><td className="px-3 py-2 text-foreground">hired_at, hire_date, start_date</td><td className="px-3 py-2 text-muted-foreground">2024-03-15</td><td className="px-3 py-2 text-foreground">For TTF/offers</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-panel p-4 mb-4">
        <h6 className="font-semibold text-foreground mb-2">Option 2: Separate Files</h6>
        <p className="text-sm text-muted-foreground mb-2">
          If your ATS exports jobs and candidates separately, that works too.
          Just make sure the Job ID matches between files.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 rounded bg-good/10">
            <strong className="text-foreground">jobs.csv / requisitions.csv</strong>
            <ul className="text-sm mb-0 mt-2 list-disc list-inside text-foreground">
              <li>job_id (unique identifier)</li>
              <li>title, open_date, status</li>
              <li>recruiter, hiring_manager</li>
              <li>close_date, department</li>
            </ul>
          </div>
          <div className="p-3 rounded bg-accent/10">
            <strong className="text-foreground">candidates.csv / applications.csv</strong>
            <ul className="text-sm mb-0 mt-2 list-disc list-inside text-foreground">
              <li>candidate_id, job_id (must match!)</li>
              <li>name, applied_at, current_stage</li>
              <li>source, hired_at</li>
              <li>stage_entered_at</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="p-3 rounded-lg bg-accent/10 border border-accent/30 text-foreground mb-4">
        <strong>Date Formats We Support:</strong>
        <ul className="text-sm mb-0 list-disc list-inside mt-1">
          <li>ISO: 2024-01-15 or 2024-01-15T10:30:00Z</li>
          <li>US: 01/15/2024 or 1/15/2024</li>
          <li>With time: 2024-01-15 10:30:00</li>
        </ul>
      </div>

      <div className="p-3 rounded-lg bg-warn/10 border border-warn/30 text-foreground">
        <strong>Common Issues:</strong>
        <ul className="text-sm mb-0 list-disc list-inside mt-1">
          <li><strong>IDs don't match</strong> - Make sure job_id in candidates file exactly matches job_id in jobs file</li>
          <li><strong>Missing dates</strong> - open_date is critical for time-based filtering</li>
          <li><strong>Status values</strong> - Use "Open", "Closed", "On Hold", or "Canceled"</li>
        </ul>
      </div>
    </div>
  );
}

export default ImportGuide;
