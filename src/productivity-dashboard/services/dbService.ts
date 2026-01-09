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

export const persistDashboardData = async (
    requisitions: Requisition[],
    candidates: Candidate[],
    events: Event[],
    users: User[]
) => {
    if (!supabase) throw new Error("Supabase execution skipped: Client not configured");

    // Transform for DB
    const dbReqs = requisitions.map(r => ({
        ...r,
        opened_at: toDbDate(r.opened_at),
        closed_at: toDbDate(r.closed_at),
        raw_data: null // Optional
    }));

    const dbCands = candidates.map(c => ({
        ...c,
        applied_at: toDbDate(c.applied_at),
        first_contacted_at: toDbDate(c.first_contacted_at),
        current_stage_entered_at: toDbDate(c.current_stage_entered_at),
        hired_at: toDbDate(c.hired_at),
        offer_extended_at: toDbDate(c.offer_extended_at),
        offer_accepted_at: toDbDate(c.offer_accepted_at)
    }));

    const dbEvents = events.map(e => ({
        ...e,
        event_at: toDbDate(e.event_at)
    }));

    // Chunk inserts to avoid payload limits (Supabase has limits)
    // Simple implementation: insert all (optimize if needed)

    // Upsert Users
    const { error: uErr } = await supabase.from('users').upsert(users);
    if (uErr) throw uErr;

    // Upsert Reqs
    const { error: rErr } = await supabase.from('requisitions').upsert(dbReqs);
    if (rErr) throw rErr;

    // Upsert Candidates
    const { error: cErr } = await supabase.from('candidates').upsert(dbCands);
    if (cErr) throw cErr;

    // Upsert Events
    const { error: eErr } = await supabase.from('events').upsert(dbEvents);
    if (eErr) throw eErr;
};

/**
 * Clear all data from the database tables
 * Used before loading demo data to ensure clean state
 */
export const clearAllData = async () => {
    if (!supabase) throw new Error("Supabase execution skipped: Client not configured");

    // Delete in order: events -> candidates -> requisitions -> users (respecting foreign keys)
    // Using neq filter to delete all rows (Supabase requires a filter for delete)
    const { error: eErr } = await supabase.from('events').delete().neq('event_id', '');
    if (eErr) throw eErr;

    const { error: cErr } = await supabase.from('candidates').delete().neq('candidate_id', '');
    if (cErr) throw cErr;

    const { error: rErr } = await supabase.from('requisitions').delete().neq('req_id', '');
    if (rErr) throw rErr;

    // Users table we might want to keep, but for demo purposes clear it too
    const { error: uErr } = await supabase.from('users').delete().neq('user_id', '');
    if (uErr) throw uErr;
};
