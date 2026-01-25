import { supabase, getSupabaseClient } from '../../lib/supabase';
import { Requisition, Candidate, Event, User, CanonicalStage, CandidateDisposition, RequisitionStatus } from '../types';
import {
    createSnapshot,
    insertSnapshotCandidates,
    insertSnapshotRequisitions,
    updateSnapshotStatus,
    generateContentHash,
    isDuplicateImport,
    getSnapshotCount
} from './snapshotService';
import { processDiff } from './snapshotDiffService';
import { SnapshotCandidateInput, SnapshotRequisitionInput, SNAPSHOT_LIMITS } from '../types/snapshotTypes';

// Simple stage normalization for snapshots (without requiring full config)
function simpleNormalizeStage(stage: string | null | undefined): CanonicalStage | null {
    if (!stage) return null;
    const lower = stage.toLowerCase().trim();

    // Direct matches
    if (lower === 'lead' || lower.includes('prospect') || lower === 'sourced') return CanonicalStage.LEAD;
    if (lower === 'applied' || lower.includes('application') || lower === 'new' || lower === 'submitted') return CanonicalStage.APPLIED;
    if (lower.includes('phone screen') || lower.includes('recruiter screen') || lower === 'screen' || lower.includes('ta screen')) return CanonicalStage.SCREEN;
    if (lower.includes('hm screen') || lower.includes('hiring manager') || lower.includes('tech screen')) return CanonicalStage.HM_SCREEN;
    if (lower.includes('onsite') || lower.includes('panel') || lower.includes('interview loop') || lower.includes('full loop')) return CanonicalStage.ONSITE;
    if (lower === 'final' || lower.includes('final round') || lower.includes('exec interview') || lower.includes('debrief')) return CanonicalStage.FINAL;
    if (lower === 'offer' || lower.includes('offer extended') || lower.includes('offer pending')) return CanonicalStage.OFFER;
    if (lower === 'hired' || lower.includes('offer accepted') || lower.includes('accepted')) return CanonicalStage.HIRED;
    if (lower.includes('reject') || lower.includes('declined by company') || lower.includes('not selected')) return CanonicalStage.REJECTED;
    if (lower.includes('withdrew') || lower.includes('withdrawn') || lower.includes('candidate declined')) return CanonicalStage.WITHDREW;

    return null;
}

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
    // Users table is optional - may not exist or have RLS restrictions
    // Don't throw, just log and continue with empty users
    if (users.error) {
        console.warn('[DB] Users query failed (table may not exist):', users.error.message);
    }

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

    // Users are simple (may be empty if table doesn't exist)
    const userList: User[] = (users.data || []) as User[];

    return { requisitions, candidates, events: eventList, users: userList };
};

// Progress callback for import/persist operations
export interface ImportProgress {
    phase: 'parsing' | 'persisting';
    step: number;
    totalSteps: number;
    table: string;
    rowsProcessed: number;
    totalRows: number;
    status: 'processing' | 'complete';
}

export type ImportProgressCallback = (progress: ImportProgress) => void;

