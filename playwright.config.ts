import process from 'node:process'
import { defineConfig } from '@playwright/test'

/**
 * Smoke tests for the panel in a real browser (ADR-025, phase 5), run against
 * a dev server that is already up, like the API suites:
 *
 *   E2E_URL=http://localhost:3000 pnpm e2e
 *
 * No browser is downloaded: the tests drive the installed Microsoft Edge
 * (`E2E_CHANNEL=chrome` for Google Chrome). They sign in with the local dev
 * accounts and the authenticator secrets the API harness keeps in
 * `.demo/.data/test-staff.json`, so they belong to a local database only.
 */
const baseURL = (process.env.E2E_URL ?? process.env.CMS_TEST_URL ?? 'http://localhost:3000').replace(/\/$/, '')

// The API harness the tests share reads its server from here.
process.env.CMS_TEST_URL = baseURL

export default defineConfig({
  testDir: '.demo/tests/e2e',
  // The suites share accounts and authenticator steps, so they run one at a time.
  workers: 1,
  fullyParallel: false,
  // A dev server compiles each page on first visit.
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  use: {
    baseURL,
    channel: process.env.E2E_CHANNEL ?? 'msedge',
    headless: true,
    viewport: { width: 1440, height: 900 },
    navigationTimeout: 90_000,
    trace: 'retain-on-failure',
  },
  outputDir: '.demo/.data/e2e-results',
})
