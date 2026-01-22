// CSV/Excel Upload Component

import React, { useState, useCallback } from 'react';
import { generateSampleData } from '../utils/sampleDataGenerator';
import { readFileAsTextOrExcel, FILE_ACCEPT, isExcelFile, extractAllSheets, MultiSheetResult } from '../utils/excelParser';
import { ImportGuide } from './ImportGuide';
import { useDashboard } from '../hooks/useDashboardContext';
import { ClearDataConfirmationModal } from './common/ClearDataConfirmationModal';
import { ImportProgressModal } from './common/ImportProgressModal';
import { PIIWarningModal } from './common/PIIWarningModal';
import { UltimateDemoModal } from './common/UltimateDemoModal';
import { ImportProgress, ClearProgress } from '../services/dbService';
import { importCsvData } from '../services/csvParser';
import { detectPII, PIIDetectionResult } from '../services/piiService';
import { useAuth } from '../../contexts/AuthContext';
import { OrgSwitcher, CreateOrgModal } from './OrgSwitcher';
import { createOrganization } from '../services/organizationService';
import { generateUltimateDemo } from '../services/ultimateDemoGenerator';
import { UltimateDemoBundle, DemoCandidate } from '../types/demoTypes';
import { Requisition, Event, User } from '../types/entities';
import { format } from 'date-fns';

// CSV conversion helpers for Ultimate Demo bundle
function formatDateForCSV(date: Date | null | undefined): string {
  if (!date) return '';
  return format(date, "yyyy-MM-dd'T'HH:mm:ss'Z'");
}

