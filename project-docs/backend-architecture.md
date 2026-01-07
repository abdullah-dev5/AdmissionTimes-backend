# Backend Architecture Blueprint - AdmissionTimes

**Last Updated:** 2026-01-05  
**Status:** Planning Phase  
**Purpose:** Complete backend foundation design before implementation

---

## Executive Summary

This document provides a comprehensive backend architecture blueprint for the AdmissionTimes platform. The system supports three user roles (Student, University, Admin) with distinct workflows, verification processes, audit trails, and notification systems. The design prioritizes PostgreSQL/Supabase compatibility, avoids Redis dependencies, and ensures scalability on free-tier infrastructure.

---

## 1. BACKEND ARCHITECTURE & FOLDER STRUCTURE

### Proposed Structure

```
src/
├── config/                 # Configuration & environment
│   ├── config.ts          # Main config loader
│   ├── database.ts        # DB connection & pool
│   └── constants.ts       # System constants
│
├── domain/                 # Domain-driven modules (CORE)
│   ├── admissions/        # Admission domain
│   │   ├── controllers/   # Admission controllers
│   │   ├── services/      # Admission business logic
│   │   ├── models/        # Admission data models
│   │   ├── routes.ts      # Admission routes
│   │   └── types.ts       # Admission TypeScript types
│   │
│   ├── verification/      # Verification domain
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── models/
│   │   ├── routes.ts
│   │   └── types.ts
│   │
│   ├── changelogs/        # Audit trail domain
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── models/
│   │   ├── routes.ts
│   │   └── types.ts
│   │
│   ├── notifications/     # Notification domain
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── models/
│   │   ├── routes.ts
│   │   └── types.ts
│   │
│   ├── deadlines/         # Deadline domain
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── models/
│   │   ├── routes.ts
│   │   └── types.ts
│   │
│   ├── analytics/          # Analytics domain
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── models/
│   │   ├── routes.ts
│   │   └── types.ts
│   │
│   └── users/              # User activity domain
│       ├── controllers/
│       ├── services/
│       ├── models/
│       ├── routes.ts
│       └── types.ts
│
├── shared/                 # Shared utilities across domains
│   ├── middleware/         # Cross-cutting middleware
│   │   ├── validation.ts  # Input validation
│   │   ├── logging.ts      # Request logging
│   │   └── errorHandler.ts # Already exists
│   │
│   ├── utils/             # Shared utilities
│   │   ├── response.ts     # Already exists
│   │   ├── pagination.ts   # Pagination helpers
│   │   ├── dateHelpers.ts  # Date calculations
│   │   └── queryBuilder.ts # DB query helpers
│   │
│   └── types/              # Shared TypeScript types
│       ├── common.ts       # Common types
│       └── api.ts          # API response types
│
├── database/               # Database layer
│   ├── migrations/         # Migration files
│   ├── seeds/              # Seed data
│   ├── schemas/            # Database schemas (if using ORM)
│   └── connection.ts       # DB connection manager
│
└── index.ts                # Application entry point
```

### Why This Structure?

**Domain-Driven Organization:**
- Each domain (admissions, verification, etc.) is self-contained
- Easy to locate code related to a specific feature
- Prevents circular dependencies
- Supports team parallelization

**Separation of Concerns:**
- Controllers: HTTP request/response handling only
- Services: Business logic, orchestration
- Models: Data structure definitions
- Routes: Endpoint definitions

**Shared Layer:**
- Common utilities avoid duplication
- Middleware handles cross-cutting concerns
- Types ensure consistency

**Future-Proof:**
- New domains can be added without refactoring existing code
- Authentication can be added as middleware without touching domain logic
- AI features can be added as services within relevant domains

---

## 2. CORE DATA MODEL

### Conceptual Table Design

#### **admissions**
**Purpose:** Core admission/program records created by universities

