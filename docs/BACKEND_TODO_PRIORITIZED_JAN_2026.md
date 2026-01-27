# Backend TODO List – Prioritized (Phase 4C & Beyond)
**Generated:** January 27, 2026  
**Context:** MVP Complete (Phases 1–5); Security, Testing, DevOps Pending  
**Principles:** Fix foundational issues first; then feature integration; security is non-negotiable before production

---

## 🔴 CRITICAL (P0) – Block Production Deployment

### Phase 4C-1: Real Authentication (Supabase JWT)
**Impact:** All endpoints currently use mock headers; no real user enforcement.  
**Effort:** 3–4 days  
**Dependencies:** Supabase Auth already provisioned; config.ts has SUPABASE_JWT_SECRET env var ready

#### Tasks:
- [ ] **4C-1.1:** Create `src/shared/middleware/jwtAuth.ts`
  - Validate JWT token from `Authorization: Bearer <token>` header
  - Extract claims: sub (user_id), role, org_id (university_id)
  - Replace mockAuth middleware in `src/index.ts`
  - Reject requests without valid token (401)
  - Error response: `{ success: false, message: "Unauthorized", errors: { auth: "Invalid token" } }`

- [ ] **4C-1.2:** Update `src/config/constants.ts`
  - Add `JWT_ISSUER = 'https://supabase-url.supabase.co'` (use env var)
  - Add `JWT_ALGORITHM = 'HS256'` (Supabase default)
  - Add `JWT_EXPIRY_TOLERANCE = 300` (5 min clock skew)

- [ ] **4C-1.3:** Add env vars to `env.example`
  ```
  SUPABASE_JWT_SECRET=your_secret_here
  SUPABASE_URL=https://your-project.supabase.co
  SUPABASE_JWT_ISSUER=https://your-project.supabase.co
  JWT_ALGORITHM=HS256
  ```

- [ ] **4C-1.4:** Wire real user IDs in services
  - Admissions: set `created_by = req.user.id` (currently not used)
  - Notifications: set `user_id = req.user.id` (currently mock)
  - Changelogs: set `changed_by = req.user.id` (currently mock)
  - User Activity: set user_id to actual user

- [ ] **4C-1.5:** Update RLS policies in `supabase/migrations/`
  - Students can only see own admissions (verified), own watchlists, own notifications
  - Universities can see own admissions, own changelogs, own notifications
  - Admins can see all

- [ ] **4C-1.6:** Test JWT flow
  - Get token from Supabase Auth signup/login
  - Send token in Authorization header
  - Verify user context is correctly extracted
  - Verify RLS policies enforce isolation

---

### Phase 4C-2: CORS Configuration
**Impact:** Frontend requests blocked if on different domain/port.  
**Effort:** 1 day  
**Dependencies:** express-cors package (already installed? verify in package.json)

#### Tasks:
- [ ] **4C-2.1:** Install `cors` if not present
  ```bash
  pnpm add cors
  pnpm add -D @types/cors
  ```

- [ ] **4C-2.2:** Create `src/shared/middleware/corsConfig.ts`
  ```typescript
  import cors from 'cors';

  const allowedOrigins = [
    'http://localhost:3001',      // Frontend dev
    'http://localhost:3000',      // Frontend prod local
    'https://admissiontimes.com', // Production
    process.env.FRONTEND_URL      // Env override
  ];

  export const corsMiddleware = cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-user-role', 'x-university-id'],
    exposedHeaders: ['x-total-count', 'x-page', 'x-limit'],
    maxAge: 86400 // 24 hours
  });
  ```

- [ ] **4C-2.3:** Register in `src/index.ts` (before routes)
  ```typescript
  app.use(corsMiddleware);
  ```

- [ ] **4C-2.4:** Test CORS
  - Send preflight request from frontend
  - Verify Access-Control-Allow-Origin response
  - Verify credentials accepted

---

### Phase 4C-3: Rate Limiting
**Impact:** No protection against brute force, DDoS, or abuse.  
**Effort:** 1–2 days  
**Dependencies:** `express-rate-limit` package

#### Tasks:
- [ ] **4C-3.1:** Install `express-rate-limit`
  ```bash
  pnpm add express-rate-limit
  ```

