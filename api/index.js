/**
 * Vercel entry point: the whole Express app as one serverless function.
 *
 * `pnpm build` compiles src/ to dist/ (aliases resolved by tsc-alias) before
 * Vercel bundles this file; vercel.json routes every path here. Locally and on
 * long-running hosts the server starts from src/index.ts instead, which also
 * runs the in-process scheduler; on Vercel, cron-job.org calls
 * /api/v1/internal/jobs/* (see DEPLOYMENT.md).
 */
const { createApp } = require('../dist/app');

module.exports = createApp();
