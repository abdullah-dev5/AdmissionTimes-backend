# API Contract – Corrected & Aligned to Actual Backend
**Generated:** January 28, 2026  
**Backend:** Express 5.2.1 + Node.js 18+ + TypeScript  
**Base URL (Dev):** `http://localhost:3000/api/v1`  
**Base URL (Prod):** `https://api.admissiontimes.com/api/v1`

---

## 🎯 Overview

This document defines the **actual** API contract implemented in the admission-times-backend system. It reflects the **current Express/Node backend**, not a hypothetical FastAPI implementation.

### Key Characteristics
- **Authentication:** Mock headers (`x-user-id`, `x-user-role`, `x-university-id`) currently; JWT planned Phase 4C
- **Response Envelope:** `{ success, message, data, pagination?, timestamp }`
- **Error Format:** `{ success: false, message, errors, timestamp }`
- **Field Naming:** 100% snake_case (e.g., `created_at`, `user_id`, `verification_status`)
- **Pagination Keys:** `page`, `limit`, `total`, `totalPages`, `hasNext`, `hasPrev`
- **Domains:** 9 total (admissions, notifications, deadlines, users, user-activity, analytics, changelogs, watchlists, user-preferences)

---

## 🔐 Authentication & Authorization

### Current (Phase 1–4B): Mock Headers
All requests must include:
```http
x-user-id: <user-uuid>
x-user-role: student | university | admin
x-university-id: <university-uuid>  # Only for university role
```

**Example:**
```http
GET /api/v1/admissions
x-user-id: 550e8400-e29b-41d4-a716-446655440001
x-user-role: student
```

**Middleware:** `mockAuth.ts` extracts headers into `req.user = { id, role, university_id }`

---

### Future (Phase 4C): Supabase JWT
Will replace mock headers with:
```http
Authorization: Bearer <jwt-token>
```

**Claims Extracted:**
- `sub` → user_id
- `role` → student/university/admin
- `org_id` → university_id

**New Endpoints (Phase 4C):**
```typescript
POST /api/v1/auth/signup
POST /api/v1/auth/signin
POST /api/v1/auth/signout
GET /api/v1/auth/me
```

⚠️ **Until Phase 4C ships:** Use mock headers only.

---

## 📦 Response Envelope

### Success Response
```json
{
  "success": true,
  "message": "Admissions retrieved successfully",
  "data": [...],
  "pagination": {           // Only on list endpoints
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  },
  "timestamp": "2026-01-28T10:30:00.000Z"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {               // Object, NOT "error.code/details"
    "title": "Title is required",
    "deadline": "Must be future date"
  },
  "timestamp": "2026-01-28T10:30:00.000Z"
}
```

**Notes:**
- No `error.code` field until Phase 4C-7
- `errors` is an object mapping fields to error messages
- For non-validation errors, `errors` may be omitted; rely on `message`

---

## 📋 Pagination

All list endpoints support pagination via query params:

**Request:**
```http
GET /api/v1/admissions?page=2&limit=20
```