- [ ] **4C-3.2:** Create `src/shared/middleware/rateLimiter.ts`
  ```typescript
  import rateLimit from 'express-rate-limit';

  // General limiter: 100 requests per 15 min per IP
  export const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.',
    statusCode: 429,
    standardHeaders: true, // Return rate limit info in RateLimit-* headers
    legacyHeaders: false   // Disable X-RateLimit-* headers
  });

  // Auth limiter: 5 failed attempts per 15 min per IP
  export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    skipSuccessfulRequests: true
  });

  // Strict limiter: 10 requests per min per IP (for create/update operations)
  export const strictLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10
  });
  ```

- [ ] **4C-3.3:** Register limiters in `src/index.ts`
  ```typescript
  app.use(generalLimiter);
  app.use('/api/v1/auth/login', authLimiter);
  app.use('/api/v1/auth/signup', authLimiter);
  app.use('/api/v1/admissions', strictLimiter);  // For POST/PUT/PATCH
  ```

- [ ] **4C-3.4:** Test rate limiting
  - Send >100 requests in 15 min
  - Verify 429 status code
  - Verify rate limit headers

---

### Phase 4C-4: Security Headers (Helmet)
**Impact:** Missing critical HTTP security headers (CSP, HSTS, X-Frame-Options, etc.).  
**Effort:** 1 day  
**Dependencies:** `helmet` package

#### Tasks:
- [ ] **4C-4.1:** Install `helmet`
  ```bash
  pnpm add helmet
  ```

- [ ] **4C-4.2:** Configure in `src/index.ts`
  ```typescript
  import helmet from 'helmet';
  
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://'],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"]
      }
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    frameguard: { action: 'deny' },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  }));
  ```

- [ ] **4C-4.3:** Verify headers in response
  ```bash
  curl -i http://localhost:3000/health
  # Check for Strict-Transport-Security, Content-Security-Policy, X-Frame-Options, etc.
  ```

---

### Phase 4C-5: Input Sanitization & Validation Hardening
**Impact:** XSS, SQL injection, and data corruption risks (though parameterized SQL helps).  
**Effort:** 2 days  
**Dependencies:** `xss`, `validator` packages

#### Tasks:
- [ ] **4C-5.1:** Install packages
  ```bash
  pnpm add xss validator
  pnpm add -D @types/xss
  ```

- [ ] **4C-5.2:** Create `src/shared/utils/sanitizer.ts`
  ```typescript
  import xss from 'xss';
  import validator from 'validator';

  export const sanitizeString = (str: string): string => {
    return xss(str.trim(), {
      whiteList: {},     // No HTML allowed
      stripIgnoredTag: true
    });
  };

  export const sanitizeEmail = (email: string): string => {
    return validator.normalizeEmail(email);
  };

  export const sanitizeUrl = (url: string): string => {
    if (!validator.isURL(url)) throw new Error('Invalid URL');
    return url;
  };

  export const sanitizeObject = (obj: any): any => {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  };
  ```

- [ ] **4C-5.3:** Update validators in each domain
  - Wrap strings in `sanitizeString()` before DB insert
  - Example: `title: Joi.string().custom(sanitizeString).required()`
  - Apply to: title, description, location, reason fields in admissions, notifications, etc.

- [ ] **4C-5.4:** Update Joi schemas
  - Add `.trim()` to all string fields
  - Add `.lowercase()` to email fields
  - Add `.min(1).max(500)` to constrain length

- [ ] **4C-5.5:** Test sanitization
  - Send `<script>alert('xss')</script>` in title field
  - Verify it's stored as plain text, not HTML
  - Verify output doesn't execute as code

---

## 🟠 HIGH (P1) – Fix Before Next Release

### Phase 4C-6: Structured Logging (Pino or Winston)
**Impact:** No request tracing, audit logs, or performance metrics; debugging prod issues difficult.  
**Effort:** 2–3 days  
**Dependencies:** `pino` or `winston`

#### Tasks:
- [ ] **4C-6.1:** Install `pino`
  ```bash
  pnpm add pino pino-http
  pnpm add -D pino-pretty
  ```

