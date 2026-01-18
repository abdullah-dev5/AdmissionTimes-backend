# API Testing Results

**Date:** January 19, 2026  
**Status:** Ready for Testing  
**Server:** `http://localhost:3000`

---

## ✅ Fixed Issues

### 1. TypeScript Compilation Errors
- ✅ Fixed `return res.status().json()` → Use `sendError()` utility
- ✅ Fixed PDF parsing import → Use `require()` for CommonJS
- ✅ Fixed description extraction type handling
- ✅ Removed unused imports

### 2. SQL Syntax Errors
- ✅ Fixed student_stats CTE → Added `FROM (SELECT 1) as dummy`
- ✅ Fixed admin_stats CTE → Added `FROM (SELECT 1) as dummy`
- ✅ Fixed COALESCE syntax → Removed FILTER clause
- ✅ Fixed recommendations query → Fixed user_preferences access

### 3. Database Schema
- ✅ Added `alert_opt_in` to watchlists table
- ✅ Created recommendations table
- ✅ Updated watchlists seed to include `alert_opt_in`

---

## 🧪 Test User IDs

From database seeding:

```
Student User ID:  7998b0fe-9d05-44e4-94ab-e65e0213bf10 (Ahmed Khan)
University User ID: 412c9cd6-78db-46c1-84e1-c059a20d11bf (Business School)
Admin User ID:    e61690b2-0a64-47de-9274-66e06d1437b7 (Admin User)
```

---

## 📋 Endpoints to Test

### 1. Health Check ✅
```
GET http://localhost:3000/health
```
**Expected:** 200 OK

---

### 2. Student Dashboard
```
GET http://localhost:3000/api/v1/student/dashboard
Headers:
  x-user-id: 7998b0fe-9d05-44e4-94ab-e65e0213bf10
  x-user-role: student
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Dashboard data retrieved successfully",
  "data": {
    "stats": {
      "active_admissions": 0,
      "saved_count": 0,
      "upcoming_deadlines": 0,
      "recommendations_count": 0,
      "unread_notifications": 0,
      "urgent_deadlines": 0
    },
    "recommended_programs": [],
    "upcoming_deadlines": [],
    "recent_notifications": [],
    "recent_activity": []
  }
}
```

**Test Cases:**
- ✅ With valid student user ID
- ❌ Without headers (should return 401)
- ❌ With wrong role (should return 403)

---

### 3. Student Recommendations ✅ (Working)
```
GET http://localhost:3000/api/v1/student/recommendations?limit=5&min_score=75
Headers:
  x-user-id: 7998b0fe-9d05-44e4-94ab-e65e0213bf10
  x-user-role: student
```

**Status:** ✅ Working (returns empty array if no recommendations)

---

### 4. University Dashboard
```
GET http://localhost:3000/api/v1/university/dashboard
Headers:
  x-user-id: 412c9cd6-78db-46c1-84e1-c059a20d11bf
  x-user-role: university
  x-university-id: 412c9cd6-78db-46c1-84e1-c059a20d11bf
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "total_admissions": 0,
      "pending_verification": 0,
      "verified_admissions": 0,
      "recent_updates": 0,
      "unread_notifications": 0,
      "pending_audits": 0
    },
    "recent_admissions": [],
    "pending_verifications": [],
    "recent_changes": [],
    "recent_notifications": []
  }
}
```

---

### 5. Admin Dashboard
```
GET http://localhost:3000/api/v1/admin/dashboard
Headers:
  x-user-id: e61690b2-0a64-47de-9274-66e06d1437b7
  x-user-role: admin
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "pending_verifications": 0,
      "total_admissions": 0,
      "total_universities": 0,
      "total_students": 0,
      "recent_actions": 0,
      "scraper_jobs_running": 0
    },
    "pending_verifications": [],
    "recent_actions": [],
    "scraper_activity": []
  }
}
```

---

### 6. PDF Parsing
```
POST http://localhost:3000/api/v1/admissions/parse-pdf
Headers:
  x-user-id: 412c9cd6-78db-46c1-84e1-c059a20d11bf
  x-user-role: university
Content-Type: multipart/form-data

Body (form-data):
  file: [PDF file]
  university_id: 412c9cd6-78db-46c1-84e1-c059a20d11bf (optional)
```

**Expected Response:**
```json
{
  "success": true,
  "message": "PDF parsed successfully",
  "data": {
    "title": "...",
    "degree_level": "...",
    "deadline": "...",
    "application_fee": 0,
    "location": "...",
    "description": "...",
    "confidence": 0,
    "extracted_fields": []
  }
}
```

---

## 🔧 Postman Setup

### Import Collection
1. Open Postman
2. Click **Import**
3. Select `postman_collection.json`
4. Create environment with variables:
   - `base_url`: `http://localhost:3000`
   - `student_user_id`: `7998b0fe-9d05-44e4-94ab-e65e0213bf10`
   - `university_user_id`: `412c9cd6-78db-46c1-84e1-c059a20d11bf`
   - `admin_user_id`: `e61690b2-0a64-47de-9274-66e06d1437b7`

### Test Requests
All requests are pre-configured in the collection with proper headers.

---

## 📝 Notes

1. **Empty Arrays:** If you see empty arrays, it means:
   - No data seeded yet (run `pnpm seed`)
   - User has no watchlists/notifications
   - No admissions match the criteria

2. **Server Restart:** After code changes, restart the server:
   ```bash
   # Stop current server (Ctrl+C)
   pnpm dev
   ```

3. **Database:** Ensure migrations are run:
   ```bash
   pnpm migrate
   ```

---

## ✅ Testing Checklist

- [ ] Health check returns 200
- [ ] Student dashboard returns data (may be empty)
- [ ] University dashboard returns data (may be empty)
- [ ] Admin dashboard returns data (may be empty)
- [ ] Recommendations endpoint works
- [ ] PDF parsing endpoint works (with test PDF)
- [ ] All responses use `snake_case` field names
- [ ] All numeric fields are numbers
- [ ] All boolean fields are booleans
- [ ] Error handling works (401, 403, 400)

---

**Status:** Ready for Testing  
**Last Updated:** January 19, 2026
