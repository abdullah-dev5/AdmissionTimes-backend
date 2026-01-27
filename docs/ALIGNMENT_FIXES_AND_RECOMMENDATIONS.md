# Frontend-Backend Alignment Fixes & Recommendations
**Date:** January 28, 2026  
**Purpose:** Resolve mismatches between frontend contract and actual Express/Node backend

---

## 🎯 Executive Summary

**Status:** Frontend contract provided references FastAPI/Python backend; actual backend is Express/Node/TypeScript.  
**Impact:** Medium - Core endpoints align, but field names, pagination, and response shapes differ.  
**Action:** Fix contract document (4 changes) + frontend code updates (6 areas) + add future features to roadmap.

---

## ✅ Changes to Make (Contract Document)

### 1. Base URL & Stack Reference
**Current (Incorrect):**
```
Development: http://localhost:8000/api/v1
Backend: FastAPI
```

**Corrected:**
```
Development: http://localhost:3000/api/v1
Production: https://api.admissiontimes.com/api/v1
Backend: Express 5 + Node.js 18+ + TypeScript (strict mode)
```

**Action:** Update contract intro section.

---

### 3. Pagination Keys Alignment
**Current (Frontend Contract):**
```json
{
  "page": 1,
  "page_size": 20,
  "total_items": 150,
  "total_pages": 8,
  "has_next": true,
  "has_prev": false
}
```

**Actual Backend:**
```json
{
  "page": 1,
  "limit": 20,
  "total": 150,
  "totalPages": 8,
  "hasNext": true,
  "hasPrev": false
}
```

**Action:** Frontend must use backend keys: `limit`, `total`, `totalPages`, `hasNext`, `hasPrev`.

---

### 4. Field Name Alignment (snake_case + Backend Schema)

#### 4.1 Admissions Fields

| Frontend Contract Field | Actual Backend Field | Action |
|------------------------|---------------------|--------|
| `country` | `location` | ✅ Use `location` (includes country/city/campus) |
| `city` | (embedded in `location`) | ✅ Remove `city` as separate field |
| `degree_type` | `degree_level` | ✅ Rename to `degree_level` |
| `program_duration` | `duration` | ✅ Rename to `duration` |
| `application_deadline` | `deadline` | ✅ Rename to `deadline` |
| `tuition_fees` | `tuition_fee` | ✅ Rename to `tuition_fee` (singular) |
| `language_requirements` | (embedded in `requirements` JSONB) | ✅ Access via `requirements.eligibility` |
| `gpa_requirement` | (embedded in `requirements` JSONB) | ✅ Access via `requirements.eligibility` |
| `description` | `description` | ✅ Keep as-is |
| `benefits` | ❌ Not in backend | ⚠️ Remove or map to `requirements.highlights` |
| `application_process` | ❌ Not in backend | ⚠️ Remove or map to custom field |
| `documents_required` | (embedded in `requirements.documents`) | ✅ Access via `requirements.documents` |
| `status` | `verification_status` | ✅ Use `verification_status` only |
| `verification_status` | `verification_status` | ✅ Keep (enum: draft/pending/verified/rejected/disputed) |
| `tags` | ❌ Not in backend | ⚠️ Remove (not implemented yet) |
| `views` | ❌ Not in backend | ⚠️ Remove (analytics not exposed) |
| `is_featured` | ❌ Not in backend | ⚠️ Remove (not implemented yet) |

#### 4.2 Notifications Fields

**Frontend Contract:**
```json
{
  "id": "uuid",
  "title": "...",
  "message": "...",
  "type": "deadline",
  "priority": "high",
  "related_admission_id": "uuid",
  "is_read": false,
  "created_at": "..."
}
```

**Actual Backend:**
```json
{
  "id": "uuid",
  "user_type": "student",
  "category": "deadline",           // ← not "type"
  "priority": "high",
  "title": "...",
  "message": "...",
  "related_entity_type": "admission",  // ← generic
  "related_entity_id": "uuid",         // ← not "related_admission_id"
  "is_read": false,
  "read_at": null,
  "action_url": "/admissions/uuid",
  "created_at": "..."
}
```

