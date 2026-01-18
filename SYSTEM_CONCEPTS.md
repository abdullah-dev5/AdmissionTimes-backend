# SYSTEM_CONCEPTS

This document defines **foundational system concepts** that govern how the AdmissionTimes backend behaves. These concepts are **non-code rules** that ensure long-term consistency, scalability, and alignment with the SRS/SDS and frontend contracts.

---

## 1. Event Classification Model

All system interactions are classified into **four distinct event types**. This separation is intentional and must be preserved across all future features.

### 1.1 User Actions → `user_activity`

Represents **intentional actions performed by users**.

**Characteristics:**

* Initiated directly by a user
* Lightweight
* Used for UI features (recent activity, recommendations later)
* Append-only

**Examples:**

* Student views an admission
* Student compares programs
* Student adds to watchlist
* University edits an admission

**Not used for analytics or auditing.**

**Implementation Status:** ✅ Implemented in Phase 4A
- Domain: `user-activity`
- Table: `user_activity`
- Activity types: `viewed`, `searched`, `compared`, `watchlisted`
- Append-only enforced at model level

---

### 1.2 System Reactions → `notifications`

Represents **system-generated messages** intended for users.

**Characteristics:**

* Triggered by system rules or user actions
* User-facing
* Volatile (time-bound relevance)
* Read/unread lifecycle

**Examples:**

* Admission verified
* Deadline approaching
* Status changed
* System announcements

**Notifications do NOT represent events themselves.**

**Implementation Status:** ✅ Implemented in Phase 4A
- Domain: `notifications`
- Table: `notifications`
- Categories: `verification`, `deadline`, `system`, `update`
- Read/unread tracking implemented
- Auto-created on admission status changes

---

### 1.3 System Metrics → `analytics_events`

Represents **non-user-facing system metrics** used for aggregation and reporting.

**Characteristics:**

* Minimal payload
* Append-only
* Aggregated at query-time
* No UI-level dependence

**Examples:**

* Admission viewed (count only)
* Search executed
* Compare action occurred

**Analytics events are never shown directly to users.**

**Implementation Status:** ⏸️ Deferred to Future Phase
- Table exists: `analytics_events`
- Domain not yet implemented
- Planned for Phase 4B or later

---

### 1.4 State Changes → `changelogs`

Represents **immutable audit records** of state changes.

**Characteristics:**

* System-enforced
* Immutable
* Source of truth for audits
* Always written on mutation

**Examples:**

* Admission status updated
* Admission verified or rejected
* Field-level changes

**Implementation Status:** ✅ Implemented in Phase 3
- Integrated in Admissions domain
- Table: `changelogs`
- Immutable (no updates/deletes)
- Auto-created on all admission mutations

---

## 2. Role Intent Model (Pre-Auth)

Roles are defined by **intent**, not enforcement. Enforcement will be applied later via authentication and RLS.

### 2.1 Student

**Intent:**

* Discover admissions
* Track interests
* Compare programs
* Monitor deadlines

**Allowed Actions (Conceptual):**

* Read verified admissions
* Save/watch programs
* Generate comparisons
* View notifications

**Implementation Status:** ✅ Implemented
- Access control in Admissions service
- Can only view verified admissions
- Activity tracking for students
- Notification access

---

### 2.2 University

**Intent:**

* Publish and maintain admission data
* Respond to verification feedback

**Allowed Actions (Conceptual):**

* Create admissions
* Update admissions
* Submit for verification
* Dispute rejections
* View change logs

**Implementation Status:** ✅ Implemented
- Full CRUD on own admissions
- Submit for verification
- Dispute rejections
- Access to own notifications

---

### 2.3 Admin

**Intent:**

* Moderate platform data
* Ensure data integrity
* Audit system changes

**Allowed Actions (Conceptual):**

* Verify admissions
* Reject admissions
* View all change logs
* View analytics summaries

**Implementation Status:** ✅ Implemented
- Verify/reject admissions
- Access all admissions
- View all changelogs
- Admin notifications

---

## 3. Data Retention Philosophy

No background jobs or scheduled deletion are used at this stage. Retention is enforced **logically via queries**, not physically via deletion.

### 3.1 Notifications

* Stored persistently
* Retrieved via pagination
* UI only displays recent items
* Older records remain but are not queried

**Implementation:** ✅
- All notifications stored in database
- Pagination implemented
- No deletion (soft delete not implemented)
- Queries ordered by `created_at DESC`

---

### 3.2 User Activity

* Append-only
* Queried with LIMIT + ORDER BY
* Used only for recent activity feeds
* No historical guarantees

**Implementation:** ✅
- Append-only enforced (no update/delete methods)
- Queries use LIMIT and ORDER BY
- Pagination for recent activity
- No historical data guarantees

---

### 3.3 Analytics Events

* Append-only
* Used only for aggregation
* Raw data considered expendable
* Aggregation-first mindset

**Implementation:** ⏸️
- Table exists but domain not implemented
- Planned for future phase

---

## 4. Frontend–Backend Contract Guarantees

The backend guarantees **stable response contracts** to support frontend development.

### 4.1 Response Envelope

All API responses follow a consistent structure:

* `success` - Boolean indicating success/failure
* `message` - Human-readable message
* `data` - Response payload
* `timestamp` - ISO8601 timestamp
* `pagination` - Pagination metadata (when applicable)

**Implementation:** ✅
- Standardized in `src/shared/utils/response.ts`
- `sendSuccess()` for single responses
- `sendPaginated()` for paginated responses
- `sendError()` for error responses
- All endpoints use these utilities

---

### 4.2 Pagination Contract

* Page-based pagination
* Stable keys: `page`, `limit`, `total`, `totalPages`, `hasNext`, `hasPrev`
* No cursor-based pagination in current phases

**Implementation:** ✅
- Pagination utilities in `src/shared/utils/pagination.ts`
- Consistent pagination object structure
- All list endpoints use same pagination format
- Default: page=1, limit=20

---

### 4.3 Enum Stability

* Enum values are fixed once released
* No renaming without migration
* Frontend may safely rely on enum strings

**Implementation:** ✅
- Enums defined in `src/config/constants.ts`
- TypeScript enums ensure type safety
- Values match database ENUMs
- No breaking changes to enum values

---

## 5. Error Taxonomy

Errors are categorized for frontend consistency and debugging clarity.

### 5.1 Error Classes (Conceptual)

* **ValidationError** – Invalid input (400)
* **NotFoundError** – Resource does not exist (404)
* **ForbiddenError** – Action not allowed (403)
* **ConflictError** – Invalid state transition (400)
* **InternalError** – Unexpected system error (500)

**Implementation:** ✅
- `AppError` class in `src/shared/middleware/errorHandler.ts`
- Status codes map to error types
- Consistent error response format
- Field-level errors for validation

---

### 5.2 Error Response Rules

* No sensitive information exposed
* Clear, human-readable messages
* Field-level errors for validation failures

**Implementation:** ✅
- Error handler prevents sensitive data exposure
- Clear error messages
- Validation errors include field-level details
- Stack traces only in development

---

## 6. Architectural Principles (Non-Negotiable)

These principles apply to all future phases:

1. **PostgreSQL is the single source of truth** ✅
   - All data stored in PostgreSQL
   - No external data stores

2. **No Redis or message queues until justified** ✅
   - No caching layer
   - No message queues
   - Direct database access

3. **No background workers in early phases** ✅
   - No cron jobs
   - No background processing
   - All operations synchronous

4. **Append-only for audit and analytics** ✅
   - Changelogs: append-only
   - User Activity: append-only
   - Analytics Events: append-only (when implemented)

5. **Frontend contracts must not break** ✅
   - Response format stable
   - Enum values stable
   - Pagination format stable

6. **Domains remain isolated** ✅
   - No cross-domain model access
   - Communication via services only
   - Clear domain boundaries

7. **Documentation precedes complexity** ✅
   - Comprehensive JSDoc comments
   - Swagger/OpenAPI documentation
   - Project documentation updated

---

## 7. Scope Lock

This document **locks the conceptual foundation** of the system.

Any future additions (Auth, AI, Scrapers, Recommendations) must:

* Respect these classifications
* Integrate without violating existing contracts
* Extend behavior, not redefine it

---

## 8. Implementation Compliance

### Current Compliance Status: ✅ 95%

| Concept | Status | Notes |
|---------|--------|-------|
| Event Classification | ✅ | All 4 types understood, 3 implemented |
| Role Intent Model | ✅ | All roles implemented with correct intent |
| Data Retention | ✅ | All retention policies followed |
| Response Contracts | ✅ | All contracts maintained |
| Error Taxonomy | ✅ | Error handling follows taxonomy |
| Architectural Principles | ✅ | All principles followed |

### Compliance Verification

**Event Classification:**
- ✅ `user_activity` - Correctly implemented
- ✅ `notifications` - Correctly implemented
- ⏸️ `analytics_events` - Table exists, domain deferred
- ✅ `changelogs` - Correctly implemented

**Data Retention:**
- ✅ Notifications: Persistent storage, pagination
- ✅ User Activity: Append-only, LIMIT queries
- ⏸️ Analytics Events: Not yet implemented

**Response Contracts:**
- ✅ All endpoints use standardized response format
- ✅ Pagination contract consistent
- ✅ Enum values stable

**Architectural Principles:**
- ✅ PostgreSQL only
- ✅ No Redis/message queues
- ✅ No background workers
- ✅ Append-only enforced
- ✅ Domain isolation maintained

---

## 9. Future Phase Requirements

When implementing future features, ensure:

1. **Analytics Domain:**
   - Use `analytics_events` table
   - Append-only
   - Aggregation-first
   - No UI-level dependence

2. **Users Domain:**
   - Respect role intent model
   - Maintain access control patterns
   - No breaking changes to existing roles

3. **Real Authentication:**
   - Enforce role-based access
   - Maintain role intent
   - No changes to role definitions

4. **Background Jobs (if added):**
   - Must not violate append-only principles
   - Must respect data retention philosophy
   - Must not break frontend contracts

---

**Status:** Active  
**Applies From:** Phase 3 onward  
**Last Updated:** January 13, 2025  
**Compliance:** ✅ 95% (Analytics domain deferred)
