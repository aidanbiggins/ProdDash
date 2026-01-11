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

// Helper for chunked upserts with progress logging
async function chunkedUpsert(table: string, data: any[], chunkSize: number = 500) {
    if (data.length === 0) {
        console.log(`[DB] Skipping ${table} - no data`);
        return;
    }

    const totalChunks = Math.ceil(data.length / chunkSize);
    console.log(`[DB] Upserting ${data.length} rows to ${table} in ${totalChunks} chunks...`);
    const startTime = Date.now();

    for (let i = 0; i < data.length; i += chunkSize) {
        const chunkNum = Math.floor(i / chunkSize) + 1;
        const chunk = data.slice(i, i + chunkSize);

        if (chunkNum % 10 === 0 || chunkNum === totalChunks) {
            console.log(`[DB] ${table}: chunk ${chunkNum}/${totalChunks}...`);
        }

        const { error } = await supabase!.from(table).upsert(chunk);
        if (error) {
            console.error(`[DB] Error upserting to ${table} (chunk ${chunkNum}):`, error);
            throw error;
        }
    }

    console.log(`[DB] ${table} complete in ${Date.now() - startTime}ms`);
}

/**
 * Persist dashboard data to the database.
 * All data will be tagged with the organization ID.
 *
 * Set localStorage.setItem('skip-db-persist', 'true') to skip persistence for testing.
 */
export const persistDashboardData = async (
    requisitions: Requisition[],
    candidates: Candidate[],
    events: Event[],
    users: User[],
    organizationId: string
) => {
    // Check for skip flag (useful for testing large files)
    const skipPersist = localStorage.getItem('skip-db-persist') === 'true';
    if (skipPersist) {
        console.warn('[DB] SKIPPING database persist (skip-db-persist flag is set)');
        console.log(`[DB] Would have persisted: ${requisitions.length} reqs, ${candidates.length} candidates, ${events.length} events, ${users.length} users`);
        return;
    }

    if (!supabase) throw new Error("Supabase execution skipped: Client not configured");
    if (!organizationId) throw new Error("Organization ID is required for data import");

    console.log(`[DB] Starting persist: ${requisitions.length} reqs, ${candidates.length} candidates, ${events.length} events, ${users.length} users`);

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
        source: c.source,
        current_stage: c.current_stage,
        current_stage_entered_at: toDbDate(c.current_stage_entered_at),
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
 * Helper to delete rows from a table in large chunks.
 * Uses 5000-row batches to balance speed vs timeout risk.
 */
async function chunkedDelete(table: string, idColumn: string, orgId?: string | null, chunkSize: number = 5000) {
    if (!supabase) return;

    const startTime = Date.now();
    let totalDeleted = 0;

    // Delete records matching the org_id
    if (orgId) {
        console.log(`[DB Clear] Deleting from ${table} for org ${orgId}...`);
        let hasMore = true;

        while (hasMore) {
            // Get a batch of IDs
            const { data, error: selectError } = await supabase
                .from(table)
                .select(idColumn)
                .eq('organization_id', orgId)
                .limit(chunkSize);

            if (selectError) {
                console.error(`[DB Clear] Error selecting from ${table}:`, selectError);
                throw selectError;
            }

            if (!data || data.length === 0) {
                hasMore = false;
                break;
            }

            // Delete this batch
            const ids = data.map((row: any) => row[idColumn]);
            const { error: deleteError } = await supabase
                .from(table)
                .delete()
                .in(idColumn, ids);

            if (deleteError) {
                console.error(`[DB Clear] Error deleting from ${table}:`, deleteError);
                throw deleteError;
            }

            totalDeleted += ids.length;
            console.log(`[DB Clear] ${table}: deleted ${totalDeleted} rows so far...`);

            if (data.length < chunkSize) hasMore = false;
        }
        console.log(`[DB Clear] Deleted ${totalDeleted} rows from ${table} in ${Date.now() - startTime}ms`);
    }

    // Also delete records with NULL organization_id (legacy data)
    let nullDeleted = 0;
    let hasMoreNull = true;
    while (hasMoreNull) {
        const { data, error: selectError } = await supabase
            .from(table)
            .select(idColumn)
            .is('organization_id', null)
            .limit(chunkSize);

        if (selectError) {
            console.error(`[DB Clear] Error selecting NULL org from ${table}:`, selectError);
            throw selectError;
        }

        if (!data || data.length === 0) {
            hasMoreNull = false;
            break;
        }

        const ids = data.map((row: any) => row[idColumn]);
        const { error: deleteError } = await supabase
            .from(table)
            .delete()
            .in(idColumn, ids);

        if (deleteError) {
            console.error(`[DB Clear] Error deleting NULL org from ${table}:`, deleteError);
            throw deleteError;
        }

        nullDeleted += ids.length;
        if (data.length < chunkSize) hasMoreNull = false;
    }
    if (nullDeleted > 0) {
        console.log(`[DB Clear] Deleted ${nullDeleted} rows with NULL org_id from ${table}`);
    }
}

/**
 * Clear all data for a specific organization.
 * If no orgId provided, clears all data the user has access to (careful!).
 * Uses chunked deletes (5000 rows at a time) to avoid timeouts.
 */
export const clearAllData = async (orgId?: string | null) => {
    if (!supabase) throw new Error("Supabase execution skipped: Client not configured");

    console.log(`[DB Clear] Starting clear for org: ${orgId || 'ALL'}`);
    const startTime = Date.now();

    // Delete in order: events -> candidates -> requisitions -> users (respecting foreign keys)
    // IMPORTANT: Each step must complete before the next begins
    try {
        console.log('[DB Clear] Step 1/4: Deleting events...');
        await chunkedDelete('events', 'event_id', orgId);

        console.log('[DB Clear] Step 2/4: Deleting candidates...');
        await chunkedDelete('candidates', 'candidate_id', orgId);

        console.log('[DB Clear] Step 3/4: Deleting requisitions...');
        await chunkedDelete('requisitions', 'req_id', orgId);

        console.log('[DB Clear] Step 4/4: Deleting users...');
        await chunkedDelete('users', 'user_id', orgId);

        console.log(`[DB Clear] Successfully cleared all data in ${Date.now() - startTime}ms`);
    } catch (error: any) {
        console.error('[DB Clear] Error during clear:', error);
        // If we get a foreign key error, it means candidates/events weren't fully deleted
        if (error?.code === '23503') {
            console.error('[DB Clear] Foreign key constraint error - some records may not have organization_id set');
            console.error('[DB Clear] Try running: DELETE FROM candidates WHERE organization_id IS NULL; DELETE FROM events WHERE organization_id IS NULL;');
        }
        throw error;
    }
};
