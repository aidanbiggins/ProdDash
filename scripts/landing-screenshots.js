#!/usr/bin/env node
/**
 * Landing Page Screenshot Capture
 *
 * This script captures screenshots of the landing page at:
 * - 375px (mobile)
 * - 768px (tablet)
 * - 1440px (desktop)
 *
 * NOTE: Playwright is not installed. Screenshots are SKIPPED.
 * To enable screenshots, install Playwright:
 *   npm install --save-dev playwright
 *   npx playwright install
 */

const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, '..', 'screenshots');
const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 }
];

// ANSI colors
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

function log(msg, color = RESET) {
  console.log(`${color}${msg}${RESET}`);
}

async function checkPlaywrightAvailable() {
  try {
    require.resolve('playwright');
    return true;
  } catch (e) {
    return false;
  }
}

async function captureScreenshots() {
  log('Landing Page Screenshot Capture', CYAN);
  log('================================\n');

  const hasPlaywright = await checkPlaywrightAvailable();

  if (!hasPlaywright) {
    log('Playwright is not installed.', YELLOW);
    log('Screenshots are SKIPPED.', YELLOW);
    log('\nTo enable screenshots, install Playwright:', YELLOW);
    log('  npm install --save-dev playwright', RESET);
    log('  npx playwright install\n', RESET);

    // Create screenshot directory with placeholder
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }

    // Write a note file
    const notePath = path.join(SCREENSHOT_DIR, 'README.md');
    fs.writeFileSync(notePath, `# Landing Page Screenshots

Screenshots are not captured because Playwright is not installed.

To enable screenshot capture:
1. Install Playwright: \`npm install --save-dev playwright\`
2. Install browsers: \`npx playwright install\`
3. Run: \`npm run landing:screenshots\`

Expected screenshots:
- landing-mobile-375px.png
- landing-tablet-768px.png
- landing-desktop-1440px.png
`);

    log('Created placeholder in screenshots directory.', GREEN);
    log('Screenshot capture SKIPPED (no Playwright).\n', YELLOW);

    // Exit with success since this is expected when Playwright is not installed
    process.exit(0);
  }

  // Playwright is available - capture screenshots
  const { chromium } = require('playwright');

  log('Playwright found. Capturing screenshots...', GREEN);

  // Ensure screenshot directory exists
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await chromium.launch();

  try {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height }
      });
      const page = await context.newPage();

      // Load landing page (assumes server is running on port 5050 or 3000)
      let url = 'http://localhost:5050/';
      try {
        await page.goto(url, { timeout: 5000 });
      } catch (e) {
        url = 'http://localhost:3000/';
        await page.goto(url);
      }

      // Wait for content to load
      await page.waitForSelector('.landing-hero', { timeout: 10000 });

      // Capture full page screenshot
      const filename = `landing-${viewport.name}-${viewport.width}px.png`;
      const filepath = path.join(SCREENSHOT_DIR, filename);

      await page.screenshot({
        path: filepath,
        fullPage: true
      });

      log(`  ✓ Captured ${filename}`, GREEN);

      await context.close();
    }

    log('\n✓ All screenshots captured successfully!', GREEN);
    log(`  Location: ${SCREENSHOT_DIR}`, CYAN);

  } catch (error) {
    log(`\nScreenshot capture failed: ${error.message}`, RED);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

captureScreenshots();
