# API Contract Document

**Created:** January 18, 2026  
**Purpose:** Complete API contract with all endpoints, request/response formats, and data structures  
**Status:** Ready for Frontend Integration  
**API Version:** v1

---

## 📋 Table of Contents

1. [Base Information](#base-information)
2. [Response Formats](#response-formats)
3. [Error Handling](#error-handling)
4. [Authentication](#authentication)
5. [Domain Endpoints](#domain-endpoints)
6. [Data Types](#data-types)

---

## 🔧 Base Information

### Base URL

**Development:**
```
http://localhost:3000
```

**Production:**
```
https://api.admissiontimes.com
```

### API Prefix

All endpoints are prefixed with `/api/v1/`

### Content Type

All requests must include:
```
Content-Type: application/json
```

---

## 📦 Response Formats

### Success Response

```typescript
{
  success: true,
  message: string,
  data: T, // Response data (object or array)
  timestamp: string // ISO 8601 format
}
```

### Paginated Response

```typescript
{
  success: true,
  message: string,
  data: T[], // Array of items
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number,
    hasNext: boolean,
    hasPrev: boolean
  },
  timestamp: string
}
```

### Error Response

```typescript
{
  success: false,
  message: string,
  errors?: { // Optional: validation errors
    [field: string]: string
  },
  timestamp: string
}
```

---

## ⚠️ Error Handling

### HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| 200 | OK | Successful GET, PUT, PATCH |
| 201 | Created | Successful POST |
| 400 | Bad Request | Validation errors, invalid input |
| 401 | Unauthorized | Missing/invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 500 | Internal Server Error | Server errors |

### Error Response Example

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "title": "Title is required",
    "deadline": "Deadline must be a valid date"
  },
  "timestamp": "2026-01-18T10:30:00.000Z"
}
```

---

## 🔐 Authentication

### Current: Mock Authentication (Development)

**Headers Required:**
```
x-user-id: <uuid> (optional)
x-user-role: student | university | admin (optional)
x-university-id: <uuid> (optional, for university role)
```

**Default Behavior:**
- If no headers: `{ id: null, role: 'guest', university_id: null }`
- Never blocks requests (always allows)

### Future: Real Authentication (Phase 4C)

**Header:**
```
Authorization: Bearer <jwt-token>
```

---

## 🌐 Domain Endpoints

### 1. Admissions Domain

#### List Admissions
```
GET /api/v1/admissions
```

**Query Parameters:**
- `page` (number, default: 1) - Page number
- `limit` (number, default: 20, max: 100) - Items per page
- `search` (string) - Search term (searches title, description, field_of_study, location)
- `program_type` (string) - Filter by program type
- `degree_level` (string) - Filter by degree level
- `field_of_study` (string) - Filter by field of study
- `location` (string) - Filter by location
- `delivery_mode` (string) - Filter by delivery mode (on-campus, online, hybrid)
- `verification_status` (string) - Filter by status (draft, pending, verified, rejected, disputed)
- `sort` (string) - Sort field (created_at, updated_at, deadline, title, tuition_fee, verified_at)
- `order` (string) - Sort order (asc, desc)

**Response:** Paginated list of admissions

**Access Control:**
- Students: Only verified admissions
- Universities: Own admissions + verified
- Admins: All admissions

---

#### Get Admission Detail
```
GET /api/v1/admissions/:id
```

**Path Parameters:**
- `id` (UUID) - Admission ID

**Response:** Single admission object

---

#### Create Admission
```
POST /api/v1/admissions
```

**Request Body:**
```typescript
{
  title: string; // Required
  description?: string;
  program_type?: string;
  degree_level?: string;
  field_of_study?: string;
  duration?: string;
  tuition_fee?: number;
  currency?: string;
  application_fee?: number;
  deadline?: string; // ISO 8601
  start_date?: string; // ISO 8601 date
  location?: string;
  campus?: string;
  delivery_mode?: string;
  requirements?: Record<string, any>; // JSON object
}
```

**Response:** Created admission object (201)

**Access Control:** Universities and Admins only

---

#### Update Admission
```
PUT /api/v1/admissions/:id
```

**Request Body:** Same as Create (all fields optional)

**Response:** Updated admission object

**Access Control:** Owner (university) or Admin

---

#### Delete Admission
```
DELETE /api/v1/admissions/:id
```

**Response:** Success message

**Access Control:** Owner (university) or Admin

---

#### Submit for Verification
```
PATCH /api/v1/admissions/:id/submit
```

**Request Body:**
```typescript
{
  submitted_by?: string; // Optional
}
```

**Response:** Updated admission object

**Status Transition:** `draft` → `pending`

**Access Control:** Owner (university) or Admin

---

#### Verify Admission
```
PATCH /api/v1/admissions/:id/verify
```

**Request Body:**
```typescript
{
  verified_by?: string; // Optional
}
```

**Response:** Updated admission object

**Status Transition:** `pending` → `verified`

**Access Control:** Admin only

---

#### Reject Admission
```
PATCH /api/v1/admissions/:id/reject
```

**Request Body:**
```typescript
{
  rejection_reason: string; // Required
  rejected_by?: string; // Optional
}
```

**Response:** Updated admission object

**Status Transition:** `pending` → `rejected`

**Access Control:** Admin only

---

#### Dispute Admission
```
PATCH /api/v1/admissions/:id/dispute
```

**Request Body:**
```typescript
{
  dispute_reason: string; // Required
  disputed_by?: string; // Optional
}
```

**Response:** Updated admission object

**Status Transition:** `rejected` → `disputed`

**Access Control:** Owner (university) only

---

#### Get Admission Changelogs
```
GET /api/v1/admissions/:id/changelogs
```

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 20)

**Response:** Paginated list of changelog entries

---

### 2. Notifications Domain

#### List Notifications
```
GET /api/v1/notifications
```

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 20)
- `category` (string) - Filter by category
- `priority` (string) - Filter by priority
- `is_read` (boolean) - Filter by read status
- `sort` (string) - Sort field (created_at, priority)
- `order` (string) - Sort order (asc, desc)

**Response:** Paginated list of notifications

---

#### Get Unread Count
```
GET /api/v1/notifications/unread-count
```

**Response:**
```typescript
{
  success: true,
  data: {
    count: number
  }
}
```

---

#### Get Notification Detail
```
GET /api/v1/notifications/:id
```

**Response:** Single notification object

---

#### Mark as Read
```
PATCH /api/v1/notifications/:id/read
```

**Request Body:**
```typescript
{
  read_at?: string; // Optional, defaults to now
}
```

**Response:** Updated notification object

---

#### Mark All as Read
```
PATCH /api/v1/notifications/read-all
```

**Response:** Success message

---

#### Create Notification
```
POST /api/v1/notifications
```

**Request Body:**
```typescript
{
  user_id?: string | null;
  user_type: 'student' | 'university' | 'admin' | 'all';
  category: 'verification' | 'deadline' | 'system' | 'update';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  message: string;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  action_url?: string | null;
}
```

**Response:** Created notification object (201)

**Access Control:** Admin only

---

#### Delete Notification
```
DELETE /api/v1/notifications/:id
```

**Response:** Success message

**Access Control:** Owner or Admin

---

### 3. Deadlines Domain

#### List Deadlines
```
GET /api/v1/deadlines
```

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 20)
- `admission_id` (UUID) - Filter by admission
- `deadline_type` (string) - Filter by type
- `is_overdue` (boolean) - Filter overdue deadlines
- `date_from` (string) - Filter from date (ISO 8601)
- `date_to` (string) - Filter to date (ISO 8601)
- `sort` (string) - Sort field (deadline_date, created_at)
- `order` (string) - Sort order (asc, desc)

**Response:** Paginated list of deadlines with metadata (days_remaining, urgency_level, is_overdue)

---

#### Get Upcoming Deadlines
```
GET /api/v1/deadlines/upcoming
```

**Query Parameters:**
- `limit` (number, default: 10) - Number of upcoming deadlines

**Response:** List of upcoming deadlines

---

#### Get Deadline Detail
```
GET /api/v1/deadlines/:id
```

**Response:** Single deadline object with metadata

---

#### Create Deadline
```
POST /api/v1/deadlines
```

**Request Body:**
```typescript
{
  admission_id: string; // Required
  deadline_type: string; // Required
  deadline_date: string; // Required, ISO 8601
  timezone?: string; // Default: UTC
  is_flexible?: boolean; // Default: false
}
```

**Response:** Created deadline object (201)

---

#### Update Deadline
```
PUT /api/v1/deadlines/:id
```

**Request Body:** Same as Create (all fields optional)

**Response:** Updated deadline object

---

#### Delete Deadline
```
DELETE /api/v1/deadlines/:id
```

**Response:** Success message

---

### 4. User Activity Domain

#### List Activities
```
GET /api/v1/activity
```

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 20)
- `activity_type` (string) - Filter by type
- `user_id` (UUID) - Filter by user
- `sort` (string) - Sort field (created_at)
- `order` (string) - Sort order (asc, desc)

**Response:** Paginated list of activities

---

#### Get Activity Detail
```
GET /api/v1/activity/:id
```

**Response:** Single activity object

---

### 5. Users Domain

#### Get Current User Profile
```
GET /api/v1/users/me
```

**Response:** Current user object

**Access Control:** Authenticated users

---

#### Update Current User Profile
```
PUT /api/v1/users/me
```

**Request Body:**
```typescript
{
  display_name?: string;
  status?: 'active' | 'inactive';
  // ... other profile fields
}
```

**Response:** Updated user object

---

#### Get User by ID
```
GET /api/v1/users/:id
```

**Response:** User object

**Access Control:** Admin or self

---

#### List Users
```
GET /api/v1/users
```

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 20)
- `role` (string) - Filter by role
- `status` (string) - Filter by status

**Response:** Paginated list of users

**Access Control:** Admin only

---

#### Update User Role
```
PATCH /api/v1/users/:id/role
```

**Request Body:**
```typescript
{
  role: 'student' | 'university' | 'admin';
}
```

**Response:** Updated user object

**Access Control:** Admin only

---

### 6. Analytics Domain

#### Track Event
```
POST /api/v1/analytics/events
```

**Request Body:**
```typescript
{
  event_type: string; // Required
  entity_type?: string;
  entity_id?: string;
  metadata?: Record<string, any>;
}
```

**Response:** Success message (201)

---

#### Get General Statistics
```
GET /api/v1/analytics/stats
```

**Response:** General statistics object

**Access Control:** Admin only

---

#### Get Admission Statistics
```
GET /api/v1/analytics/admissions
```

**Query Parameters:**
- `date_from` (string) - Filter from date
- `date_to` (string) - Filter to date

**Response:** Admission statistics object

**Access Control:** Admin only

---

#### Get User Statistics
```
GET /api/v1/analytics/users
```

**Response:** User statistics object

**Access Control:** Admin only

---

#### Get Aggregated Activity Feed
```
GET /api/v1/analytics/activity
```

**Query Parameters:**
- `limit` (number, default: 50)

**Response:** Aggregated activity feed

**Access Control:** Admin only

---

### 7. Changelogs Domain

#### List Changelogs
```
GET /api/v1/changelogs
```

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 20)
- `admission_id` (UUID) - Filter by admission
- `action_type` (string) - Filter by action type
- `actor_type` (string) - Filter by actor type
- `sort` (string) - Sort field (created_at)
- `order` (string) - Sort order (asc, desc)

**Response:** Paginated list of changelogs

---

#### Get Changelog by ID
```
GET /api/v1/changelogs/:id
```

**Response:** Single changelog object

---

#### Get Admission Changelogs
```
GET /api/v1/changelogs/admission/:admissionId
```

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 20)

**Response:** Paginated list of changelogs for admission

---

### 8. Watchlists Domain

#### List User's Watchlists
```
GET /api/v1/watchlists
```

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 20)
- `admission_id` (UUID) - Filter by admission
- `sort` (string) - Sort field (created_at)
- `order` (string) - Sort order (asc, desc)

**Response:** Paginated list of watchlists (with admission details)

**Access Control:** Authenticated users (own watchlists only)

---

#### Add to Watchlist
```
POST /api/v1/watchlists
```

**Request Body:**
```typescript
{
  admission_id: string; // Required
  notes?: string | null;
}
```

**Response:** Created watchlist object (201)

**Note:** Idempotent - if already exists, returns existing watchlist

**Access Control:** Authenticated users

---

#### Get Watchlist Item
```
GET /api/v1/watchlists/:id
```

**Response:** Single watchlist object (with admission details)

**Access Control:** Owner only

---

#### Update Watchlist Notes
```
PATCH /api/v1/watchlists/:id
```

**Request Body:**
```typescript
{
  notes?: string | null;
}
```

**Response:** Updated watchlist object

**Access Control:** Owner only

---

#### Remove from Watchlist
```
DELETE /api/v1/watchlists/:id
```

**Response:** Success message

**Access Control:** Owner only

---

### 9. User Preferences Domain

#### Get User Preferences
```
GET /api/v1/users/me/preferences
```

**Response:** User preferences object (or defaults if not set)

**Access Control:** Authenticated users

---

#### Update Preferences (Full Update)
```
PUT /api/v1/users/me/preferences
```

**Request Body:**
```typescript
{
  email_notifications_enabled?: boolean;
  email_frequency?: 'immediate' | 'daily' | 'weekly' | 'never';
  push_notifications_enabled?: boolean;
  notification_categories?: {
    verification?: boolean;
    deadline?: boolean;
    system?: boolean;
    update?: boolean;
  };
  language?: 'en' | 'ar' | 'fr' | 'es';
  timezone?: string;
  theme?: 'light' | 'dark' | 'auto';
}
```

**Response:** Updated preferences object

**Access Control:** Authenticated users

---

#### Partial Update Preferences
```
PATCH /api/v1/users/me/preferences
```

**Request Body:** Same as PUT (all fields optional)

**Response:** Updated preferences object

**Access Control:** Authenticated users

---

## 📊 Data Types

### Admission

```typescript
{
  id: string; // UUID
  university_id: string | null;
  title: string;
  description: string | null;
  program_type: string | null;
  degree_level: string | null;
  field_of_study: string | null;
  duration: string | null;
  tuition_fee: number | null;
  currency: string | null;
  application_fee: number | null;
  deadline: string | null; // ISO 8601 timestamp
  start_date: string | null; // ISO 8601 date
  location: string | null;
  campus: string | null;
  delivery_mode: string | null;
  requirements: Record<string, any> | null; // JSONB
  verification_status: 'draft' | 'pending' | 'verified' | 'rejected' | 'disputed';
  verified_at: string | null; // ISO 8601 timestamp
  verified_by: string | null;
  rejection_reason: string | null;
  dispute_reason: string | null;
  created_by: string | null;
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
  is_active: boolean;
}
```

### Notification

```typescript
{
  id: string; // UUID
  user_id: string | null;
  user_type: 'student' | 'university' | 'admin' | 'all';
  category: 'verification' | 'deadline' | 'system' | 'update';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  message: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  is_read: boolean;
  read_at: string | null; // ISO 8601 timestamp
  action_url: string | null;
  created_at: string; // ISO 8601 timestamp
}
```

### Deadline

```typescript
{
  id: string; // UUID
  admission_id: string;
  deadline_type: string;
  deadline_date: string; // ISO 8601 timestamp
  timezone: string;
  is_flexible: boolean;
  reminder_sent: boolean;
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
  // Calculated fields (in responses):
  days_remaining: number;
  is_overdue: boolean;
  urgency_level: 'low' | 'medium' | 'high' | 'critical' | 'expired';
}
```

### Watchlist

```typescript
{
  id: string; // UUID
  user_id: string;
  admission_id: string;
  notes: string | null;
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
  // Extended (in list responses):
  admission?: {
    id: string;
    title: string;
    field_of_study: string | null;
    university_id: string;
    status: string;
    created_at: string;
  };
}
```

### User Preferences

```typescript
{
  id: string; // UUID
  user_id: string;
  email_notifications_enabled: boolean;
  email_frequency: 'immediate' | 'daily' | 'weekly' | 'never';
  push_notifications_enabled: boolean;
  notification_categories: {
    verification?: boolean;
    deadline?: boolean;
    system?: boolean;
    update?: boolean;
  };
  language: 'en' | 'ar' | 'fr' | 'es';
  timezone: string;
  theme: 'light' | 'dark' | 'auto';
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
}
```

### User

```typescript
{
  id: string; // UUID
  auth_user_id: string; // Supabase Auth user ID
  role: 'student' | 'university' | 'admin';
  display_name: string | null;
  status: 'active' | 'inactive';
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
}
```

---

## 📝 Notes

### Date Formats
- All dates are in **ISO 8601** format
- Timestamps: `2026-01-18T10:30:00.000Z`
- Dates: `2026-01-18`

### UUIDs
- All IDs are UUIDs (v4)
- Format: `123e4567-e89b-12d3-a456-426614174000`

### Pagination
- Default `page`: 1
- Default `limit`: 20
- Maximum `limit`: 100

### Access Control Summary

| Role | Admissions | Notifications | Deadlines | Watchlists | Preferences |
|------|-----------|---------------|-----------|------------|-------------|
| Student | Read verified only | Own | Read | Own | Own |
| University | Own + verified | Own | Own | Own | Own |
| Admin | All | All | All | All | All |

---

**Last Updated:** January 18, 2026  
**API Version:** v1  
**Backend Version:** 1.0.0
