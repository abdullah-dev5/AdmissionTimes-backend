# API Testing Guide

**Created:** January 19, 2026  
**Purpose:** Guide for testing all new API endpoints before frontend integration  
**Base URL:** `http://localhost:3000`

---

## 🚀 Quick Start

### 1. Start the Server

```bash
pnpm dev
```

Server will start on: `http://localhost:3000`

### 2. Verify Server is Running

**GET** `http://localhost:3000/health`

Expected Response:
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "status": "ok",
    "message": "AdmissionTimes backend is running"
  },
  "timestamp": "2026-01-19T..."
}
```

---

## 🔐 Authentication Headers

For development, use these headers in Postman:

```
x-user-id: <user-uuid>
x-user-role: student | university | admin
x-university-id: <university-uuid> (optional, for university role)
```

### Sample User IDs (Get from database after seeding)

After running `pnpm seed`, you can get user IDs from the database:

```sql
SELECT id, role, display_name FROM users LIMIT 5;
```

Or use these sample UUIDs (replace with actual IDs from your database):
- Student: `550e8400-e29b-41d4-a716-446655440001`
- University: `550e8400-e29b-41d4-a716-446655440002`
- Admin: `550e8400-e29b-41d4-a716-446655440003`

---

## 📊 Dashboard Endpoints

### 1. Student Dashboard

**GET** `http://localhost:3000/api/v1/student/dashboard`

**Headers:**
```
x-user-id: <student-user-id>
x-user-role: student
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Dashboard data retrieved successfully",
  "data": {
    "stats": {
      "active_admissions": 5,
      "saved_count": 3,
      "upcoming_deadlines": 2,
      "recommendations_count": 4,
      "unread_notifications": 1,
      "urgent_deadlines": 0
    },
    "recommended_programs": [...],
    "upcoming_deadlines": [...],
    "recent_notifications": [...],
    "recent_activity": [...]
  },
  "timestamp": "2026-01-19T..."
}
```

**Test Cases:**
- ✅ With valid student user ID
- ✅ Without authentication (should return 401)
- ✅ With wrong role (should return 403)

---

### 2. University Dashboard

**GET** `http://localhost:3000/api/v1/university/dashboard`

**Headers:**
```
x-user-id: <university-user-id>
x-user-role: university
x-university-id: <university-id> (optional)
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Dashboard data retrieved successfully",
  "data": {
    "stats": {
      "total_admissions": 10,
      "pending_verification": 2,
      "verified_admissions": 8,
      "recent_updates": 3,
      "unread_notifications": 1,
      "pending_audits": 2
    },
    "recent_admissions": [...],
    "pending_verifications": [...],
    "recent_changes": [...],
    "recent_notifications": [...]
  },
  "timestamp": "2026-01-19T..."
}
```

**Test Cases:**
- ✅ With valid university user ID
- ✅ Without authentication (should return 401)
- ✅ With wrong role (should return 403)

---

### 3. Admin Dashboard

**GET** `http://localhost:3000/api/v1/admin/dashboard`

**Headers:**
```
x-user-id: <admin-user-id>
x-user-role: admin
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Dashboard data retrieved successfully",
  "data": {
    "stats": {
      "pending_verifications": 5,
      "total_admissions": 50,
      "total_universities": 10,
      "total_students": 30,
      "recent_actions": 15,
      "scraper_jobs_running": 0
    },
    "pending_verifications": [...],
    "recent_actions": [...],
    "scraper_activity": []
  },
  "timestamp": "2026-01-19T..."
}
```

**Test Cases:**
- ✅ With valid admin user ID
- ✅ Without authentication (should return 401)
- ✅ With wrong role (should return 403)

---

## 🎯 Recommendations Endpoint

### Get Student Recommendations

**GET** `http://localhost:3000/api/v1/student/recommendations`

**Headers:**
```
x-user-id: <student-user-id>
x-user-role: student
```

**Query Parameters:**
- `limit` (optional, default: 10) - Number of recommendations
- `min_score` (optional, default: 75) - Minimum match score (0-100)

**Example:**
```
GET http://localhost:3000/api/v1/student/recommendations?limit=5&min_score=80
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Recommendations retrieved successfully",
  "data": [
    {
      "admission_id": "uuid",
      "score": 85,
      "reason": "High match: Preferred degree level and approaching deadline",
      "factors": {
        "degree_match": 25,
        "deadline_proximity": 20,
        "location_preference": 20,
        "gpa_match": 20,
        "interest_match": 15
      }
    },
    ...
  ],
  "timestamp": "2026-01-19T..."
}
```

**Test Cases:**
- ✅ With valid student user ID
- ✅ With limit parameter
- ✅ With min_score parameter
- ✅ Without authentication (should return 401)
- ✅ With wrong role (should return 403)

---

## 📄 PDF Parsing Endpoint

### Parse PDF and Extract Admission Data

**POST** `http://localhost:3000/api/v1/admissions/parse-pdf`

**Headers:**
```
x-user-id: <university-user-id>
x-user-role: university
Content-Type: multipart/form-data
```

**Body (form-data):**
- `file` (File) - PDF file to parse (max 10MB)
- `university_id` (optional, string) - University ID