**Key Fields:**
- `id` (UUID, primary key)
- `university_id` (UUID, foreign key - future)
- `title` (string)
- `description` (text)
- `program_type` (enum: undergraduate, graduate, certificate, etc.)
- `degree_level` (enum: bachelor, master, phd, etc.)
- `field_of_study` (string)
- `duration` (string, e.g., "4 years")
- `tuition_fee` (decimal)
- `currency` (string, ISO code)
- `application_fee` (decimal)
- `deadline` (timestamp)
- `start_date` (date)
- `location` (string/city)
- `delivery_mode` (enum: on-campus, online, hybrid)
- `requirements` (JSONB - flexible structure)
- `verification_status` (enum: draft, pending, verified, rejected, disputed)
- `verified_at` (timestamp, nullable)
- `verified_by` (UUID, nullable - admin user)
- `rejection_reason` (text, nullable)
- `dispute_reason` (text, nullable)
- `created_by` (UUID - university user, future)
- `created_at` (timestamp)
- `updated_at` (timestamp)
- `is_active` (boolean, soft delete)

**Relationships:**
- One-to-many with `changelogs` (audit trail)
- One-to-many with `notifications` (when status changes)
- Many-to-many with `students` via `watchlists` (future)
- One-to-many with `deadlines` (if multiple deadlines per admission)

**Design Rationale:**
- `verification_status` drives the verification workflow
- `requirements` as JSONB allows flexibility without schema changes
- Soft delete preserves audit trail
- `verified_by` tracks admin who verified

---

#### **changelogs**
**Purpose:** Immutable audit trail of all admission changes

**Key Fields:**
- `id` (UUID, primary key)
- `admission_id` (UUID, foreign key)
- `changed_by` (UUID - user who made change, future)
- `change_type` (enum: created, updated, verified, rejected, disputed, status_changed)
- `field_name` (string - which field changed, null for status changes)
- `old_value` (text/JSONB - previous value)
- `new_value` (text/JSONB - new value)
- `diff_summary` (text - human-readable summary)
- `metadata` (JSONB - additional context)
- `created_at` (timestamp, immutable)

**Relationships:**
- Many-to-one with `admissions`

**Design Rationale:**
- Immutable: no updates or deletes
- `old_value` and `new_value` stored as text/JSONB for flexibility
- `diff_summary` pre-computed for quick display
- `metadata` stores context (IP, user agent, etc. - future)
- Supports both field-level and status-level changes

---

#### **notifications**
**Purpose:** User notifications (students, universities, admins)

**Key Fields:**
- `id` (UUID, primary key)
- `user_id` (UUID - future, nullable for now)
- `user_type` (enum: student, university, admin)
- `category` (enum: verification, deadline, system, update)
- `priority` (enum: low, medium, high, urgent)
- `title` (string)
- `message` (text)
- `related_entity_type` (string - e.g., "admission", "verification")
- `related_entity_id` (UUID - e.g., admission_id)
- `is_read` (boolean, default false)
- `read_at` (timestamp, nullable)
- `action_url` (string, nullable - frontend route)
- `created_at` (timestamp)

**Relationships:**
- Many-to-one with `admissions` (via `related_entity_id`)

**Design Rationale:**
- `user_id` nullable initially (auth not implemented)
- `user_type` allows filtering by role
- `is_read` and `read_at` support read tracking
- `action_url` helps frontend navigation
- Indexed on `user_type`, `is_read`, `created_at` for efficient queries

---

#### **deadlines**
**Purpose:** Admission deadlines with calculated urgency

**Key Fields:**
- `id` (UUID, primary key)
- `admission_id` (UUID, foreign key)
- `deadline_type` (enum: application, document_submission, payment, etc.)
- `deadline_date` (timestamp)
- `timezone` (string, ISO timezone)
- `is_flexible` (boolean - can be extended)
- `reminder_sent` (boolean, default false)
- `created_at` (timestamp)
- `updated_at` (timestamp)

**Relationships:**
- Many-to-one with `admissions`

**Design Rationale:**
- Separate table allows multiple deadlines per admission
- `deadline_type` supports different deadline categories
- `timezone` ensures accurate calculations
- `reminder_sent` tracks notification state (no background workers)

---

#### **analytics_events**
**Purpose:** Minimal event tracking for admin analytics