**Recommendation:** **Keep backend fields**. Frontend should adapt.

**Action for Frontend:**
- Use `category` instead of `type`
- Use `related_entity_id` instead of `related_admission_id`
- Add `related_entity_type` check (future-proof for deadlines, users, etc.)
- Add `action_url` for navigation
- Add `read_at` timestamp

---

#### 4.3 Changelogs Fields

**Frontend Contract:**
```json
{
  "id": "uuid",
  "admission_id": "uuid",
  "admission_title": "...",
  "field_changed": "application_deadline",
  "old_value": "...",
  "new_value": "...",
  "changed_by_user_id": "uuid",
  "changed_by_name": "Rep Name",
  "reason": "Extended due to high demand",
  "created_at": "..."
}
```

**Actual Backend:**
```json
{
  "id": "uuid",
  "admission_id": "uuid",
  "actor_type": "university",        // ← WHO made the change
  "changed_by": "uuid",              // ← user_id
  "action_type": "updated",          // ← WHAT action (created/updated/verified/rejected/disputed/status_changed)
  "field_name": "deadline",          // ← not "field_changed"
  "old_value": {...},                // ← now JSONB
  "new_value": {...},                // ← now JSONB
  "diff_summary": "Extended deadline from Mar 1 to Mar 15",  // ← pre-computed human text
  "metadata": {},                    // ← future: IP, user agent, etc.
  "created_at": "..."
}
```

**Recommendation:** **Merge both approaches** - Backend has richer data; frontend needs display-friendly fields.

**Action for Backend (optional enhancement):**
- Add `changed_by_name` as computed field (JOIN users table on response)
- Keep `diff_summary` as human-readable summary
- Add `reason` field for user-provided justification (new column)

**Action for Frontend:**
- Use `field_name` instead of `field_changed`
- Use `action_type` for change categorization (e.g., "Verification Actions", "Field Updates")
- Use `actor_type` to show who made the change (admin, university, system)
- Display `diff_summary` as primary message
- Fetch `changed_by` user details separately if `changed_by_name` not provided
- Map `field_name` to human labels (e.g., `deadline` → "Application Deadline")

**Recommended Hybrid Schema (Backend Response):**
```json
{
  "id": "uuid",
  "admission_id": "uuid",
  "actor_type": "university",         // ← Backend
  "action_type": "updated",           // ← Backend (not "change_type")
  "field_name": "deadline",           // ← Backend
  "old_value": "2026-03-01T...",     // ← Backend (JSONB)
  "new_value": "2026-03-15T...",     // ← Backend (JSONB)
  "diff_summary": "Extended deadline from Mar 1 to Mar 15",  // ← Backend (computed)
  "changed_by": "uuid",              // ← Backend
  "changed_by_name": "Rep Name",     // ← Backend (add via JOIN or service layer)
  "reason": "Extended due to high demand",  // ← Backend (new field)
  "created_at": "..."                // ← Backend
}
```

---

### 6. Response Envelope Alignment

**Frontend Contract (Incorrect):**
```json
{
  "success": true,
  "message": "...",
  "data": {...},
  "timestamp": "..."
}

// Error:
{
  "success": false,
  "message": "...",
  "error": {
    "code": "ERROR_CODE",
    "details": "..."
  },
  "timestamp": "..."
}
```

**Actual Backend:**
```json
{
  "success": true,
  "message": "...",
  "data": {...},
  "pagination": {...},  // ← only on list endpoints
  "timestamp": "..."
}

// Error:
{
  "success": false,
  "message": "Error description",
  "errors": {           // ← NOT "error", plural "errors"
    "field1": "specific error",
    "field2": "..."
  },
  "timestamp": "..."
}
```

