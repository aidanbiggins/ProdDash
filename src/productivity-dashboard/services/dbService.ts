import { supabase } from '../../lib/supabase';
import { Requisition, Candidate, Event, User } from '../types';

// Helper to sanitize dates for JSON/DB (undefined -> null, Date -> ISO string)
const toDbDate = (date: Date | null | undefined): string | null => {
    if (!date) return null;
    return date.toISOString();
};

/**
 * Fetch dashboard data for a specific organization.
 * If orgId is null, returns empty data (user needs to select/create an org).
 * RLS enforces that users can only see their org's data.
 */
export const fetchDashboardData = async (orgId?: string | null) => {
    if (!supabase) {
        return { requisitions: [], candidates: [], events: [], users: [] };
    }

    // If no org specified, fetch all user has access to (RLS enforces)
    // For explicit org filtering, we add the filter
    let reqsQuery = supabase.from('requisitions').select('*');
    let candsQuery = supabase.from('candidates').select('*');
    let eventsQuery = supabase.from('events').select('*');
    let usersQuery = supabase.from('users').select('*');

    if (orgId) {
        reqsQuery = reqsQuery.eq('organization_id', orgId);
        candsQuery = candsQuery.eq('organization_id', orgId);
        eventsQuery = eventsQuery.eq('organization_id', orgId);
        usersQuery = usersQuery.eq('organization_id', orgId);
    }

    const [reqs, cands, events, users] = await Promise.all([
        reqsQuery,
        candsQuery,
        eventsQuery,
        usersQuery
    ]);

    if (reqs.error) throw reqs.error;
    if (cands.error) throw cands.error;
    if (events.error) throw events.error;
    if (users.error) throw users.error;

    // Transform ISO strings back to Date objects
    const requisitions: Requisition[] = reqs.data.map((r: any) => ({
        ...r,
        opened_at: new Date(r.opened_at),
        closed_at: r.closed_at ? new Date(r.closed_at) : null
    }));

    const candidates: Candidate[] = cands.data.map((c: any) => ({
        ...c,
        applied_at: c.applied_at ? new Date(c.applied_at) : null,
        first_contacted_at: c.first_contacted_at ? new Date(c.first_contacted_at) : null,
        current_stage_entered_at: c.current_stage_entered_at ? new Date(c.current_stage_entered_at) : null,
        hired_at: c.hired_at ? new Date(c.hired_at) : null,
        offer_extended_at: c.offer_extended_at ? new Date(c.offer_extended_at) : null,
        offer_accepted_at: c.offer_accepted_at ? new Date(c.offer_accepted_at) : null
    }));

    const eventList: Event[] = events.data.map((e: any) => ({
        ...e,
        event_at: new Date(e.event_at)
    }));

    // Users are simple
    const userList: User[] = users.data as User[];

    return { requisitions, candidates, events: eventList, users: userList };
};

// Helper for chunked upserts
async function chunkedUpsert(table: string, data: any[], chunkSize: number = 500) {
    if (data.length === 0) return;

    for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        const { error } = await supabase!.from(table).upsert(chunk);
        if (error) {
            console.error(`Error upserting to ${table} (chunk ${i / chunkSize}):`, error);
            throw error;
        }
    }
}

/**
 * Persist dashboard data to the database.
 * All data will be tagged with the organization ID.
 */
export const persistDashboardData = async (
    requisitions: Requisition[],
    candidates: Candidate[],
    events: Event[],
    users: User[],
    organizationId: string
) => {
    if (!supabase) throw new Error("Supabase execution skipped: Client not configured");
    if (!organizationId) throw new Error("Organization ID is required for data import");

    // Transform for DB - ONLY include columns that exist in the DB schema
    const dbReqs = requisitions.map(r => ({
        req_id: r.req_id,
        req_title: r.req_title,
        recruiter_id: r.recruiter_id,
        hiring_manager_id: r.hiring_manager_id,
        status: r.status,
        level: r.level,
        function: r.function,
        job_family: r.job_family,
        business_unit: r.business_unit,
        location_region: r.location_region,
        location_type: r.location_type,
        opened_at: toDbDate(r.opened_at),
        closed_at: toDbDate(r.closed_at),
        raw_data: null,
        organization_id: organizationId
    }));

    const dbCands = candidates.map(c => ({
        candidate_id: c.candidate_id,
        name: c.name,
        req_id: c.req_id,
        current_stage: c.current_stage,
        applied_at: toDbDate(c.applied_at),
        first_contacted_at: toDbDate(c.first_contacted_at),
        hired_at: toDbDate(c.hired_at),
        offer_extended_at: toDbDate(c.offer_extended_at),
        offer_accepted_at: toDbDate(c.offer_accepted_at),
        disposition: c.disposition,
        raw_data: null,
        organization_id: organizationId
    }));

    const dbEvents = events.map(e => ({
        candidate_id: e.candidate_id,
        req_id: e.req_id,
        event_type: e.event_type,
        from_stage: e.from_stage,
        to_stage: e.to_stage,
        actor_user_id: e.actor_user_id,
        event_at: toDbDate(e.event_at),
        metadata: e.metadata_json ? JSON.parse(e.metadata_json) : null,
        organization_id: organizationId
    }));

    const dbUsers = users.map(u => ({
        ...u,
        organization_id: organizationId
    }));

    // Chunk inserts to avoid payload limits
    await chunkedUpsert('users', dbUsers);
    await chunkedUpsert('requisitions', dbReqs);
    await chunkedUpsert('candidates', dbCands);
    await chunkedUpsert('events', dbEvents);
};

/**
 * Helper to delete all rows from a table in batches to avoid timeouts.
 * Optionally filter by organization ID.
 */
async function batchDelete(table: string, idColumn: string, orgId?: string | null, batchSize: number = 500) {
    if (!supabase) return;

    let hasMore = true;
    while (hasMore) {
        let query = supabase.from(table).select(idColumn).limit(batchSize);

        if (orgId) {
            query = query.eq('organization_id', orgId);
        }

        const { data, error } = await query;

        if (error) throw error;
        if (!data || data.length === 0) {
            hasMore = false;
            break;
        }

        const ids = data.map((row: any) => row[idColumn]);

        const { error: deleteError } = await supabase
            .from(table)
            .delete()
            .in(idColumn, ids);

        if (deleteError) throw deleteError;

        // If we fetched less than limit, we are done
        if (data.length < batchSize) hasMore = false;
    }
}

/**
 * Clear all data for a specific organization.
 * If no orgId provided, clears all data the user has access to (careful!).
 */
export const clearAllData = async (orgId?: string | null) => {
    if (!supabase) throw new Error("Supabase execution skipped: Client not configured");

    console.log("Starting batched clear of data...");

    // Delete in order: events -> candidates -> requisitions -> users (respecting foreign keys)
    await batchDelete('events', 'event_id', orgId);
    await batchDelete('candidates', 'candidate_id', orgId);
    await batchDelete('requisitions', 'req_id', orgId);
    await batchDelete('users', 'user_id', orgId);

    console.log("Successfully cleared data.");
};
