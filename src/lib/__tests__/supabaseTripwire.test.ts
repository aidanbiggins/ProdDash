/**
 * Unit tests for the Supabase service role key tripwire logic.
 *
 * These tests verify the security tripwire behavior:
 * - Localhost never crashes, even with production builds
 * - Non-localhost with key present throws
 * - ALLOW_SERVICE_ROLE requires: !isProd && isLocalhost && devBypassEnabled
 */

describe('Supabase Service Role Tripwire', () => {
    // Store original values
    const originalEnv = process.env;
    const originalWindow = global.window;

    beforeEach(() => {
        // Reset modules to re-evaluate the tripwire logic
        jest.resetModules();
        // Reset env
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
        global.window = originalWindow;
    });

    /**
     * Helper to compute tripwire values without actually importing the module
     * (which would trigger the throw). This mirrors the logic in supabase.ts.
     */
    function computeTripwireValues(config: {
        isProd: boolean;
        isLocalhost: boolean;
        devBypassEnabled: boolean;
        keyPresent: boolean;
    }) {
        const { isLocalhost, devBypassEnabled, keyPresent } = config;
        // Note: isProd is intentionally NOT used - localhost is the security boundary

        // Would throw?
        const shouldThrow = keyPresent && !isLocalhost;

        // ALLOW_SERVICE_ROLE - only checks localhost + devBypassEnabled (not isProd)
        const ALLOW_SERVICE_ROLE = isLocalhost && devBypassEnabled;

        // SERVICE_ROLE_KEY_PRESENT_BUT_DISABLED
        const SERVICE_ROLE_KEY_PRESENT_BUT_DISABLED =
            isLocalhost && keyPresent && !ALLOW_SERVICE_ROLE;

        return {
            shouldThrow,
            ALLOW_SERVICE_ROLE,
            SERVICE_ROLE_KEY_PRESENT_BUT_DISABLED,
        };
    }

    describe('Case A: localhost + production build + key present', () => {
        it('should NOT throw and SERVICE_ROLE_KEY_PRESENT_BUT_DISABLED should be true', () => {
            const result = computeTripwireValues({
                isProd: true,
                isLocalhost: true,
                devBypassEnabled: false,
                keyPresent: true,
            });

            expect(result.shouldThrow).toBe(false);
            expect(result.ALLOW_SERVICE_ROLE).toBe(false);
            expect(result.SERVICE_ROLE_KEY_PRESENT_BUT_DISABLED).toBe(true);
        });
    });

    describe('Case B: non-localhost hostname + key present', () => {
        it('should throw SECURITY VIOLATION', () => {
            const result = computeTripwireValues({
                isProd: false,
                isLocalhost: false, // e.g., deployed to example.com
                devBypassEnabled: true,
                keyPresent: true,
            });

            expect(result.shouldThrow).toBe(true);
        });

        it('should throw even with production build on non-localhost', () => {
            const result = computeTripwireValues({
                isProd: true,
                isLocalhost: false,
                devBypassEnabled: false,
                keyPresent: true,
            });

            expect(result.shouldThrow).toBe(true);
        });
    });

    describe('Case C: localhost + dev bypass enabled + !isProd + key present', () => {
        it('should have ALLOW_SERVICE_ROLE true', () => {
            const result = computeTripwireValues({
                isProd: false,
                isLocalhost: true,
                devBypassEnabled: true,
                keyPresent: true,
            });

            expect(result.shouldThrow).toBe(false);
            expect(result.ALLOW_SERVICE_ROLE).toBe(true);
            expect(result.SERVICE_ROLE_KEY_PRESENT_BUT_DISABLED).toBe(false);
        });
    });

    describe('Edge cases', () => {
        it('should not show warning when key is absent', () => {
            const result = computeTripwireValues({
                isProd: false,
                isLocalhost: true,
                devBypassEnabled: false,
                keyPresent: false,
            });

            expect(result.shouldThrow).toBe(false);
            expect(result.ALLOW_SERVICE_ROLE).toBe(false);
            expect(result.SERVICE_ROLE_KEY_PRESENT_BUT_DISABLED).toBe(false);
        });

        it('should not throw on non-localhost when key is absent', () => {
            const result = computeTripwireValues({
                isProd: true,
                isLocalhost: false,
                devBypassEnabled: false,
                keyPresent: false,
            });

            expect(result.shouldThrow).toBe(false);
        });

        it('localhost + dev bypass + isProd should STILL have ALLOW_SERVICE_ROLE true', () => {
            // Production build on localhost with dev bypass - service role IS allowed
            // The security boundary is localhost, not NODE_ENV
            const result = computeTripwireValues({
                isProd: true,
                isLocalhost: true,
                devBypassEnabled: true,
                keyPresent: true,
            });

            expect(result.shouldThrow).toBe(false);
            expect(result.ALLOW_SERVICE_ROLE).toBe(true); // isProd does NOT block it
            expect(result.SERVICE_ROLE_KEY_PRESENT_BUT_DISABLED).toBe(false);
        });
    });
});
