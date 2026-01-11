// CSV Upload Component

import React, { useState, useCallback } from 'react';
import { generateSampleData } from '../utils/sampleDataGenerator';
import { ICIMSImportGuide } from './ICIMSImportGuide';
import { useDashboard } from '../hooks/useDashboardContext';
import { ClearDataConfirmationModal } from './common/ClearDataConfirmationModal';
import { useAuth } from '../../contexts/AuthContext';
import { OrgSwitcher, CreateOrgModal } from './OrgSwitcher';
import { createOrganization } from '../services/organizationService';

interface CSVUploadProps {
  onUpload: (
    requisitionsCsv: string,
    candidatesCsv: string,
    eventsCsv: string,
    usersCsv: string,
    isDemo?: boolean
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
  const { currentOrg, user, refreshMemberships, supabaseUser, userRole } = useAuth();
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
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);

  const handleCreateOrg = async (name: string) => {
    if (!supabaseUser?.id) throw new Error('Not authenticated');
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

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
      reader.readAsText(file);
    });
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // Relaxed validation: Only Requisitions (which can be the Universal file) is strictly required at submit time
    // Logic inside importCsvData will determine if it's a valid Universal file or missing sub-files
    if (!files.requisitions) {
      setErrors(['Please select at least a Requisitions CSV or a Universal Report CSV']);
      return;
    }

    setUploading(true);
    setErrors([]);

    try {
      const [reqCsv, candCsv, eventCsv, userCsv] = await Promise.all([
        readFileAsText(files.requisitions),
        files.candidates ? readFileAsText(files.candidates) : Promise.resolve(undefined),
        files.events ? readFileAsText(files.events) : Promise.resolve(undefined),
        files.users ? readFileAsText(files.users) : Promise.resolve(undefined)
      ]);

      // Pass undefined for missing files
      const result = await onUpload(
        reqCsv,
        candCsv || '',  // csvParser expects string, empty string handled as empty
        eventCsv || '',
        userCsv || ''
      );

      if (!result.success) {
        setErrors(result.errors);
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Unknown error during upload']);
    } finally {
      setUploading(false);
    }
  }, [files, onUpload]);

  const handleLoadDemo = useCallback(async () => {
    setUploading(true);
    setErrors([]);

    try {
      const sampleData = generateSampleData({
        reqCount: 40,
        candidatesPerReq: 12,
        recruiterCount: 6,
        hmCount: 10
      });

      const result = await onUpload(
        sampleData.requisitions,
        sampleData.candidates,
        sampleData.events,
        sampleData.users,
        true // isDemo
      );

      if (!result.success) {
        setErrors(result.errors);
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Error loading demo data']);
    } finally {
      setUploading(false);
    }
  }, [onUpload]);

  const handleClearDataConfirm = async () => {
    setIsClearing(true);
    try {
      const result = await clearPersistedData();
      if (!result.success) {
        setErrors([result.error || 'Failed to clear database']);
      } else {
        setShowClearConfirm(false);
      }
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="container py-5">
      {showGuide && <ICIMSImportGuide onClose={() => setShowGuide(false)} />}

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
                iCIMS Import Guide
              </button>
            </div>
            <div className="card-body">
              <p className="text-muted mb-4">
                Drag and drop your "Universal Application Report" (Jobs + Candidates in one file)
                <strong> OR </strong> select the individual CSV files below.
              </p>

              <form onSubmit={handleSubmit}>
                {/* Unified Drop Zone */}
                <div
                  className="border rounded p-5 text-center mb-4 bg-light"
                  style={{ borderStyle: 'dashed', borderWidth: '2px', borderColor: '#ccc' }}
                >
                  <p className="lead mb-2">Drag & Drop CSS Files Here</p>
                  <p className="small text-muted">Supports "Universal Report" or individual files</p>

                  <input
                    type="file"
                    className="form-control mt-3"
                    accept=".csv"
                    multiple
                    onChange={(e) => {
                      // Simple implementation for now - just map to standard inputs
                      const fileList = e.target.files;
                      if (!fileList) return;

                      // Identify files by name heuristic or just assign first one to requisitions if single
                      if (fileList.length === 1) {
                        setFiles(prev => ({ ...prev, requisitions: fileList[0] }));
                      } else {
                        // TODO: Smart auto-assign based on filename, for now manual is backup
                        Array.from(fileList).forEach(f => {
                          const name = f.name.toLowerCase();
                          if (name.includes('req') || name.includes('job')) setFiles(p => ({ ...p, requisitions: f }));
                          else if (name.includes('cand') || name.includes('person')) setFiles(p => ({ ...p, candidates: f }));
                          else if (name.includes('event') || name.includes('activity')) setFiles(p => ({ ...p, events: f }));
                          else if (name.includes('user')) setFiles(p => ({ ...p, users: f }));
                        });
                      }
                      setErrors([]);
                    }}
                    disabled={uploading || isLoading}
                  />
                </div>

                {/* Manual File Selection Check (Hidden mostly, but good for debug) */}
                <div className="mb-3 p-3 border rounded bg-white">
                  <h6 className="mb-3">Selected Files:</h6>
                  <div className="row g-2">
                    <div className="col-md-6">
                      <div className={`p-2 border rounded ${files.requisitions ? 'bg-success bg-opacity-10 border-success' : 'bg-light'}`}>
                        <strong>Requisitions / Universal:</strong> {files.requisitions?.name || 'Missing'}
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className={`p-2 border rounded ${files.candidates ? 'bg-success bg-opacity-10 border-success' : 'bg-light'}`}>
                        <strong>Candidates:</strong> {files.candidates?.name || 'Optional'}
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className={`p-2 border rounded ${files.events ? 'bg-success bg-opacity-10 border-success' : 'bg-light'}`}>
                        <strong>Events:</strong> {files.events?.name || 'Optional'}
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className={`p-2 border rounded ${files.users ? 'bg-success bg-opacity-10 border-success' : 'bg-light'}`}>
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
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={handleLoadDemo}
                  disabled={uploading || isLoading}
                >
                  {uploading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Loading Demo...
                    </>
                  ) : (
                    'Load Demo Data'
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-danger ms-2"
                  onClick={() => setShowClearConfirm(true)}
                  disabled={uploading || isLoading}
                >
                  Clear Database
                </button>
              </div>

              {/* Clear Data Confirmation Modal */}
              <ClearDataConfirmationModal
                isOpen={showClearConfirm}
                onCancel={() => setShowClearConfirm(false)}
                onConfirm={handleClearDataConfirm}
                isClearing={isClearing}
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