**Key Fields:**
- `id` (UUID, primary key)
- `event_type` (enum: admission_viewed, admission_created, verification_completed, etc.)
- `entity_type` (string - e.g., "admission")
- `entity_id` (UUID)
- `user_type` (enum: student, university, admin, anonymous)
- `metadata` (JSONB - minimal context)
- `created_at` (timestamp)

**Relationships:**
- None (denormalized for performance)

**Design Rationale:**
- Minimal fields to reduce storage
- `metadata` JSONB for flexibility
- No user_id initially (auth later)
- Indexed on `event_type`, `created_at` for aggregation
- Old events can be archived/aggregated periodically

---

#### **user_activity**
**Purpose:** Recent activity tracking for dashboards

**Key Fields:**
- `id` (UUID, primary key)
- `user_type` (enum: student, university, admin)
- `activity_type` (enum: viewed, searched, compared, watchlisted, etc.)
- `entity_type` (string)
- `entity_id` (UUID)
- `metadata` (JSONB)
- `created_at` (timestamp)

**Relationships:**
- None (denormalized)

**Design Rationale:**
- Lightweight table for recent activity only
- Old records can be purged (e.g., > 30 days)
- Supports student dashboard "recently viewed"
- Supports admin analytics
- Can be extended for recommendations later

---

#### **watchlists** (Future - when auth is added)
**Purpose:** Student saved admissions

**Key Fields:**
- `id` (UUID, primary key)
- `student_id` (UUID, foreign key)
- `admission_id` (UUID, foreign key)
- `created_at` (timestamp)

**Relationships:**
- Many-to-one with `admissions`
- Many-to-one with `students` (future)

---

### Verification Status Flow

**States:**
1. **draft** - University is still editing (not submitted)
2. **pending** - Submitted for verification, awaiting admin review
3. **verified** - Approved by admin, visible to students
4. **rejected** - Admin rejected (with reason)
5. **disputed** - University disputed rejection

**State Transitions:**
- `draft` → `pending` (university submits)
- `pending` → `verified` (admin approves)
- `pending` → `rejected` (admin rejects)
- `rejected` → `disputed` (university disputes)
- `disputed` → `pending` (admin re-opens for review)
- `verified` → `pending` (if university edits after verification)

**Re-verification Trigger:**
- When a `verified` admission is edited, status automatically changes to `pending`
- Admin must re-verify before it's visible again
- Previous verification record is preserved in changelogs

---

## 3. ADMISSION LIFECYCLE & VERIFICATION FLOW

### University Workflow

**Creating Admission:**
1. University creates admission with status `draft`
2. Can save and edit multiple times
3. When ready, submits → status changes to `pending`
4. Changelog entry: `change_type: "status_changed"`, `old_value: "draft"`, `new_value: "pending"`

**Editing Verified Admission:**
1. University edits a `verified` admission
2. System automatically sets status to `pending`
3. Changelog entry captures all field changes
4. Notification sent to admin: "Admission requires re-verification"
5. Admission hidden from student search until re-verified

**Disputing Rejection:**
1. University views rejection reason
2. Can submit dispute with `dispute_reason`
3. Status changes to `disputed`
4. Notification sent to admin
5. Admin reviews and either approves (`verified`) or maintains rejection (`rejected`)

### Admin Workflow

**Verification Center:**
- Lists all `pending` and `disputed` admissions
- Shows admission details + changelog history
- Can approve → status `verified`, `verified_at` set, `verified_by` set
- Can reject → status `rejected`, `rejection_reason` set
- Changelog entry created for verification action

**Change Logs View:**
- Shows all changes for an admission
- Filters by change type, date range, user
- Displays diff view (old vs new values)

### Data Written at Each Step

**Draft → Pending:**
- `admissions.verification_status` = "pending"
- `changelogs` entry: status change
- `notifications` entry: admin notified

**Pending → Verified:**
- `admissions.verification_status` = "verified"
- `admissions.verified_at` = current timestamp
- `admissions.verified_by` = admin user ID
- `changelogs` entry: verification action
- `notifications` entry: university notified