- [ ] **4C-6.2:** Create `src/shared/middleware/logger.ts`
  ```typescript
  import pino from 'pino';
  import pinoHttp from 'pino-http';

  const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        singleLine: false,
        translateTime: 'SYS:standard'
      }
    }
  });

  export const httpLogger = pinoHttp({
    logger: logger,
    autoLogging: true,
    serializers: {
      req: (req) => ({
        method: req.method,
        path: req.url,
        userId: req.user?.id,
        userRole: req.user?.role,
        headers: {
          host: req.headers.host,
          'user-agent': req.headers['user-agent']
        }
      }),
      res: (res) => ({
        statusCode: res.statusCode,
        responseTime: res.responseTime
      })
    }
  });

  export default logger;
  ```

- [ ] **4C-6.3:** Register in `src/index.ts`
  ```typescript
  import { httpLogger } from './shared/middleware/logger';
  
  app.use(httpLogger);
  ```

- [ ] **4C-6.4:** Replace all `console.log()` with logger calls in services
  ```typescript
  // Before:
  console.log('User verified admission:', admissionId);

  // After:
  logger.info({ admissionId, userId: req.user.id }, 'User verified admission');
  ```

- [ ] **4C-6.5:** Add correlation IDs
  - Each request gets unique ID
  - Log ID in all related logs
  - Return in response headers for tracing

- [ ] **4C-6.6:** Test logging
  - Send request to API
  - Verify logs include method, path, statusCode, responseTime
  - Verify user context is logged

---

### Phase 4C-7: Error Code Taxonomy & Standardization
**Impact:** Inconsistent error messages; hard for frontend to handle errors programmatically.  
**Effort:** 2 days

#### Tasks:
- [ ] **4C-7.1:** Create `src/shared/constants/errorCodes.ts`
  ```typescript
  export const ERROR_CODES = {
    // Auth errors
    AUTH_INVALID_TOKEN: 'AUTH_001',
    AUTH_TOKEN_EXPIRED: 'AUTH_002',
    AUTH_MISSING_HEADER: 'AUTH_003',
    AUTH_INVALID_CREDENTIALS: 'AUTH_004',

    // Validation errors
    VALIDATION_FAILED: 'VAL_001',
    INVALID_EMAIL: 'VAL_002',
    INVALID_DATE: 'VAL_003',

    // Access control
    FORBIDDEN_INSUFFICIENT_ROLE: 'ACCESS_001',
    FORBIDDEN_NOT_OWNER: 'ACCESS_002',
    FORBIDDEN_ARCHIVED: 'ACCESS_003',

    // Not found
    RESOURCE_NOT_FOUND: 'NOT_FOUND_001',
    USER_NOT_FOUND: 'NOT_FOUND_002',
    ADMISSION_NOT_FOUND: 'NOT_FOUND_003',

    // Business logic
    ADMISSION_INVALID_STATE_TRANSITION: 'BIZ_001',
    ADMISSION_ALREADY_VERIFIED: 'BIZ_002',
    ADMISSION_CANNOT_DISPUTE_NON_REJECTED: 'BIZ_003',

    // Server errors
    INTERNAL_SERVER_ERROR: 'ERR_500',
    DATABASE_ERROR: 'ERR_DB',
    EXTERNAL_SERVICE_ERROR: 'ERR_EXT'
  };
  ```

- [ ] **4C-7.2:** Update error responses to include code
  ```json
  {
    "success": false,
    "message": "Admission cannot be verified; already in verified state",
    "code": "BIZ_002",
    "errors": { "status": "Invalid state transition" },
    "timestamp": "2026-01-27T..."
  }
  ```

- [ ] **4C-7.3:** Update `src/shared/middleware/errorHandler.ts`
  - Map error messages to codes
  - Return code in error response

- [ ] **4C-7.4:** Create frontend-facing error documentation
  - List all error codes with descriptions
  - Include recovery steps (e.g., "User must be logged in")

---

### Phase 4C-8: Unit & Integration Tests (Jest or Vitest)
**Impact:** No automated quality gates; regressions not caught; refactoring risky.  
**Effort:** 4–5 days  
**Dependencies:** `vitest` (faster) or `jest`

