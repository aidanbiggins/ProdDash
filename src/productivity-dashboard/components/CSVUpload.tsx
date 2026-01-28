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
    <div className="max-w-4xl mx-auto py-8 px-4">
      {showGuide && <ImportGuide onClose={() => setShowGuide(false)} />}

      <div className="w-full">
        {/* Organization Context */}
        <div className="mb-4 flex justify-between items-center">
          <OrgSwitcher
            onCreateOrg={() => setShowCreateOrgModal(true)}
          />
        </div>

        {/* No Organization Warning */}
        {hasNoOrg && (
          <div className="p-4 rounded-lg bg-warn/10 border border-warn/30 text-foreground mb-4">
            <h5 className="font-semibold text-warn mb-2">No Organization Selected</h5>
            <p className="mb-3">You need to create or join an organization before importing data.</p>
            <button
              className="px-4 py-2 text-sm font-medium rounded-md bg-warn text-accent-foreground hover:bg-warn/90"
              onClick={() => setShowCreateOrgModal(true)}
            >
              Create Organization
            </button>
          </div>
        )}

        {/* Member-Only Warning */}
        {!hasNoOrg && isMemberOnly && (
          <div className="p-4 rounded-lg bg-accent/10 border border-accent/30 text-foreground mb-4">
            <h5 className="font-semibold text-accent mb-2">View-Only Access</h5>
            <p className="mb-0">
              You are a member of <strong>{currentOrg?.name}</strong>.
              Only organization admins can import data. Contact your admin if you need to upload data.
            </p>
          </div>
        )}

        <div className="bg-card border border-border rounded-lg shadow-lg">
          <div className="flex justify-between items-center p-4 border-b border-border">
            <h5 className="font-semibold text-foreground">Import Data {currentOrg && <span className="text-muted-foreground text-sm font-normal">to {currentOrg.name}</span>}</h5>
            <button
              className="px-3 py-1.5 text-sm font-medium rounded border border-accent text-accent hover:bg-accent hover:text-accent-foreground transition-colors"
              onClick={() => setShowGuide(true)}
            >
              Import Guide
            </button>
          </div>
          <div className="p-4">
            <p className="text-muted-foreground mb-4">
              Drag and drop your "Universal Application Report" (Jobs + Candidates in one file)
              <strong> OR </strong> select individual files below.
              <br />
              <span className="text-sm">Supports CSV, XLS, and XLSX formats.</span>
            </p>

            <form onSubmit={handleSubmit}>
              {/* Unified Drop Zone */}
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center mb-4 bg-muted/50">
                <p className="text-lg font-medium text-foreground mb-2">Drag & Drop Files Here</p>
                <p className="text-sm text-muted-foreground">Supports CSV, XLS, XLSX - "Universal Report" or individual files</p>

                <input
                  type="file"
                  className="mt-3 w-full px-3 py-2 text-sm bg-card/30 border border-border rounded-md text-foreground file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-accent file:text-accent-foreground file:font-medium"
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
              <div className="mb-3 p-3 border border-border rounded-lg bg-muted/50">
                <h6 className="mb-3 font-semibold text-foreground">Selected Files:</h6>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className={`p-2 border rounded ${files.requisitions ? 'bg-good/10 border-good' : 'bg-muted/50 border-border'}`}>
                    <strong className="text-foreground">Requisitions / Universal:</strong> <span className="text-foreground">{files.requisitions?.name || 'Missing'}</span>
                  </div>
                  <div className={`p-2 border rounded ${files.candidates ? 'bg-good/10 border-good' : 'bg-muted/50 border-border'}`}>
                    <strong className="text-foreground">Candidates:</strong> <span className="text-foreground">{files.candidates?.name || 'Optional'}</span>
                  </div>
                  <div className={`p-2 border rounded ${files.events ? 'bg-good/10 border-good' : 'bg-muted/50 border-border'}`}>
                    <strong className="text-foreground">Events:</strong> <span className="text-foreground">{files.events?.name || 'Optional'}</span>
                  </div>
                  <div className={`p-2 border rounded ${files.users ? 'bg-good/10 border-good' : 'bg-muted/50 border-border'}`}>
                    <strong className="text-foreground">Users:</strong> <span className="text-foreground">{files.users?.name || 'Optional'}</span>
                  </div>
                </div>
              </div>

              {/* Errors */}
              {errors.length > 0 && (
                <div className="p-3 rounded-lg bg-bad/10 border border-bad/30 text-foreground mb-4">
                  <strong className="text-bad">Import Errors:</strong>
                  <ul className="mb-0 mt-2 list-disc list-inside">
                    {errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                className="w-full px-4 py-2.5 text-sm font-medium rounded-md bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition-colors"
                disabled={!files.requisitions || uploading || isLoading || !canImportData || hasNoOrg}
              >
                {uploading || isLoading ? (
                  <span className="flex items-center justify-center">
                    <span className="w-4 h-4 border-2 border-current border-r-transparent rounded-full animate-spin mr-2" />
                    Processing...
                  </span>
                ) : (
                  'Import Data'
                )}
              </button>
            </form>

            {/* Demo Mode */}
            <div className="mt-4 p-4 rounded-lg bg-accent/10 border border-accent/30">
              <h6 className="font-semibold text-accent mb-2">Try Demo Mode</h6>
              <p className="text-sm text-muted-foreground mb-3">
                Want to explore the dashboard before importing your data? Load sample data
                to see all features in action.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="px-4 py-2 text-sm font-medium rounded-md bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
                  onClick={() => setShowUltimateDemoModal(true)}
                  disabled={uploading || isLoading}
                  data-testid="load-ultimate-demo-btn"
                >
                  <i className="bi bi-magic mr-2"></i>
                  Load Ultimate Demo
                </button>
                <button
                  type="button"
                  className="px-4 py-2 text-sm font-medium rounded-md border border-accent text-accent hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
                  onClick={handleLoadDemo}
                  disabled={uploading || isLoading}
                >
                  {uploading ? (
                    <span className="flex items-center">
                      <span className="w-4 h-4 border-2 border-current border-r-transparent rounded-full animate-spin mr-2" />
                      Loading...
                    </span>
                  ) : (
                    'Load Basic Demo'
                  )}
                </button>
                <button
                  type="button"
                  className="px-4 py-2 text-sm font-medium rounded-md border border-bad text-bad hover:bg-bad hover:text-white transition-colors disabled:opacity-50"
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

      {/* Create Organization Modal */}
      <CreateOrgModal
        isOpen={showCreateOrgModal}
        onClose={() => setShowCreateOrgModal(false)}
        onCreate={handleCreateOrg}
      />
    </div>
  );
}