**Pending → Rejected:**
- `admissions.verification_status` = "rejected"
- `admissions.rejection_reason` = admin's reason
- `changelogs` entry: rejection action
- `notifications` entry: university notified

**Verified → Pending (after edit):**
- `admissions.verification_status` = "pending"
- `admissions.verified_at` = null
- `admissions.verified_by` = null
- `changelogs` entries: all changed fields
- `notifications` entry: admin notified

---

## 4. CHANGE LOGS & AUDIT TRAIL

### How Changes Are Captured

**Automatic Capture:**
- Middleware intercepts admission updates
- Compares old vs new values
- Creates changelog entries for each changed field
- Also creates status change entry if status changed

**Change Detection:**
- Service layer compares database values before/after update
- Only changed fields are logged (not entire object)
- JSONB fields are compared deeply

### Old vs New Value Storage

**Storage Strategy:**
- `old_value` and `new_value` stored as TEXT or JSONB
- For simple fields (strings, numbers): TEXT
- For complex fields (JSONB like requirements): JSONB
- Allows flexible querying and display

**Example:**
```
field_name: "tuition_fee"
old_value: "5000"
new_value: "5500"
diff_summary: "Tuition fee increased from $5,000 to $5,500"
```

### Diff Representation

**Pre-computed Summary:**
- `diff_summary` field stores human-readable change description
- Generated at write time (not computed on read)
- Format: "Field X changed from Y to Z"

**Frontend Display:**
- Frontend can show simple summary or detailed diff
- For JSONB fields, can show structured diff
- Changelog API returns both summary and raw values

### Immutability

**Why Immutable:**
- Audit trail must be tamper-proof
- No updates or deletes allowed
- Ensures compliance with SDS requirements
- Supports legal/regulatory needs

**Implementation:**
- Database constraints prevent updates/deletes
- Application layer enforces immutability
- Only inserts allowed

### Admin vs University Views

**Same Data, Different Filters:**
- Both query the same `changelogs` table
- Admin sees all changes (including verification actions)
- University sees changes to their admissions (excluding admin actions on other admissions)
- Filtering happens at query level, not data level

**Why This Works:**
- Single source of truth
- No data duplication
- Consistent audit trail
- Role-based filtering in service layer

---

## 5. NOTIFICATIONS SYSTEM

### Notification Philosophy

**What is Stored:**
- User-specific notifications (when user_id is available)
- System-wide notifications (when user_id is null, filtered by user_type)
- Read/unread status
- Action URLs for navigation

**What is NOT Stored:**
- Computed notifications (e.g., "5 new admissions" - computed on demand)
- Temporary notifications (e.g., "Your session expires in 5 minutes")
- Real-time notifications (handled via WebSocket/SSE in future)

### Notification Categories

**Student Notifications:**
- `deadline` - Deadline approaching/expired
- `update` - Admission they're watching was updated
- `system` - General system messages

**University Notifications:**
- `verification` - Admission verified/rejected/disputed
- `update` - Admin made changes to their admission
- `system` - System messages

**Admin Notifications:**
- `verification` - New admission pending verification
- `verification` - Dispute submitted
- `system` - System alerts

### Priority Levels

**Urgent:**
- Deadline expired
- Dispute submitted (admin)

**High:**
- Deadline approaching (< 7 days)
- Verification required (admin)
- Admission rejected (university)

**Medium:**
- Admission verified (university)
- Admission updated (student)

**Low:**
- General updates
- System announcements

### How Notifications Are Generated

**Event-Driven Creation:**
- When admission status changes → notification created
- When deadline approaches → notification created (on-demand check)
- When admin verifies → notification to university
- When university disputes → notification to admin

**Generation Logic:**
- Service layer creates notifications after state changes
- No background workers needed initially
- Deadline notifications checked on-demand (when student views dashboard)

### Mark as Read

**Implementation:**
- `is_read` boolean flag
- `read_at` timestamp
- Updated via PATCH endpoint
- Bulk mark-as-read supported

