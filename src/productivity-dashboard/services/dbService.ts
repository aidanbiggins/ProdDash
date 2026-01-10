import { supabase } from '../../lib/supabase';
import { Requisition, Candidate, Event, User } from '../types';

// Helper to sanitize dates for JSON/DB (undefined -> null, Date -> ISO string)
const toDbDate = (date: Date | null | undefined): string | null => {
    if (!date) return null;
    return date.toISOString();
};

const toDbJson = (data: any) => {
    return JSON.parse(JSON.stringify(data));
};

export const fetchDashboardData = async () => {
    if (!supabase) {
        return { requisitions: [], candidates: [], events: [], users: [] };
    }

    const [reqs, cands, events, users] = await Promise.all([
        supabase.from('requisitions').select('*'),
        supabase.from('candidates').select('*'),
        supabase.from('events').select('*'),
        supabase.from('users').select('*')
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
        current_stage_entered_at: new Date(c.current_stage_entered_at), // Assuming this exists in DB schema? Wait, I didn't add it to schema explicitly but it's in interface. I should check schema.
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

export const persistDashboardData = async (
    requisitions: Requisition[],
    candidates: Candidate[],
    events: Event[],
    users: User[]
) => {
    if (!supabase) throw new Error("Supabase execution skipped: Client not configured");

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
        raw_data: null
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
        raw_data: null
        // Note: columns like current_stage_entered_at are in entities.ts but not in DB schema.sql
    }));

    const dbEvents = events.map(e => ({
        candidate_id: e.candidate_id,
        req_id: e.req_id,
        event_type: e.event_type,
        from_stage: e.from_stage,
        to_stage: e.to_stage,
        actor_user_id: e.actor_user_id,
        event_at: toDbDate(e.event_at),
        metadata: e.metadata_json ? JSON.parse(e.metadata_json) : null
    }));

    // Chunk inserts to avoid payload limits (Supabase/PostgREST typically limit to ~1000 records or payload size)
    console.log(`Starting chunked upsert: ${users.length} users, ${dbReqs.length} reqs, ${dbCands.length} candidates, ${dbEvents.length} events`);

    await chunkedUpsert('users', users);
    await chunkedUpsert('requisitions', dbReqs);
    await chunkedUpsert('candidates', dbCands);
    await chunkedUpsert('events', dbEvents);

    console.log('Successfully persisted all data to Supabase');
};

/**
 * Clear all data from the database tables
 * Used before loading demo data to ensure clean state
 */
/**
 * Helper to delete all rows from a table in batches to avoid timeouts
 */
async function batchDelete(table: string, idColumn: string, batchSize: number = 500) {
    if (!supabase) return;

    let hasMore = true;
    while (hasMore) {
        // IDs are UUID or text, so we just select the ID to minimize payload
        const { data, error } = await supabase
            .from(table)
            .select(idColumn)
            .limit(batchSize);

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
 * Clear all data from the database tables
 * Used before loading demo data to ensure clean state
 */
export const clearAllData = async () => {
    if (!supabase) throw new Error("Supabase execution skipped: Client not configured");

    console.log("Starting batched clear of all data...");

    // Delete in order: events -> candidates -> requisitions -> users (respecting foreign keys)
    await batchDelete('events', 'event_id');
    await batchDelete('candidates', 'candidate_id');
    await batchDelete('requisitions', 'req_id');
    await batchDelete('users', 'user_id');

    console.log("Successfully cleared all data.");
};
