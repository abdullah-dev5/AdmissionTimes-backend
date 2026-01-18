# Requirements & Features

**Last Updated:** January 13, 2025 (Phase 4B Complete)

## System Requirements

### Functional Requirements

#### ✅ Implemented Features

**Admissions Management**
- Create, read, update, delete admissions
- Status transitions (draft → pending → verified/rejected/disputed)
- Search and filter admissions
- Pagination support
- Access control based on user roles

**Notifications System**
- Create notifications for system events
- Retrieve user notifications
- Mark notifications as read/unread
- Filter by category, priority, read status
- Unread count tracking

**Deadlines Management**
- Store and retrieve deadlines
- Calculate days remaining (real-time)
- Determine urgency levels (low/medium/high/critical/expired)
- Filter by type, date range, overdue status
- Upcoming deadlines endpoint

**User Activity Tracking**
- Track user actions (viewed, searched, compared, watchlisted)
- Retrieve activity history
- Filter by activity type
- Pagination support

**Users Management**
- User identity mapping (Supabase Auth → Internal Users)
- User profile management
- Role intent model (student, university, admin)
- Ownership anchoring for all domains
- Access control (users see own, admins see all)

**Analytics & Statistics**
- Event tracking (append-only)
- General statistics aggregation
- Admission statistics
- User statistics
- Aggregated activity feed

**Changelogs Standalone API**
- Standalone changelog access
- Advanced filtering (admission_id, actor_type, action_type, date range)
- Search in diff_summary
- Pagination support

**API Documentation**
- Complete Swagger/OpenAPI documentation (43 endpoints)
- Interactive API explorer at `/api-docs`
- Request/response schemas
- Authentication requirements

#### ⏸️ Planned Features

**System Enhancements**
- Real Supabase Auth integration (Users domain ready)
- Structured logging
- Rate limiting
- CORS configuration
- Input sanitization
- Security headers
- Comprehensive testing

### Non-Functional Requirements

- **Performance**: ✅ API response time under 200ms for standard operations
- **Security**: ⏸️ Mock auth in place, real authentication planned
- **Reliability**: ✅ Comprehensive error handling and validation
- **Scalability**: ✅ Domain-driven architecture supports growth
- **Maintainability**: ✅ SOLID principles and design patterns followed
- **Documentation**: ✅ Complete API documentation with Swagger
- **Type Safety**: ✅ 100% TypeScript with strict mode

## Feature Descriptions

### Admissions Domain

**Purpose:** Core domain for managing university admission information.

**Key Features:**
- CRUD operations for admissions
- Status workflow management
- Search and filtering capabilities
- Changelog integration for audit trails
- Access control (students read verified, universities manage own, admins full access)

**API Endpoints:** 10 endpoints
- `GET /api/v1/admissions` - List admissions
- `GET /api/v1/admissions/:id` - Get admission detail
- `POST /api/v1/admissions` - Create admission
- `PUT /api/v1/admissions/:id` - Update admission
- `DELETE /api/v1/admissions/:id` - Delete admission
- `PATCH /api/v1/admissions/:id/submit` - Submit for verification
- `PATCH /api/v1/admissions/:id/verify` - Verify admission (admin)
- `PATCH /api/v1/admissions/:id/reject` - Reject admission (admin)
- `PATCH /api/v1/admissions/:id/dispute` - Dispute admission (university)
- `GET /api/v1/admissions/:id/changelogs` - Get changelogs

### Notifications Domain

**Purpose:** Store and manage user-facing system notifications.

**Key Features:**
- Auto-created on admission status changes
- Read/unread tracking
- Category and priority filtering
- Unread count endpoint

**API Endpoints:** 5 endpoints
- `GET /api/v1/notifications` - List notifications
- `GET /api/v1/notifications/:id` - Get notification detail
- `GET /api/v1/notifications/unread-count` - Get unread count
- `PATCH /api/v1/notifications/:id/read` - Mark as read
- `PATCH /api/v1/notifications/read-all` - Mark all as read

### Deadlines Domain

**Purpose:** Normalize and expose deadline-related data with urgency calculations.

**Key Features:**
- Real-time days remaining calculation
- Urgency level determination
- Overdue flag calculation
- Upcoming deadlines filtering