**Action for Frontend:**
- Error handling: expect `errors` (object), not `error.code/details`
- No `code` field until Phase 4C-7 (error code taxonomy)
- Pagination: nested in root response, not in `data`

**Example Frontend Error Handler:**
```typescript
try {
  const response = await api.call();
  return response.data;
} catch (err) {
  if (err.response?.data?.errors) {
    // Map field errors to form
    Object.entries(err.response.data.errors).forEach(([field, msg]) => {
      setFieldError(field, msg);
    });
  } else {
    showToast(err.response?.data?.message || 'An error occurred');
  }
}
```

---

## 🔍 Modules/Paths Differences

### Current Situation

**Frontend Contract Paths:**
```
/auth/signup
/auth/signin
/auth/signout
/auth/me

/student/dashboard
/student/admissions
/student/watchlist
/student/notifications
/student/ai/chat

/university/dashboard
/university/admissions
/university/change-logs

/admin/dashboard
/admin/admissions
/admin/users
/admin/scraper/logs
/admin/scraper/trigger
/admin/notifications/send
```

**Actual Backend Paths:**
```
(No /auth/* endpoints yet - mock headers only)
/api/v1/users/me  (get current user)

/api/v1/student/dashboard
/api/v1/admissions  (students see verified only via role check)
/api/v1/watchlists
/api/v1/notifications
(No AI chat endpoint)

/api/v1/university/dashboard
/api/v1/admissions  (universities see own via role check)
/api/v1/changelogs  (standalone, not /change-logs)

/api/v1/admin/dashboard
/api/v1/admissions  (admins see all via role check)
/api/v1/users
/api/v1/analytics/*  (instead of scraper logs)
(No scraper trigger endpoint)
(No admin notifications send endpoint yet)
```

### ⚠️ Path Issues & Recommendations

| Frontend Path | Backend Path | Issue | Recommendation |
|--------------|-------------|-------|----------------|
| `/student/admissions` | `/api/v1/admissions` | ❌ Namespaced | **Frontend:** Call `/api/v1/admissions` with `x-user-role: student` header. Backend filters by role. |
| `/university/admissions` | `/api/v1/admissions` | ❌ Namespaced | **Frontend:** Same endpoint, different header (`x-user-role: university`). |
| `/admin/admissions` | `/api/v1/admissions` | ❌ Namespaced | **Frontend:** Same endpoint, different header (`x-user-role: admin`). |
| `/student/watchlist` | `/api/v1/watchlists` | ❌ Singular vs plural | **Frontend:** Use `/api/v1/watchlists` (plural). |
| `/student/notifications` | `/api/v1/notifications` | ❌ Namespaced | **Frontend:** Use `/api/v1/notifications` (role-scoped in backend). |
| `/university/change-logs` | `/api/v1/changelogs` | ❌ Hyphenated vs camelCase | **Frontend:** Use `/api/v1/changelogs` (no hyphens). |
| `/admin/scraper/*` | ❌ Not implemented | Missing feature | **Skip for now.** Add to Phase 5 roadmap. |
| `/student/ai/chat` | ❌ Not implemented | Missing feature | **Skip for now.** Add to Phase 5 roadmap. |
| `/admin/notifications/send` | ❌ Not implemented | Partial feature | `POST /api/v1/notifications` exists (admin only) but not namespaced. **Frontend:** Use `/api/v1/notifications` with admin role. |

### ✅ Recommended Frontend API Client Structure