**Response (in root, NOT in data):**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": true
  }
}
```

**Defaults:** `page=1`, `limit=20`  
**Max Limit:** `100` (enforced in backend)

---

## 🎓 Admissions Domain

### Schema
```typescript
interface Admission {
  id: string;                    // UUID
  title: string;
  description: string;
  field_of_study: string;
  location: string;              // "City, Country" or "Country"
  delivery_mode: 'On-campus' | 'Online' | 'Hybrid';
  degree_level: string;          // "Bachelor's" | "Master's" | "PhD"
  program_type: string;          // "Undergraduate" | "Graduate" | etc.
  duration: string;              // "4 years" | "2 semesters"
  tuition_fee: number;           // Numeric value
  application_fee: number;
  currency: string;              // "USD" | "PKR" | "GBP"
  deadline: string;              // ISO 8601 date
  start_date: string;            // ISO 8601 date
  requirements: {                // JSONB object
    eligibility?: string;        // GPA, test scores, etc.
    documents?: string[];        // ["Transcript", "IELTS"]
    highlights?: string[];       // ["Full scholarship", "Remote OK"]
    importantDates?: Record<string, string>;
    feeStructure?: Record<string, any>;
    officialLinks?: string[];
  };
  verification_status: 'draft' | 'pending' | 'verified' | 'rejected' | 'disputed';
  verified_at?: string;          // ISO 8601
  verified_by?: string;          // Admin user UUID
  rejection_reason?: string;
  dispute_reason?: string;
  created_by: string;            // University user UUID
  created_at: string;            // ISO 8601
  updated_at: string;            // ISO 8601
  is_active: boolean;
}
```

**Key Differences from Frontend Contract:**
- ✅ `location` replaces `country` + `city` (single field)
- ✅ `degree_level` (not `degree_type`)
- ✅ `duration` (not `program_duration`)
- ✅ `deadline` (not `application_deadline`)
- ✅ `tuition_fee` (singular, number, not string)
- ✅ `requirements` is JSONB object (not flat fields like `language_requirements`, `gpa_requirement`)
- ✅ `verification_status` only (no separate `status` field)
- ❌ No `tags`, `views`, `is_featured` (future Phase 6-4, 6-5)
- ❌ No `benefits`, `application_process` (use `requirements.highlights`)

---

### Endpoints

#### 1. List Admissions
```http
GET /api/v1/admissions
```

**Query Params:**
- `page` (default: 1)
- `limit` (default: 20, max: 100)
- `field_of_study` (filter)
- `location` (filter; partial match)
- `degree_level` (filter)
- `program_type` (filter)
- `verification_status` (filter; admin/university only)
- `created_by` (filter; university/admin only)
- `search` (text search across title, description)

**Role-Based Filtering:**
- **Students:** Only verified admissions (`verification_status = 'verified'`)
- **Universities:** Only own admissions (`created_by = req.user.id`)
- **Admins:** All admissions

**Response:**
```json
{
  "success": true,
  "message": "Admissions retrieved successfully",
  "data": [
    {
      "id": "uuid",
      "title": "MSc Computer Science",
      "location": "London, UK",
      "degree_level": "Master's",
      "duration": "1 year",
      "tuition_fee": 25000,
      "currency": "GBP",
      "deadline": "2026-05-01T00:00:00.000Z",
      "verification_status": "verified",
      "created_at": "2026-01-15T10:30:00.000Z",
      // ... other fields
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  },
  "timestamp": "2026-01-28T10:30:00.000Z"
}
```

---

#### 2. Get Single Admission
```http
GET /api/v1/admissions/:id
```

**Response:**
```json
{
  "success": true,
  "message": "Admission retrieved successfully",
  "data": {
    "id": "uuid",
    "title": "MSc Computer Science",
    "description": "...",
    "field_of_study": "Computer Science",
    "location": "London, UK",
    "delivery_mode": "On-campus",
    "degree_level": "Master's",
    "program_type": "Graduate",
    "duration": "1 year",
    "tuition_fee": 25000,
    "application_fee": 100,
    "currency": "GBP",
    "deadline": "2026-05-01T00:00:00.000Z",
    "start_date": "2026-09-01T00:00:00.000Z",
    "requirements": {
      "eligibility": "Bachelor's in CS or related; IELTS 6.5",
      "documents": ["Transcript", "IELTS", "Personal Statement"],
      "highlights": ["Merit scholarship available", "Industry placements"],
      "importantDates": {
        "Application Deadline": "2026-05-01",
        "Decision Date": "2026-06-15"
      },
      "officialLinks": ["https://uni.ac.uk/msc-cs"]
    },
    "verification_status": "verified",
    "verified_at": "2026-01-20T14:00:00.000Z",
    "verified_by": "admin-uuid",
    "created_by": "university-uuid",
    "created_at": "2026-01-15T10:30:00.000Z",
    "updated_at": "2026-01-20T14:00:00.000Z",
    "is_active": true
  },
  "timestamp": "2026-01-28T10:30:00.000Z"
}
```

---

#### 3. Create Admission (University Only)
```http
POST /api/v1/admissions
```

**Headers:**
```http
x-user-role: university
x-user-id: <university-user-uuid>
x-university-id: <university-uuid>
```

**Request Body:**
```json
{
  "title": "MSc Computer Science",
  "description": "...",
  "field_of_study": "Computer Science",
  "location": "London, UK",
  "delivery_mode": "On-campus",
  "degree_level": "Master's",
  "program_type": "Graduate",
  "duration": "1 year",
  "tuition_fee": 25000,
  "application_fee": 100,
  "currency": "GBP",
  "deadline": "2026-05-01T00:00:00.000Z",
  "start_date": "2026-09-01T00:00:00.000Z",
  "requirements": {
    "eligibility": "Bachelor's in CS or related; IELTS 6.5",
    "documents": ["Transcript", "IELTS", "Personal Statement"],
    "highlights": ["Merit scholarship available"]
  }
}
```

**Validation:**
- `title`: required, 5–200 chars
- `description`: required, 10–5000 chars
- `deadline`: required, must be future date
- `tuition_fee`: required, number >= 0
- `requirements`: optional JSONB object

**Response:**
```json
{
  "success": true,
  "message": "Admission created successfully",
  "data": {
    "id": "new-uuid",
    "verification_status": "draft",
    "created_by": "university-uuid",
    "created_at": "2026-01-28T10:30:00.000Z",
    // ... other fields
  },
  "timestamp": "2026-01-28T10:30:00.000Z"
}
```

---

#### 4. Update Admission (University Only, Own Admissions)
```http
PUT /api/v1/admissions/:id
```

**Headers:** `x-user-role: university`, `x-user-id: <uuid>`

**Request Body:** Same as create (all fields)

**Access Control:**
- University can only update own admissions (`created_by = req.user.id`)
- Cannot update if `verification_status = 'verified'` (must dispute first)

**Response:** Updated admission object

---

#### 5. Submit Admission for Verification (University Only)
```http
PATCH /api/v1/admissions/:id/submit
```

**Transitions:** `draft` → `pending`

**Access Control:** Only if `created_by = req.user.id` and `verification_status = 'draft'`

**Response:**
```json
{
  "success": true,
  "message": "Admission submitted for verification",
  "data": {
    "id": "uuid",
    "verification_status": "pending",
    "updated_at": "2026-01-28T10:30:00.000Z"
  }
}
```

---

#### 6. Verify Admission (Admin Only)
```http
PATCH /api/v1/admissions/:id/verify
```

**Headers:** `x-user-role: admin`

**Transitions:** `pending` → `verified`

**Response:**
```json
{
  "success": true,
  "message": "Admission verified successfully",
  "data": {
    "id": "uuid",
    "verification_status": "verified",
    "verified_at": "2026-01-28T10:30:00.000Z",
    "verified_by": "admin-uuid"
  }
}
```

---

#### 7. Reject Admission (Admin Only)
```http
PATCH /api/v1/admissions/:id/reject
```

**Headers:** `x-user-role: admin`

**Request Body:**
```json
{
  "reason": "Incomplete information; missing fee structure"
}
```

**Transitions:** `pending` → `rejected`

**Response:**
```json
{
  "success": true,
  "message": "Admission rejected",
  "data": {
    "id": "uuid",
    "verification_status": "rejected",
    "rejection_reason": "Incomplete information; missing fee structure",
    "updated_at": "2026-01-28T10:30:00.000Z"
  }
}
```

---

#### 8. Dispute Rejection (University Only)
```http
PATCH /api/v1/admissions/:id/dispute
```

**Headers:** `x-user-role: university`, `x-user-id: <uuid>`

**Request Body:**
```json
{
  "reason": "Fee structure was included in requirements.feeStructure"
}
```

**Transitions:** `rejected` → `disputed`

**Access Control:** Only if `created_by = req.user.id` and `verification_status = 'rejected'`

**Response:**
```json
{
  "success": true,
  "message": "Dispute submitted",
  "data": {
    "id": "uuid",
    "verification_status": "disputed",
    "dispute_reason": "Fee structure was included in requirements.feeStructure",
    "updated_at": "2026-01-28T10:30:00.000Z"
  }
}
```

---

#### 9. Delete Admission (University/Admin)
```http
DELETE /api/v1/admissions/:id
```

**Access Control:**
- University: Only own admissions (`created_by = req.user.id`) and `verification_status = 'draft'`
- Admin: Any admission

**Response:**
```json
{
  "success": true,
  "message": "Admission deleted successfully",
  "timestamp": "2026-01-28T10:30:00.000Z"
}
```

**Note:** Soft delete (sets `is_active = false`)

---

#### 10. Get Admission Changelogs
```http
GET /api/v1/admissions/:id/changelogs
```

**Query Params:** `page`, `limit`

**Response:**
```json
{
  "success": true,
  "message": "Changelogs retrieved",
  "data": [
    {
      "id": "uuid",
      "admission_id": "uuid",
      "changed_by": "user-uuid",
      "change_type": "updated",
      "field_name": "deadline",
      "old_value": "2026-03-01T00:00:00.000Z",
      "new_value": "2026-03-15T00:00:00.000Z",
      "diff_summary": "Extended deadline from Mar 1 to Mar 15",
      "created_at": "2026-01-28T10:30:00.000Z"
    }
  ],
  "pagination": {...}
}
```

---

## 🔔 Notifications Domain

### Schema
```typescript
interface Notification {
  id: string;
  user_type: 'student' | 'university' | 'admin';     // Recipient type
  category: 'verification' | 'deadline' | 'system' | 'update';  // NOT "type"
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  message: string;
  related_entity_type?: 'admission' | 'deadline' | 'user';  // Generic
  related_entity_id?: string;                        // NOT "related_admission_id"
  is_read: boolean;
  read_at?: string;                                  // Timestamp
  action_url?: string;                               // "/admissions/uuid"
  created_at: string;
}
```

**Key Differences from Frontend Contract:**
- ✅ `category` (not `type`)
- ✅ `related_entity_type` + `related_entity_id` (generic, not `related_admission_id`)
- ✅ `read_at` timestamp
- ✅ `action_url` for navigation

---

### Endpoints

#### 1. List Notifications
```http
GET /api/v1/notifications
```

**Query Params:**
- `page`, `limit`
- `category` (filter)
- `is_read` (filter: true/false)
- `priority` (filter)

**Role-Based Filtering:**
- Automatically filters by `user_type = req.user.role`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "user_type": "student",
      "category": "deadline",
      "priority": "high",
      "title": "Application Deadline Approaching",
      "message": "MSc CS at University of London deadline is in 7 days",
      "related_entity_type": "admission",
      "related_entity_id": "admission-uuid",
      "is_read": false,
      "read_at": null,
      "action_url": "/admissions/admission-uuid",
      "created_at": "2026-01-28T10:30:00.000Z"
    }
  ],
  "pagination": {...}
}
```

---

#### 2. Get Unread Count
```http
GET /api/v1/notifications/unread-count
```

**Response:**
```json
{
  "success": true,
  "data": {
    "unread_count": 5
  }
}
```

---

#### 3. Mark as Read
```http
PATCH /api/v1/notifications/:id/read
```

**Response:**
```json
{
  "success": true,
  "message": "Notification marked as read",
  "data": {
    "id": "uuid",
    "is_read": true,
    "read_at": "2026-01-28T10:35:00.000Z"
  }
}
```

---

#### 4. Mark All as Read
```http
PATCH /api/v1/notifications/read-all
```

**Response:**
```json
{
  "success": true,
  "message": "All notifications marked as read",
  "data": {
    "updated_count": 5
  }
}
```

---

#### 5. Create Notification (Admin Only)
```http
POST /api/v1/notifications
```

**Headers:** `x-user-role: admin`

**Request Body:**
```json
{
  "user_type": "student",
  "category": "system",
  "priority": "medium",
  "title": "System Maintenance",
  "message": "Scheduled maintenance on Sunday 2AM-4AM",
  "action_url": "/announcements/123"
}
```

**Response:** Created notification object

**Future (Phase 6-3):** Add bulk send via `recipient_type` param.

---

## 📅 Deadlines Domain

### Schema
```typescript
interface Deadline {
  id: string;
  admission_id: string;
  deadline_type: 'application' | 'decision' | 'enrollment' | 'fee_payment' | 'custom';
  deadline_date: string;     // ISO 8601
  reminder_sent: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}
```

---

### Endpoints

#### 1. List Deadlines
```http
GET /api/v1/deadlines
```

**Query Params:**
- `page`, `limit`
- `admission_id` (filter)
- `deadline_type` (filter)
- `from_date`, `to_date` (date range)

**Response:** Standard list with pagination

---

#### 2. Get Upcoming Deadlines
```http
GET /api/v1/deadlines/upcoming
```

**Query Params:**
- `days` (default: 30) – deadlines within next N days

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "admission_id": "uuid",
      "deadline_type": "application",
      "deadline_date": "2026-02-15T00:00:00.000Z",
      "days_until": 18,
      "admission_title": "MSc Computer Science"  // Joined from admissions
    }
  ]
}
```

---

#### 3. Create/Update/Delete Deadlines
```http
POST /api/v1/deadlines
PUT /api/v1/deadlines/:id
DELETE /api/v1/deadlines/:id
```

**Access Control:** University (own admissions), Admin (all)

---

## 👥 Users Domain

### Schema
```typescript
interface User {
  id: string;
  username: string;
  email: string;
  role: 'student' | 'university' | 'admin';   // NOT "user_type"
  university_id?: string;                     // For university role
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

**Key Difference:** `role` (not `user_type`)

---

### Endpoints

#### 1. Get Current User
```http
GET /api/v1/users/me
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "john_doe",
    "email": "john@example.com",
    "role": "student",
    "is_active": true,
    "created_at": "2026-01-01T00:00:00.000Z"
  }
}
```

---

#### 2. Update Current User
```http
PUT /api/v1/users/me
```

**Request Body:**
```json
{
  "username": "new_username",
  "email": "newemail@example.com"
}
```

**Response:** Updated user object

---

#### 3. List Users (Admin Only)
```http
GET /api/v1/users
```

**Query Params:** `page`, `limit`, `role` (filter)

**Response:** Standard list with pagination

---

#### 4. Update User Role (Admin Only)
```http
PATCH /api/v1/users/:id/role
```

**Request Body:**
```json
{
  "role": "admin",
  "university_id": null
}
```

**Response:** Updated user object

---

## 🔖 Watchlists Domain

### Schema
```typescript
interface Watchlist {
  id: string;
  user_id: string;
  admission_id: string;
  notes?: string;
  created_at: string;
  
  // Optionally joined
  admission?: Admission;
}
```

---

### Endpoints

#### 1. List Watchlist Items
```http
GET /api/v1/watchlists
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "user_id": "student-uuid",
      "admission_id": "admission-uuid",
      "notes": "My top choice",
      "created_at": "2026-01-25T10:00:00.000Z",
      "admission": {
        "id": "admission-uuid",
        "title": "MSc Computer Science",
        "location": "London, UK",
        "deadline": "2026-05-01T00:00:00.000Z"
      }
    }
  ],
  "pagination": {...}
}
```

---

#### 2. Add to Watchlist
```http
POST /api/v1/watchlists
```

**Request Body:**
```json
{
  "admission_id": "admission-uuid",
  "notes": "My top choice"
}
```

**Validation:**
- Admission must exist
- No duplicates (user_id + admission_id unique)

**Response:** Created watchlist item

---

#### 3. Update Watchlist Item
```http
PATCH /api/v1/watchlists/:id
```

**Request Body:**
```json
{
  "notes": "Updated notes"
}
```

**Response:** Updated watchlist item

---

#### 4. Remove from Watchlist
```http
DELETE /api/v1/watchlists/:id
```

**Response:**
```json
{
  "success": true,
  "message": "Watchlist item removed"
}
```

---

## 📊 Dashboards

### 1. Student Dashboard
```http
GET /api/v1/student/dashboard
```

**Headers:** `x-user-role: student`

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "john_doe",
      "email": "john@example.com",
      "role": "student"
    },
    "statistics": {
      "total_watchlist": 5,
      "upcoming_deadlines": 3,
      "unread_notifications": 2
    },
    "recent_admissions": [
      {
        "id": "uuid",
        "title": "MSc Computer Science",
        "location": "London, UK",
        "deadline": "2026-05-01T00:00:00.000Z"
      }
    ],
    "upcoming_deadlines": [
      {
        "admission_title": "BSc Data Science",
        "deadline_date": "2026-02-15T00:00:00.000Z",
        "days_until": 18
      }
    ],
    "watchlisted_admissions": [...]
  }
}
```

---

### 2. University Dashboard
```http
GET /api/v1/university/dashboard
```

**Headers:** `x-user-role: university`

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {...},
    "statistics": {
      "total_admissions": 12,
      "verified_admissions": 8,
      "pending_admissions": 3,
      "rejected_admissions": 1
    },
    "recent_admissions": [...],
    "pending_verifications": [...]
  }
}
```

