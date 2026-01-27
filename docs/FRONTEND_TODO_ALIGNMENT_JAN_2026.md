# Frontend TODO & Alignment List – For Integration with Backend
**Generated:** January 27, 2026  
**Purpose:** What frontend must build/fix to integrate with AdmissionTimes backend  
**Backend Status:** 51 endpoints live, tested (96.7% pass), mock auth ready, seed data aligned  
**Frontend Responsibility:** Role-based routing, mock auth header injection, pagination handling, error handling, state management

---

## 🎯 Critical Requirements (Must-Haves)

### 1. Authentication & Authorization Setup

#### 1.1 Mock Auth Header Injection (Current MVP Phase)
**Status:** NOT STARTED  
**Responsibility:** Frontend must implement  
**Blocking:** ALL API calls

**Tasks:**
- [ ] **1.1.1:** Create auth context/store
  - Store user after signin: `{ id, role, university_id }`
  - Make available globally across app (Redux, Zustand, Context API)
  - Persist to localStorage for session recovery

- [ ] **1.1.2:** Create HTTP interceptor/client wrapper
  ```typescript
  // Example (Axios):
  const axiosInstance = axios.create({
    baseURL: 'http://localhost:3000/api/v1'
  });

  axiosInstance.interceptors.request.use((config) => {
    const auth = getAuthContext(); // From store
    if (auth) {
      config.headers['x-user-id'] = auth.id;
      config.headers['x-user-role'] = auth.role;
      if (auth.university_id) {
        config.headers['x-university-id'] = auth.university_id;
      }
    }
    return config;
  });

  export default axiosInstance;
  ```

- [ ] **1.1.3:** Use interceptor on ALL API calls
  - Replace direct `fetch` with wrapped client
  - Ensure headers sent on GET, POST, PUT, PATCH, DELETE

- [ ] **1.1.4:** Test mock auth
  - Send request without headers → should work (no validation yet)
  - Verify headers included in request (use DevTools Network tab)
  - Note: Backend will validate headers in Phase 4C

---

#### 1.2 Prepare for Real Supabase JWT (Phase 4C)
**Status:** PREP ONLY  
**Responsibility:** Frontend + Backend (Phase 4C)  
**Not blocking:** Current MVP phase

**Tasks:**
- [ ] **1.2.1:** Document JWT swap plan
  - After backend Phase 4C ships:
    - Replace `x-user-id` header injection with `Authorization: Bearer <token>`
    - Token comes from Supabase `getSession()` or `getUser()` calls
    - Same HTTP interceptor; just different header source