#### Tasks:
- [ ] **4C-8.1:** Install Vitest
  ```bash
  pnpm add -D vitest @vitest/ui @testing-library/node
  ```

- [ ] **4C-8.2:** Configure `vitest.config.ts`
  ```typescript
  import { defineConfig } from 'vitest/config';

  export default defineConfig({
    test: {
      globals: true,
      environment: 'node',
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    }
  });
  ```

- [ ] **4C-8.3:** Create test structure
  ```
  tests/
  ├── unit/
  │   ├── admissions.service.test.ts
  │   ├── notifications.service.test.ts
  │   └── ...
  ├── integration/
  │   ├── admissions.api.test.ts (hit real endpoints)
  │   ├── auth.test.ts (JWT validation)
  │   └── ...
  └── helpers/
      ├── db.ts (seed test DB)
      ├── auth.ts (create test tokens)
      └── fixtures.ts (mock data)
  ```

- [ ] **4C-8.4:** Write unit tests for admissions service
  - Test status transitions (draft → pending → verified)
  - Test rejection with reason
  - Test dispute logic
  - Test changelog creation
  - Coverage: ≥80%

- [ ] **4C-8.5:** Write integration tests
  - Test full admission lifecycle (create → submit → verify → verify endpoint returns verified)
  - Test auth: invalid token → 401, valid token → 200
  - Test CORS: preflight returns correct headers
  - Test rate limiting: >100 requests → 429

- [ ] **4C-8.6:** Setup coverage gates
  - Add to `package.json` scripts: `"test:coverage"` with --coverage flag
  - Fail CI if coverage <80%

- [ ] **4C-8.7:** Add test script to package.json
  ```json
  {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
  ```

---

### Phase 4C-9: Health & Readiness Checks
**Impact:** Load balancers, Kubernetes, and DevOps can't determine if service is healthy.  
**Effort:** 1 day

#### Tasks:
- [ ] **4C-9.1:** Create `src/domain/health/health.controller.ts`
  ```typescript
  export const healthCheck = async (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0'
    });
  };

  export const readinessCheck = async (req: Request, res: Response) => {
    try {
      // Test DB connection
      const result = await pool.query('SELECT 1');
      res.json({
        status: 'ready',
        database: 'connected',
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      res.status(503).json({
        status: 'not_ready',
        database: 'disconnected',
        error: err.message
      });
    }
  };
  ```

- [ ] **4C-9.2:** Register routes in `src/index.ts`
  ```typescript
  app.get('/health', healthCheck);
  app.get('/ready', readinessCheck);
  ```

- [ ] **4C-9.3:** Test endpoints
  ```bash
  curl http://localhost:3000/health
  curl http://localhost:3000/ready
  ```

---

## 🟡 MEDIUM (P2) – Do Before Production

### Phase 4C-10: Environment Validation & Startup Checks
**Effort:** 1 day

#### Tasks:
- [ ] **4C-10.1:** Create `src/config/envValidation.ts`
  ```typescript
  const requiredEnvVars = [
    'DATABASE_URL',
    'SUPABASE_JWT_SECRET',
    'SUPABASE_URL',
    'NODE_ENV'
  ];

  const optionalEnvVars = [
    'LOG_LEVEL',
    'FRONTEND_URL',
    'CORS_ORIGINS'
  ];

  export const validateEnv = () => {
    const missing: string[] = [];
    requiredEnvVars.forEach(env => {
      if (!process.env[env]) missing.push(env);
    });
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  };
  ```

- [ ] **4C-10.2:** Call in `src/index.ts` before server starts
  ```typescript
  import { validateEnv } from './config/envValidation';

  validateEnv();
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  ```

---

### Phase 4C-11: API Documentation Enhancements
**Effort:** 2 days

#### Tasks:
- [ ] **4C-11.1:** Update Swagger with auth requirements
  - Mark endpoints requiring JWT
  - Document error responses (400, 401, 403, 404, 500) with examples

- [ ] **4C-11.2:** Create API Usage Guide
  - Sample requests (with curl, JavaScript fetch, etc.)
  - Error handling patterns
  - Pagination examples
  - Date/time handling

- [ ] **4C-11.3:** Create Versioning Strategy doc
  - When to bump major/minor/patch
  - Backward compatibility rules
  - Deprecation timeline