**Query Optimization:**
- Index on `(user_type, is_read, created_at)`
- Efficient filtering for unread count
- Pagination for notification lists

### Old Notifications

**Retention Strategy:**
- Keep all notifications (no automatic deletion)
- Frontend paginates (shows recent first)
- Optional: Archive old notifications (> 90 days) to separate table
- Unread notifications never archived

### PostgreSQL-Only Scale

**Avoiding DB Overload:**
- Indexes on `user_type`, `is_read`, `created_at`
- Efficient queries (limit, offset)
- No N+1 queries (batch fetch)
- Pagination limits result sets

**Query Patterns:**
```sql
-- Get unread count (fast)
SELECT COUNT(*) FROM notifications 
WHERE user_type = 'student' AND is_read = false;

-- Get recent notifications (paginated)
SELECT * FROM notifications 
WHERE user_type = 'student' 
ORDER BY created_at DESC 
LIMIT 20 OFFSET 0;
```

**No Redis Needed:**
- PostgreSQL handles notification storage efficiently
- Read queries are simple and indexed
- Write volume is low (only on state changes)
- Free-tier PostgreSQL sufficient for initial scale

---

## 6. DEADLINE ENGINE

### Deadline Storage

**Storage:**
- `deadlines` table stores all deadline information
- One admission can have multiple deadlines (application, document, payment)
- `deadline_date` stored as timestamp with timezone

### Days Remaining Calculation

**Calculation Strategy:**
- Computed on-demand (not stored)
- Calculated in service layer using PostgreSQL date functions
- Formula: `deadline_date - CURRENT_TIMESTAMP`

**Example Query:**
```sql
SELECT 
  id,
  deadline_date,
  EXTRACT(EPOCH FROM (deadline_date - CURRENT_TIMESTAMP)) / 86400 AS days_remaining
FROM deadlines
WHERE admission_id = $1;
```

### Urgency Logic

**Urgency Levels:**
- **Expired:** days_remaining < 0
- **Urgent:** 0 <= days_remaining <= 7
- **Warning:** 8 <= days_remaining <= 30
- **Normal:** days_remaining > 30

**Computed in Service:**
- Service layer calculates urgency after fetching days_remaining
- Returns urgency level to frontend
- Frontend uses urgency for UI styling (colors, badges)

### Student Dashboard Widgets

**Deadline List:**
- Query: Get all admissions with deadlines
- Filter: Only `verified` admissions
- Sort: By days_remaining (ascending)
- Limit: Top 10 most urgent

**Deadline Calendar:**
- Query: Get deadlines for date range (e.g., current month)
- Group by date
- Return structured data for calendar rendering

### Reminder Logic (No Background Workers)

**On-Demand Checks:**
- When student views dashboard, check if any deadlines need reminders
- If deadline is < 7 days and `reminder_sent = false`:
  - Create notification
  - Set `reminder_sent = true`
- No cron jobs needed initially

**Future Enhancement:**
- Can add scheduled job later if needed
- For now, on-demand is sufficient and simpler

---

## 7. ANALYTICS (MINIMAL)

### Events Tracked

**Admission Events:**
- `admission_viewed` - Student viewed admission detail
- `admission_created` - University created admission
- `admission_updated` - University updated admission
- `verification_completed` - Admin verified admission
- `verification_rejected` - Admin rejected admission

**Search Events:**
- `admission_searched` - Student searched admissions (aggregated, not per query)

**NOT Tracked:**
- Page views (too granular)
- Click events (not needed)
- User sessions (auth not implemented)
- Performance metrics (handled separately)

### Aggregation Strategy

**Daily Aggregation:**
- Admin dashboard shows daily metrics
- Query: `SELECT event_type, COUNT(*) FROM analytics_events WHERE DATE(created_at) = CURRENT_DATE GROUP BY event_type`
- Cached in memory (or computed on-demand for small datasets)

**Total Metrics:**
- Query: `SELECT event_type, COUNT(*) FROM analytics_events GROUP BY event_type`
- No pre-aggregation needed (PostgreSQL handles efficiently)

### Admin Filters