// Helper for chunked upserts with progress logging
async function chunkedUpsert(
    table: string,
    data: any[],
    chunkSize: number = 500,
    onProgress?: (rowsUpserted: number, totalRows: number) => void
) {
    if (data.length === 0) {
        console.log(`[DB] Skipping ${table} - no data`);
        onProgress?.(0, 0);
        return;
    }

    const totalChunks = Math.ceil(data.length / chunkSize);
    console.log(`[DB] Upserting ${data.length} rows to ${table} in ${totalChunks} chunks...`);
    const startTime = Date.now();
    let rowsUpserted = 0;

    for (let i = 0; i < data.length; i += chunkSize) {
        const chunkNum = Math.floor(i / chunkSize) + 1;
        const chunk = data.slice(i, i + chunkSize);

        if (chunkNum % 10 === 0 || chunkNum === totalChunks) {
            console.log(`[DB] ${table}: chunk ${chunkNum}/${totalChunks}...`);
        }

        const client = getSupabaseClient();
        if (!client) throw new Error("Supabase client not configured");
        const { error } = await client.from(table).upsert(chunk);
        if (error) {
            console.error(`[DB] Error upserting to ${table} (chunk ${chunkNum}):`, error);
            throw error;
        }

        rowsUpserted += chunk.length;
        onProgress?.(rowsUpserted, data.length);
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
    organizationId: string,
    onProgress?: ImportProgressCallback
) => {
    // Check for skip flag (useful for testing large files)
    const skipPersist = localStorage.getItem('skip-db-persist') === 'true';
    if (skipPersist) {
        console.warn('[DB] SKIPPING database persist (skip-db-persist flag is set)');
        console.log(`[DB] Would have persisted: ${requisitions.length} reqs, ${candidates.length} candidates, ${events.length} events, ${users.length} users`);
        return;
    }

    const client = getSupabaseClient();
    if (!client) throw new Error("Supabase execution skipped: Client not configured");
    if (!organizationId) throw new Error("Organization ID is required for data import");

    console.log(`[DB] Starting persist: ${requisitions.length} reqs, ${candidates.length} candidates, ${events.length} events, ${users.length} users`);

    // Build set of valid req_ids from requisitions being imported
    const validReqIds = new Set(requisitions.map(r => r.req_id));

    // Filter candidates to only those referencing valid requisitions (resilient import)
    const validCandidates = candidates.filter(c => validReqIds.has(c.req_id));
    const orphanedCandidates = candidates.length - validCandidates.length;

    if (orphanedCandidates > 0) {
        console.warn(`[DB] Filtering ${orphanedCandidates} orphaned candidates (req_id not in requisitions file)`);
        // Log some examples
        const orphanExamples = candidates
            .filter(c => !validReqIds.has(c.req_id))
            .slice(0, 5)
            .map(c => c.req_id);
        console.warn(`[DB] Example orphaned req_ids: ${orphanExamples.join(', ')}`);
    }

    // Similarly filter events
    const validEvents = events.filter(e => validReqIds.has(e.req_id));
    const orphanedEvents = events.length - validEvents.length;
    if (orphanedEvents > 0) {
        console.warn(`[DB] Filtering ${orphanedEvents} orphaned events (req_id not in requisitions file)`);
    }

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

    const dbCands = validCandidates.map(c => ({
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

    const dbEvents = validEvents.map(e => ({
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

    // Tables to persist in order
    const tables = [
        { name: 'users', data: dbUsers, label: 'Users' },
        { name: 'requisitions', data: dbReqs, label: 'Requisitions' },
        { name: 'candidates', data: dbCands, label: 'Candidates' },
        { name: 'events', data: dbEvents, label: 'Events' }
    ];

    // Chunk inserts to avoid payload limits
    for (let i = 0; i < tables.length; i++) {
        const { name, data, label } = tables[i];
        const step = i + 1;

        // Report starting this table
        onProgress?.({
            phase: 'persisting',
            step,
            totalSteps: 4,
            table: label,
            rowsProcessed: 0,
            totalRows: data.length,
            status: 'processing'
        });

        await chunkedUpsert(name, data, 500, (rowsUpserted, totalRows) => {
            onProgress?.({
                phase: 'persisting',
                step,
                totalSteps: 4,
                table: label,
                rowsProcessed: rowsUpserted,
                totalRows,
                status: 'processing'
            });
        });

        // Report table complete
        onProgress?.({
            phase: 'persisting',
            step,
            totalSteps: 4,
            table: label,
            rowsProcessed: data.length,
            totalRows: data.length,
            status: 'complete'
        });
    }
};

// Progress callback for clear operations
export interface ClearProgress {
    step: number;
    totalSteps: number;
    table: string;
    rowsDeleted: number;
    status: 'counting' | 'deleting' | 'complete';
}

export type ClearProgressCallback = (progress: ClearProgress) => void;

/**
 * Helper to delete rows from a table in chunks.
 * Uses 200-row batches to avoid URL length limits with .in() queries.
 */
async function chunkedDelete(
    table: string,
    idColumn: string,
    orgId?: string | null,
    chunkSize: number = 200,
    onProgress?: (rowsDeleted: number) => void
): Promise<number> {
    const client = getSupabaseClient();
    if (!client) return 0;

    const startTime = Date.now();
    let totalDeleted = 0;

    // Delete records matching the org_id
    if (orgId) {
        console.log(`[DB Clear] Deleting from ${table} for org ${orgId}...`);
        let hasMore = true;

        while (hasMore) {
            // Get a batch of IDs - use smaller chunk to keep URL size manageable
            const { data, error: selectError } = await client
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

            // Delete this batch using .in() with IDs - smaller chunk avoids URL length limits
            const ids = data.map((row: any) => row[idColumn]);
            const { error: deleteError } = await client
                .from(table)
                .delete()
                .in(idColumn, ids);

            if (deleteError) {
                console.error(`[DB Clear] Error deleting from ${table}:`, deleteError);
                throw deleteError;
            }

            totalDeleted += ids.length;
            onProgress?.(totalDeleted);
            if (totalDeleted % 1000 === 0 || data.length < chunkSize) {
                console.log(`[DB Clear] ${table}: deleted ${totalDeleted} rows so far...`);
            }

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 20));

            if (data.length < chunkSize) hasMore = false;
        }
        console.log(`[DB Clear] Deleted ${totalDeleted} rows from ${table} in ${Date.now() - startTime}ms`);
    }

    // Also delete records with NULL organization_id (legacy data)
    let nullDeleted = 0;
    let hasMoreNull = true;
    while (hasMoreNull) {
        const { data, error: selectError } = await client
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
        const { error: deleteError } = await client
            .from(table)
            .delete()
            .in(idColumn, ids);

        if (deleteError) {
            console.error(`[DB Clear] Error deleting NULL org from ${table}:`, deleteError);
            throw deleteError;
        }

        nullDeleted += ids.length;
        onProgress?.(totalDeleted + nullDeleted);
        if (data.length < chunkSize) hasMoreNull = false;
    }
    if (nullDeleted > 0) {
        console.log(`[DB Clear] Deleted ${nullDeleted} rows with NULL org_id from ${table}`);
    }

    return totalDeleted + nullDeleted;
}

/**
 * Clear all data for a specific organization.
 * If no orgId provided, clears all data the user has access to (careful!).
 * Uses chunked deletes (200 rows at a time) to avoid URL length limits.
 */
export const clearAllData = async (
    orgId?: string | null,
    onProgress?: ClearProgressCallback
) => {
    const client = getSupabaseClient();
    if (!client) throw new Error("Supabase execution skipped: Client not configured");

    console.log(`[DB Clear] Starting clear for org: ${orgId || 'ALL'}`);
    const startTime = Date.now();

    const tables = [
        { name: 'events', idColumn: 'event_id', label: 'Events' },
        { name: 'candidates', idColumn: 'candidate_id', label: 'Candidates' },
        { name: 'requisitions', idColumn: 'req_id', label: 'Requisitions' },
        { name: 'users', idColumn: 'user_id', label: 'Users' }
    ];

    // Delete in order: events -> candidates -> requisitions -> users (respecting foreign keys)
    // IMPORTANT: Each step must complete before the next begins
    try {
        for (let i = 0; i < tables.length; i++) {
            const { name, idColumn, label } = tables[i];
            const step = i + 1;

            console.log(`[DB Clear] Step ${step}/4: Deleting ${name}...`);

            // Report starting
            onProgress?.({
                step,
                totalSteps: 4,
                table: label,
                rowsDeleted: 0,
                status: 'deleting'
            });

            // Delete with progress callback
            const deleted = await chunkedDelete(
                name,
                idColumn,
                orgId,
                200,
                (rowsDeleted) => {
                    onProgress?.({
                        step,
                        totalSteps: 4,
                        table: label,
                        rowsDeleted,
                        status: 'deleting'
                    });
                }
            );

            // Report complete for this table
            onProgress?.({
                step,
                totalSteps: 4,
                table: label,
                rowsDeleted: deleted || 0,
                status: 'complete'
            });
        }

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

// ============================================
// SNAPSHOT CREATION ON IMPORT
// ============================================

export interface SnapshotImportResult {
    snapshotId: string;
    snapshotSeq: number;
    candidateCount: number;
    reqCount: number;
    eventsGenerated: number;
    isDuplicate: boolean;
}

/**
 * Create a snapshot from imported data and run the diff algorithm.
 * This is called after persistDashboardData to capture the snapshot state.
 */
export async function createSnapshotFromImport(
    requisitions: Requisition[],
    candidates: Candidate[],
    organizationId: string,
    options: {
        snapshotDate?: Date;
        sourceFilename?: string;
        csvContent?: string;
        userId?: string;
    } = {}
): Promise<SnapshotImportResult> {
    const {
        snapshotDate = new Date(),
        sourceFilename,
        csvContent,
        userId
    } = options;

    console.log(`[Snapshot] Creating snapshot for org ${organizationId}...`);

    // Generate content hash for deduplication
    let sourceHash: string | undefined;
    if (csvContent) {
        sourceHash = await generateContentHash(csvContent);

        // Check for duplicate import
        const duplicate = await isDuplicateImport(organizationId, sourceHash);
        if (duplicate) {
            console.log('[Snapshot] Duplicate import detected, skipping snapshot creation');
            return {
                snapshotId: '',
                snapshotSeq: 0,
                candidateCount: candidates.length,
                reqCount: requisitions.length,
                eventsGenerated: 0,
                isDuplicate: true
            };
        }
    }

    // Check snapshot limit
    const currentCount = await getSnapshotCount(organizationId);
    if (currentCount >= SNAPSHOT_LIMITS.MAX_SNAPSHOTS_PER_ORG) {
        console.warn(`[Snapshot] Org ${organizationId} has reached max snapshots (${SNAPSHOT_LIMITS.MAX_SNAPSHOTS_PER_ORG})`);
        // Could implement snapshot rotation here in the future
    }

    // Create the snapshot record
    const snapshot = await createSnapshot({
        organization_id: organizationId,
        snapshot_date: snapshotDate,
        source_filename: sourceFilename,
        source_hash: sourceHash,
        imported_by: userId
    });

    console.log(`[Snapshot] Created snapshot ${snapshot.id} (seq ${snapshot.snapshot_seq})`);

    try {
        // Convert candidates to snapshot format
        const snapshotCandidates: SnapshotCandidateInput[] = candidates.map((c, index) => ({
            snapshot_id: snapshot.id,
            organization_id: organizationId,
            candidate_id: c.candidate_id,
            req_id: c.req_id,
            current_stage: c.current_stage,
            canonical_stage: simpleNormalizeStage(c.current_stage),
            disposition: c.disposition as CandidateDisposition | null,
            applied_at: c.applied_at,
            current_stage_entered_at: c.current_stage_entered_at,
            hired_at: c.hired_at,
            rejected_at: null, // Not available in Candidate type
            withdrawn_at: null, // Not available in Candidate type
            offer_extended_at: c.offer_extended_at,
            source_row_number: index + 1
        }));

        // Convert requisitions to snapshot format
        const snapshotRequisitions: SnapshotRequisitionInput[] = requisitions.map((r, index) => ({
            snapshot_id: snapshot.id,
            organization_id: organizationId,
            req_id: r.req_id,
            status: r.status as RequisitionStatus | null,
            recruiter_id: r.recruiter_id,
            hiring_manager_id: r.hiring_manager_id,
            opened_at: r.opened_at,
            closed_at: r.closed_at,
            source_row_number: index + 1
        }));

        // Insert snapshot data
        console.log(`[Snapshot] Inserting ${snapshotCandidates.length} candidates and ${snapshotRequisitions.length} reqs...`);
        await insertSnapshotCandidates(snapshotCandidates);
        await insertSnapshotRequisitions(snapshotRequisitions);

        // Update snapshot with counts
        await updateSnapshotStatus(snapshot.id, 'pending', {
            candidate_count: candidates.length,
            req_count: requisitions.length
        });

        // Run diff algorithm
        console.log(`[Snapshot] Running diff for snapshot ${snapshot.id}...`);
        const diffResult = await processDiff(organizationId, snapshot.id);

        console.log(`[Snapshot] Snapshot complete: ${diffResult.eventsGenerated} events generated`);

        return {
            snapshotId: snapshot.id,
            snapshotSeq: snapshot.snapshot_seq,
            candidateCount: candidates.length,
            reqCount: requisitions.length,
            eventsGenerated: diffResult.eventsGenerated,
            isDuplicate: false
        };
    } catch (error) {
        console.error('[Snapshot] Error creating snapshot:', error);
        await updateSnapshotStatus(snapshot.id, 'failed', {
            error_message: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
    }
}
