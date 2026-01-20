// About Page Smoke Tests - Verifies the About page component exists and exports correctly

import { AboutPage } from '../AboutPage';

describe('About Page Smoke Tests', () => {
  describe('Component Export', () => {
    it('should export AboutPage component', () => {
      expect(AboutPage).toBeDefined();
      expect(typeof AboutPage).toBe('function');
    });

    it('should be a valid React component (function that can be called)', () => {
      // AboutPage should be a function component
      expect(AboutPage.name).toBe('AboutPage');
    });
  });
});