---

### 3. Admin Dashboard
```http
GET /api/v1/admin/dashboard
```

**Headers:** `x-user-role: admin`

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {...},
    "statistics": {
      "total_users": 250,
      "total_admissions": 80,
      "pending_verifications": 5,
      "total_universities": 15
    },
    "pending_verifications": [...],
    "recent_activity": [...]
  }
}
```

---

### 4. Student Recommendations
```http
GET /api/v1/student/recommendations
```

**Headers:** `x-user-role: student`

**Response:**
```json
{
  "success": true,
  "data": {
    "based_on_activity": [...],
    "based_on_preferences": [...],
    "trending": [...]
  }
}
```

---

## 📜 Changelogs Domain

### Schema
```typescript
interface Changelog {
  id: string;
  admission_id: string;
  actor_type: 'admin' | 'university' | 'system';
  changed_by: string;           // User UUID
  action_type: 'created' | 'updated' | 'verified' | 'rejected' | 'disputed' | 'status_changed';
  field_name: string | null;    // NOT "field_changed"
  old_value: Record<string, any> | null;
  new_value: Record<string, any> | null;
  diff_summary: string | null;  // Human-readable summary
  metadata?: Record<string, any>;
  created_at: string;
  
  // Future (Phase 6-6)
  changed_by_name?: string;     // Via JOIN
  reason?: string;              // User-provided justification
}
```

**Key Differences:**
- ✅ `field_name` (not `field_changed`)
- ✅ `action_type` enum (actor performing the action: admin, university, system)
- ✅ `diff_summary` (pre-computed)
- ✅ `changed_by` (not `changed_by_user_id`)
- ✅ `actor_type` (who made the change)
- 🔜 `changed_by_name`, `reason` (Phase 6-6)

---

### Endpoints

#### 1. List Changelogs
```http
GET /api/v1/changelogs
```

**Query Params:**
- `page`, `limit`
- `admission_id` (filter)
- `change_type` (filter)
- `changed_by` (filter)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "admission_id": "admission-uuid",
      "changed_by": "user-uuid",
      "change_type": "updated",
      "field_name": "deadline",
      "old_value": "2026-03-01T00:00:00.000Z",
      "new_value": "2026-03-15T00:00:00.000Z",
      "diff_summary": "Extended deadline from Mar 1 to Mar 15",
      "created_at": "2026-01-28T10:30:00.000Z"
    }
  ],
  "pagination": {...}
}
```