**Filtering:**
- By date range
- By event type
- By entity type (admission, verification, etc.)
- Combined filters supported

**Query Pattern:**
```sql
SELECT 
  event_type,
  COUNT(*) as count,
  DATE(created_at) as date
FROM analytics_events
WHERE created_at BETWEEN $1 AND $2
  AND event_type = $3
GROUP BY event_type, DATE(created_at)
ORDER BY date DESC;
```

### Database Load Minimization

**Strategies:**
- Index on `(event_type, created_at)`
- Limit event types (no tracking bloat)
- Archive old events (> 1 year) periodically
- Aggregation queries use indexes efficiently
- No real-time analytics (computed on-demand)

---

## 8. USER ACTIVITY & RECENT ACTIVITY

### What is Stored

**Activity Types:**
- `viewed` - Student viewed admission
- `searched` - Student searched (aggregated)
- `compared` - Student compared admissions (future)
- `watchlisted` - Student added to watchlist (future)

**Storage:**
- `user_activity` table stores recent activity
- Lightweight records (minimal fields)
- No user_id initially (auth later)

### What is NOT Stored

**Intentionally Excluded:**
- Page navigation (too granular)
- Time spent on page (not needed)
- Scroll events (not needed)
- Form interactions (not needed)

### Recent Activity Derivation

**Student Dashboard:**
- Query: `SELECT * FROM user_activity WHERE user_type = 'student' AND activity_type = 'viewed' ORDER BY created_at DESC LIMIT 10`
- Returns recently viewed admissions
- Frontend displays as "Recently Viewed" widget

**Admin Analytics:**
- Query: `SELECT activity_type, COUNT(*) FROM user_activity WHERE created_at > CURRENT_DATE - INTERVAL '7 days' GROUP BY activity_type`
- Shows activity trends
- Supports admin dashboard metrics

### Recommendations (Future)

**Foundation:**
- `user_activity` table provides foundation for recommendations
- Can analyze viewing patterns
- Can identify similar admissions
- Can suggest based on watchlist
- No implementation needed now, but data structure supports it

---

## 9. FRONTEND ↔ BACKEND CONTRACT

### Module Mapping

#### **Student Module**

**Dashboard:**
- `GET /api/v1/admissions/recent` - Recently viewed admissions
- `GET /api/v1/deadlines/upcoming` - Upcoming deadlines
- `GET /api/v1/notifications?user_type=student&is_read=false` - Unread notifications

**Search Admissions:**
- `GET /api/v1/admissions/search?q=...&filters=...` - Search with filters
- `GET /api/v1/admissions/:id` - Admission detail
- `POST /api/v1/analytics/events` - Track admission view

**Compare Programs:**
- `GET /api/v1/admissions?ids=id1,id2,id3` - Get multiple admissions
- (Comparison logic in frontend)

**Watchlist:**
- `GET /api/v1/watchlists` - Get watchlist (future)
- `POST /api/v1/watchlists` - Add to watchlist (future)
- `DELETE /api/v1/watchlists/:id` - Remove from watchlist (future)

**Deadlines:**
- `GET /api/v1/deadlines/calendar?start_date=...&end_date=...` - Calendar data
- `GET /api/v1/deadlines/list` - Deadline list with urgency

**Notifications:**
- `GET /api/v1/notifications` - Get notifications (paginated)
- `PATCH /api/v1/notifications/:id/read` - Mark as read
- `PATCH /api/v1/notifications/read-all` - Mark all as read

**Program Detail Page:**
- `GET /api/v1/admissions/:id` - Full admission details
- `POST /api/v1/user-activity` - Track view

---

#### **University Module**

**Dashboard:**
- `GET /api/v1/admissions?created_by=university_id` - University's admissions
- `GET /api/v1/notifications?user_type=university&is_read=false` - Unread notifications

**Manage Admissions:**
- `POST /api/v1/admissions` - Create admission (status: draft)
- `GET /api/v1/admissions/:id` - Get admission
- `PUT /api/v1/admissions/:id` - Update admission
- `PATCH /api/v1/admissions/:id/submit` - Submit for verification (draft → pending)
- `DELETE /api/v1/admissions/:id` - Soft delete