function escapeCSV(value: string | null | undefined): string {
  if (value == null) return '';
  const str = String(value);
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function convertRequisitionsToCSV(requisitions: Requisition[]): string {
  const headers = [
    'req_id', 'req_title', 'function', 'job_family', 'level', 'location_type',
    'location_region', 'location_city', 'comp_band_min', 'comp_band_max',
    'opened_at', 'closed_at', 'status', 'hiring_manager_id', 'recruiter_id',
    'business_unit', 'headcount_type', 'priority', 'candidate_slate_required', 'search_firm_used'
  ];

  const rows = requisitions.map(r => [
    escapeCSV(r.req_id),
    escapeCSV(r.req_title),
    escapeCSV(r.function),
    escapeCSV(r.job_family),
    escapeCSV(r.level),
    escapeCSV(r.location_type),
    escapeCSV(r.location_region),
    escapeCSV(r.location_city),
    r.comp_band_min?.toString() || '',
    r.comp_band_max?.toString() || '',
    formatDateForCSV(r.opened_at),
    formatDateForCSV(r.closed_at),
    escapeCSV(r.status),
    escapeCSV(r.hiring_manager_id),
    escapeCSV(r.recruiter_id),
    escapeCSV(r.business_unit),
    escapeCSV(r.headcount_type),
    escapeCSV(r.priority),
    r.candidate_slate_required ? 'true' : 'false',
    r.search_firm_used ? 'true' : 'false'
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
}

function convertCandidatesToCSV(candidates: DemoCandidate[]): string {
  const headers = [
    'candidate_id', 'candidate_name', 'candidate_email', 'candidate_phone',
    'req_id', 'source', 'applied_at', 'first_contacted_at', 'current_stage',
    'current_stage_entered_at', 'disposition', 'hired_at', 'offer_extended_at', 'offer_accepted_at'
  ];

  const rows = candidates.map(c => [
    escapeCSV(c.candidate_id),
    escapeCSV(c.name),
    escapeCSV(c.email),
    escapeCSV(c.phone),
    escapeCSV(c.req_id),
    escapeCSV(c.source),
    formatDateForCSV(c.applied_at),
    formatDateForCSV(c.first_contacted_at),
    escapeCSV(c.current_stage),
    formatDateForCSV(c.current_stage_entered_at),
    escapeCSV(c.disposition),
    formatDateForCSV(c.hired_at),
    formatDateForCSV(c.offer_extended_at),
    formatDateForCSV(c.offer_accepted_at)
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
}

function convertEventsToCSV(events: Event[]): string {
  const headers = [
    'event_id', 'candidate_id', 'req_id', 'event_type',
    'from_stage', 'to_stage', 'actor_user_id', 'event_at', 'metadata_json'
  ];

  const rows = events.map(e => [
    escapeCSV(e.event_id),
    escapeCSV(e.candidate_id),
    escapeCSV(e.req_id),
    escapeCSV(e.event_type),
    escapeCSV(e.from_stage),
    escapeCSV(e.to_stage),
    escapeCSV(e.actor_user_id),
    formatDateForCSV(e.event_at),
    escapeCSV(e.metadata_json)
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
}

function convertUsersToCSV(users: User[]): string {
  const headers = ['user_id', 'name', 'role', 'team', 'manager_user_id', 'email'];

  const rows = users.map(u => [
    escapeCSV(u.user_id),
    escapeCSV(u.name),
    escapeCSV(u.role),
    escapeCSV(u.team),
    escapeCSV(u.manager_user_id),
    escapeCSV(u.email)
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
}

interface CSVUploadProps {
  onUpload: (
    requisitionsCsv: string,
    candidatesCsv: string,
    eventsCsv: string,
    usersCsv: string,
    isDemo?: boolean,
    onProgress?: (progress: ImportProgress) => void,
    shouldAnonymize?: boolean
  ) => Promise<{ success: boolean; errors: string[] }>;
  isLoading: boolean;
}

interface FileState {
  requisitions: File | null;
  candidates: File | null;
  events: File | null;
  users: File | null;
}

export function CSVUpload({ onUpload, isLoading }: CSVUploadProps) {
  const { clearPersistedData, canImportData } = useDashboard();
  const { currentOrg, user, refreshMemberships, supabaseUser, userRole, session } = useAuth();
  const [files, setFiles] = useState<FileState>({
    requisitions: null,
    candidates: null,
    events: null,
    users: null
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [clearProgress, setClearProgress] = useState<ClearProgress | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);

  // PII Detection state
  const [showPIIWarning, setShowPIIWarning] = useState(false);
  const [piiDetectionResult, setPiiDetectionResult] = useState<PIIDetectionResult | null>(null);
  const [pendingCsvData, setPendingCsvData] = useState<{ req: string; cand: string; event: string; user: string } | null>(null);
  const [pendingDemoData, setPendingDemoData] = useState<{ req: string; cand: string; event: string; user: string } | null>(null);
  const [isProcessingPII, setIsProcessingPII] = useState(false);

  // Ultimate Demo state
  const [showUltimateDemoModal, setShowUltimateDemoModal] = useState(false);
  const [ultimateDemoBundle, setUltimateDemoBundle] = useState<UltimateDemoBundle | null>(null);

  const handleCreateOrg = async (name: string) => {
    if (!supabaseUser?.id) throw new Error('Not authenticated');
    if (!session) throw new Error('Session expired. Please log in again.');
    await createOrganization({ name }, supabaseUser.id);
    await refreshMemberships();
  };

  // Check if user has an org and can import
  const hasNoOrg = !currentOrg;
  const isMemberOnly = userRole === 'member';

  const handleFileChange = (type: keyof FileState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFiles(prev => ({ ...prev, [type]: file }));
    setErrors([]);
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // Relaxed validation: Only Requisitions (which can be the Universal file) is strictly required at submit time
    // Logic inside importCsvData will determine if it's a valid Universal file or missing sub-files
    if (!files.requisitions) {
      setErrors(['Please select at least a Requisitions file (CSV, XLS, or XLSX) or a Universal Report']);
      return;
    }

    setUploading(true);
    setErrors([]);
    setImportProgress(null);

    try {
      let reqCsv: string = '';
      let candCsv: string | undefined;
      let eventCsv: string | undefined;
      let userCsv: string | undefined;

      // Collect all files to process
      const allFiles = [files.requisitions, files.candidates, files.events, files.users].filter(Boolean) as File[];
      const excelFiles = allFiles.filter(f => isExcelFile(f));
      const csvFiles = allFiles.filter(f => !isExcelFile(f));

      console.log(`[CSVUpload] Processing ${allFiles.length} files (${excelFiles.length} Excel, ${csvFiles.length} CSV)`);

      // Extract sheets from ALL Excel files and merge results
      const mergedSheets: { requisitions?: string; candidates?: string; events?: string; users?: string } = {};

      for (const excelFile of excelFiles) {
        console.log(`[CSVUpload] Extracting sheets from: ${excelFile.name}`);
        const multiSheet = await extractAllSheets(excelFile);

        // Merge - first one wins for each type
        if (multiSheet.requisitions && !mergedSheets.requisitions) {
          mergedSheets.requisitions = multiSheet.requisitions;
          console.log(`[CSVUpload] Using requisitions from ${excelFile.name}`);
        }
        if (multiSheet.candidates && !mergedSheets.candidates) {
          mergedSheets.candidates = multiSheet.candidates;
          console.log(`[CSVUpload] Using candidates from ${excelFile.name}`);
        }
        if (multiSheet.events && !mergedSheets.events) {
          mergedSheets.events = multiSheet.events;
          console.log(`[CSVUpload] Using events from ${excelFile.name}`);
        }
        if (multiSheet.users && !mergedSheets.users) {
          mergedSheets.users = multiSheet.users;
          console.log(`[CSVUpload] Using users from ${excelFile.name}`);
        }
      }

      // Now process explicit file assignments (these override extracted sheets)
      // Requisitions: use extracted, or read the file directly
      if (files.requisitions) {
        if (isExcelFile(files.requisitions) && mergedSheets.requisitions) {
          reqCsv = mergedSheets.requisitions;
        } else if (!isExcelFile(files.requisitions)) {
          reqCsv = await readFileAsTextOrExcel(files.requisitions);
        } else {
          reqCsv = mergedSheets.requisitions || '';
        }
      }

      // Candidates: explicit file overrides extracted
      if (files.candidates && !isExcelFile(files.candidates)) {
        candCsv = await readFileAsTextOrExcel(files.candidates);
      } else {
        candCsv = mergedSheets.candidates;
      }

      // Events: explicit file overrides extracted
      if (files.events && !isExcelFile(files.events)) {
        eventCsv = await readFileAsTextOrExcel(files.events);
      } else {
        eventCsv = mergedSheets.events;
      }

      // Users: explicit file overrides extracted
      if (files.users && !isExcelFile(files.users)) {
        userCsv = await readFileAsTextOrExcel(files.users);
      } else {
        userCsv = mergedSheets.users;
      }

      // Log final data sources
      const sources = [];
      if (reqCsv) sources.push('requisitions');
      if (candCsv) sources.push('candidates');
      if (eventCsv) sources.push('events');
      if (userCsv) sources.push('users');
      console.log(`[CSVUpload] Final data: ${sources.join(', ') || 'none'}`);

      // If no requisitions data found at all, try to use first unclassified content
      if (!reqCsv && excelFiles.length > 0) {
        console.log('[CSVUpload] No requisitions found, using first Excel file as requisitions');
        reqCsv = await readFileAsTextOrExcel(excelFiles[0]);
      }

      // Parse CSV to detect PII in candidates
      const parseResult = importCsvData(reqCsv, candCsv || '', eventCsv || '', userCsv || '');

      if (parseResult.candidates.data.length > 0) {
        const piiResult = detectPII(parseResult.candidates.data);

        if (piiResult.hasPII) {
          // Store CSV data and show PII warning modal
          setPendingCsvData({ req: reqCsv, cand: candCsv || '', event: eventCsv || '', user: userCsv || '' });
          setPiiDetectionResult(piiResult);
          setShowPIIWarning(true);
          setUploading(false);
          return; // Stop here - user must decide
        }
      }

      // No PII detected, proceed with import
      const result = await onUpload(
        reqCsv,
        candCsv || '',  // csvParser expects string, empty string handled as empty
        eventCsv || '',
        userCsv || '',
        false, // isDemo
        (progress) => setImportProgress(progress)
      );

      if (!result.success) {
        setErrors(result.errors);
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Unknown error during upload']);
    } finally {
      setUploading(false);
      setImportProgress(null);
    }
  }, [files, onUpload]);

  const handleLoadDemo = useCallback(async () => {
    setUploading(true);
    setErrors([]);
    setImportProgress(null);

    try {
      const sampleData = generateSampleData({
        reqCount: 40,
        candidatesPerReq: 12,
        recruiterCount: 6,
        hmCount: 10
      });

      // Parse candidate CSV to detect PII
      const parseResult = importCsvData(sampleData.requisitions, sampleData.candidates, sampleData.events, sampleData.users);

      if (parseResult.candidates.data.length > 0) {
        const piiResult = detectPII(parseResult.candidates.data);

        if (piiResult.hasPII) {
          // Store demo data and show PII warning modal
          setPendingDemoData({
            req: sampleData.requisitions,
            cand: sampleData.candidates,
            event: sampleData.events,
            user: sampleData.users
          });
          setPiiDetectionResult(piiResult);
          setShowPIIWarning(true);
          setUploading(false);
          return;
        }
      }

      // No PII detected, proceed with import
      const result = await onUpload(
        sampleData.requisitions,
        sampleData.candidates,
        sampleData.events,
        sampleData.users,
        true, // isDemo
        (progress) => setImportProgress(progress)
      );

      if (!result.success) {
        setErrors(result.errors);
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Error loading demo data']);
    } finally {
      setUploading(false);
      setImportProgress(null);
    }
  }, [onUpload]);

  // Ultimate Demo handler
  const handleLoadUltimateDemo = useCallback(async (bundle: UltimateDemoBundle) => {
    setShowUltimateDemoModal(false);
    setUploading(true);
    setErrors([]);
    setImportProgress(null);

    try {
      // Convert bundle to CSV format for import
      const reqCsv = convertRequisitionsToCSV(bundle.requisitions);
      const candCsv = convertCandidatesToCSV(bundle.candidates);
      const eventCsv = convertEventsToCSV(bundle.events);
      const userCsv = convertUsersToCSV(bundle.users);

      // Check for PII if synthetic_pii pack is enabled
      if (bundle.packsEnabled.synthetic_pii) {
        const candidatesForPII = bundle.candidates.map(c => ({
          candidate_id: c.candidate_id,
          candidate_name: c.name || '',
          email: c.email,
          phone: c.phone,
        }));
        const piiResult = detectPII(candidatesForPII);

        if (piiResult.hasPII) {
          // Store demo data and show PII warning modal
          setPendingDemoData({
            req: reqCsv,
            cand: candCsv,
            event: eventCsv,
            user: userCsv
          });
          setUltimateDemoBundle(bundle);
          setPiiDetectionResult(piiResult);
          setShowPIIWarning(true);
          setUploading(false);
          return;
        }
      }

      // No PII or not enabled, proceed with import
      const result = await onUpload(
        reqCsv,
        candCsv,
        eventCsv,
        userCsv,
        true, // isDemo
        (progress) => setImportProgress(progress)
      );

      if (!result.success) {
        setErrors(result.errors);
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Error loading Ultimate Demo']);
    } finally {
      setUploading(false);
      setImportProgress(null);
      setUltimateDemoBundle(null);
    }
  }, [onUpload]);

  const handleClearDataConfirm = async () => {
    setIsClearing(true);
    setClearProgress(null);
    try {
      const result = await clearPersistedData((progress) => {
        setClearProgress(progress);
      });
      if (!result.success) {
        setErrors([result.error || 'Failed to clear database']);
      } else {
        setShowClearConfirm(false);
      }
    } finally {
      setIsClearing(false);
      setClearProgress(null);
    }
  };

  // PII Modal handlers
  const handlePIIClose = () => {
    setShowPIIWarning(false);
    setPiiDetectionResult(null);
    setPendingCsvData(null);
    setPendingDemoData(null);
    setIsProcessingPII(false);
  };

  const handleAnonymize = async () => {
    const data = pendingCsvData || pendingDemoData;
    if (!data) return;

    const isDemo = !!pendingDemoData;
    setIsProcessingPII(true);
    setImportProgress(null);

    try {
      const result = await onUpload(
        data.req,
        data.cand,
        data.event,
        data.user,
        isDemo,
        (progress) => setImportProgress(progress),
        true // shouldAnonymize
      );

      if (!result.success) {
        setErrors(result.errors);
      }
      handlePIIClose();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Unknown error during anonymization']);
    } finally {
      setIsProcessingPII(false);
      setImportProgress(null);
    }
  };

  const handleImportAsIs = async () => {
    const data = pendingCsvData || pendingDemoData;
    if (!data) return;

    const isDemo = !!pendingDemoData;
    setIsProcessingPII(true);
    setImportProgress(null);

    try {
      const result = await onUpload(
        data.req,
        data.cand,
        data.event,
        data.user,
        isDemo,
        (progress) => setImportProgress(progress),
        false // shouldAnonymize
      );

      if (!result.success) {
        setErrors(result.errors);
      }
      handlePIIClose();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Unknown error during import']);
    } finally {
      setIsProcessingPII(false);
      setImportProgress(null);
    }
  };

  return (
    <div className="container py-5">
      {showGuide && <ImportGuide onClose={() => setShowGuide(false)} />}

      <div className="row justify-content-center">
        <div className="col-md-8">
          {/* Organization Context */}
          <div className="mb-4 d-flex justify-content-between align-items-center">
            <OrgSwitcher
              onCreateOrg={() => setShowCreateOrgModal(true)}
            />
          </div>

          {/* No Organization Warning */}
          {hasNoOrg && (
            <div className="alert alert-warning mb-4">
              <h5 className="alert-heading">No Organization Selected</h5>
              <p className="mb-2">You need to create or join an organization before importing data.</p>
              <button
                className="btn btn-warning"
                onClick={() => setShowCreateOrgModal(true)}
              >
                Create Organization
              </button>
            </div>
          )}

          {/* Member-Only Warning */}
          {!hasNoOrg && isMemberOnly && (
            <div className="alert alert-info mb-4">
              <h5 className="alert-heading">View-Only Access</h5>
              <p className="mb-0">
                You are a member of <strong>{currentOrg?.name}</strong>.
                Only organization admins can import data. Contact your admin if you need to upload data.
              </p>
            </div>
          )}

          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Import Data {currentOrg && <small className="text-muted">to {currentOrg.name}</small>}</h5>
              <button
                className="btn btn-sm btn-outline-info"
                onClick={() => setShowGuide(true)}
              >
                Import Guide
              </button>
            </div>
            <div className="card-body">
              <p className="text-muted mb-4">
                Drag and drop your "Universal Application Report" (Jobs + Candidates in one file)
                <strong> OR </strong> select individual files below.
                <br />
                <small>Supports CSV, XLS, and XLSX formats.</small>
              </p>

              <form onSubmit={handleSubmit}>
                {/* Unified Drop Zone */}
                <div
                  className="border rounded p-5 text-center mb-4"
                  style={{ borderStyle: 'dashed', borderWidth: '2px', borderColor: 'rgba(255,255,255,0.2)', background: 'rgba(30, 41, 59, 0.5)' }}
                >
                  <p className="lead mb-2">Drag & Drop Files Here</p>
                  <p className="small text-muted">Supports CSV, XLS, XLSX - "Universal Report" or individual files</p>

                  <input
                    type="file"
                    className="form-control mt-3"
                    accept={FILE_ACCEPT}
                    multiple
                    onChange={(e) => {
                      // Simple implementation for now - just map to standard inputs
                      const fileList = e.target.files;
                      if (!fileList) return;

                      // Identify files by name heuristic or just assign first one to requisitions if single
                      if (fileList.length === 1) {
                        setFiles(prev => ({ ...prev, requisitions: fileList[0] }));
                      } else {
                        // Smart auto-assign based on filename (works for CSV and Excel)
                        Array.from(fileList).forEach(f => {
                          const name = f.name.toLowerCase().replace(/\.(csv|xlsx?|xls)$/i, '');
                          if (name.includes('req') || name.includes('job') || name.includes('universal')) {
                            setFiles(p => ({ ...p, requisitions: f }));
                          } else if (name.includes('cand') || name.includes('person') || name.includes('applicant')) {
                            setFiles(p => ({ ...p, candidates: f }));
                          } else if (name.includes('event') || name.includes('activity') || name.includes('history')) {
                            setFiles(p => ({ ...p, events: f }));
                          } else if (name.includes('user') || name.includes('recruiter') || name.includes('team')) {
                            setFiles(p => ({ ...p, users: f }));
                          }
                        });
                      }
                      setErrors([]);
                    }}
                    disabled={uploading || isLoading}
                  />
                </div>

                {/* Manual File Selection Check (Hidden mostly, but good for debug) */}
                <div className="mb-3 p-3 border rounded" style={{ background: 'rgba(30, 41, 59, 0.6)', borderColor: 'rgba(255,255,255,0.1)' }}>
                  <h6 className="mb-3" style={{ color: '#F8FAFC' }}>Selected Files:</h6>
                  <div className="row g-2">
                    <div className="col-md-6">
                      <div className="p-2 border rounded" style={{ background: files.requisitions ? 'rgba(16, 185, 129, 0.15)' : 'rgba(30, 41, 59, 0.4)', borderColor: files.requisitions ? '#10b981' : 'rgba(255,255,255,0.1)', color: '#F8FAFC' }}>
                        <strong>Requisitions / Universal:</strong> {files.requisitions?.name || 'Missing'}
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="p-2 border rounded" style={{ background: files.candidates ? 'rgba(16, 185, 129, 0.15)' : 'rgba(30, 41, 59, 0.4)', borderColor: files.candidates ? '#10b981' : 'rgba(255,255,255,0.1)', color: '#F8FAFC' }}>
                        <strong>Candidates:</strong> {files.candidates?.name || 'Optional'}
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="p-2 border rounded" style={{ background: files.events ? 'rgba(16, 185, 129, 0.15)' : 'rgba(30, 41, 59, 0.4)', borderColor: files.events ? '#10b981' : 'rgba(255,255,255,0.1)', color: '#F8FAFC' }}>
                        <strong>Events:</strong> {files.events?.name || 'Optional'}
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="p-2 border rounded" style={{ background: files.users ? 'rgba(16, 185, 129, 0.15)' : 'rgba(30, 41, 59, 0.4)', borderColor: files.users ? '#10b981' : 'rgba(255,255,255,0.1)', color: '#F8FAFC' }}>
                        <strong>Users:</strong> {files.users?.name || 'Optional'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Errors */}
                {errors.length > 0 && (
                  <div className="alert alert-danger">
                    <strong>Import Errors:</strong>
                    <ul className="mb-0 mt-2">
                      {errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  className="btn btn-primary w-100"
                  disabled={!files.requisitions || uploading || isLoading || !canImportData || hasNoOrg}
                >
                  {uploading || isLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Processing...
                    </>
                  ) : (
                    'Import Data'
                  )}
                </button>
              </form>

              {/* Demo Mode */}
              <div className="mt-4 p-3 bg-primary bg-opacity-10 rounded border border-primary">
                <h6 className="text-primary">Try Demo Mode</h6>
                <p className="small text-muted mb-3">
                  Want to explore the dashboard before importing your data? Load sample data
                  to see all features in action.
                </p>
                <div className="d-flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setShowUltimateDemoModal(true)}
                    disabled={uploading || isLoading}
                    data-testid="load-ultimate-demo-btn"
                  >
                    <i className="bi bi-magic me-2"></i>
                    Load Ultimate Demo
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={handleLoadDemo}
                    disabled={uploading || isLoading}
                  >
                    {uploading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" />
                        Loading...
                      </>
                    ) : (
                      'Load Basic Demo'
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-danger"
                    onClick={() => setShowClearConfirm(true)}
                    disabled={uploading || isLoading}
                  >
                    Clear Database
                  </button>
                </div>
              </div>

              {/* Clear Data Confirmation Modal */}
              <ClearDataConfirmationModal
                isOpen={showClearConfirm}
                onCancel={() => setShowClearConfirm(false)}
                onConfirm={handleClearDataConfirm}
                isClearing={isClearing}
                clearProgress={clearProgress}
              />

              {/* Import Progress Modal */}
              <ImportProgressModal
                isOpen={(uploading || isProcessingPII) && importProgress !== null}
                progress={importProgress}
              />

              {/* PII Warning Modal */}
              {piiDetectionResult && (
                <PIIWarningModal
                  isOpen={showPIIWarning}
                  onClose={handlePIIClose}
                  detectionResult={piiDetectionResult}
                  onAnonymize={handleAnonymize}
                  onImportAsIs={handleImportAsIs}
                  isProcessing={isProcessingPII}
                />
              )}

              {/* Ultimate Demo Modal */}
              <UltimateDemoModal
                isOpen={showUltimateDemoModal}
                onClose={() => setShowUltimateDemoModal(false)}
                onLoadDemo={handleLoadUltimateDemo}
              />

            </div>
          </div>
        </div>
      </div>

      {/* Create Organization Modal */}
      <CreateOrgModal
        isOpen={showCreateOrgModal}
        onClose={() => setShowCreateOrgModal(false)}
        onCreate={handleCreateOrg}
      />
    </div>
  );
}