---

#### 2. Get Changelog by ID
```http
GET /api/v1/changelogs/:id
```

**Response:** Single changelog object

---

#### 3. Get Changelogs by Admission
```http
GET /api/v1/changelogs/admission/:admissionId
```

**Query Params:** `page`, `limit`

**Response:** List of changelogs for that admission

**Note:** Also accessible via `GET /api/v1/admissions/:id/changelogs`

---

## ⚙️ User Preferences Domain

### Schema
```typescript
interface UserPreferences {
  user_id: string;
  notification_settings: {
    email_notifications: boolean;
    deadline_reminders: boolean;
    verification_updates: boolean;
  };
  filter_preferences?: {
    preferred_locations?: string[];
    preferred_fields?: string[];
    preferred_degree_levels?: string[];
  };
  created_at: string;
  updated_at: string;
}
```

---

### Endpoints

#### 1. Get User Preferences
```http
GET /api/v1/users/me/preferences
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "notification_settings": {
      "email_notifications": true,
      "deadline_reminders": true,
      "verification_updates": false
    },
    "filter_preferences": {
      "preferred_locations": ["UK", "USA"],
      "preferred_fields": ["Computer Science", "Data Science"],
      "preferred_degree_levels": ["Master's"]
    },
    "created_at": "2026-01-01T00:00:00.000Z",
    "updated_at": "2026-01-28T10:30:00.000Z"
  }
}
```