---

### Phase 4C-12: Ownership Wiring (Once Auth Works)
**Effort:** 1–2 days (do after 4C-1)

#### Tasks:
- [ ] **4C-12.1:** Add `created_by` FK to admissions
  ```sql
  ALTER TABLE admissions ADD COLUMN created_by UUID NOT NULL DEFAULT NULL;
  ALTER TABLE admissions ADD CONSTRAINT fk_admissions_created_by FOREIGN KEY (created_by) REFERENCES users(id);
  ```

- [ ] **4C-12.2:** Update admissions service to set created_by
  - When creating: `created_by = req.user.id`
  - When updating: only if created_by = req.user.id or user is admin

- [ ] **4C-12.3:** Do same for notifications, user_activity, changelogs

---

## 🟢 LOW (P3) – Nice-to-Have / Optimization

### Phase 5-1: Docker & Docker Compose
**Effort:** 2 days

#### Tasks:
- [ ] **5-1.1:** Create `Dockerfile`
  ```dockerfile
  FROM node:18-alpine
  WORKDIR /app
  COPY package*.json pnpm-lock.yaml ./
  RUN npm install -g pnpm && pnpm install --frozen-lockfile
  COPY . .
  RUN pnpm build
  EXPOSE 3000
  CMD ["node", "dist/index.js"]
  ```

- [ ] **5-1.2:** Create `docker-compose.yml`
  ```yaml
  version: '3.8'
  services:
    api:
      build: .
      ports:
        - "3000:3000"
      environment:
        DATABASE_URL: postgresql://user:pass@postgres:5432/admissiontimes
        NODE_ENV: development
      depends_on:
        - postgres
    postgres:
      image: postgres:15
      environment:
        POSTGRES_PASSWORD: password
        POSTGRES_DB: admissiontimes
      volumes:
        - postgres_data:/var/lib/postgresql/data
  volumes:
    postgres_data:
  ```

---

### Phase 5-2: CI/CD Pipeline (GitHub Actions)
**Effort:** 2–3 days

#### Tasks:
- [ ] **5-2.1:** Create `.github/workflows/test.yml`
  ```yaml
  name: Test
  on: [push, pull_request]
  jobs:
    test:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v3
        - uses: pnpm/action-setup@v2
        - uses: actions/setup-node@v3
          with:
            node-version: 18
            cache: 'pnpm'
        - run: pnpm install
        - run: pnpm lint
        - run: pnpm test:coverage
        - run: pnpm build
  ```

- [ ] **5-2.2:** Create `.github/workflows/deploy.yml` (deploy to cloud)

---

### Phase 5-3: Query Optimization & Indexing
**Effort:** 2–3 days

#### Tasks:
- [ ] **5-3.1:** Review slow queries (add query logging)
- [ ] **5-3.2:** Add indexes
  ```sql
  CREATE INDEX idx_admissions_verification_status ON admissions(verification_status);
  CREATE INDEX idx_admissions_created_by ON admissions(created_by);
  CREATE INDEX idx_notifications_user_id ON notifications(user_type);
  CREATE INDEX idx_deadlines_admission_id ON deadlines(admission_id);
  ```

---

### Phase 5-4: Optional Caching (Redis)
**Effort:** 3–4 days (only if justified by metrics)

#### Tasks:
- [ ] **5-4.1:** Setup Redis
- [ ] **5-4.2:** Cache frequently accessed data (user profiles, verified admissions list)
- [ ] **5-4.3:** Implement cache invalidation on updates

---

## 🟢 OPTIONAL PRODUCT FEATURES (Phase 6) – Future Enhancements

### Phase 6-1: AI Chat Endpoint
**Priority:** 🟢 LOW (P3)  
**Effort:** 3–4 days  
**Context:** Frontend contract references `/student/ai/chat` – not yet implemented

#### Tasks:
- [ ] **6-1.1:** Setup OpenAI/Anthropic API integration
  - Add API key to env vars (`OPENAI_API_KEY`)
  - Install SDK (`pnpm add openai`)
  - Create `src/config/openai.ts` with client setup

