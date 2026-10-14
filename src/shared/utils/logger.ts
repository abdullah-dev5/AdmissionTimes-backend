/**
 * Minimal leveled logger.
 *
 * LOG_LEVEL controls verbosity: error | warn | info | debug (default: info,
 * or debug when NODE_ENV=development). Never pass tokens, passwords or full
 * request bodies to the logger.
 */

type Level = 'error' | 'warn' | 'info' | 'debug';

const LEVEL_ORDER: Record<Level, number> = { error: 0, warn: 1, info: 2, debug: 3 };

const resolveLevel = (): Level => {
  const raw = (process.env.LOG_LEVEL || '').toLowerCase();
  if (raw in LEVEL_ORDER) return raw as Level;
  return process.env.NODE_ENV === 'development' ? 'debug' : 'info';
};

const activeLevel = resolveLevel();

const enabled = (level: Level): boolean => LEVEL_ORDER[level] <= LEVEL_ORDER[activeLevel];

const format = (scope: string, message: string): string => `[${scope}] ${message}`;

export const createLogger = (scope: string) => ({
  error: (message: string, meta?: unknown) => {
    if (enabled('error')) console.error(format(scope, message), meta ?? '');
  },
  warn: (message: string, meta?: unknown) => {
    if (enabled('warn')) console.warn(format(scope, message), meta ?? '');
  },
  info: (message: string, meta?: unknown) => {
    if (enabled('info')) console.log(format(scope, message), meta ?? '');
  },
  debug: (message: string, meta?: unknown) => {
    if (enabled('debug')) console.log(format(scope, message), meta ?? '');
  },
});

export type Logger = ReturnType<typeof createLogger>;
