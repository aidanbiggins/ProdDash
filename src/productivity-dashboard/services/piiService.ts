// PII Detection and Anonymization Service
// Detects personally identifiable information in candidate data and provides anonymization

import { Candidate } from '../types/entities';

// Extended candidate type that includes candidate_name for PII detection
// (accounts for both raw parsed data and internal Candidate type)
export interface CandidateWithPII extends Omit<Candidate, 'name'> {
  candidate_name: string;
  name?: string | null;
}

// ===== PII DETECTION =====

export interface PIIDetectionResult {
  hasPII: boolean;
  candidateCount: number;
  detectedFields: PIIField[];
  sampleData: PIISample[];
}

export interface PIIField {
  field: string;
  type: 'name' | 'email' | 'phone' | 'address' | 'ssn' | 'other';
  count: number;
  description: string;
}

export interface PIISample {
  candidateId: string;
  field: string;
  value: string;
  type: string;
}

// Email pattern
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone patterns (various formats)
const PHONE_PATTERNS = [
  /^\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/,
  /^\d{10,11}$/,
  /^\(\d{3}\)\s?\d{3}-\d{4}$/,
];

// SSN pattern
const SSN_PATTERN = /^\d{3}-?\d{2}-?\d{4}$/;

/**
 * Detect PII in candidate data
 * Accepts candidates with either `candidate_name` or `name` field
 */
export function detectPII(candidates: Array<Partial<CandidateWithPII> & { candidate_id: string }>): PIIDetectionResult {
  const detectedFields: Map<string, PIIField> = new Map();
  const samples: PIISample[] = [];

  let candidatesWithPII = 0;

  for (const candidate of candidates) {
    let hasPIIInCandidate = false;

    // Check candidate name (support both candidate_name and name fields)
    const candidateName = candidate.candidate_name || candidate.name || '';
    if (candidateName && candidateName.trim()) {
      const name = candidateName.trim();
      // Names with spaces are likely real names (not IDs)
      if (name.includes(' ') || name.length > 3) {
        hasPIIInCandidate = true;
        updateFieldCount(detectedFields, 'candidate_name', 'name', 'Candidate names');
        if (samples.length < 5) {
          samples.push({
            candidateId: candidate.candidate_id,
            field: 'candidate_name',
            value: name,
            type: 'name'
          });
        }
      }
    }

    // Check for email in any string field
    const candidateAny = candidate as Record<string, unknown>;
    for (const [key, value] of Object.entries(candidateAny)) {
      if (typeof value === 'string') {
        // Email check
        if (EMAIL_PATTERN.test(value)) {
          hasPIIInCandidate = true;
          updateFieldCount(detectedFields, key, 'email', `Email addresses in ${key}`);
          if (samples.length < 10 && !samples.find(s => s.type === 'email')) {
            samples.push({
              candidateId: candidate.candidate_id,
              field: key,
              value: maskEmail(value),
              type: 'email'
            });
          }
        }

        // Phone check
        if (PHONE_PATTERNS.some(p => p.test(value.replace(/\s/g, '')))) {
          hasPIIInCandidate = true;
          updateFieldCount(detectedFields, key, 'phone', `Phone numbers in ${key}`);
          if (samples.length < 10 && !samples.find(s => s.type === 'phone')) {
            samples.push({
              candidateId: candidate.candidate_id,
              field: key,
              value: maskPhone(value),
              type: 'phone'
            });
          }
        }

        // SSN check
        if (SSN_PATTERN.test(value)) {
          hasPIIInCandidate = true;
          updateFieldCount(detectedFields, key, 'ssn', `SSN in ${key}`);
          if (samples.length < 10) {
            samples.push({
              candidateId: candidate.candidate_id,
              field: key,
              value: '***-**-****',
              type: 'ssn'
            });
          }
        }
      }
    }

    if (hasPIIInCandidate) {
      candidatesWithPII++;
    }
  }

  return {
    hasPII: detectedFields.size > 0,
    candidateCount: candidatesWithPII,
    detectedFields: Array.from(detectedFields.values()),
    sampleData: samples
  };
}

function updateFieldCount(
  map: Map<string, PIIField>,
  field: string,
  type: PIIField['type'],
  description: string
) {
  const existing = map.get(field);
  if (existing) {
    existing.count++;
  } else {
    map.set(field, { field, type, count: 1, description });
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***@***.***';
  const maskedLocal = local.length > 2 ? local[0] + '***' + local[local.length - 1] : '***';
  return `${maskedLocal}@${domain}`;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 4) {
    return '***-***-' + digits.slice(-4);
  }
  return '***-***-****';
}

// ===== ANONYMIZATION =====

