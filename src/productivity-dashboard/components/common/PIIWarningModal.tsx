// PII Warning Modal Component
// Displays when PII is detected during import, offering anonymization options

import React from 'react';
import { PIIDetectionResult, PIIField } from '../../services/piiService';

interface PIIWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  detectionResult: PIIDetectionResult;
  onAnonymize: () => void;
  onImportAsIs: () => void;
  isProcessing?: boolean;
}

const PII_TYPE_ICONS: Record<string, string> = {
  name: 'bi-person-fill',
  email: 'bi-envelope-fill',
  phone: 'bi-telephone-fill',
  address: 'bi-geo-alt-fill',
  ssn: 'bi-shield-exclamation',
  other: 'bi-file-text-fill'
};

const PII_TYPE_COLORS: Record<string, string> = {
  name: '#3b82f6',
  email: '#8b5cf6',
  phone: '#06b6d4',
  address: '#f59e0b',
  ssn: '#ef4444',
  other: '#64748b'
};

export function PIIWarningModal({
  isOpen,
  onClose,
  detectionResult,
  onAnonymize,
  onImportAsIs,
  isProcessing = false
}: PIIWarningModalProps) {
  if (!isOpen) return null;

  const { candidateCount, detectedFields, sampleData } = detectionResult;

  return (
    <>
      {/* Backdrop */}
      <div
        className="modal-backdrop fade show"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="modal fade show d-block"
        tabIndex={-1}
        role="dialog"
        style={{ zIndex: 1055 }}
      >
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div
            className="modal-content"
            style={{
              background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}
          >
            {/* Header */}
            <div
              className="modal-header border-0 pb-0"
              style={{ padding: '1.5rem 1.5rem 1rem' }}
            >
              <div className="d-flex align-items-center gap-3">
                <div
                  className="d-flex align-items-center justify-content-center"
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#ef4444'
                  }}
                >
                  <i className="bi bi-shield-exclamation" style={{ fontSize: '1.5rem' }}></i>
                </div>
                <div>
                  <h5 className="modal-title mb-1" style={{ color: '#f8fafc', fontWeight: 600 }}>
                    Sensitive Data Detected
                  </h5>
                  <p className="mb-0 small" style={{ color: '#94a3b8' }}>
                    {candidateCount.toLocaleString()} candidates contain personally identifiable information
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={onClose}
                disabled={isProcessing}
              />
            </div>

            {/* Body */}
            <div className="modal-body" style={{ padding: '1.5rem' }}>
              {/* Warning Message */}
              <div
                className="p-3 rounded-3 mb-4"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)'
                }}
              >
                <p className="mb-0" style={{ color: '#fca5a5', fontSize: '0.9rem' }}>
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  Your import contains candidate PII including names and contact information.
                  Consider anonymizing this data to protect candidate privacy while maintaining
                  full dashboard functionality.
                </p>
              </div>

              {/* Detected Fields */}
              <div className="mb-4">
                <h6 className="mb-3" style={{ color: '#e2e8f0', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Detected PII Types
                </h6>
                <div className="d-flex flex-wrap gap-2">
                  {detectedFields.map((field, idx) => (
                    <FieldBadge key={idx} field={field} />
                  ))}
                </div>
              </div>

              {/* Sample Data Preview */}
              {sampleData.length > 0 && (
                <div className="mb-4">
                  <h6 className="mb-3" style={{ color: '#e2e8f0', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Sample Data (Masked)
                  </h6>
                  <div
                    className="rounded-3 overflow-hidden"
                    style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <table className="table table-sm mb-0" style={{ fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ background: 'rgba(15, 23, 42, 0.8)' }}>
                          <th style={{ color: '#94a3b8', fontWeight: 500, padding: '0.75rem', border: 'none' }}>Type</th>
                          <th style={{ color: '#94a3b8', fontWeight: 500, padding: '0.75rem', border: 'none' }}>Field</th>
                          <th style={{ color: '#94a3b8', fontWeight: 500, padding: '0.75rem', border: 'none' }}>Sample Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sampleData.slice(0, 5).map((sample, idx) => (
                          <tr key={idx} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ color: '#e2e8f0', padding: '0.75rem', border: 'none' }}>
                              <span
                                className="badge"
                                style={{
                                  background: `${PII_TYPE_COLORS[sample.type]}20`,
                                  color: PII_TYPE_COLORS[sample.type],
                                  fontSize: '0.75rem'
                                }}
                              >
                                {sample.type}
                              </span>
                            </td>
                            <td style={{ color: '#94a3b8', padding: '0.75rem', border: 'none', fontFamily: 'monospace' }}>
                              {sample.field}
                            </td>
                            <td style={{ color: '#e2e8f0', padding: '0.75rem', border: 'none', fontFamily: 'monospace' }}>
                              {sample.value}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* What Anonymization Does */}
              <div
                className="p-3 rounded-3"
                style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)' }}
              >
                <h6 className="mb-2" style={{ color: '#86efac', fontSize: '0.85rem' }}>
                  <i className="bi bi-shield-check me-2"></i>
                  What Anonymization Does
                </h6>
                <ul className="mb-0 ps-3" style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                  <li>Replaces candidate names with realistic pseudonyms</li>
                  <li>Converts email addresses to anonymous placeholders</li>
                  <li>Removes phone numbers and other sensitive identifiers</li>
                  <li className="mt-1" style={{ color: '#86efac' }}>
                    <strong>Preserves:</strong> Recruiter names, HM names, req data, dates, stages, and all metrics
                  </li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div
              className="modal-footer border-0 pt-0"
              style={{ padding: '0 1.5rem 1.5rem', gap: '0.75rem' }}
            >
              <button
                type="button"
                className="btn btn-bespoke-secondary"
                onClick={onClose}
                disabled={isProcessing}
              >
                Cancel Import
              </button>
              <button
                type="button"
                className="btn"
                onClick={onImportAsIs}
                disabled={isProcessing}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#fca5a5',
                  border: '1px solid rgba(239, 68, 68, 0.3)'
                }}
              >
                {isProcessing ? (
                  <span className="spinner-border spinner-border-sm me-2" />
                ) : (
                  <i className="bi bi-exclamation-triangle me-2"></i>
                )}
                Import with PII
              </button>
              <button
                type="button"
                className="btn btn-success"
                onClick={onAnonymize}
                disabled={isProcessing}
                style={{ minWidth: '160px' }}
              >
                {isProcessing ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <i className="bi bi-shield-check me-2"></i>
                    Anonymize & Import
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Field badge component
function FieldBadge({ field }: { field: PIIField }) {
  const icon = PII_TYPE_ICONS[field.type] || PII_TYPE_ICONS.other;
  const color = PII_TYPE_COLORS[field.type] || PII_TYPE_COLORS.other;

  return (
    <div
      className="d-flex align-items-center gap-2 px-3 py-2 rounded-pill"
      style={{
        background: `${color}15`,
        border: `1px solid ${color}30`
      }}
    >
      <i className={icon} style={{ color, fontSize: '0.9rem' }}></i>
      <span style={{ color: '#e2e8f0', fontSize: '0.85rem' }}>{field.description}</span>
      <span
        className="badge rounded-pill"
        style={{ background: color, color: 'white', fontSize: '0.7rem' }}
      >
        {field.count.toLocaleString()}
      </span>
    </div>
  );
}

export default PIIWarningModal;