**Expected Response:**
```json
{
  "success": true,
  "message": "PDF parsed successfully",
  "data": {
    "title": "Computer Science Master Program",
    "degree_level": "master",
    "deadline": "2025-07-30T00:00:00.000Z",
    "application_fee": 75000,
    "location": "Islamabad, Pakistan",
    "description": "A comprehensive master program...",
    "confidence": 75,
    "extracted_fields": ["title", "degree_level", "deadline", "application_fee", "location", "description"]
  },
  "timestamp": "2026-01-19T..."
}
```

**Error Response (Invalid File):**
```json
{
  "success": false,
  "message": "PDF file is required",
  "errors": {
    "file": "PDF file is required"
  },
  "timestamp": "2026-01-19T..."
}
```

**Test Cases:**
- ✅ With valid PDF file
- ✅ With invalid file type (should return 400)
- ✅ With file too large >10MB (should return 400)
- ✅ Without file (should return 400)
- ✅ With corrupted PDF (should return 400)

**Sample PDF:**
Create a test PDF with admission information or use any admission-related PDF document.

---

## 📋 Postman Collection Setup

### Environment Variables

Create a Postman environment with:

```
base_url: http://localhost:3000
student_user_id: <your-student-user-id>
university_user_id: <your-university-user-id>
admin_user_id: <your-admin-user-id>
```

### Headers Collection

Create a collection with pre-configured headers:

**Student Headers:**
```
x-user-id: {{student_user_id}}
x-user-role: student
```

**University Headers:**
```
x-user-id: {{university_user_id}}
x-user-role: university
x-university-id: {{university_user_id}}
```

**Admin Headers:**
```
x-user-id: {{admin_user_id}}
x-user-role: admin
```

---

## 🧪 Test Scenarios

### Scenario 1: Student Flow

1. **Get Student Dashboard**
   - Should return stats, recommendations, deadlines, notifications
   - Verify all counts are numbers
   - Verify arrays are not null

2. **Get Recommendations**
   - Should return personalized recommendations
   - Verify scores are between 0-100
   - Verify factors are present

3. **Test with different limits**
   - `limit=5` should return 5 recommendations
   - `min_score=90` should return only high-scoring recommendations

### Scenario 2: University Flow

1. **Get University Dashboard**
   - Should return university-specific stats
   - Verify pending verifications are shown
   - Verify recent changes are included

2. **Parse PDF**
   - Upload a test PDF
   - Verify extracted fields
   - Check confidence score

### Scenario 3: Admin Flow

1. **Get Admin Dashboard**
   - Should return system-wide stats
   - Verify pending verifications count
   - Verify recent actions are shown

### Scenario 4: Error Handling

1. **Unauthenticated Requests**
   - All endpoints should return 401 without headers

2. **Wrong Role**
   - Student endpoint with university role → 403
   - University endpoint with student role → 403
   - Admin endpoint with student role → 403

3. **Invalid Data**
   - PDF parsing with invalid file → 400
   - Recommendations with invalid user → 400

---

## ✅ Validation Checklist

### Response Format
- [ ] All responses have `success`, `message`, `data`, `timestamp`
- [ ] All numeric fields are numbers (not strings)
- [ ] All boolean fields are booleans (not strings)
- [ ] All dates are ISO 8601 format

### Field Names
- [ ] All fields use `snake_case`
- [ ] No `camelCase` in responses
- [ ] Consistent naming across all endpoints

### Data Types
- [ ] `active_admissions`: number
- [ ] `saved_count`: number
- [ ] `days_remaining`: number
- [ ] `match_score`: number (0-100)
- [ ] `saved`: boolean
- [ ] `alert_enabled`: boolean
- [ ] `is_read`: boolean

### Error Handling
- [ ] 401 for unauthenticated requests
- [ ] 403 for wrong role
- [ ] 400 for validation errors
- [ ] 500 for server errors (with proper message)

---

## 🔍 Debugging Tips

### Check Database

```sql
-- Get user IDs
SELECT id, role, display_name FROM users LIMIT 10;

-- Check watchlists
SELECT * FROM watchlists WHERE user_id = '<user-id>' LIMIT 5;

-- Check admissions
SELECT id, title, verification_status FROM admissions WHERE is_active = true LIMIT 10;

-- Check notifications
SELECT * FROM notifications WHERE user_id = '<user-id>' LIMIT 5;
```

### Check Server Logs

Watch the server console for:
- Database query errors
- SQL syntax errors
- Type conversion errors

### Common Issues

1. **Empty arrays in response**
   - Check if database has seeded data
   - Run `pnpm seed` if needed

2. **401 Unauthorized**
   - Verify headers are set correctly
   - Check header names (case-sensitive)

3. **403 Forbidden**
   - Verify user role matches endpoint requirement
   - Check user exists in database

4. **500 Internal Server Error**
   - Check server logs
   - Verify database connection
   - Check SQL query syntax

---

## 📝 Notes

- All endpoints require authentication headers (even in mock mode)
- User IDs must exist in the database
- Run migrations and seeding before testing
- PDF parsing requires a valid PDF file
- Recommendations depend on user preferences and activity

---

**Status:** Ready for Testing  
**Last Updated:** January 19, 2026
