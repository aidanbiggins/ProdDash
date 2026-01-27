// Core entity types for the Recruiter Productivity Dashboard

// ===== ENUMS =====

export enum Function {
  Engineering = 'Engineering',
  Product = 'Product',
  Sales = 'Sales',
  GA = 'G&A',
  Marketing = 'Marketing',
  Operations = 'Operations',
  Finance = 'Finance',
  Legal = 'Legal',
  HR = 'HR',
  Other = 'Other'
}

export enum LocationType {
  Remote = 'Remote',
  Hybrid = 'Hybrid',
  Onsite = 'Onsite'
}

export enum LocationRegion {
  AMER = 'AMER',
  EMEA = 'EMEA',
  APAC = 'APAC',
  LATAM = 'LATAM'
}

export enum RequisitionStatus {
  Open = 'Open',
  Closed = 'Closed',
  OnHold = 'OnHold',
  Canceled = 'Canceled'
}

export enum HeadcountType {
  Backfill = 'Backfill',
  New = 'New',
  Intern = 'Intern',
  Contractor = 'Contractor'
}

export enum Priority {
  P0 = 'P0',
  P1 = 'P1',
  P2 = 'P2',
  P3 = 'P3'
}

export enum CandidateSource {
  Referral = 'Referral',
  Inbound = 'Inbound',
  Sourced = 'Sourced',
  Agency = 'Agency',
  Internal = 'Internal',
  Other = 'Other'
}

export enum CandidateDisposition {
  Active = 'Active',
  Rejected = 'Rejected',
  Withdrawn = 'Withdrawn',
  Hired = 'Hired'
}

export enum EventType {
  STAGE_CHANGE = 'STAGE_CHANGE',
  INTERVIEW_SCHEDULED = 'INTERVIEW_SCHEDULED',
  INTERVIEW_COMPLETED = 'INTERVIEW_COMPLETED',
  FEEDBACK_SUBMITTED = 'FEEDBACK_SUBMITTED',
  OFFER_REQUESTED = 'OFFER_REQUESTED',
  OFFER_APPROVED = 'OFFER_APPROVED',
  OFFER_EXTENDED = 'OFFER_EXTENDED',
  OFFER_ACCEPTED = 'OFFER_ACCEPTED',
  OFFER_DECLINED = 'OFFER_DECLINED',
  CANDIDATE_WITHDREW = 'CANDIDATE_WITHDREW',
  REJECTION_SENT = 'REJECTION_SENT',
  NOTE_ADDED = 'NOTE_ADDED',
  EMAIL_SENT = 'EMAIL_SENT',
  OUTREACH_SENT = 'OUTREACH_SENT',
  SCREEN_COMPLETED = 'SCREEN_COMPLETED'
}

export enum UserRole {
  Recruiter = 'Recruiter',
  HiringManager = 'HiringManager',
  Sourcer = 'Sourcer',
  TAOps = 'TAOps',
  Admin = 'Admin'
}

export enum CanonicalStage {
  LEAD = 'LEAD',
  APPLIED = 'APPLIED',
  SCREEN = 'SCREEN',
  HM_SCREEN = 'HM_SCREEN',
  ONSITE = 'ONSITE',
  FINAL = 'FINAL',
  OFFER = 'OFFER',
  HIRED = 'HIRED',
  REJECTED = 'REJECTED',
  WITHDREW = 'WITHDREW'
}

// ===== ENTITY INTERFACES =====

export interface Requisition {
  req_id: string;
  req_title: string;
  function: Function | string;
  job_family: string;
  level: string;
  location_type: LocationType;
  location_region: LocationRegion;
  location_city: string | null;
  comp_band_min: number | null;
  comp_band_max: number | null;
  opened_at: Date | null;  // STRICT: null if missing from source data
  closed_at: Date | null;
  status: RequisitionStatus;
  hiring_manager_id: string;
  recruiter_id: string;
  business_unit: string | null;
  headcount_type: HeadcountType;
  priority: Priority | null;
  candidate_slate_required: boolean;
  search_firm_used: boolean;
}

// Stage timestamps extracted from ATS data (e.g., iCIMS columns)
export interface StageTimestamps {
  screen_at?: Date;        // Recruiter/phone screen
  hm_screen_at?: Date;     // Hiring manager screen
  onsite_at?: Date;        // Onsite/panel interview
  final_at?: Date;         // Final round interview
  offer_at?: Date;         // Offer extended
  // Raw interview dates (for more granularity)
  interviews?: Array<{
    stage: CanonicalStage;
    date: Date;
    column?: string;  // Original column name for debugging
  }>;
}

export interface Candidate {
  candidate_id: string;
  name: string | null;
  req_id: string;
  source: CandidateSource | string;
  applied_at: Date | null;
  first_contacted_at: Date | null;
  current_stage: string;
  current_stage_entered_at: Date | null;  // STRICT: null if missing from source data
  disposition: CandidateDisposition;
  hired_at: Date | null;
  offer_extended_at: Date | null;
  offer_accepted_at: Date | null;
  // Real stage timestamps from ATS (optional - populated by iCIMS parser)
  stage_timestamps?: StageTimestamps;
}

export interface Event {
  event_id: string;
  candidate_id: string;
  req_id: string;
  event_type: EventType;
  from_stage: string | null;
  to_stage: string | null;
  actor_user_id: string;
  event_at: Date;
  metadata_json: string | null;
}

export interface User {
  user_id: string;
  name: string;
  role: UserRole;
  team: string | null;
  manager_user_id: string | null;
  email: string | null;
}

// ===== RAW CSV TYPES (before parsing) =====

export interface RawRequisition {
  req_id: string;
  req_title: string;
  function: string;
  job_family: string;
  level: string;
  location_type: string;
  location_region: string;
  location_city?: string;
  comp_band_min?: string;
  comp_band_max?: string;
  opened_at: string;
  closed_at?: string;
  status: string;
  hiring_manager_id: string;
  recruiter_id: string;
  business_unit?: string;
  headcount_type: string;
  priority?: string;
  candidate_slate_required?: string;
  search_firm_used?: string;
}

export interface RawCandidate {
  candidate_id: string;
  candidate_name?: string;
  req_id: string;
  source: string;
  applied_at?: string;
  first_contacted_at?: string;
  current_stage: string;
  current_stage_entered_at: string;
  disposition: string;
  hired_at?: string;
  offer_extended_at?: string;
  offer_accepted_at?: string;
}

export interface RawEvent {
  event_id: string;
  candidate_id: string;
  req_id: string;
  event_type: string;
  from_stage?: string;
  to_stage?: string;
  actor_user_id: string;
  event_at: string;
  metadata_json?: string;
}

export interface RawUser {
  user_id: string;
  name: string;
  role: string;
  team?: string;
  manager_user_id?: string;
  email?: string;
}
