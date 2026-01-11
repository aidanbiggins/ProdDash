// Organization Service
// Handles all organization-related operations: CRUD, memberships, invites

import { supabase } from '../../lib/supabase';
import {
  Organization,
  OrganizationMembership,
  OrganizationInvite,
  CreateOrganizationInput,
  UpdateOrganizationInput,
  InviteMemberInput
} from '../types/auth';

// ============================================
// Organization CRUD
// ============================================

/**
 * Create a new organization
 * The creating user is automatically added as admin via database trigger
 */
export async function createOrganization(
  input: CreateOrganizationInput,
  userId: string
): Promise<Organization> {
  if (!supabase) throw new Error('Supabase not configured');

  // Generate slug from name
  const { data: slugData, error: slugError } = await supabase
    .rpc('generate_org_slug', { org_name: input.name });

  if (slugError) throw slugError;

  const { data, error } = await supabase
    .from('organizations')
    .insert({
      name: input.name,
      slug: slugData,
      created_by: userId
    })
    .select()
    .single();

  if (error) throw error;
  return data as Organization;
}

/**
 * Get organization by ID
 */
export async function getOrganization(orgId: string): Promise<Organization | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data as Organization;
}

/**
 * Get organization by slug
 */
export async function getOrganizationBySlug(slug: string): Promise<Organization | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as Organization;
}

/**
 * Update organization details
 */
export async function updateOrganization(
  orgId: string,
  input: UpdateOrganizationInput
): Promise<Organization> {
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('organizations')
    .update(input)
    .eq('id', orgId)
    .select()
    .single();

  if (error) throw error;
  return data as Organization;
}

/**
 * Soft-delete organization (sets deleted_at timestamp)
 */
export async function deleteOrganization(orgId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');

  const { error } = await supabase
    .from('organizations')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', orgId);

  if (error) throw error;
}

// ============================================
// Membership Operations
// ============================================

/**
 * Get all memberships for a user (with org details)
 */
export async function getUserMemberships(userId: string): Promise<OrganizationMembership[]> {
  console.log('[OrgService] getUserMemberships called for:', userId);
  if (!supabase) {
    console.log('[OrgService] No supabase client');
    return [];
  }

  try {
    console.log('[OrgService] Querying organization_members...');
    const { data, error } = await supabase
      .from('organization_members')
      .select(`
        id,
        organization_id,
        user_id,
        role,
        created_at,
        organization:organizations (
          id,
          name,
          slug,
          created_at,
          created_by,
          deleted_at
        )
      `)
      .eq('user_id', userId);

    console.log('[OrgService] Query complete. Error:', error, 'Data:', data?.length ?? 0, 'rows');
    if (error) throw error;

    // Filter out memberships for deleted orgs and transform
    return (data || [])
      .filter((m: any) => m.organization && !m.organization.deleted_at)
      .map((m: any) => ({
        id: m.id,
        organization_id: m.organization_id,
        organization: m.organization,
        user_id: m.user_id,
        role: m.role,
        created_at: m.created_at
      }));
  } catch (err) {
    console.error('[OrgService] getUserMemberships error:', err);
    return [];
  }
}

/**
 * Get all members of an organization
 */
export async function getOrganizationMembers(orgId: string): Promise<OrganizationMembership[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('organization_members')
    .select(`
      id,
      organization_id,
      user_id,
      role,
      created_at
    `)
    .eq('organization_id', orgId);

  if (error) throw error;

  return data as OrganizationMembership[];
}

/**
 * Update a member's role
 */
export async function updateMemberRole(
  memberId: string,
  role: 'admin' | 'member'
): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');

  const { error } = await supabase
    .from('organization_members')
    .update({ role })
    .eq('id', memberId);

  if (error) throw error;
}

/**
 * Remove a member from an organization
 */
export async function removeMember(memberId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');

  const { error } = await supabase
    .from('organization_members')
    .delete()
    .eq('id', memberId);

  if (error) throw error;
}

// ============================================
// Invite Operations
// ============================================

/**
 * Generate a secure random token for invites
 */
function generateInviteToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create an invite for a user to join an organization
 */
