// PII Warning Modal Component
// Displays when PII is detected during import, offering anonymization options

import React from 'react';
import { ShieldAlert, X, AlertTriangle, ShieldCheck, User, Mail, Phone, MapPin, FileText } from 'lucide-react';
import { PIIDetectionResult, PIIField } from '../../services/piiService';

interface PIIWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  detectionResult: PIIDetectionResult;
  onAnonymize: () => void;
  onImportAsIs: () => void;
  isProcessing?: boolean;
}

const PII_TYPE_ICONS: Record<string, React.ReactNode> = {
  name: <User className="w-4 h-4" />,
  email: <Mail className="w-4 h-4" />,
  phone: <Phone className="w-4 h-4" />,
  address: <MapPin className="w-4 h-4" />,
  ssn: <ShieldAlert className="w-4 h-4" />,
  other: <FileText className="w-4 h-4" />
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
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 flex items-center justify-center z-50 p-4"
        tabIndex={-1}
        role="dialog"
      >
        <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
          <div className="glass-panel rounded-xl border border-bad/30">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-border">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-bad/20 text-bad">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div>
                    <h5 className="text-lg font-semibold text-foreground">
                      Sensitive Data Detected
                    </h5>
                    <p className="text-sm text-muted-foreground">
                      {candidateCount.toLocaleString()} candidates contain personally identifiable information
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  onClick={onClose}
                  disabled={isProcessing}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-4 space-y-4">
              {/* Warning Message */}
              <div className="p-3 rounded-lg bg-bad/10 border border-bad/20">
                <p className="text-sm text-bad flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    Your import contains candidate PII including names and contact information.
                    Consider anonymizing this data to protect candidate privacy while maintaining
                    full dashboard functionality.
                  </span>
                </p>
              </div>

              {/* Detected Fields */}
              <div>
                <h6 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
                <div>
                  <h6 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Sample Data (Masked)
                  </h6>
                  <div className="glass-panel rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Type</th>
                          <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Field</th>
                          <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Sample Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {sampleData.slice(0, 5).map((sample, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-primary/20 text-primary">
                                {sample.type}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                              {sample.field}
                            </td>
                            <td className="px-4 py-3 text-foreground font-mono text-xs">
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
              <div className="p-3 rounded-lg bg-good/10 border border-good/20">
                <h6 className="mb-2 text-sm font-medium text-good flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  What Anonymization Does
                </h6>
                <ul className="space-y-1 text-sm text-muted-foreground pl-6">
                  <li>Replaces candidate names with realistic pseudonyms</li>
                  <li>Converts email addresses to anonymous placeholders</li>
                  <li>Removes phone numbers and other sensitive identifiers</li>
                  <li className="text-good">
                    <strong>Preserves:</strong> Recruiter names, HM names, req data, dates, stages, and all metrics
                  </li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 flex flex-col sm:flex-row justify-end gap-3 border-t border-border">
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium rounded-md bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors"
                onClick={onClose}
                disabled={isProcessing}
              >
                Cancel Import
              </button>
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium rounded-md bg-bad/20 hover:bg-bad/30 text-bad border border-bad/30 transition-colors inline-flex items-center justify-center gap-2"
                onClick={onImportAsIs}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <span className="w-4 h-4 border-2 border-current border-r-transparent rounded-full animate-spin" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                Import with PII
              </button>
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium rounded-md bg-good hover:bg-good/90 text-good-foreground min-w-[160px] transition-colors inline-flex items-center justify-center gap-2"
                onClick={onAnonymize}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-current border-r-transparent rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
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

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-primary/10 border border-primary/20">
      <span className="text-primary">{icon}</span>
      <span className="text-sm text-foreground">{field.description}</span>
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary text-primary-foreground">
        {field.count.toLocaleString()}
      </span>
    </div>
  );
}

export default PIIWarningModal;