**Verification Center:**
- `GET /api/v1/admissions?verification_status=pending,disputed` - Pending/disputed admissions
- `GET /api/v1/admissions/:id/changelogs` - Get changelog for admission
- `PATCH /api/v1/admissions/:id/dispute` - Submit dispute

**Change Logs:**
- `GET /api/v1/changelogs?admission_id=...` - Get changelogs for admission
- `GET /api/v1/changelogs?change_type=...&date_from=...&date_to=...` - Filtered changelogs

**Notifications:**
- Same as student module

**Settings:**
- (Future - when auth is implemented)

---

#### **Admin Module**

**Dashboard:**
- `GET /api/v1/analytics/summary` - System metrics
- `GET /api/v1/analytics/events?date_from=...&date_to=...` - Event analytics
- `GET /api/v1/admissions/stats` - Admission statistics

**Verification Center:**
- `GET /api/v1/admissions?verification_status=pending,disputed` - Pending/disputed
- `GET /api/v1/admissions/:id` - Admission details
- `GET /api/v1/admissions/:id/changelogs` - Changelog history
- `PATCH /api/v1/admissions/:id/verify` - Approve (pending → verified)
- `PATCH /api/v1/admissions/:id/reject` - Reject (pending → rejected)

**Change Logs:**
- `GET /api/v1/changelogs` - All changelogs (with filters)
- `GET /api/v1/changelogs/:id` - Single changelog entry

**Analytics:**
- `GET /api/v1/analytics/events` - Event analytics
- `GET /api/v1/analytics/user-activity` - User activity analytics
- `GET /api/v1/analytics/admissions` - Admission analytics

**Notifications:**
- Same as other modules

---

### Consistency Maintenance

**Response Format:**
- All endpoints use `sendSuccess()` and `sendError()` utilities
- Consistent structure: `{ success, message, data, timestamp }`
- Pagination: `{ data, pagination: { page, limit, total, totalPages } }`

**Error Handling:**
- All errors go through `errorHandler` middleware
- Consistent error format: `{ success: false, message, errors? }`
- Appropriate HTTP status codes

**Versioning:**
- All routes prefixed with `/api/v1`
- Future versions can be added as `/api/v2` without breaking changes

---

## 10. POSTGRESQL + SUPABASE STRATEGY

### Why PostgreSQL is Sufficient

**Capabilities:**
- JSONB for flexible schema (requirements, metadata)
- Full-text search (for admission search)
- Efficient indexing
- ACID compliance (critical for audit trail)
- Free-tier sufficient for initial scale

**Performance:**
- Proper indexing handles query load
- Connection pooling manages concurrent requests
- No Redis needed for initial scale

### Supabase Compatibility

**Why Supabase:**
- Built on PostgreSQL (100% compatible)
- Provides REST API automatically (optional)
- Real-time subscriptions (future - notifications)
- Auth integration (future)
- Free-tier available

**Local Development:**
- Use local PostgreSQL for development
- Use Supabase for staging/production
- Same schema works for both
- Connection string is only difference

### Free-Tier Limits

**Supabase Free Tier:**
- 500 MB database
- 2 GB bandwidth
- Sufficient for initial development and small-scale deployment

**Optimization Strategies:**
- Efficient indexing
- Archive old data (changelogs, analytics_events)
- Pagination everywhere
- No unnecessary data storage

### Data Retention

**Retention Policies:**
- **Changelogs:** Keep forever (audit requirement)
- **Notifications:** Keep all, archive old (> 90 days) optionally
- **Analytics Events:** Archive after 1 year, keep aggregated data
- **User Activity:** Purge after 30 days (recent activity only)

**Archival Strategy:**
- Move old data to `*_archive` tables
- Or export to cold storage
- Keep aggregated summaries

### Indexing Strategy

