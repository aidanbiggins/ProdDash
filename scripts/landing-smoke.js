#!/usr/bin/env node
/**
 * Landing Page Smoke Test
 *
 * This script verifies that the landing page is correctly built by:
 * 1. Checking that the build directory exists
 * 2. Verifying CSS contains landing page styles
 * 3. Verifying the JS bundle can be loaded
 * 4. Serving the build and checking that the page loads (status 200)
 *
 * Note: Since this is a React SPA, the HTML is just a shell.
 * Content verification requires a headless browser (Playwright not installed).
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

const BUILD_DIR = path.join(__dirname, '..', 'build');
const PORT = 5050;
const LANDING_URL = `http://localhost:${PORT}/`;

// ANSI colors
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

function log(msg, color = RESET) {
  console.log(`${color}${msg}${RESET}`);
}

function checkBuildExists() {
  if (!fs.existsSync(BUILD_DIR)) {
    log('Build directory not found!', RED);
    return false;
  }
  log('✓ Build directory exists', GREEN);
  return true;
}

function checkCSSContainsLandingStyles() {
  const cssDir = path.join(BUILD_DIR, 'static', 'css');
  if (!fs.existsSync(cssDir)) {
    log('CSS directory not found!', RED);
    return false;
  }

  const cssFiles = fs.readdirSync(cssDir).filter(f => f.endsWith('.css'));
  if (cssFiles.length === 0) {
    log('No CSS files found!', RED);
    return false;
  }

  // Read the main CSS file and check for landing page styles
  const mainCss = fs.readFileSync(path.join(cssDir, cssFiles[0]), 'utf8');

  const checks = [
    { name: 'Landing page class', pattern: /\.landing-page/ },
    { name: 'Landing hero', pattern: /\.landing-hero/ },
    { name: 'Landing CTA', pattern: /\.landing-cta-primary/ },
    { name: 'Landing features', pattern: /\.landing-feature/ },
    { name: 'Hero badge', pattern: /\.hero-badge/ },
    { name: 'Focus-visible styles', pattern: /focus-visible/ }
  ];

  let allPassed = true;
  for (const check of checks) {
    if (check.pattern.test(mainCss)) {
      log(`  ✓ ${check.name} found in CSS`, GREEN);
    } else {
      log(`  ✗ ${check.name} not found in CSS`, RED);
      allPassed = false;
    }
  }

  return allPassed;
}

function checkJSBundle() {
  const jsDir = path.join(BUILD_DIR, 'static', 'js');
  if (!fs.existsSync(jsDir)) {
    log('JS directory not found!', RED);
    return false;
  }

  const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js') && !f.includes('.map'));
  if (jsFiles.length === 0) {
    log('No JS files found!', RED);
    return false;
  }

  // Read the main JS file and check for landing page components
  const mainJs = fs.readFileSync(path.join(jsDir, jsFiles[0]), 'utf8');

  const checks = [
    { name: 'Hero content', pattern: /Stop Guessing/ },
    { name: 'Start Knowing', pattern: /Start Knowing/ },
    { name: 'Get Started Free CTA', pattern: /Get Started Free/ },
    { name: 'Features section', pattern: /Everything You Need/ },
    { name: 'CSV badge text', pattern: /CSV to insights/ }
  ];

  let allPassed = true;
  for (const check of checks) {
    if (check.pattern.test(mainJs)) {
      log(`  ✓ ${check.name} found in JS bundle`, GREEN);
    } else {
      log(`  ✗ ${check.name} not found in JS bundle`, RED);
      allPassed = false;
    }
  }

  return allPassed;
}

async function checkServerResponse() {
  return new Promise(async (resolve) => {
    let server;

    try {
      const serveHandler = require('serve-handler');

      server = http.createServer((req, res) => {
        return serveHandler(req, res, {
          public: BUILD_DIR,
          cleanUrls: true,
          rewrites: [{ source: '**', destination: '/index.html' }]
        });
      });

      server.on('error', (err) => {
        log(`Server error: ${err.message}`, RED);
        resolve(false);
      });

      server.listen(PORT, async () => {
        log(`Server started on port ${PORT}`, CYAN);

        // Wait for server to be ready
        await new Promise(r => setTimeout(r, 500));

        try {
          const fetch = (await import('node-fetch')).default;
          const response = await fetch(LANDING_URL);

          if (response.status === 200) {
            log(`  ✓ Page loads successfully (status 200)`, GREEN);

            // Check that HTML shell contains required elements
            const html = await response.text();
            if (html.includes('<div id="root">')) {
              log(`  ✓ React root element present`, GREEN);
            } else {
              log(`  ✗ React root element missing`, RED);
              resolve(false);
              return;
            }

            if (html.includes('/static/js/') && html.includes('/static/css/')) {
              log(`  ✓ Static assets referenced`, GREEN);
            } else {
              log(`  ✗ Static assets not referenced`, RED);
              resolve(false);
              return;
            }

            resolve(true);
          } else {
            log(`  ✗ Page returned status ${response.status}`, RED);
            resolve(false);
          }
        } catch (err) {
          log(`Fetch error: ${err.message}`, RED);
          resolve(false);
        } finally {
          server.close();
          log('Server stopped', CYAN);
        }
      });
    } catch (err) {
      log(`Server setup error: ${err.message}`, RED);
      if (server) server.close();
      resolve(false);
    }
  });
}

async function runSmokeTest() {
  log('\nLanding Page Smoke Test', CYAN);
  log('=======================\n');

  let exitCode = 0;

  // Check 1: Build exists
  log('1. Checking build directory...', YELLOW);
  if (!checkBuildExists()) {
    log('\nBuild directory missing. Run: npm run build', RED);
    process.exit(1);
  }

  // Check 2: CSS contains landing styles
  log('\n2. Checking CSS for landing page styles...', YELLOW);
  if (!checkCSSContainsLandingStyles()) {
    exitCode = 1;
  }

  // Check 3: JS bundle contains landing content
  log('\n3. Checking JS bundle for landing page content...', YELLOW);
  if (!checkJSBundle()) {
    exitCode = 1;
  }

  // Check 4: Server serves the page
  log('\n4. Starting server and checking response...', YELLOW);
  if (!await checkServerResponse()) {
    exitCode = 1;
  }

  // Summary
  if (exitCode === 0) {
    log('\n✓ Landing page smoke test PASSED', GREEN);
  } else {
    log('\n✗ Landing page smoke test FAILED', RED);
  }

  process.exit(exitCode);
}

runSmokeTest();
