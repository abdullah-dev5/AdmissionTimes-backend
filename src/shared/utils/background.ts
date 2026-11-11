/**
 * Work that should finish after the HTTP response is sent (notifications,
 * emails, activity tracking).
 *
 * On a long-running server it simply runs. On Vercel, a function is frozen
 * once it has responded, so unfinished work could be lost: `waitUntil` keeps
 * the function alive until the promise settles. Errors are logged, never
 * thrown (background work must not fail the request that started it).
 */

import { waitUntil } from '@vercel/functions';
import { createLogger } from './logger';

const log = createLogger('Background');

export const runInBackground = (label: string, work: Promise<unknown> | (() => Promise<unknown>)): void => {
  const promise = (typeof work === 'function' ? work() : work).catch((error) => {
    log.error(`${label} failed`, (error as Error)?.message ?? error);
  });
  try {
    waitUntil(promise);
  } catch {
    // Not on Vercel: the promise runs on its own.
  }
};
