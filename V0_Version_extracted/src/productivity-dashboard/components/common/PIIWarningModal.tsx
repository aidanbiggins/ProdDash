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
        className="fixed inset-0 flex items-center justify-center"
        tabIndex={-1}
        role="dialog"
        style={{ zIndex: 1055 }}
      >
        <div className="w-full max-w-3xl mx-4">
          <div
            className="rounded-2xl"
            style={{
              background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}
          >
            {/* Header */}
            <div
              className="border-0 pb-0"
              style={{ padding: '1.5rem 1.5rem 1rem' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center"
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
                <div className="flex-1">
                  <h5 className="mb-1 text-lg" style={{ color: '#f8fafc', fontWeight: 600 }}>
                    Sensitive Data Detected
                  </h5>
                  <p className="mb-0 text-sm" style={{ color: '#94a3b8' }}>
                    {candidateCount.toLocaleString()} candidates contain personally identifiable information
                  </p>
                </div>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white"
                  onClick={onClose}
                  disabled={isProcessing}
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '1.5rem' }}>
              {/* Warning Message */}
              <div
                className="p-3 rounded-lg mb-4"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)'
                }}
              >
                <p className="mb-0" style={{ color: '#fca5a5', fontSize: '0.9rem' }}>
                  <i className="bi bi-exclamation-triangle-fill mr-2"></i>
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
                <div className="flex flex-wrap gap-2">
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
                    className="rounded-lg overflow-hidden"
                    style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <table className="w-full text-sm mb-0">
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
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                                style={{
                                  background: `${PII_TYPE_COLORS[sample.type]}20`,
                                  color: PII_TYPE_COLORS[sample.type],
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
                className="p-3 rounded-lg"
                style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)' }}
              >
                <h6 className="mb-2" style={{ color: '#86efac', fontSize: '0.85rem' }}>
                  <i className="bi bi-shield-check mr-2"></i>
                  What Anonymization Does
                </h6>
                <ul className="mb-0 pl-3" style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
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
              className="flex justify-end gap-3 border-0 pt-0"
              style={{ padding: '0 1.5rem 1.5rem' }}
            >
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium rounded-md bg-white/10 hover:bg-white/20 text-white"
                onClick={onClose}
                disabled={isProcessing}
              >
                Cancel Import
              </button>
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium rounded-md"
                onClick={onImportAsIs}
                disabled={isProcessing}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#fca5a5',
                  border: '1px solid rgba(239, 68, 68, 0.3)'
                }}
              >
                {isProcessing ? (
                  <span className="w-4 h-4 border-2 border-current border-r-transparent rounded-full animate-spin inline-block mr-2" />
                ) : (
                  <i className="bi bi-exclamation-triangle mr-2"></i>
                )}
                Import with PII
              </button>
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium rounded-md bg-green-600 hover:bg-green-700 text-white"
                onClick={onAnonymize}
                disabled={isProcessing}
                style={{ minWidth: '160px' }}
              >
                {isProcessing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-current border-r-transparent rounded-full animate-spin inline-block mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <i className="bi bi-shield-check mr-2"></i>
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
      className="flex items-center gap-2 px-3 py-2 rounded-full"
      style={{
        background: `${color}15`,
        border: `1px solid ${color}30`
      }}
    >
      <i className={icon} style={{ color, fontSize: '0.9rem' }}></i>
      <span style={{ color: '#e2e8f0', fontSize: '0.85rem' }}>{field.description}</span>
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
        style={{ background: color, color: 'white' }}
      >
        {field.count.toLocaleString()}
      </span>
    </div>
  );
}

export default PIIWarningModal;
