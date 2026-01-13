# Phase 4: Additional Domains & System Enhancements - Planning Document

**Planning Date:** January 2025  
**Phase:** Additional Domains + System Enhancements  
**Status:** Ready to Begin  
**Estimated Completion:** ~60% of total backend implementation  
**Prerequisites:** Phase 3 (Admissions Domain) must be complete

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Phase 4 Overview](#phase-4-overview)
3. [Domain Implementations](#domain-implementations)
4. [Technical Enhancements](#technical-enhancements)
5. [Database Context](#database-context)
6. [Implementation Order](#implementation-order)
7. [API Endpoints by Domain](#api-endpoints-by-domain)
8. [Integration Points](#integration-points)
9. [File Structure](#file-structure)
10. [Acceptance Criteria](#acceptance-criteria)
11. [Testing Strategy](#testing-strategy)
12. [Documentation Requirements](#documentation-requirements)

---

## 🎯 Executive Summary

Phase 4 extends the AdmissionTimes backend with **5 additional domains** and **critical system enhancements**. This phase transforms the platform from a basic CRUD system into a complete, production-ready application with user management, notifications, deadlines, analytics, and comprehensive changelog access.

### Key Objectives

- ✅ **Users Domain** - Real authentication, user management, profiles
- ✅ **Notifications Domain** - Notification generation, delivery, read tracking
- ✅ **Deadlines Domain** - Deadline calculations, calendar data, urgency levels
- ✅ **Analytics Domain** - Event tracking, aggregation, statistics
- ✅ **Changelogs API** - Standalone changelog endpoints with filtering
- ✅ **System Enhancements** - Real auth, structured logging, testing, security

### Success Metrics

- 5 new domains implemented
- Real authentication replacing mock auth
- Comprehensive test coverage (>80%)
- Production-ready security features
- Complete API documentation

---

## 📊 Phase 4 Overview

### Scope

**✅ Included in Phase 4:**

1. **Users Domain**
   - User CRUD operations
   - Real Supabase Auth integration
   - User profiles management
   - Role management
   - User preferences

2. **Notifications Domain**
   - Notification generation
   - Notification delivery
   - Mark as read/unread
   - Notification preferences
   - Notification history

3. **Deadlines Domain**
   - Deadline calculations
   - Days remaining calculation
   - Urgency level determination
   - Calendar data generation
   - Deadline reminders

4. **Analytics Domain**
   - Event tracking
   - Aggregation queries
   - Statistics endpoints
   - User activity tracking
   - Admission views tracking

5. **Changelogs Domain API**
   - Standalone changelog endpoints
   - Changelog filtering
   - Changelog search
   - Changelog pagination

6. **System Enhancements**
   - Real authentication (Supabase Auth)
   - Structured logging (winston/pino)
   - Unit and integration tests
   - Rate limiting
   - CORS configuration
   - API documentation (OpenAPI/Swagger)

**❌ Excluded from Phase 4:**

- Real-time features (WebSockets)
- File uploads
- Advanced search (Elasticsearch)
- Caching layer (Redis)
- Background jobs (Bull/BullMQ)
- Email notifications (basic in-app only)

---

## 🏗️ Domain Implementations

### 1. Users Domain

#### Purpose
Manage users, authentication, and user profiles. Replace mock auth with real Supabase Auth.

#### Features

**Authentication:**
- ✅ Supabase Auth integration
- ✅ JWT token validation
- ✅ Refresh token handling
- ✅ User session management
- ✅ Password reset (via Supabase)

**User Management:**
- ✅ Get user profile
- ✅ Update user profile
- ✅ User preferences
- ✅ User roles (student, university, admin)
- ✅ University association

**API Endpoints:**
```
GET    /api/v1/users/me              # Get current user
PUT    /api/v1/users/me               # Update current user
GET    /api/v1/users/:id               # Get user (admin)
GET    /api/v1/users                   # List users (admin)
PATCH  /api/v1/users/:id/role          # Update role (admin)
```

**Database Tables:**
- `users` (from Supabase Auth)
- `user_profiles` (extended profile data)
- `user_preferences` (user settings)

**Integration Points:**
- Replace `mockAuth` middleware with real Supabase Auth
- Update all domains to use real user context
- Integrate with admissions domain (created_by, verified_by)

---

### 2. Notifications Domain

#### Purpose
Generate and manage notifications for users based on system events.

#### Features

**Notification Types:**
- ✅ Admission verified
- ✅ Admission rejected
- ✅ Admission disputed
- ✅ Deadline approaching
- ✅ System updates

**Notification Management:**
- ✅ Get user notifications
- ✅ Mark as read/unread
- ✅ Delete notification
- ✅ Notification preferences
- ✅ Unread count

**API Endpoints:**
```
GET    /api/v1/notifications          # List user notifications
GET    /api/v1/notifications/unread-count  # Get unread count
PATCH  /api/v1/notifications/:id/read # Mark as read
PATCH  /api/v1/notifications/read-all # Mark all as read
DELETE /api/v1/notifications/:id      # Delete notification
GET    /api/v1/notifications/preferences # Get preferences
PUT    /api/v1/notifications/preferences # Update preferences
```

**Database Tables:**
- `notifications` (already exists in schema)

**Integration Points:**
- Integrate with admissions domain (create notifications on verify/reject/dispute)
- Integrate with deadlines domain (deadline reminders)
- Auto-create notifications on status changes

---

### 3. Deadlines Domain

#### Purpose
Calculate and manage admission deadlines, urgency levels, and calendar data.

#### Features

**Deadline Calculations:**
- ✅ Days remaining calculation
- ✅ Urgency level (low, medium, high, critical)
- ✅ Calendar data generation
- ✅ Deadline filtering
- ✅ Upcoming deadlines

**API Endpoints:**
```
GET    /api/v1/deadlines              # List deadlines
GET    /api/v1/deadlines/:id           # Get deadline detail
GET    /api/v1/deadlines/upcoming     # Get upcoming deadlines
GET    /api/v1/deadlines/calendar     # Get calendar data
GET    /api/v1/admissions/:id/deadline # Get admission deadline
```

**Database Tables:**
- `deadlines` (already exists in schema, references admissions)

**Integration Points:**
- Integrate with admissions domain (calculate from admission.deadline)
- Integrate with notifications domain (deadline reminders)
- Provide calendar view data

---

### 4. Analytics Domain

#### Purpose
Track events, aggregate statistics, and provide analytics endpoints.

#### Features

**Event Tracking:**
- ✅ Admission views
- ✅ User activity
- ✅ Search queries
- ✅ Filter usage
- ✅ Status transitions

**Statistics:**
- ✅ Total admissions by status
- ✅ Admissions by program type
- ✅ Admissions by location
- ✅ User activity stats
- ✅ Popular searches

**API Endpoints:**
```
POST   /api/v1/analytics/events       # Track event
GET    /api/v1/analytics/stats         # Get statistics
GET    /api/v1/analytics/admissions   # Admission statistics
GET    /api/v1/analytics/users         # User statistics
GET    /api/v1/analytics/activity      # Activity feed
```

**Database Tables:**
- `analytics_events` (already exists in schema)
- `user_activity` (already exists in schema)

**Integration Points:**
- Track admission views
- Track user actions
- Aggregate statistics for dashboard

---

### 5. Changelogs Domain API

#### Purpose
Provide standalone API endpoints for accessing changelogs with filtering and search.

#### Features

**Changelog Access:**
- ✅ List changelogs (with filters)
- ✅ Get changelog by ID
- ✅ Filter by admission_id
- ✅ Filter by actor_type
- ✅ Filter by action_type
- ✅ Search changelogs
- ✅ Pagination support

**API Endpoints:**
```
GET    /api/v1/changelogs             # List changelogs
GET    /api/v1/changelogs/:id          # Get changelog detail
GET    /api/v1/changelogs/admission/:admissionId  # Get admission changelogs
```

**Database Tables:**
- `changelogs` (already exists in schema)

**Integration Points:**
- Extend existing changelog integration from admissions domain
- Provide standalone access to changelogs
- Support filtering and search

---

## 🔧 Technical Enhancements

### 1. Real Authentication

**Current State:**
- Mock auth middleware (`src/shared/middleware/auth.ts`)
- User context from headers (no validation)

**Target State:**
- Supabase Auth integration
- JWT token validation
- Real user context
- Session management

**Implementation:**
```typescript
// Replace mockAuth with real Supabase Auth
import { createClient } from '@supabase/supabase-js';

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return next(new AppError('Authentication required', 401));
  }
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return next(new AppError('Invalid token', 401));
  }
  
  req.user = {
    id: user.id,
    role: user.user_metadata.role,
    university_id: user.user_metadata.university_id,
  };
  
  next();
};
```

---

### 2. Structured Logging

**Current State:**
- `console.error()` for errors
- Basic logging

**Target State:**
- Winston or Pino for structured logging
- Log levels (error, warn, info, debug)
- JSON format logs
- Request/response logging
- Correlation IDs

**Implementation:**
```typescript
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const correlationId = req.headers['x-correlation-id'] || generateId();
  req.correlationId = correlationId;
  
  logger.info('Request', {
    correlationId,
    method: req.method,
    path: req.path,
    timestamp: new Date().toISOString(),
  });
  
  next();
};
```

---

### 3. Testing

**Current State:**
- No tests implemented

**Target State:**
- Unit tests for services
- Integration tests for API endpoints
- Test coverage >80%

**Test Structure:**
```
tests/
├── unit/
│   ├── services/
│   │   ├── admissions.service.test.ts
│   │   ├── notifications.service.test.ts
│   │   └── deadlines.service.test.ts
│   └── utils/
│       └── pagination.test.ts
├── integration/
│   ├── admissions.test.ts
│   ├── notifications.test.ts
│   └── deadlines.test.ts
└── fixtures/
    ├── admissions.fixture.ts
    └── users.fixture.ts
```

**Testing Tools:**
- Jest or Vitest for test runner
- Supertest for API testing
- Test database setup/teardown

---

### 4. Rate Limiting

**Purpose:**
Prevent API abuse and ensure fair usage.

**Implementation:**
```typescript
import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});

// Apply to all API routes
app.use('/api/v1', apiLimiter);
```

---

### 5. CORS Configuration

**Purpose:**
Configure Cross-Origin Resource Sharing for frontend access.

**Implementation:**
```typescript
import cors from 'cors';

const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
```

---

### 6. API Documentation

**Purpose:**
Generate OpenAPI/Swagger documentation for API endpoints.

**Implementation:**
```typescript
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AdmissionTimes API',
      version: '1.0.0',
    },
  },
  apis: ['./src/domain/**/routes/*.ts'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
```

---

## 🗄️ Database Context

### Existing Tables (From Phase 2)

| Table | Purpose | Phase 4 Usage |
|-------|---------|---------------|
| `admissions` | Core admission record | ✅ Reference for deadlines, analytics |
| `changelogs` | Immutable audit history | ✅ Standalone API |
| `deadlines` | Admission deadlines | ✅ Primary table for deadlines domain |
| `notifications` | User alerts | ✅ Primary table for notifications domain |
| `user_activity` | Recent activity feed | ✅ Primary table for analytics |
| `analytics_events` | Minimal analytics | ✅ Primary table for analytics |

### New Tables (If Needed)

**User Profiles:**
```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**User Preferences:**
```sql
CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  email_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT true,
  notification_categories JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 📅 Implementation Order

### Recommended Sequence

**Week 1-2: Users Domain + Real Auth**
1. Install Supabase client
2. Implement real authentication middleware
3. Create Users domain structure
4. Implement user CRUD operations
5. Replace mock auth with real auth
6. Test authentication flow

**Week 3: Notifications Domain**
1. Create Notifications domain structure
2. Implement notification CRUD
3. Integrate with admissions domain (auto-create on status changes)
4. Implement notification preferences
5. Test notification flow

**Week 4: Deadlines Domain**
1. Create Deadlines domain structure
2. Implement deadline calculations
3. Implement urgency levels
4. Implement calendar data generation
5. Integrate with notifications (reminders)

**Week 5: Analytics Domain**
1. Create Analytics domain structure
2. Implement event tracking
3. Implement aggregation queries
4. Create statistics endpoints
5. Integrate with admissions domain (track views)

**Week 6: Changelogs API**
1. Create Changelogs domain structure
2. Implement changelog endpoints
3. Implement filtering and search
4. Test changelog access

**Week 7: System Enhancements**
1. Implement structured logging
2. Add rate limiting
3. Configure CORS
4. Generate API documentation
5. Write tests (unit + integration)

**Week 8: Testing & Documentation**
1. Complete test coverage
2. Update documentation
3. Performance testing
4. Security audit
5. Final review

---

## 🌐 API Endpoints by Domain

### Users Domain (5 endpoints)

```
GET    /api/v1/users/me              # Get current user
PUT    /api/v1/users/me               # Update current user
GET    /api/v1/users/:id               # Get user (admin)
GET    /api/v1/users                   # List users (admin)
PATCH  /api/v1/users/:id/role          # Update role (admin)
```

### Notifications Domain (7 endpoints)

```
GET    /api/v1/notifications          # List user notifications
GET    /api/v1/notifications/unread-count  # Get unread count
PATCH  /api/v1/notifications/:id/read # Mark as read
PATCH  /api/v1/notifications/read-all # Mark all as read
DELETE /api/v1/notifications/:id      # Delete notification
GET    /api/v1/notifications/preferences # Get preferences
PUT    /api/v1/notifications/preferences # Update preferences
```

### Deadlines Domain (5 endpoints)

```
GET    /api/v1/deadlines              # List deadlines
GET    /api/v1/deadlines/:id           # Get deadline detail
GET    /api/v1/deadlines/upcoming     # Get upcoming deadlines
GET    /api/v1/deadlines/calendar     # Get calendar data
GET    /api/v1/admissions/:id/deadline # Get admission deadline
```

### Analytics Domain (5 endpoints)

```
POST   /api/v1/analytics/events       # Track event
GET    /api/v1/analytics/stats         # Get statistics
GET    /api/v1/analytics/admissions    # Admission statistics
GET    /api/v1/analytics/users         # User statistics
GET    /api/v1/analytics/activity      # Activity feed
```

### Changelogs Domain (3 endpoints)

```
GET    /api/v1/changelogs             # List changelogs
GET    /api/v1/changelogs/:id          # Get changelog detail
GET    /api/v1/changelogs/admission/:admissionId  # Get admission changelogs
```

**Total Phase 4 Endpoints: 25 new endpoints**

---

## 🔗 Integration Points

### Admissions Domain Integration

**Notifications:**
- Create notification when admission verified
- Create notification when admission rejected
- Create notification when admission disputed

**Deadlines:**
- Calculate deadline from admission.deadline
- Generate calendar data from admissions

**Analytics:**
- Track admission views
- Track status transitions
- Aggregate admission statistics

**Users:**
- Use real user IDs for created_by, verified_by
- Validate user permissions

### Cross-Domain Dependencies

```
Users Domain
    ↓
    ├──→ Admissions (created_by, verified_by)
    ├──→ Notifications (user_id)
    └──→ Analytics (user_id)

Admissions Domain
    ↓
    ├──→ Notifications (trigger on status change)
    ├──→ Deadlines (calculate from deadline)
    └──→ Analytics (track views, transitions)

Deadlines Domain
    ↓
    └──→ Notifications (deadline reminders)
```

---

## 📁 File Structure

### New Domain Structure

```
src/
├── domain/
│   ├── users/                        # ✅ New
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── types/
│   │   ├── validators/
│   │   └── constants/
│   │
│   ├── notifications/                # ✅ New
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── types/
│   │   ├── validators/
│   │   └── constants/
│   │
│   ├── deadlines/                     # ✅ New
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── types/
│   │   ├── validators/
│   │   └── constants/
│   │
│   ├── analytics/                     # ✅ New
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── types/
│   │   ├── validators/
│   │   └── constants/
│   │
│   ├── changelogs/                    # ✅ New
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── types/
│   │   ├── validators/
│   │   └── constants/
│   │
│   └── index.ts                       # Update with new domains
│
├── shared/
│   ├── middleware/
│   │   ├── auth.ts                    # ✅ Replace with real auth
│   │   ├── errorHandler.ts
│   │   ├── validation.ts
│   │   ├── rateLimiter.ts             # ✅ New
│   │   └── logger.ts                 # ✅ New
│   │
│   └── utils/
│       └── logger.ts                 # ✅ New (structured logging)
│
└── tests/                            # ✅ New
    ├── unit/
    ├── integration/
    └── fixtures/
```

---

## ✅ Acceptance Criteria

### Functional Requirements

**Users Domain:**
- ✅ Real authentication works
- ✅ User CRUD operations work
- ✅ User profiles can be updated
- ✅ Roles can be managed (admin only)
- ✅ Mock auth replaced with real auth

**Notifications Domain:**
- ✅ Notifications created on status changes
- ✅ Notifications can be listed
- ✅ Notifications can be marked as read
- ✅ Unread count works
- ✅ Preferences can be managed

**Deadlines Domain:**
- ✅ Days remaining calculated correctly
- ✅ Urgency levels determined correctly
- ✅ Calendar data generated correctly
- ✅ Upcoming deadlines retrieved

**Analytics Domain:**
- ✅ Events can be tracked
- ✅ Statistics aggregated correctly
- ✅ Activity feed works
- ✅ Admission statistics accurate

**Changelogs API:**
- ✅ Changelogs can be listed
- ✅ Filtering works
- ✅ Search works
- ✅ Pagination works

### Technical Requirements

**Authentication:**
- ✅ Supabase Auth integrated
- ✅ JWT tokens validated
- ✅ User context attached correctly
- ✅ Protected routes work

**Logging:**
- ✅ Structured logging implemented
- ✅ Log levels configured
- ✅ Request/response logging
- ✅ Error logging with context

**Testing:**
- ✅ Unit tests for services
- ✅ Integration tests for endpoints
- ✅ Test coverage >80%
- ✅ Tests pass in CI/CD

**Security:**
- ✅ Rate limiting configured
- ✅ CORS configured
- ✅ Input validation on all endpoints
- ✅ SQL injection prevention

**Documentation:**
- ✅ API documentation generated
- ✅ All endpoints documented
- ✅ Request/response examples
- ✅ Error responses documented

---

## 🧪 Testing Strategy

### Unit Tests

**Services:**
- Test business logic
- Test status transitions
- Test calculations (deadlines, urgency)
- Test access control

**Utils:**
- Test pagination helpers
- Test date helpers
- Test response formatters

### Integration Tests

**API Endpoints:**
- Test all CRUD operations
- Test authentication
- Test authorization
- Test validation
- Test error handling

**Database:**
- Test queries
- Test transactions
- Test constraints

### Test Coverage Goals

- **Services:** >90% coverage
- **Controllers:** >80% coverage
- **Models:** >85% coverage
- **Overall:** >80% coverage

---

## 📚 Documentation Requirements

### Code Documentation

- ✅ All functions have JSDoc comments
- ✅ All complex logic explained
- ✅ All business rules documented
- ✅ All parameters and return values documented

### API Documentation

- ✅ OpenAPI/Swagger documentation
- ✅ All endpoints documented
- ✅ Request/response examples
- ✅ Error responses documented
- ✅ Authentication requirements documented

### Project Documentation

- ✅ Update `PROJECT_CONTEXT_AND_BEST_PRACTICES.md`
- ✅ Create `PHASE4_FINAL_REPORT.md` on completion
- ✅ Update README with new endpoints
- ✅ Document authentication flow

---

## 🚀 Getting Started

### Prerequisites

1. ✅ Phase 3 complete
2. ✅ Supabase project configured
3. ✅ Database migrations applied
4. ✅ Environment variables set

### First Steps

1. **Install Dependencies:**
   ```bash
   pnpm add @supabase/supabase-js
   pnpm add -D @types/express-rate-limit express-rate-limit
   pnpm add -D winston @types/winston
   pnpm add -D jest @types/jest ts-jest supertest
   pnpm add -D swagger-jsdoc swagger-ui-express
   pnpm add cors @types/cors
   ```

2. **Create Domain Structure:**
   - Follow same pattern as admissions domain
   - Use path aliases for imports
   - Register in `src/domain/index.ts`

3. **Start with Users Domain:**
   - Implement real authentication first
   - Then user CRUD operations
   - Replace mock auth

4. **Follow Implementation Order:**
   - Users → Notifications → Deadlines → Analytics → Changelogs
   - Then system enhancements

---

## 📝 Notes

### Important Considerations

1. **Backward Compatibility:**
   - Ensure existing admissions endpoints still work
   - Don't break frontend contracts
   - Maintain response formats

2. **Performance:**
   - Optimize database queries
   - Use indexes effectively
   - Consider caching for statistics

3. **Security:**
   - Validate all inputs
   - Use parameterized queries
   - Implement proper authorization
   - Rate limit appropriately

4. **Testing:**
   - Write tests as you implement
   - Don't leave testing until the end
   - Maintain test coverage

---

## 🎯 Success Criteria

Phase 4 is complete when:

- ✅ All 5 domains implemented
- ✅ Real authentication working
- ✅ All 25 endpoints functional
- ✅ Test coverage >80%
- ✅ API documentation complete
- ✅ Structured logging implemented
- ✅ Rate limiting configured
- ✅ CORS configured
- ✅ All integration points working
- ✅ No breaking changes to Phase 3

---

**Planning Document Created:** January 2025  
**Status:** Ready for Implementation  
**Next Step:** Begin Users Domain implementation