---

#### 2. Update User Preferences (Full Replace)
```http
PUT /api/v1/users/me/preferences
```

**Request Body:** Complete preferences object

**Response:** Updated preferences

---

#### 3. Patch User Preferences (Partial Update)
```http
PATCH /api/v1/users/me/preferences
```

**Request Body:**
```json
{
  "notification_settings": {
    "deadline_reminders": false
  }
}
```

**Response:** Updated preferences

---

## 📈 Analytics Domain

### Endpoints

#### 1. Track Event
```http
POST /api/v1/analytics/events
```

**Request Body:**
```json
{
  "event_type": "admission_view",
  "metadata": {
    "admission_id": "uuid",
    "duration": 120
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Event tracked"
}
```

---

#### 2. Get Analytics Stats
```http
GET /api/v1/analytics/stats
```

**Headers:** `x-user-role: admin`

**Response:**
```json
{
  "success": true,
  "data": {
    "total_events": 5000,
    "events_by_type": {
      "admission_view": 2000,
      "watchlist_add": 500,
      "notification_read": 1500
    }
  }
}
```

---

#### 3. Get Admission Analytics
```http
GET /api/v1/analytics/admissions
```

**Headers:** `x-user-role: admin`

**Response:**
```json
{
  "success": true,
  "data": {
    "total_admissions": 80,
    "verified": 60,
    "pending": 15,
    "rejected": 5,
    "by_university": [...]
  }
}
```