```typescript
// src/api/endpoints.ts
const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

export const ENDPOINTS = {
  // Auth (future)
  auth: {
    me: '/users/me',  // Current mock
    // signup, signin, signout will be added in Phase 4C
  },
  
  // Admissions (shared across roles; backend filters by role)
  admissions: {
    list: '/admissions',
    detail: (id: string) => `/admissions/${id}`,
    create: '/admissions',
    update: (id: string) => `/admissions/${id}`,
    delete: (id: string) => `/admissions/${id}`,
    submit: (id: string) => `/admissions/${id}/submit`,
    verify: (id: string) => `/admissions/${id}/verify`,
    reject: (id: string) => `/admissions/${id}/reject`,
    dispute: (id: string) => `/admissions/${id}/dispute`,
    changelogs: (id: string) => `/admissions/${id}/changelogs`,
  },
  
  // Dashboards (role-specific)
  dashboards: {
    student: '/student/dashboard',
    university: '/university/dashboard',
    admin: '/admin/dashboard',
    recommendations: '/student/recommendations',
  },
  
  // Watchlists
  watchlists: {
    list: '/watchlists',
    add: '/watchlists',
    get: (id: string) => `/watchlists/${id}`,
    update: (id: string) => `/watchlists/${id}`,
    delete: (id: string) => `/watchlists/${id}`,
  },
  
  // Notifications
  notifications: {
    list: '/notifications',
    unreadCount: '/notifications/unread-count',
    detail: (id: string) => `/notifications/${id}`,
    markRead: (id: string) => `/notifications/${id}/read`,
    markAllRead: '/notifications/read-all',
    create: '/notifications',  // Admin only
    delete: (id: string) => `/notifications/${id}`,
  },
  
  // Changelogs
  changelogs: {
    list: '/changelogs',
    detail: (id: string) => `/changelogs/${id}`,
    byAdmission: (admissionId: string) => `/changelogs/admission/${admissionId}`,
  },
  
  // Deadlines
  deadlines: {
    list: '/deadlines',
    upcoming: '/deadlines/upcoming',
    detail: (id: string) => `/deadlines/${id}`,
    create: '/deadlines',
    update: (id: string) => `/deadlines/${id}`,
    delete: (id: string) => `/deadlines/${id}`,
  },
  
  // User Activity
  activity: {
    list: '/activity',
    detail: (id: string) => `/activity/${id}`,
  },
  
  // Users
  users: {
    me: '/users/me',
    updateMe: '/users/me',
    byId: (id: string) => `/users/${id}`,
    list: '/users',
    updateRole: (id: string) => `/users/${id}/role`,
  },
  
  // User Preferences
  preferences: {
    get: '/users/me/preferences',
    update: '/users/me/preferences',
    patch: '/users/me/preferences',
  },
  
  // Analytics
  analytics: {
    trackEvent: '/analytics/events',
    stats: '/analytics/stats',
    admissionStats: '/analytics/admissions',
    userStats: '/analytics/users',
    activityFeed: '/analytics/activity',
  },
};
```

**Key Insight:** Backend uses **role-based filtering on shared endpoints** (e.g., `/admissions`), not path namespacing (e.g., `/student/admissions`). Frontend must send correct headers; backend enforces access control in services.

---

## 📋 What to Fix in Frontend

### 1. API Client Base URL
**File:** `src/api/client.ts` or `src/config/api.ts`

**Change:**
```typescript
// Before
const API_BASE_URL = 'http://localhost:8000/api/v1';

// After
const API_BASE_URL = 'http://localhost:3000/api/v1';
```

---

### 2. Pagination Handling
**File:** `src/types/api.ts` or `src/hooks/usePagination.ts`

**Change:**
```typescript
// Before
interface Pagination {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

// After (match backend)
interface Pagination {
  page: number;
  limit: number;         // ← was page_size
  total: number;         // ← was total_items
  totalPages: number;    // ← was total_pages
  hasNext: boolean;      // ← was has_next
  hasPrev: boolean;      // ← was has_prev
}
```

**Update all usages:**
```typescript
// Before
const { total_items, total_pages, has_next } = response.data.pagination;

// After
const { total, totalPages, hasNext } = response.pagination;  // ← root level, not in data
```

---

### 3. Admissions Field Mapping
**File:** `src/types/admission.ts`