// First names for anonymization
const FIRST_NAMES = [
  'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Quinn', 'Avery',
  'Parker', 'Sage', 'River', 'Rowan', 'Finley', 'Hayden', 'Reese', 'Cameron',
  'Dakota', 'Skyler', 'Phoenix', 'Emery', 'Blake', 'Charlie', 'Drew', 'Jamie',
  'Kendall', 'Logan', 'Peyton', 'Sawyer', 'Sydney', 'Tatum', 'Bailey', 'Devon'
];

// Last names for anonymization
const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker'
];

// Deterministic hash for consistent anonymization
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Generate an anonymized name based on the original (deterministic)
 */
export function anonymizeName(originalName: string, candidateId: string): string {
  const hash = simpleHash(candidateId + originalName);
  const firstName = FIRST_NAMES[hash % FIRST_NAMES.length];
  const lastName = LAST_NAMES[(hash >> 8) % LAST_NAMES.length];
  return `${firstName} ${lastName}`;
}

/**
 * Generate an anonymized email based on the original (deterministic)
 */
export function anonymizeEmail(originalEmail: string, candidateId: string): string {
  const hash = simpleHash(candidateId + originalEmail);
  const name = `candidate${hash % 10000}`;
  return `${name}@example.com`;
}

/**
 * Anonymize a single candidate's PII
 * Works with both `candidate_name` and `name` fields
 */
export function anonymizeCandidate<T extends { candidate_id: string; candidate_name?: string; name?: string | null }>(candidate: T): T {
  const anonymized = { ...candidate };

  // Anonymize name (support both candidate_name and name fields)
  if (anonymized.candidate_name) {
    anonymized.candidate_name = anonymizeName(
      anonymized.candidate_name,
      candidate.candidate_id
    );
  }
  if (anonymized.name) {
    anonymized.name = anonymizeName(
      anonymized.name,
      candidate.candidate_id
    );
  }

  // Anonymize any email fields
  const candidateAny = anonymized as Record<string, unknown>;
  for (const [key, value] of Object.entries(candidateAny)) {
    if (typeof value === 'string' && EMAIL_PATTERN.test(value)) {
      candidateAny[key] = anonymizeEmail(value, candidate.candidate_id);
    }
    // Remove phone numbers
    if (typeof value === 'string' && PHONE_PATTERNS.some(p => p.test(value.replace(/\s/g, '')))) {
      candidateAny[key] = '';
    }
    // Remove SSNs
    if (typeof value === 'string' && SSN_PATTERN.test(value)) {
      candidateAny[key] = '';
    }
  }

  return anonymized;
}

/**
 * Anonymize all candidates in an array
 */
export function anonymizeCandidates<T extends { candidate_id: string; candidate_name?: string; name?: string | null }>(candidates: T[]): T[] {
  return candidates.map(c => anonymizeCandidate(c));
}

// ===== SUMMARY =====

export interface AnonymizationSummary {
  totalCandidates: number;
  namesAnonymized: number;
  emailsAnonymized: number;
  phonesRemoved: number;
  otherFieldsCleaned: number;
}

/**
 * Anonymize candidates and return summary
 * Works with both `candidate_name` and `name` fields
 */
export function anonymizeCandidatesWithSummary<T extends { candidate_id: string; candidate_name?: string; name?: string | null }>(
  candidates: T[]
): { candidates: T[]; summary: AnonymizationSummary } {
  let namesAnonymized = 0;
  let emailsAnonymized = 0;
  let phonesRemoved = 0;
  let otherFieldsCleaned = 0;

  const anonymized = candidates.map(candidate => {
    const result = { ...candidate } as T;
    const candidateAny = result as Record<string, unknown>;

    // Anonymize name (support both candidate_name and name fields)
    if (result.candidate_name && result.candidate_name.trim()) {
      result.candidate_name = anonymizeName(result.candidate_name, candidate.candidate_id);
      namesAnonymized++;
    }
    if (result.name && result.name.trim()) {
      result.name = anonymizeName(result.name, candidate.candidate_id);
      if (!result.candidate_name) namesAnonymized++; // Only count once
    }

    // Process all string fields
    for (const [key, value] of Object.entries(candidateAny)) {
      if (key === 'candidate_name' || key === 'name') continue; // Already handled

      if (typeof value === 'string') {
        if (EMAIL_PATTERN.test(value)) {
          candidateAny[key] = anonymizeEmail(value, candidate.candidate_id);
          emailsAnonymized++;
        } else if (PHONE_PATTERNS.some(p => p.test(value.replace(/\s/g, '')))) {
          candidateAny[key] = '';
          phonesRemoved++;
        } else if (SSN_PATTERN.test(value)) {
          candidateAny[key] = '';
          otherFieldsCleaned++;
        }
      }
    }

    return result;
  });

  return {
    candidates: anonymized,
    summary: {
      totalCandidates: candidates.length,
      namesAnonymized,
      emailsAnonymized,
      phonesRemoved,
      otherFieldsCleaned
    }
  };
}
