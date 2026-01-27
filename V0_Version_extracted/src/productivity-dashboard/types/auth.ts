// Multi-Tenant Authentication Types
// Defines organization, membership, and role structures

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  created_by: string | null;
  deleted_at: string | null;
}

export interface OrganizationMembership {
  id: string;
  organization_id: string;
  organization: Organization;
  user_id: string;
  role: 'admin' | 'member';
  created_at: string;
}

export interface OrganizationInvite {
  id: string;
  organization_id: string;
  organization?: Organization;
  email: string;
  role: 'admin' | 'member';
  token: string;
  invited_by: string | null;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
}

export type UserRole = 'super_admin' | 'admin' | 'member';

export interface AuthUser {
  id: string;
  email: string;
  memberships: OrganizationMembership[];
  currentOrgId: string | null;
  isSuperAdmin: boolean;
}

// Context type for auth state
export interface OrgAuthContextType {
  // User state
  user: AuthUser | null;
  loading: boolean;

  // Current organization
  currentOrg: Organization | null;
  userRole: UserRole | null;

  // Organization management
  switchOrganization: (orgId: string) => void;
  refreshMemberships: () => Promise<void>;

  // Permissions
  canImportData: boolean;
  canManageMembers: boolean;
  canDeleteOrg: boolean;

  // Auth actions
  signOut: () => Promise<void>;
}

// For creating/updating organizations
export interface CreateOrganizationInput {
  name: string;
}

export interface UpdateOrganizationInput {
  name?: string;
}

// For inviting members
export interface InviteMemberInput {
  email: string;
  role: 'admin' | 'member';
}

// For updating member role
export interface UpdateMemberRoleInput {
  memberId: string;
  role: 'admin' | 'member';
}