---

#### 4. Get User Analytics
```http
GET /api/v1/analytics/users
```

**Headers:** `x-user-role: admin`

**Response:**
```json
{
  "success": true,
  "data": {
    "total_users": 250,
    "students": 200,
    "universities": 45,
    "admins": 5,
    "active_users_30d": 180
  }
}
```

---

#### 5. Get Activity Feed
```http
GET /api/v1/analytics/activity
```

**Headers:** `x-user-role: admin`

**Query Params:** `page`, `limit`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "event_type": "admission_created",
      "user_id": "uuid",
      "metadata": {...},
      "created_at": "2026-01-28T10:30:00.000Z"
    }
  ],
  "pagination": {...}
}
```

---

## 🚦 User Activity Domain

### Schema
```typescript
interface UserActivity {
  id: string;
  user_id: string;
  action: string;           // "view_admission", "add_watchlist", etc.
  resource_type: string;    // "admission", "notification"
  resource_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
}
```

---

### Endpoints

#### 1. List User Activity
```http
GET /api/v1/activity
```

**Query Params:** `page`, `limit`, `action` (filter)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "user_id": "student-uuid",
      "action": "view_admission",
      "resource_type": "admission",
      "resource_id": "admission-uuid",
      "metadata": {
        "duration": 120
      },
      "created_at": "2026-01-28T10:30:00.000Z"
    }
  ],
  "pagination": {...}
}
```