- [ ] **1.2.2:** Prepare Supabase setup (don't implement yet)
  - Ensure Supabase project has Auth enabled
  - Plan for signup/login UI (Supabase UI or custom)
  - When Phase 4C done, swap this in

---

### 2. Role-Based Routing Post-Signin (Critical)

**Status:** NOT STARTED  
**Responsibility:** Frontend (NOT server-side redirect)  
**Blocking:** User navigation after signin

#### 2.1 Post-Signin Navigation Flow
```
1. User fills signin form
2. Frontend calls GET /users/me or POST /auth/signin (when available)
3. Backend returns { success: true, data: { id, role, ... } }
4. Frontend extracts role from response
5. Frontend ROUTES (not server-redirects):
   - if role === 'student' → navigate to /student/dashboard
   - if role === 'university' → navigate to /university/dashboard
   - if role === 'admin' → navigate to /admin/dashboard
6. Store role & user context in auth store
7. Render correct dashboard
```

**Tasks:**
- [ ] **2.1.1:** Create role-based route guard
  ```typescript
  // Example (React Router):
  const ProtectedRoute = ({ children }) => {
    const auth = useAuthContext();
    if (!auth) return <Navigate to="/signin" />;
    return children;
  };

  const StudentDashboardRoute = () => (
    <ProtectedRoute requiredRole="student">
      <StudentDashboard />
    </ProtectedRoute>
  );
  ```

- [ ] **2.1.2:** Setup dashboard routing
  ```typescript
  // In your router config:
  {
    path: '/student/dashboard',
    element: <StudentDashboard />,
    requiredRole: 'student'
  },
  {
    path: '/university/dashboard',
    element: <UniversityDashboard />,
    requiredRole: 'university'
  },
  {
    path: '/admin/dashboard',
    element: <AdminDashboard />,
    requiredRole: 'admin'
  }
  ```

- [ ] **2.1.3:** Post-signin redirect logic
  ```typescript
  // After signin API call:
  const handleSigninSuccess = (response) => {
    const { role } = response.data;
    saveAuthContext(response.data);
    
    // Route based on role
    const dashboardMap = {
      student: '/student/dashboard',
      university: '/university/dashboard',
      admin: '/admin/dashboard'
    };
    navigate(dashboardMap[role]);
  };
  ```

- [ ] **2.1.4:** Test role-based navigation
  - Test student signin → lands on /student/dashboard
  - Test university signin → lands on /university/dashboard
  - Test admin signin → lands on /admin/dashboard
  - Test unauthorized access (e.g., student accessing /university/dashboard) → redirect to /signin

---

### 3. API Call Patterns & Response Handling

**Status:** NOT STARTED  
**Responsibility:** Frontend  
**Reference:** [API_CONTRACT.md](API_CONTRACT.md), [FRONTEND_INTEGRATION_GUIDE.md](FRONTEND_INTEGRATION_GUIDE.md)

#### 3.1 Response Envelope Handling
**All responses follow this structure:**
```json
{
  "success": true|false,
  "message": "Human-readable message",
  "data": { /* payload */ } or [ /* array */ ],
  "pagination": { "page": 1, "limit": 20, "total": 100, "totalPages": 5, "hasNext": true, "hasPrev": false },
  "timestamp": "2026-01-27T10:30:00.000Z"
}
```

**Tasks:**
- [ ] **3.1.1:** Create response parser/handler
  ```typescript
  const handleApiResponse = (response) => {
    if (!response.success) {
      // Handle error
      throw new ApiError(response.message, response.errors);
    }
    return response.data;
  };

  axiosInstance.interceptors.response.use(
    (res) => handleApiResponse(res.data),
    (err) => {
      if (err.response?.data?.success === false) {
        throw new ApiError(err.response.data.message, err.response.data.errors);
      }
      throw err;
    }
  );
  ```

- [ ] **3.1.2:** Test with example endpoint
  ```bash
  # Get list of admissions
  curl -H "x-user-id: <uuid>" \
       -H "x-user-role: student" \
       http://localhost:3000/api/v1/admissions
  ```

---

#### 3.2 Pagination Handling
**Pagination fields returned in every list endpoint:**
- `page` (1-indexed)
- `limit` (default 20, max 100)
- `total` (total records matching filter)
- `totalPages` (ceil(total / limit))
- `hasNext` (page < totalPages)
- `hasPrev` (page > 1)

**Tasks:**
- [ ] **3.2.1:** Create pagination component
  ```typescript
  interface PaginationState {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  }

  const usePagination = (initialPage = 1, initialLimit = 20) => {
    const [pagination, setPagination] = useState<PaginationState>({
      page: initialPage,
      limit: initialLimit,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false
    });

    const goToPage = (page: number) => {
      setPagination(prev => ({ ...prev, page }));
    };

    return { pagination, setPagination, goToPage };
  };
  ```

- [ ] **3.2.2:** Use in list components
  ```typescript
  // Example: List admissions
  const [admissions, setAdmissions] = useState([]);
  const { pagination, goToPage } = usePagination();

  useEffect(() => {
    fetchAdmissions(pagination.page, pagination.limit)
      .then(response => {
        setAdmissions(response.data);
        setPagination(prev => ({
          ...prev,
          total: response.pagination.total,
          totalPages: response.pagination.totalPages,
          hasNext: response.pagination.hasNext,
          hasPrev: response.pagination.hasPrev
        }));
      });
  }, [pagination.page, pagination.limit]);

  return (
    <>
      {admissions.map(a => <AdmissionCard key={a.id} admission={a} />)}
      <Pagination pagination={pagination} onPageChange={goToPage} />
    </>
  );
  ```

- [ ] **3.2.3:** Support filtering & searching
  - Query params: `?page=1&limit=20&search=lums&filter=verified`
  - Reset page to 1 when filter changes

---

#### 3.3 Error Handling
**Error responses include:**
```json
{
  "success": false,
  "message": "Error description",
  "errors": { "field1": "specific error", "field2": "..." },
  "timestamp": "2026-01-27T..."
}
```

**HTTP status codes:**
- `400` Bad Request (validation error)
- `401` Unauthorized (missing/invalid auth)
- `403` Forbidden (insufficient permission)
- `404` Not Found (resource doesn't exist)
- `500` Internal Server Error

**Tasks:**
- [ ] **3.3.1:** Create error boundary component
  ```typescript
  const ErrorBoundary = ({ children }) => {
    const [error, setError] = useState(null);

    const handleError = (err) => {
      if (err.status === 401) {
        // Redirect to signin
        navigate('/signin');
      } else if (err.status === 403) {
        // Show "Access Denied"
        showNotification('You do not have permission to access this resource');
      } else {
        // Show generic error
        showNotification(err.message || 'An error occurred');
      }
      setError(err);
    };

    return (
      <ErrorContext.Provider value={handleError}>
        {children}
        {error && <ErrorAlert error={error} onClose={() => setError(null)} />}
      </ErrorContext.Provider>
    );
  };
  ```

- [ ] **3.3.2:** Handle validation errors in forms
  ```typescript
  const handleSubmit = async (formData) => {
    try {
      await createAdmission(formData);
      showSuccess('Admission created');
    } catch (err) {
      if (err.status === 400 && err.errors) {
        // Map errors to form fields
        setFormErrors(err.errors);
      } else {
        showError(err.message);
      }
    }
  };
  ```

- [ ] **3.3.3:** Test error scenarios
  - Send invalid data (e.g., invalid email) → show field-specific errors
  - Send request without headers → 401 (will happen in Phase 4C)
  - Access resource not yours → 403

---

### 4. Data Type Conventions

**Status:** NOT STARTED  
**Responsibility:** Frontend  
**Blocking:** Data display, filtering, validation

#### 4.1 Field Naming (Snake_Case Everywhere)
```
✅ Correct:
  admission.program_type
  admission.field_of_study
  admission.tuition_fee
  notification.is_read
  user.university_id

❌ Wrong:
  admission.programType (camelCase)
  admission.fieldOfStudy
  admission.tuitionFee
  notification.isRead
  user.universityId
```

**Tasks:**
- [ ] **4.1.1:** Update all API response handling
  - No camelCase conversion
  - Keep snake_case throughout app
  - If framework auto-converts, disable it

- [ ] **4.1.2:** Update all API request builders
  - Send field names as snake_case
  - Example: `{ program_type: 'Undergraduate', field_of_study: 'CS' }`

---

#### 4.2 Date/Time Handling (ISO 8601)
```
Format: 2026-01-27T10:30:00.000Z
Timezone: Always UTC (Z suffix)
Parsing: Use moment, date-fns, or native Date with proper timezone awareness

❌ Wrong:
  2026-01-27 (no time)
  10:30:00 (no date)
  2026-01-27T10:30:00+05:00 (avoid timezone offsets; use UTC)
```

**Tasks:**
- [ ] **4.2.1:** Create date formatting utility
  ```typescript
  import { format, parseISO } from 'date-fns';

  export const formatDate = (isoString: string) => {
    return format(parseISO(isoString), 'MMM dd, yyyy');
  };

  export const formatDateTime = (isoString: string) => {
    return format(parseISO(isoString), 'MMM dd, yyyy hh:mm aa');
  };

  export const getDaysRemaining = (deadlineISO: string) => {
    const deadline = parseISO(deadlineISO);
    const now = new Date();
    return Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };
  ```

- [ ] **4.2.2:** Use in display
  ```typescript
  <div>
    Posted: {formatDate(admission.created_at)}
    Deadline: {formatDateTime(deadline.deadline_date)}
  </div>
  ```

- [ ] **4.2.3:** Handle timezones
  - Deadlines include `timezone` field (ISO string, e.g., 'America/New_York')
  - Display deadline in user's timezone or admission's timezone (clarify with design)

---

#### 4.3 UUID Handling
```
Format: 36 characters, dashes: 550e8400-e29b-41d4-a716-446655440000
Immutable: Never change after creation
No truncation: Always full 36 characters
```

**Tasks:**
- [ ] **4.3.1:** Validate UUIDs on form input
  ```typescript
  const isValidUUID = (id: string) => {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  };
  ```

---

#### 4.4 Number Handling
```
Integers: admission counts, totals, page numbers (no decimals)
Decimals: tuition_fee, application_fee (e.g., 25000.00)
Strings: DON'T use numbers as strings
```

**Tasks:**
- [ ] **4.4.1:** Format currency on display
  ```typescript
  const formatCurrency = (amount: number, currency = 'PKR') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount);
  };

  // Usage: {formatCurrency(admission.tuition_fee, admission.currency)}
  ```

---

### 5. Domain-Specific Integration

**Status:** NOT STARTED  
**Responsibility:** Frontend + Backend (coordinated)  
**Reference:** [FRONTEND_INTEGRATION_GUIDE.md](FRONTEND_INTEGRATION_GUIDE.md)

#### 5.1 Admissions Domain
**51 endpoints summary; these 3 are critical for student list:**
- `GET /api/v1/admissions?page=1&limit=20&verification_status=verified`
- `GET /api/v1/admissions/:id`
- `GET /api/v1/admissions/:id/changelogs`

**Tasks:**
- [ ] **5.1.1:** Build admissions list component
  ```typescript
  interface AdmissionFilters {
    search?: string;
    program_type?: string;
    degree_level?: string;
    field_of_study?: string;
    location?: string;
    delivery_mode?: string;
    verification_status?: 'draft' | 'pending' | 'verified' | 'rejected' | 'disputed';
    page?: number;
    limit?: number;
    sort_by?: 'created_at' | 'updated_at' | 'deadline' | 'title' | 'tuition_fee';
  }

  const AdmissionsList = () => {
    const [filters, setFilters] = useState<AdmissionFilters>({
      verification_status: 'verified', // Students see verified only
      page: 1,
      limit: 20
    });
    const [admissions, setAdmissions] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      setLoading(true);
      fetchAdmissions(filters)
        .then(response => {
          setAdmissions(response.data);
          // handle pagination
        })
        .finally(() => setLoading(false));
    }, [filters]);

    return (
      <>
        <AdmissionFilterBar filters={filters} onFiltersChange={setFilters} />
        {loading ? <Spinner /> : <AdmissionGrid admissions={admissions} />}
        <Pagination ... />
      </>
    );
  };
  ```

- [ ] **5.1.2:** Build admission detail view
  - Show full admission data + requirements (JSONB object)
  - Show deadline countdown
  - Show changelog (how this admission was verified, rejected, etc.)
  - Add to watchlist button

- [ ] **5.1.3:** For universities: build admission management
  - Create, edit, delete admissions (draft state)
  - Submit for verification (draft → pending)
  - View verification feedback
  - Dispute rejection

- [ ] **5.1.4:** For admins: build verification dashboard
  - List pending verifications
  - Verify or reject with reason
  - View all admissions (no filter)

---

#### 5.2 Notifications Domain
**7 endpoints; critical ones:**
- `GET /api/v1/notifications?page=1&limit=20`
- `GET /api/v1/notifications/unread-count`
- `PATCH /api/v1/notifications/:id/read`
- `PATCH /api/v1/notifications/read-all`

**Tasks:**
- [ ] **5.2.1:** Build notifications component
  ```typescript
  const NotificationBell = () => {
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);

    useEffect(() => {
      // Poll every 30s (or setup websocket in future)
      const interval = setInterval(() => {
        fetchUnreadCount().then(count => setUnreadCount(count.data));
      }, 30000);
      return () => clearInterval(interval);
    }, []);

    const handleMarkAllRead = () => {
      markAllNotificationsAsRead().then(() => {
        setUnreadCount(0);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      });
    };

    return (
      <>
        <BellIcon count={unreadCount} onClick={() => setShowDropdown(!showDropdown)} />
        {showDropdown && (
          <NotificationDropdown
            notifications={notifications}
            onMarkAllRead={handleMarkAllRead}
          />
        )}
      </>
    );
  };
  ```

- [ ] **5.2.2:** Mark notification as read on click
  - Single click → mark as read & navigate to related admission
  - Batch mark all read → button in dropdown

---

#### 5.3 Deadlines Domain
**6 endpoints; critical ones:**
- `GET /api/v1/deadlines/upcoming?days_from_now=30`
- `GET /api/v1/deadlines/:id`

**Tasks:**
- [ ] **5.3.1:** Build upcoming deadlines component
  - Show deadlines sorted by days_remaining
  - Color-code by urgency (expired=red, critical<7=orange, high=yellow, medium/low=green)
  - Show admission title, deadline date, days remaining

- [ ] **5.3.2:** Integrate with deadline alerts
  - If user has alert_opt_in=true in watchlist, show reminder

---

#### 5.4 Watchlists Domain
**5 endpoints; critical ones:**
- `POST /api/v1/watchlists` (add admission)
- `GET /api/v1/watchlists?page=1&limit=20`
- `DELETE /api/v1/watchlists/:id`
- `PATCH /api/v1/watchlists/:id` (update notes, alert_opt_in)

**Tasks:**
- [ ] **5.4.1:** Build watchlist button on admission detail
  ```typescript
  const WatchlistButton = ({ admissionId, isWatched }) => {
    const [loading, setLoading] = useState(false);

    const handleToggle = async () => {
      setLoading(true);
      try {
        if (isWatched) {
          await removeFromWatchlist(admissionId);
        } else {
          await addToWatchlist(admissionId);
        }
        // Refetch to update isWatched status
      } finally {
        setLoading(false);
      }
    };

    return (
      <Button onClick={handleToggle} disabled={loading}>
        {isWatched ? '❤️ Saved' : '🤍 Save'}
      </Button>
    );
  };
  ```

- [ ] **5.4.2:** Build watchlist page
  - Show all saved admissions
  - Show notes field (editable)
  - Show alert_opt_in checkbox
  - Remove button

---

#### 5.5 User Activity Domain
**2 endpoints:**
- `GET /api/v1/activity?page=1&limit=20`

**Tasks:**
- [ ] **5.5.1:** Build activity feed
  - Show recent user actions (viewed, searched, compared, watchlisted)
  - Display on dashboard (show 5 most recent)
  - Link to related admission if available

---

#### 5.6 Dashboards
**4 special endpoints (not domain):**
- `GET /api/v1/student/dashboard`
- `GET /api/v1/university/dashboard`
- `GET /api/v1/admin/dashboard`
- `GET /api/v1/student/recommendations?limit=10&min_score=75`

**Tasks:**
- [ ] **5.6.1:** Build student dashboard
  - Display stats cards: active admissions, saved count, upcoming deadlines, recommendations, unread notifications, urgent deadlines
  - Show recommended programs (with match score & reason)
  - Show upcoming deadlines (color-coded)
  - Show recent notifications (list)
  - Show recent activity feed

- [ ] **5.6.2:** Build university dashboard
  - Stats: total admissions, pending verification, verified, recent updates, unread notifications, pending audits
  - Recent admissions (table with status)
  - Pending verifications (list to respond to)
  - Recent changes (changelog)
  - Notifications (list)

- [ ] **5.6.3:** Build admin dashboard
  - Stats: pending verifications, total admissions, total universities, total students, recent actions, scraper jobs
  - Pending verifications (list to verify/reject)
  - Recent actions (who did what when)
  - Scraper activity (if applicable)

---

### 6. State Management & Persistence

**Status:** NOT STARTED  
**Responsibility:** Frontend

**Tasks:**
- [ ] **6.1:** Choose state management
  - Option A: Redux + Redux Persist
  - Option B: Zustand + localStorage
  - Option C: React Context + custom persistence
  - Recommended: Zustand (simpler for this scale)

- [ ] **6.2:** Create auth store
  ```typescript
  // Zustand example
  const useAuthStore = create<AuthStore>((set) => ({
    user: null,
    isAuthenticated: false,
    login: (user) => set({ user, isAuthenticated: true }),
    logout: () => set({ user: null, isAuthenticated: false }),
    updateUser: (updates) => set((state) => ({
      user: { ...state.user, ...updates }
    }))
  }));

  // Persist to localStorage
  const useAuthStoreWithPersist = persist(useAuthStore, {
    name: 'auth-store',
    version: 1
  });
  ```

- [ ] **6.3:** Create domain stores (admissions, notifications, watchlists, etc.)
  - Cache list results
  - Track current filters/search
  - Handle optimistic updates

---

### 7. Testing & QA

**Status:** NOT STARTED  
**Responsibility:** Frontend QA + Backend coordination

**Tasks:**
- [ ] **7.1:** Create test checklist per domain
  - Admissions: create, list, filter, detail, verify (admin), reject (admin), dispute (university)
  - Notifications: list, mark read, mark all read, unread count
  - Watchlists: add, list, update notes, remove
  - Deadlines: show upcoming, color by urgency
  - Dashboards: all stats render, responsive on mobile

- [ ] **7.2:** Test auth flow
  - Signin with student → student dashboard
  - Signin with university → university dashboard
  - Signin with admin → admin dashboard
  - Access unauthorized dashboard → redirect to signin

- [ ] **7.3:** Test error scenarios
  - Submit invalid form → show field errors
  - Network error → show retry button
  - 403 Forbidden → show "not authorized"
  - 404 Not Found → show "not found"

- [ ] **7.4:** Test pagination
  - List endpoints return 20 per page by default
  - Change page → data updates
  - Filter changes → reset to page 1
  - Total count updates correctly

---

## 📋 Integration Checklist (Phase Order)

### Phase 1: Foundation (Week 1)
- [ ] Setup HTTP client with mock auth header injection
- [ ] Create auth context/store
- [ ] Setup role-based routing (student/university/admin dashboards)
- [ ] Test mock headers in DevTools Network tab

### Phase 2: Core List Views (Week 2)
- [ ] Build admissions list (GET /api/v1/admissions)
- [ ] Build pagination component
- [ ] Add filters (search, program type, field, location, etc.)
- [ ] Add sorting

### Phase 3: Detail & Detail Operations (Week 3)
- [ ] Build admission detail view
- [ ] Add admission changelog display
- [ ] Build watchlist (add/remove)
- [ ] Build notifications (mark read, badge count)

### Phase 4: Dashboards (Week 4)
- [ ] Build student dashboard
- [ ] Build university dashboard
- [ ] Build admin dashboard
- [ ] Show stats, recommendations, recent activity

### Phase 5: Polish & Testing (Week 5)
- [ ] Error handling (all error codes)
- [ ] Loading states (spinners, skeletons)
- [ ] Empty states
- [ ] Mobile responsiveness
- [ ] Full QA checklist

### Phase 6: Prepare for Real Auth (Week 6)
- [ ] Update HTTP client to accept JWT token source
- [ ] Plan Supabase Auth integration (don't implement yet)
- [ ] Document JWT swap steps

---

## 🔗 Critical Backend References

**Read These First (for frontend team):**
1. [FRONTEND_BACKEND_ALIGNMENT_OVERVIEW.md](FRONTEND_BACKEND_ALIGNMENT_OVERVIEW.md) – Quick 10-point handoff
2. [API_CONTRACT.md](API_CONTRACT.md) – Detailed per-endpoint specs (request/response examples)
3. [FRONTEND_INTEGRATION_GUIDE.md](FRONTEND_INTEGRATION_GUIDE.md) – How to call API, auth setup, patterns

**Reference During Integration:**
4. [FINAL_SYSTEM_REPORT_JAN_2026.md](FINAL_SYSTEM_REPORT_JAN_2026.md) – This report; full system architecture
5. Swagger UI: `http://localhost:3000/api-docs` – Interactive endpoint explorer

**For Backend Coordination:**
6. [BACKEND_TODO_PRIORITIZED_JAN_2026.md](BACKEND_TODO_PRIORITIZED_JAN_2026.md) – Backend remaining work (Phase 4C+)

---

## 📞 Common Issues & Solutions

### Issue: "Headers not being sent with requests"
**Solution:**
- Verify HTTP interceptor is registered on client
- Check DevTools Network tab → request headers
- Ensure all API calls use wrapped client (not direct fetch)
- Test with Swagger first to confirm backend accepts requests

### Issue: "Getting 'resource not found' errors"
**Solution:**
- Verify UUID format (36 chars with dashes)
- Check if resource exists in backend (seed data includes test UUIDs)
- If testing with real data, first POST create the record, then GET by ID
- See seeding guide: [SEED_RESET_GUIDE.md](SEED_RESET_GUIDE.md)

### Issue: "Pagination not working correctly"
**Solution:**
- Default limit is 20; default page is 1
- Query params: `?page=1&limit=20`
- Verify response includes pagination object
- Reset page to 1 when filters change
- hasNext = (page < totalPages), hasPrev = (page > 1)

### Issue: "Dates showing in wrong timezone"
**Solution:**
- Backend returns ISO 8601 UTC (e.g., 2026-01-27T10:30:00.000Z)
- Parse with `new Date(isoString)` (JavaScript defaults to local timezone)
- For user's timezone display: use `date-fns` or `moment` with timezone
- For deadline's timezone: note the `timezone` field in response; convert if needed

### Issue: "Notifications not updating in real-time"
**Solution:**
- Current MVP: frontend must poll (every 30s)
- Real-time: implement WebSocket in Phase 5
- Use `setInterval` with `fetchUnreadCount()` until then

---

## 🚀 Ready-to-Use Code Examples

### 1. HTTP Client Setup (Axios)
```typescript
// api/client.ts
import axios from 'axios';
import { useAuthStore } from '../store/auth';

const client = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1',
  timeout: 30000
});

client.interceptors.request.use((config) => {
  const { user } = useAuthStore.getState();
  if (user) {
    config.headers['x-user-id'] = user.id;
    config.headers['x-user-role'] = user.role;
    if (user.university_id) {
      config.headers['x-university-id'] = user.university_id;
    }
  }
  return config;
});

client.interceptors.response.use(
  (res) => {
    if (!res.data.success) {
      throw new Error(res.data.message);
    }
    return res.data;
  },
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/signin';
    }
    throw err;
  }
);

export default client;
```

### 2. Auth Store (Zustand)
```typescript
// store/auth.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  role: 'student' | 'university' | 'admin';
  university_id?: string;
}

interface AuthStore {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>(
  persist(
    (set) => ({
      user: null,
      login: (user) => set({ user }),
      logout: () => set({ user: null })
    }),
    { name: 'auth-store' }
  )
);
```

### 3. Fetch Admissions Hook
```typescript
// hooks/useAdmissions.ts
import { useState, useEffect } from 'react';
import client from '../api/client';

export const useAdmissions = (page = 1, limit = 20) => {
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetch = async (p = page, l = limit) => {
    setLoading(true);
    try {
      const res = await client.get('/admissions', {
        params: { page: p, limit: l, verification_status: 'verified' }
      });
      setData(res.data);
      setPagination(res.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch(page, limit);
  }, [page, limit]);

  return { data, pagination, loading, error, fetch };
};
```

---

## 📅 Timeline Recommendation

| Week | Focus | Dependency |
|------|-------|-----------|
| 1 | Auth setup, routing, HTTP client | None (start immediately) |
| 2 | List views, pagination, filters | Backend 51 endpoints (ready) |
| 3 | Detail views, watchlists, notifications | Same |
| 4 | Dashboards, stats rendering | Same |
| 5 | Error handling, loading states, polish | Same |
| 6 | Prepare for JWT, plan Phase 4C swap | Backend Phase 4C (in progress) |

**Parallel work possible:** Start Phase 1 immediately; backend Phase 4C can progress in parallel.

---

## ✅ Success Criteria

- [ ] All 51 endpoints callable from frontend
- [ ] Student dashboard renders with correct data
- [ ] University dashboard renders with correct data
- [ ] Admin dashboard renders with correct data
- [ ] Role-based routing works (student → student dashboard, etc.)
- [ ] Pagination works (go to next page, previous page)
- [ ] Filters work (search, program type, degree level, etc.)
- [ ] Notifications show unread count badge
- [ ] Watchlist add/remove works
- [ ] Error handling works (show user-friendly messages)
- [ ] Mock auth headers sent on all requests
- [ ] Mobile responsive (pass on phone/tablet)
- [ ] Load time <2s on 4G network
- [ ] No console errors (warnings ok)
- [ ] All QA checklist items pass

---

**Report Generated:** January 27, 2026  
**For:** Frontend Team  
**Status:** Ready for Implementation  
**Backend Status:** 51 endpoints live, tested, seeded data ready  
**Blocking Issues:** None (all infrastructure in place)