- [ ] **6-1.2:** Create AI chat endpoint
  ```typescript
  POST /api/v1/student/ai/chat
  Request: {
    message: "I want to study computer science in UK",
    context?: {
      user_filters: {...},
      watchlist_ids: [...],
      recent_activity: [...]
    }
  }
  Response: {
    reply: "Based on your interests, here are 3 programs...",
    suggested_admissions: ["uuid1", "uuid2", "uuid3"],
    follow_up_questions: ["What's your budget?", "Do you prefer London?"]
  }
  ```

- [ ] **6-1.3:** Design context-aware prompts
  - Include user's saved filters (location, degree, field)
  - Include watchlisted admissions
  - Include user's role and preferences

- [ ] **6-1.4:** Rate limiting for AI calls
  - 20 chat messages per day per user
  - Track in `user_activity` or Redis
  - Return 429 if exceeded

- [ ] **6-1.5:** Cost monitoring
  - Log token usage to analytics
  - Add dashboard for AI costs per user

---

### Phase 6-2: Scraper Management Endpoints
**Priority:** 🟢 LOW (P3)  
**Effort:** 2–3 days  
**Context:** Frontend contract references `/admin/scraper/*` – not yet implemented

#### Tasks:
- [ ] **6-2.1:** Create scraper jobs table
  ```sql
  CREATE TABLE scraper_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'pending', -- pending/running/completed/failed
    records_found INT DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```

- [ ] **6-2.2:** Create scraper controller + service + model
  - `src/domain/scraper/scraper.controller.ts`
  - `src/domain/scraper/scraper.service.ts`
  - `src/domain/scraper/scraper.model.ts`

- [ ] **6-2.3:** Add scraper endpoints
  ```typescript
  GET /api/v1/admin/scraper/logs
  Query: ?university_id=uuid&status=completed&page=1&limit=20
  Response: { jobs: [...], pagination: {...} }

  POST /api/v1/admin/scraper/trigger
  Body: { university_id: "uuid", options: {...} }
  Response: { job_id: "uuid", status: "pending" }
  ```

- [ ] **6-2.4:** Wire scraper job queue
  - Use background job queue (e.g., Bull + Redis)
  - Queue job on trigger; process async
  - Update job status in scraper_jobs table

- [ ] **6-2.5:** Notify on completion
  - Create notification for admin when job completes
  - Include records_found count in notification

---

### Phase 6-3: Admin Bulk Notification Send
**Priority:** 🟡 MEDIUM (P2)  
**Effort:** 1 day  
**Context:** Current `POST /notifications` creates single notification; need bulk send

#### Tasks:
- [ ] **6-3.1:** Enhance `POST /api/v1/notifications` endpoint
  - Add `recipient_type` param: `all_students` | `all_universities` | `specific_user`
  - Add `recipient_id` param (if `specific_user`)
  - If bulk: query all users matching type; insert notification for each
  - Return `{ recipients_count: 150, notification_ids: [...] }`

- [ ] **6-3.2:** Add admin-only validation
  - Verify `req.user.role === 'admin'` before allowing bulk send
  - Return 403 if non-admin tries bulk

- [ ] **6-3.3:** Rate limit bulk sends
  - Max 5 bulk sends per hour per admin
  - Track in user_activity or Redis

---

### Phase 6-4: Featured Admissions & Tags
**Priority:** 🟢 LOW (P3)  
**Effort:** 2 days  
**Context:** Frontend contract references `is_featured` and `tags` – not yet implemented

#### Tasks:
- [ ] **6-4.1:** Add fields to admissions table
  ```sql
  ALTER TABLE admissions
  ADD COLUMN is_featured BOOLEAN DEFAULT FALSE,
  ADD COLUMN tags JSONB DEFAULT '[]';
  
  CREATE INDEX idx_admissions_is_featured ON admissions(is_featured);
  CREATE INDEX idx_admissions_tags ON admissions USING GIN (tags);
  ```

- [ ] **6-4.2:** Add filtering to `GET /admissions`
  - `?is_featured=true` – return only featured admissions
  - `?tags=scholarship,stem` – return admissions with matching tags

- [ ] **6-4.3:** Add admin endpoint to toggle featured
  ```typescript
  PATCH /api/v1/admin/admissions/:id/feature
  Body: { is_featured: true }
  Response: { success: true, admission: {...} }
  ```