---

#### 2. Get Activity by ID
```http
GET /api/v1/activity/:id
```

**Response:** Single activity object

---

## 🌐 Path Mapping (Frontend → Backend)

Frontend developers: **Do NOT use role-namespaced paths** like `/student/admissions`. Backend uses shared endpoints with role-based filtering.

| Frontend Path (Incorrect) | Actual Backend Path | Notes |
|---------------------------|---------------------|-------|
| `/student/admissions` | `/api/v1/admissions` | Use with `x-user-role: student` header |
| `/university/admissions` | `/api/v1/admissions` | Use with `x-user-role: university` header |
| `/admin/admissions` | `/api/v1/admissions` | Use with `x-user-role: admin` header |
| `/student/watchlist` | `/api/v1/watchlists` | Plural, no role prefix |
| `/student/notifications` | `/api/v1/notifications` | No role prefix; backend filters by role |
| `/university/change-logs` | `/api/v1/changelogs` | No hyphens, plural |
| `/student/dashboard` | `/api/v1/student/dashboard` | ✅ Correct |
| `/university/dashboard` | `/api/v1/university/dashboard` | ✅ Correct |
| `/admin/dashboard` | `/api/v1/admin/dashboard` | ✅ Correct |
| `/auth/signup` | ❌ Not yet implemented | Phase 4C |
| `/auth/signin` | ❌ Not yet implemented | Phase 4C |
| `/admin/scraper/*` | ❌ Not yet implemented | Phase 6-2 |
| `/student/ai/chat` | ❌ Not yet implemented | Phase 6-1 |

