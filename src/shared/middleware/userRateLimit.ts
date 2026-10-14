import { Request, Response, NextFunction } from 'express';

type RateLimitOptions = {
  /** Unique name so separate limiters never share counters. */
  scope: string;
  limit: number;
  windowMs: number;
  message: string;
  /** Key requests by IP even when a user is authenticated (e.g. auth endpoints). */
  byIp?: boolean;
};

type Counter = {
  count: number;
  resetAt: number;
};

/**
 * Fixed-window, in-memory rate limiter.
 *
 * Counters are per-process: with several API replicas the effective limit is
 * multiplied by the replica count. Move to a shared store before scaling out.
 */
export const userRateLimit = ({ scope, limit, windowMs, message, byIp = false }: RateLimitOptions) => {
  const counters = new Map<string, Counter>();
  let lastCleanupAt = 0;

  const keyFor = (req: Request): string => {
    if (!byIp && req.user?.id) return `user:${req.user.id}`;
    return `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
  };

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();

    if (now - lastCleanupAt >= windowMs) {
      for (const [key, counter] of counters) {
        if (counter.resetAt <= now) counters.delete(key);
      }
      lastCleanupAt = now;
    }

    const key = keyFor(req);
    const current = counters.get(key);
    const counter = current && current.resetAt > now ? current : { count: 0, resetAt: now + windowMs };

    counter.count += 1;
    counters.set(key, counter);

    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - counter.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(counter.resetAt / 1000));

    if (counter.count > limit) {
      res.status(429).json({
        success: false,
        message,
        errors: { rate_limit: `Scope ${scope}: retry after ${Math.ceil((counter.resetAt - now) / 1000)}s` },
        retry_after_seconds: Math.ceil((counter.resetAt - now) / 1000),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
};