**Change:**
```typescript
// Before
interface Admission {
  id: string;
  title: string;
  university: string;
  country: string;              // ❌
  city: string;                 // ❌
  degree_type: string;          // ❌
  program_duration: string;     // ❌
  application_deadline: string; // ❌
  tuition_fees: string;         // ❌
  language_requirements: string; // ❌
  gpa_requirement: string;      // ❌
  description: string;
  benefits?: string;            // ❌
  application_process?: string; // ❌
  status: string;               // ❌
  verification_status: string;
  tags: string[];               // ❌
  views: number;                // ❌
  is_featured: boolean;         // ❌
  created_at: string;
  updated_at: string;
}

// After (match backend schema)
interface Admission {
  id: string;
  title: string;
  description: string;
  field_of_study: string;
  location: string;             // ✅ replaces country + city
  delivery_mode: string;        // 'On-campus' | 'Online' | 'Hybrid'
  degree_level: string;         // ✅ was degree_type
  program_type: string;         // 'Undergraduate' | 'Graduate' | etc.
  duration: string;             // ✅ was program_duration
  tuition_fee: number;          // ✅ was tuition_fees (singular, number)
  application_fee: number;
  currency: string;             // 'USD' | 'PKR' | etc.
  deadline: string;             // ✅ was application_deadline (ISO 8601)
  start_date: string;           // ISO 8601
  requirements: {               // ✅ JSONB object
    eligibility?: string;       // GPA, test scores
    documents?: string[];
    highlights?: string[];
    importantDates?: Record<string, string>;
    feeStructure?: Record<string, any>;
    officialLinks?: string[];
  };
  verification_status: 'draft' | 'pending' | 'verified' | 'rejected' | 'disputed';
  verified_at?: string;
  verified_by?: string;
  rejection_reason?: string;
  dispute_reason?: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}
```

**Migration Helper (if needed):**
```typescript
// src/utils/admissionMapper.ts
export function mapLegacyAdmission(legacy: LegacyAdmission): Admission {
  return {
    ...legacy,
    location: legacy.country ? `${legacy.city}, ${legacy.country}` : legacy.city,
    degree_level: legacy.degree_type,
    duration: legacy.program_duration,
    tuition_fee: parseFloat(legacy.tuition_fees.replace(/[^0-9.]/g, '')),
    deadline: legacy.application_deadline,
    requirements: {
      eligibility: [legacy.gpa_requirement, legacy.language_requirements].filter(Boolean).join('; '),
      documents: legacy.documents_required || [],
      highlights: legacy.benefits ? [legacy.benefits] : [],
    },
  };
}
```

---

### 4. Notifications Field Mapping
**File:** `src/types/notification.ts`

**Change:**
```typescript
// Before
interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;                    // ❌
  priority?: string;
  related_admission_id?: string;   // ❌
  is_read: boolean;
  created_at: string;
}

// After (match backend)
interface Notification {
  id: string;
  user_type: 'student' | 'university' | 'admin';  // ✅ recipient type
  category: 'verification' | 'deadline' | 'system' | 'update';  // ✅ was "type"
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  message: string;
  related_entity_type?: 'admission' | 'deadline' | 'user';  // ✅ generic
  related_entity_id?: string;      // ✅ was related_admission_id
  is_read: boolean;
  read_at?: string;                // ✅ timestamp when marked read
  action_url?: string;             // ✅ navigation target
  created_at: string;
}
```

**Update API Calls:**
```typescript
// Before
const admissionId = notification.related_admission_id;
const category = notification.type;

// After
const entityId = notification.related_entity_id;
const entityType = notification.related_entity_type;
const category = notification.category;

// Navigate on click
const handleClick = () => {
  if (notification.action_url) {
    navigate(notification.action_url);
  } else if (notification.related_entity_type === 'admission') {
    navigate(`/admissions/${notification.related_entity_id}`);
  }
};
```

---

### 5. Changelogs Field Mapping
**File:** `src/types/changelog.ts`