---

## 🔮 Future Features (Not Yet Implemented)

### Phase 4C (Security)
- ✅ Real JWT authentication (`/auth/signup`, `/auth/signin`, `/auth/signout`)
- ✅ Error code taxonomy (`error.code` field)
- ✅ Rate limiting, security headers, input sanitization

### Phase 6 (Product Features)
- 🔜 AI Chat Endpoint (`POST /api/v1/student/ai/chat`)
- 🔜 Scraper Management (`GET /admin/scraper/logs`, `POST /admin/scraper/trigger`)
- 🔜 Bulk Notifications (`POST /notifications` with `recipient_type`)
- 🔜 Featured Admissions (`is_featured` field, admin toggle)
- 🔜 Tags (`tags` JSONB array on admissions)
- 🔜 Views Tracking (`views` counter on admissions)
- 🔜 Changelog Enhancements (`changed_by_name`, `reason` fields)

See [BACKEND_TODO_PRIORITIZED_JAN_2026.md](BACKEND_TODO_PRIORITIZED_JAN_2026.md) for full roadmap.

---

## 🛡️ Error Codes (Phase 4C-7 - Future)

Currently, error responses use `errors` object with field-specific messages. In Phase 4C-7, a standardized error code taxonomy will be added:

```json
{
  "success": false,
  "message": "Validation failed",
  "error_code": "VALIDATION_ERROR",
  "errors": {
    "title": "Title is required"
  },
  "timestamp": "..."
}
```

**Planned Codes:**
- `VALIDATION_ERROR` – Joi validation failed
- `UNAUTHORIZED` – Missing/invalid auth
- `FORBIDDEN` – Insufficient permissions
- `NOT_FOUND` – Resource doesn't exist
- `CONFLICT` – Duplicate resource
- `RATE_LIMIT_EXCEEDED` – Too many requests
- `INTERNAL_ERROR` – Server error

---

## 📚 Additional Resources

- **Backend Repo:** `admission-times-backend`
- **Comprehensive System Report:** [FINAL_SYSTEM_REPORT_JAN_2026.md](FINAL_SYSTEM_REPORT_JAN_2026.md)
- **Backend TODO:** [BACKEND_TODO_PRIORITIZED_JAN_2026.md](BACKEND_TODO_PRIORITIZED_JAN_2026.md)
- **Frontend Integration Guide:** [FRONTEND_TODO_ALIGNMENT_JAN_2026.md](FRONTEND_TODO_ALIGNMENT_JAN_2026.md)
- **Swagger Docs:** `http://localhost:3000/api-docs` (when backend is running)
- **Postman Collection:** [postman_collection.json](postman_collection.json)

---

**Contract Version:** 1.0.0 (Corrected)  
**Last Updated:** January 28, 2026  
**Maintained By:** Backend Team