- [ ] **6-4.4:** Add admin endpoint to update tags
  ```typescript
  PATCH /api/v1/admin/admissions/:id/tags
  Body: { tags: ["scholarship", "stem", "uk"] }
  Response: { success: true, admission: {...} }
  ```

---

### Phase 6-5: Analytics/Views Tracking
**Priority:** 🟡 MEDIUM (P2)  
**Effort:** 1–2 days  
**Context:** Frontend contract references `views` field – not yet tracked

#### Tasks:
- [ ] **6-5.1:** Add views column to admissions table
  ```sql
  ALTER TABLE admissions ADD COLUMN views INT DEFAULT 0;
  CREATE INDEX idx_admissions_views ON admissions(views);
  ```

- [ ] **6-5.2:** Increment views on `GET /admissions/:id`
  - Add middleware to track unique views per user per admission (debounce 1 hour)
  - Store in Redis: `view:admission:{id}:user:{user_id}` with 1-hour TTL
  - If key doesn't exist: increment `views` count in DB, set key

- [ ] **6-5.3:** Add `watchlist_count` computed field
  - On `GET /admissions` or `GET /admissions/:id`, add SQL:
    ```sql
    SELECT a.*, COUNT(w.id) AS watchlist_count
    FROM admissions a
    LEFT JOIN watchlists w ON w.admission_id = a.id
    WHERE a.id = $1
    GROUP BY a.id;
    ```

- [ ] **6-5.4:** Expose in admission responses
  - Add `views` and `watchlist_count` to admission schema
  - Update Swagger docs

---

### Phase 6-6: Changelog Enhancements
**Priority:** 🟡 MEDIUM (P2)  
**Effort:** 1 day  
**Context:** Merge frontend contract needs with backend best practices

#### Tasks:
- [ ] **6-6.1:** Add `reason` column to changelogs table
  ```sql
  ALTER TABLE changelogs ADD COLUMN reason TEXT;
  ```

- [ ] **6-6.2:** Accept `reason` in admission update requests
  - When `PUT /admissions/:id` or `PATCH /admissions/:id/*` includes `reason` param
  - Store in changelog record

- [ ] **6-6.3:** Add `changed_by_name` via JOIN
  - In `ChangelogService.getChangelogs()`, JOIN users table:
    ```sql
    SELECT c.*, u.username AS changed_by_name
    FROM changelogs c
    LEFT JOIN users u ON u.id = c.changed_by
    WHERE c.admission_id = $1
    ORDER BY c.created_at DESC;
    ```
  - Return `changed_by_name` in response

- [ ] **6-6.4:** Keep `diff_summary` as primary display
  - Frontend should use `diff_summary` for main message
  - Show `reason` (if provided) as secondary detail

---

## Summary by Phase

| Phase | Focus | Duration | Owner |
|-------|-------|----------|-------|
| **4C-1 to 4C-5** | Security (Auth, CORS, Rate Limiting, Helmet, Sanitization) | 1 week | Backend |
| **4C-6 to 4C-9** | Observability & Quality (Logging, Error Codes, Tests, Health) | 2 weeks | Backend |
| **4C-10 to 4C-12** | Polish & Ownership (Env Validation, Docs, Ownership Wiring) | 1 week | Backend |
| **Phase 5** | DevOps & Optimization (Docker, CI/CD, Query Optimization, Caching) | 2–3 weeks | DevOps + Backend |
| **Phase 6** | Product Features (AI Chat, Scraper, Bulk Notifications, Tags, Views, Changelog Enhancements) | 2–3 weeks | Backend + Product |

---

## Quick Start (Immediate Actions)

1. **Today:** Start 4C-1 (JWT auth) – blocks real user enforcement
2. **This Week:** Complete 4C-1 through 4C-5 (security critical)
3. **Next Week:** Complete 4C-6 through 4C-9 (quality gates)
4. **Before Prod:** Complete 4C-10 through 4C-12 (polish)
5. **Release:** Phase 5 (DevOps) as bandwidth allows

---

**Report Generated:** January 27, 2026  
**For:** Backend Team  
**Status:** Ready for Implementation