**Change:**
```typescript
// Before
interface ChangeLog {
  id: string;
  admission_id: string;
  admission_title: string;      // ❌ not in backend
  field_changed: string;        // ❌
  old_value: string | null;
  new_value: string;
  changed_by_user_id: string;   // ❌
  changed_by_name: string;      // ❌ not in backend (yet)
  reason?: string;              // ❌ not in backend (yet)
  created_at: string;
}

// After (match backend + optional enhancements)
interface ChangeLog {
  id: string;
  admission_id: string;
  changed_by: string;           // ✅ user UUID
  change_type: 'created' | 'updated' | 'verified' | 'rejected' | 'disputed' | 'status_changed';  // ✅
  field_name: string;           // ✅ was field_changed
  old_value: string | null;
  new_value: string;
  diff_summary: string;         // ✅ human-readable summary
  metadata?: Record<string, any>;  // ✅ future: IP, user agent
  created_at: string;
  
  // Optional (if backend adds via JOIN/service layer)
  changed_by_name?: string;     // Fetch separately or backend adds
  reason?: string;              // Backend Phase 4C+
}
```

**Display Helper:**
```typescript
// src/utils/changelogHelpers.ts
export function formatChangeLog(log: ChangeLog): string {
  // Use backend's pre-computed diff_summary
  if (log.diff_summary) return log.diff_summary;
  
  // Fallback: compute locally
  const fieldLabel = FIELD_LABELS[log.field_name] || log.field_name;
  return `${fieldLabel}: ${log.old_value} → ${log.new_value}`;
}

const FIELD_LABELS: Record<string, string> = {
  deadline: 'Application Deadline',
  tuition_fee: 'Tuition Fee',
  duration: 'Program Duration',
  verification_status: 'Verification Status',
  // ... add more
};
```

---

### 6. Error Handling
**File:** `src/api/client.ts` or `src/utils/errorHandler.ts`

**Change:**
```typescript
// Before
try {
  const response = await api.call();
} catch (error) {
  if (error.response?.data?.error?.code === 'VALIDATION_ERROR') {
    // Handle
  }
}

// After (match backend response)
try {
  const response = await api.call();
} catch (error) {
  const apiError = error.response?.data;
  
  if (!apiError.success && apiError.errors) {
    // Backend returns errors as object: { field1: "error msg", field2: "..." }
    Object.entries(apiError.errors).forEach(([field, message]) => {
      setFieldError(field, message as string);
    });
  } else {
    showToast(apiError.message || 'An error occurred');
  }
}
```

**Note:** Error `code` field will be added in Phase 4C-7. Until then, rely on `message` and `errors` object.

---

## 🚀 Features to Add to Roadmap (Not Fix Now)

### Phase 4C (Security & Auth) - Already Documented
- ✅ Real Supabase JWT authentication (replaces mock headers)
- ✅ `/auth/signup`, `/auth/signin`, `/auth/signout` endpoints
- ✅ Error code taxonomy (`error.code` field)

### Phase 5 (Product Features) - **Add to BACKEND_TODO_PRIORITIZED**

#### 5.1 AI Chat Endpoint
**Priority:** 🟢 LOW (P3)  
**Effort:** 3–4 days  
**Endpoint:** `POST /api/v1/student/ai/chat`