export async function createInvite(
  orgId: string,
  input: InviteMemberInput,
  invitedBy: string
): Promise<OrganizationInvite> {
  if (!supabase) throw new Error('Supabase not configured');

  const token = generateInviteToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiry

  const { data, error } = await supabase
    .from('organization_invites')
    .insert({
      organization_id: orgId,
      email: input.email.toLowerCase(),
      role: input.role,
      token,
      invited_by: invitedBy,
      expires_at: expiresAt.toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return data as OrganizationInvite;
}

/**
 * Get pending invites for an organization
 */
export async function getOrganizationInvites(orgId: string): Promise<OrganizationInvite[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('organization_invites')
    .select('*')
    .eq('organization_id', orgId)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString());

  if (error) throw error;
  return data as OrganizationInvite[];
}

/**
 * Get invite by token
 */
export async function getInviteByToken(token: string): Promise<OrganizationInvite | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('organization_invites')
    .select(`
      *,
      organization:organizations (*)
    `)
    .eq('token', token)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as OrganizationInvite;
}

/**
 * Get pending invites for a user's email
 */
export async function getInvitesForEmail(email: string): Promise<OrganizationInvite[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('organization_invites')
    .select(`
      *,
      organization:organizations (*)
    `)
    .eq('email', email.toLowerCase())
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString());

  if (error) throw error;
  return data as OrganizationInvite[];
}

/**
 * Accept an invite and add user to organization
 */
export async function acceptInvite(token: string, userId: string): Promise<OrganizationMembership> {
  if (!supabase) throw new Error('Supabase not configured');

  // Get the invite
  const invite = await getInviteByToken(token);
  if (!invite) throw new Error('Invite not found or expired');

  // Add user to organization
  const { data: memberData, error: memberError } = await supabase
    .from('organization_members')
    .insert({
      organization_id: invite.organization_id,
      user_id: userId,
      role: invite.role
    })
    .select()
    .single();

  if (memberError) throw memberError;

  // Mark invite as accepted
  await supabase
    .from('organization_invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id);

  // Fetch the full membership with org details
  const memberships = await getUserMemberships(userId);
  const newMembership = memberships.find(m => m.organization_id === invite.organization_id);

  if (!newMembership) throw new Error('Failed to fetch new membership');
  return newMembership;
}

/**
 * Delete/cancel an invite
 */
export async function deleteInvite(inviteId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');

  const { error } = await supabase
    .from('organization_invites')
    .delete()
    .eq('id', inviteId);

  if (error) throw error;
}

// ============================================
// Super Admin Operations
// ============================================

/**
 * Check if a user is a super admin
 */
export async function checkIsSuperAdmin(userId: string): Promise<boolean> {
  console.log('[OrgService] checkIsSuperAdmin called for:', userId);
  if (!supabase) {
    console.log('[OrgService] No supabase client');
    return false;
  }

  try {
    console.log('[OrgService] Querying super_admins...');
    const { data, error } = await supabase
      .from('super_admins')
      .select('user_id')
      .eq('user_id', userId)
      .single();

    console.log('[OrgService] super_admins query complete. Error:', error, 'Data:', data);
    if (error) return false;
    return !!data;
  } catch (err) {
    console.error('[OrgService] checkIsSuperAdmin error:', err);
    return false;
  }
}

/**
 * Get all organizations (super admin only)
 */
export async function getAllOrganizations(): Promise<Organization[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Organization[];
}

/**
 * Add a super admin (super admin only)
 */
export async function addSuperAdmin(userId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');

  const { error } = await supabase
    .from('super_admins')
    .insert({ user_id: userId });

  if (error) throw error;
}

/**
 * Remove a super admin (super admin only)
 */
export async function removeSuperAdmin(userId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');

  const { error } = await supabase
    .from('super_admins')
    .delete()
    .eq('user_id', userId);

  if (error) throw error;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Generate invite URL
 */
export function getInviteUrl(token: string): string {
  return `${window.location.origin}/invite/${token}`;
}

/**
 * Check if user has any org memberships
 */
export async function hasAnyMembership(userId: string): Promise<boolean> {
  const memberships = await getUserMemberships(userId);
  return memberships.length > 0;
}