**API Endpoints:** 3 endpoints
- `GET /api/v1/deadlines` - List deadlines
- `GET /api/v1/deadlines/upcoming` - Get upcoming deadlines
- `GET /api/v1/deadlines/:id` - Get deadline detail

### User Activity Domain

**Purpose:** Capture recent user behavior for activity feeds and analytics.

**Key Features:**
- Append-only activity tracking
- Lightweight metadata storage
- Activity type filtering
- User-specific activity retrieval

**API Endpoints:** 2 endpoints
- `GET /api/v1/activity` - List activities
- `GET /api/v1/activity/:id` - Get activity detail

### Users Domain

**Purpose:** Identity mapping, role intent, and ownership anchoring for all domains.

**Key Features:**
- Identity mapping (Supabase Auth → Internal Users)
- Role intent model (student, university, admin)
- User profile management
- Ownership anchoring
- Access control

**API Endpoints:** 5 endpoints
- `GET /api/v1/users/me` - Get current user profile
- `PUT /api/v1/users/me` - Update current user profile
- `GET /api/v1/users/:id` - Get user by ID
- `GET /api/v1/users` - List users (admin only)
- `PATCH /api/v1/users/:id/role` - Update user role (admin only)

### Analytics Domain

**Purpose:** Track system metrics and aggregate statistics for analytics and reporting.

**Key Features:**
- Append-only event tracking
- Aggregation-first approach
- Statistics endpoints
- Activity feed aggregation
- Non-user-facing (raw events not exposed)

**API Endpoints:** 5 endpoints
- `POST /api/v1/analytics/events` - Track event
- `GET /api/v1/analytics/stats` - Get general statistics
- `GET /api/v1/analytics/admissions` - Admission statistics
- `GET /api/v1/analytics/users` - User statistics
- `GET /api/v1/analytics/activity` - Aggregated activity feed

### Changelogs Domain

**Purpose:** Standalone API for accessing changelogs with advanced filtering and search.

**Key Features:**
- Advanced filtering
- Search in diff_summary
- Pagination support
- Standalone access
- Read-only operations

**API Endpoints:** 3 endpoints
- `GET /api/v1/changelogs` - List changelogs (with filters)
- `GET /api/v1/changelogs/:id` - Get changelog by ID
- `GET /api/v1/changelogs/admission/:admissionId` - Get admission changelogs

## Business Rules

### Admissions Status Workflow

1. **Draft** → Can be edited, deleted, or submitted
2. **Pending** → Submitted for verification, cannot be edited
3. **Verified** → Approved by admin, visible to students
4. **Rejected** → Rejected by admin, university can dispute
5. **Disputed** → University disputed rejection, admin reviews

### Access Control Rules

- **Students:** Can read verified admissions only
- **Universities:** Can manage own admissions, read verified admissions
- **Admins:** Full access to all admissions, can verify/reject/dispute

### Notification Rules

- Notifications are created automatically on status changes
- Users see only their own notifications
- Notifications are persistent (no deletion)
- Read status can be updated

### Deadline Rules

- Days remaining calculated at query time (not stored)
- Urgency levels: low (>30 days), medium (15-30 days), high (7-14 days), critical (<7 days), expired (overdue)
- Deadlines are immutable once created (updates allowed through controlled logic)

### Activity Tracking Rules

- Activities are append-only (no updates or deletes)
- Activities are lightweight (minimal metadata)
- Users see only their own activities
- Activities are time-ordered (newest first)

## Edge Cases

### Admissions

- ✅ Empty search results return empty array (not error)
- ✅ Invalid status transitions return validation error
- ✅ Deleted admissions return 404
- ✅ Unauthorized access returns 403
- ✅ Missing required fields return validation error

### Notifications

- ✅ Marking already-read notification as read is idempotent
- ✅ No notifications return empty array
- ✅ Invalid notification ID returns 404

### Deadlines

- ✅ Past deadlines show negative days remaining
- ✅ Overdue deadlines have `is_overdue: true`
- ✅ Missing deadlines return 404

### User Activity

- ✅ No activities return empty array
- ✅ Invalid activity ID returns 404
- ✅ Activity tracking failures don't break core operations (non-blocking)