**Critical Indexes:**
- `admissions(verification_status, created_at)` - Verification center queries
- `admissions(university_id, verification_status)` - University dashboard
- `changelogs(admission_id, created_at)` - Changelog queries
- `notifications(user_type, is_read, created_at)` - Notification queries
- `deadlines(admission_id, deadline_date)` - Deadline queries
- `analytics_events(event_type, created_at)` - Analytics queries

**Index Maintenance:**
- Created via migrations
- Monitored for performance
- Adjusted based on query patterns

### Local Development

**Setup:**
- Docker Compose for local PostgreSQL (optional)
- Or use Supabase local development
- `.env` file for connection strings
- Migrations run on startup (development mode)

---

## 11. IMPLEMENTATION READINESS CHECKLIST

### Decisions Finalized ✅

1. **Database:** PostgreSQL (Supabase compatible)
2. **Framework:** Express.js + TypeScript
3. **Architecture:** Domain-driven structure
4. **Verification Flow:** 5-state system (draft, pending, verified, rejected, disputed)
5. **Audit Trail:** Immutable changelogs
6. **Notifications:** PostgreSQL-only, no Redis
7. **Analytics:** Minimal event tracking
8. **API Design:** RESTful, versioned (`/api/v1`)

### Decisions Delayed ⏸️

1. **Authentication:** Will be added later (middleware layer ready)
2. **User Management:** User tables and relationships deferred
3. **AI Features:** Not in scope
4. **Background Workers:** Not needed initially
5. **Real-time:** WebSocket/SSE deferred
6. **File Uploads:** Not specified yet
7. **Email Notifications:** Not in scope
8. **Payment Integration:** Not in scope

### High-Risk Areas ⚠️

1. **Verification Workflow:**
   - Risk: Complex state transitions
   - Mitigation: Clear state machine, comprehensive tests

2. **Changelog Performance:**
   - Risk: Large changelog tables slow queries
   - Mitigation: Proper indexing, pagination, archival strategy

3. **Notification Scale:**
   - Risk: Too many notifications slow queries
   - Mitigation: Indexes, pagination, read/unread optimization

4. **Deadline Calculations:**
   - Risk: Timezone issues
   - Mitigation: Store timezone, use PostgreSQL timezone functions

5. **Analytics Query Performance:**
   - Risk: Slow aggregation queries
   - Mitigation: Indexes, limit date ranges, consider materialized views later

### Validation Against Frontend

**Frontend Compatibility:**
- ✅ All frontend modules have corresponding backend endpoints
- ✅ Response formats match frontend expectations
- ✅ Pagination supported where needed
- ✅ Filtering supported where needed
- ⚠️ Mock data structure should match actual API responses

**Action Items:**
- Review frontend mock data structures
- Ensure API responses match mock data shape
- Test endpoints with frontend integration

### Validation Against SRS/SDS

**SRS Compliance:**
- ✅ Audit trail (changelogs)
- ✅ Verification workflow
- ✅ Multi-role support
- ✅ Notification system
- ✅ Analytics (minimal)

**SDS Compliance:**
- ✅ Traceability (changelogs)
- ✅ Auditability (immutable logs)
- ✅ Scalability (efficient queries, indexing)
- ✅ Maintainability (domain structure)

### Next Steps

1. **Database Setup:**
   - Create PostgreSQL database
   - Set up connection configuration
   - Create migration system

2. **Implement Core Domains:**
   - Start with admissions domain
   - Implement verification flow
   - Add changelog system

3. **API Development:**
   - Implement endpoints incrementally
   - Test with frontend integration
   - Document API responses

4. **Testing:**
   - Unit tests for services
   - Integration tests for APIs
   - Test verification workflow

5. **Documentation:**
   - API documentation
   - Update project docs
   - Database schema documentation

---

## Conclusion

This blueprint provides a complete foundation for the AdmissionTimes backend. The architecture is:
- **Scalable:** Efficient queries, proper indexing
- **Maintainable:** Domain-driven structure
- **Audit-Safe:** Immutable changelogs
- **Frontend-Compatible:** All modules supported
- **Future-Proof:** Ready for auth, AI, and other features

The design avoids over-engineering while ensuring the system can grow without major refactors.