**Tasks:**
- [ ] Integrate OpenAI/Anthropic API
- [ ] Design context-aware prompts (user's filters, watchlist, activity)
- [ ] Return suggestions (admission IDs + relevance scores)
- [ ] Add follow-up question generation
- [ ] Rate limit AI calls (e.g., 20/day per user)

#### 5.2 Scraper Management Endpoints
**Priority:** 🟢 LOW (P3)  
**Effort:** 2–3 days  
**Endpoints:**
- `GET /api/v1/admin/scraper/logs`
- `POST /api/v1/admin/scraper/trigger`

**Tasks:**
- [ ] Create `scraper_jobs` table (id, university_id, status, records_found, error, started_at, completed_at)
- [ ] Add scraper controller + service + model
- [ ] Implement manual trigger endpoint (queues job)
- [ ] Add scraper logs list endpoint with filters

#### 5.3 Admin Bulk Notification Send
**Priority:** 🟡 MEDIUM (P2)  
**Effort:** 1 day  
**Endpoint:** Enhanced `POST /api/v1/notifications`

**Tasks:**
- [ ] Add `recipient_type` param (`all_students`, `all_universities`, `specific_user`)
- [ ] Add `recipient_id` param (if specific_user)
- [ ] Bulk insert notifications for all users matching type
- [ ] Return `recipients_count` in response

#### 5.4 Featured Admissions & Tags
**Priority:** 🟢 LOW (P3)  
**Effort:** 2 days

**Tasks:**
- [ ] Add `is_featured` boolean to admissions table
- [ ] Add `tags` JSONB array to admissions table
- [ ] Add filtering by featured status and tags
- [ ] Add admin endpoint to toggle featured status

#### 5.5 Analytics/Views Tracking
**Priority:** 🟡 MEDIUM (P2)  
**Effort:** 1–2 days

**Tasks:**
- [ ] Add `views` counter to admissions table
- [ ] Increment on `GET /api/v1/admissions/:id` (with debouncing)
- [ ] Add `watchlist_count` computed field (COUNT from watchlists)
- [ ] Expose in admission responses

---

## ✅ Summary: Actions to Take

### Backend Changes (Minimal)
1. ✅ **No stack changes** (keep Express/Node/TypeScript)
2. ✅ **No auth endpoint changes** (Phase 4C handles this)
3. 🔧 **Optional Enhancement (Changelogs):**
   - Add `changed_by_name` via JOIN on response (service layer)
   - Add `reason` column to `changelogs` table (for user-provided justification)
   - Keep `diff_summary` as-is (already computed)

### Frontend Changes (Required)
1. ✅ Update base URL: `http://localhost:3000/api/v1`
2. ✅ Update pagination keys: `limit`, `total`, `totalPages`, `hasNext`, `hasPrev`
3. ✅ Update admissions fields: `location`, `degree_level`, `duration`, `deadline`, `tuition_fee`, `requirements` JSONB
4. ✅ Update notifications fields: `category`, `related_entity_id`, `related_entity_type`, `action_url`, `read_at`
5. ✅ Update changelogs fields: `field_name`, `change_type`, `diff_summary`, `changed_by`
6. ✅ Update error handling: expect `errors` object, not `error.code`
7. ✅ Update API paths: use shared `/api/v1/admissions`, `/watchlists`, `/notifications`, `/changelogs` with role headers

### Contract Document Updates (Do Now)
1. ✅ Fix base URL and stack reference
2. ✅ Fix pagination structure
3. ✅ Fix field names in all schemas
4. ✅ Fix response envelope (success/error shapes)
5. ✅ Add path mapping table (frontend path → backend path)
6. ✅ Add "Future Features" section (AI chat, scraper, tags, views)

### Roadmap Updates
1. ✅ Add AI chat to Phase 5 in `BACKEND_TODO_PRIORITIZED_JAN_2026.md`
2. ✅ Add scraper endpoints to Phase 5
3. ✅ Add featured/tags/views to Phase 5
4. ✅ Add bulk notifications to Phase 4C-12 or Phase 5

---

## 🎯 Recommended Approach

**For Notifications:** ✅ **Keep backend fields**, change frontend.  
**For Changelogs:** ✅ **Merge both** - Backend adds `changed_by_name` and `reason`; frontend uses `diff_summary` for display.  
**For Paths:** ✅ **Use backend shared endpoints** (`/admissions`, `/watchlists`, etc.) with role headers; avoid namespacing in frontend.

---

**Next Step:** Update contract document with these fixes, then share with frontend team for code updates.
