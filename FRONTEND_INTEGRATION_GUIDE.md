# Frontend Integration Guide

**Created:** January 18, 2026  
**Purpose:** Complete guide for frontend developers to integrate with AdmissionTimes Backend API  
**Status:** Ready for Integration

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [API Base URL](#api-base-url)
3. [Authentication](#authentication)
4. [Request/Response Format](#requestresponse-format)
5. [Error Handling](#error-handling)
6. [API Endpoints Overview](#api-endpoints-overview)
7. [Integration Checklist](#integration-checklist)
8. [Common Patterns](#common-patterns)
9. [Testing](#testing)

---

## 🚀 Quick Start

### 1. Base URL

**Development:**
```
http://localhost:3000
```

**Production:**
```
https://api.admissiontimes.com
```

### 2. API Version

All endpoints are prefixed with `/api/v1/`

**Example:**
```
GET http://localhost:3000/api/v1/admissions
```

### 3. Interactive Documentation

**Swagger UI:** `http://localhost:3000/api-docs`

- Browse all endpoints
- Test endpoints directly
- View request/response schemas
- See example payloads

---

## 🔐 Authentication

### Current Status: Mock Authentication (Development)

**⚠️ Important:** The backend currently uses **mock authentication** for development. Real Supabase Auth will be implemented in Phase 4C.

### Development Setup

For development, set these headers on all requests:

```javascript
headers: {
  'Content-Type': 'application/json',
  'x-user-id': 'user-uuid-here',           // Optional: User UUID
  'x-user-role': 'student',                 // Optional: 'student' | 'university' | 'admin'
  'x-university-id': 'university-uuid'     // Optional: Required for university role
}
```

### Example (Axios)

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add mock auth headers for development
api.interceptors.request.use((config) => {
  const userId = localStorage.getItem('userId');
  const userRole = localStorage.getItem('userRole');
  const universityId = localStorage.getItem('universityId');
  
  if (userId) config.headers['x-user-id'] = userId;
  if (userRole) config.headers['x-user-role'] = userRole;
  if (universityId) config.headers['x-university-id'] = universityId;
  
  return config;
});
```

### Future: Real Authentication (Phase 4C)

When real Supabase Auth is implemented:

```javascript
// Future implementation
headers: {
  'Authorization': 'Bearer <jwt-token>',
  'Content-Type': 'application/json'
}
```

---

## 📦 Request/Response Format

### Standard Success Response

```json
{
  "success": true,
  "message": "Success",
  "data": { /* response data */ },
  "timestamp": "2026-01-18T10:30:00.000Z"
}
```

### Paginated Response

```json
{
  "success": true,
  "message": "Success",
  "data": [ /* array of items */ ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  },
  "timestamp": "2026-01-18T10:30:00.000Z"
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error message",
  "errors": { /* optional validation errors */ },
  "timestamp": "2026-01-18T10:30:00.000Z"
}
```

---

## ⚠️ Error Handling

### HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful GET, PUT, PATCH requests |
| 201 | Created | Successful POST requests |
| 400 | Bad Request | Validation errors, invalid input |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 500 | Internal Server Error | Server errors |

### Error Response Format

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

### Frontend Error Handler Example

```javascript
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server responded with error
      const { message, errors } = error.response.data;
      
      // Handle validation errors
      if (errors) {
        // Display field-specific errors
        Object.keys(errors).forEach(field => {
          console.error(`${field}: ${errors[field]}`);
        });
      } else {
        // Display general error message
        console.error(message);
      }
    } else {
      // Network error
      console.error('Network error:', error.message);
    }
    
    return Promise.reject(error);
  }
);
```

---

## 🌐 API Endpoints Overview

### Base URL Structure

```
/api/v1/{domain}/{resource}
```

### Domains & Endpoints

#### 1. Admissions Domain (10 endpoints)
- `GET /api/v1/admissions` - List admissions (paginated, filtered)
- `GET /api/v1/admissions/:id` - Get admission detail
- `POST /api/v1/admissions` - Create admission
- `PUT /api/v1/admissions/:id` - Update admission
- `DELETE /api/v1/admissions/:id` - Delete admission
- `PATCH /api/v1/admissions/:id/submit` - Submit for verification
- `PATCH /api/v1/admissions/:id/verify` - Verify admission (admin)
- `PATCH /api/v1/admissions/:id/reject` - Reject admission (admin)
- `PATCH /api/v1/admissions/:id/dispute` - Dispute admission (university)
- `GET /api/v1/admissions/:id/changelogs` - Get admission changelogs

#### 2. Notifications Domain (7 endpoints)
- `GET /api/v1/notifications` - List notifications
- `GET /api/v1/notifications/unread-count` - Get unread count
- `GET /api/v1/notifications/:id` - Get notification detail
- `PATCH /api/v1/notifications/:id/read` - Mark as read
- `PATCH /api/v1/notifications/read-all` - Mark all as read
- `POST /api/v1/notifications` - Create notification (admin)
- `DELETE /api/v1/notifications/:id` - Delete notification

#### 3. Deadlines Domain (6 endpoints)
- `GET /api/v1/deadlines` - List deadlines
- `GET /api/v1/deadlines/upcoming` - Get upcoming deadlines
- `GET /api/v1/deadlines/:id` - Get deadline detail
- `POST /api/v1/deadlines` - Create deadline
- `PUT /api/v1/deadlines/:id` - Update deadline
- `DELETE /api/v1/deadlines/:id` - Delete deadline

#### 4. User Activity Domain (2 endpoints)
- `GET /api/v1/activity` - List activities
- `GET /api/v1/activity/:id` - Get activity detail

#### 5. Users Domain (5 endpoints)
- `GET /api/v1/users/me` - Get current user profile
- `PUT /api/v1/users/me` - Update current user profile
- `GET /api/v1/users/:id` - Get user by ID
- `GET /api/v1/users` - List users (admin only)
- `PATCH /api/v1/users/:id/role` - Update user role (admin only)

#### 6. Analytics Domain (5 endpoints)
- `POST /api/v1/analytics/events` - Track event
- `GET /api/v1/analytics/stats` - Get general statistics
- `GET /api/v1/analytics/admissions` - Admission statistics
- `GET /api/v1/analytics/users` - User statistics
- `GET /api/v1/analytics/activity` - Aggregated activity feed

#### 7. Changelogs Domain (3 endpoints)
- `GET /api/v1/changelogs` - List changelogs (with filters)
- `GET /api/v1/changelogs/:id` - Get changelog by ID
- `GET /api/v1/changelogs/admission/:admissionId` - Get admission changelogs

#### 8. Watchlists Domain (5 endpoints)
- `GET /api/v1/watchlists` - List user's watchlists
- `POST /api/v1/watchlists` - Add admission to watchlist
- `GET /api/v1/watchlists/:id` - Get watchlist item
- `PATCH /api/v1/watchlists/:id` - Update watchlist notes
- `DELETE /api/v1/watchlists/:id` - Remove from watchlist

#### 9. User Preferences Domain (3 endpoints)
- `GET /api/v1/users/me/preferences` - Get user preferences
- `PUT /api/v1/users/me/preferences` - Update preferences (full update)
- `PATCH /api/v1/users/me/preferences` - Partial update preferences

**Total: 51 API Endpoints**

---

## ✅ Integration Checklist

### Setup Phase

- [ ] Configure API base URL (development/production)
- [ ] Set up HTTP client (Axios, Fetch, etc.)
- [ ] Configure request interceptors for auth headers
- [ ] Configure response interceptors for error handling
- [ ] Test connection to `/health` endpoint

### Authentication

- [ ] Implement mock auth headers (development)
- [ ] Store user context (userId, role, universityId)
- [ ] Handle authentication errors (401)
- [ ] Prepare for real Supabase Auth (Phase 4C)

### Core Features

- [ ] **Admissions**
  - [ ] List admissions with pagination
  - [ ] Filter and search admissions
  - [ ] View admission details
  - [ ] Create/update admissions (university)
  - [ ] Submit for verification
  - [ ] Verify/reject (admin)

- [ ] **Notifications**
  - [ ] Display notifications list
  - [ ] Show unread count badge
  - [ ] Mark as read / mark all as read
  - [ ] Real-time updates (future)

- [ ] **Deadlines**
  - [ ] Display deadlines list
  - [ ] Show upcoming deadlines
  - [ ] Display urgency indicators
  - [ ] Create/update deadlines

- [ ] **Watchlists**
  - [ ] Add/remove from watchlist
  - [ ] Display user's watchlist
  - [ ] Update watchlist notes

- [ ] **User Preferences**
  - [ ] Display preferences
  - [ ] Update preferences
  - [ ] Apply preferences (theme, language)

- [ ] **User Activity**
  - [ ] Display activity feed
  - [ ] Filter by activity type

- [ ] **Analytics**
  - [ ] Track user events
  - [ ] Display statistics (admin)

### Error Handling

- [ ] Handle 400 (validation errors)
- [ ] Handle 401 (unauthorized)
- [ ] Handle 403 (forbidden)
- [ ] Handle 404 (not found)
- [ ] Handle 500 (server errors)
- [ ] Display user-friendly error messages
- [ ] Handle network errors

### UI/UX

- [ ] Loading states for async requests
- [ ] Empty states for no data
- [ ] Pagination UI
- [ ] Search/filter UI
- [ ] Form validation (client-side)
- [ ] Success/error notifications

---

## 🔄 Common Patterns

### Pagination

```javascript
// Request
GET /api/v1/admissions?page=1&limit=20

// Response
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}

// Frontend usage
const loadPage = async (page) => {
  const response = await api.get('/admissions', {
    params: { page, limit: 20 }
  });
  
  setAdmissions(response.data.data);
  setPagination(response.data.pagination);
};
```

### Filtering & Search

```javascript
// Request
GET /api/v1/admissions?search=computer&program_type=master&degree_level=graduate

// Frontend usage
const searchAdmissions = async (filters) => {
  const response = await api.get('/admissions', {
    params: {
      page: 1,
      limit: 20,
      ...filters
    }
  });
  
  return response.data.data;
};
```

### Creating Resources

```javascript
// Request
POST /api/v1/admissions
Content-Type: application/json

{
  "title": "Computer Science Master's Program",
  "description": "...",
  "program_type": "master",
  "degree_level": "graduate",
  "deadline": "2026-06-01T00:00:00.000Z"
}

// Response
{
  "success": true,
  "message": "Admission created successfully",
  "data": { /* created admission */ }
}

// Frontend usage
const createAdmission = async (data) => {
  try {
    const response = await api.post('/admissions', data);
    return response.data.data;
  } catch (error) {
    // Handle validation errors
    if (error.response?.data?.errors) {
      // Display field errors
    }
    throw error;
  }
};
```

### Updating Resources

```javascript
// Full update (PUT)
PUT /api/v1/admissions/:id
{
  "title": "Updated Title",
  "description": "Updated description",
  // ... all fields
}

// Partial update (PATCH)
PATCH /api/v1/admissions/:id/submit
{
  "submitted_by": "user-id"
}
```

---

## 🧪 Testing

### Manual Testing

1. **Use Swagger UI:** `http://localhost:3000/api-docs`
   - Test endpoints directly
   - See request/response examples
   - Validate schemas

2. **Use Postman/Insomnia**
   - Import OpenAPI spec from Swagger
   - Create test collections
   - Test authentication flows

### Automated Testing

```javascript
// Example: Jest + Axios
import api from './api';

describe('Admissions API', () => {
  it('should list admissions', async () => {
    const response = await api.get('/admissions', {
      headers: {
        'x-user-id': 'test-user-id',
        'x-user-role': 'student'
      }
    });
    
    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(Array.isArray(response.data.data)).toBe(true);
  });
});
```

---

## 📝 Notes

### Date Formats

- All dates are in **ISO 8601** format: `2026-01-18T10:30:00.000Z`
- Use `new Date().toISOString()` for sending dates
- Parse dates with `new Date(dateString)` on frontend

### UUIDs

- All IDs are **UUIDs** (v4)
- Format: `123e4567-e89b-12d3-a456-426614174000`
- Validate UUIDs before sending requests

### Pagination Defaults

- Default `page`: 1
- Default `limit`: 20
- Maximum `limit`: 100

### Access Control

- **Students:** Read-only access to verified admissions
- **Universities:** Full access to own admissions
- **Admins:** Full access to all admissions

---

## 🔗 Additional Resources

- **API Documentation:** `http://localhost:3000/api-docs`
- **Backend Repository:** See `README.md` for setup instructions
- **API Contract:** See `API_CONTRACT.md` for detailed endpoint documentation
- **Backend Summary:** See `BACKEND_ACHIEVEMENT_SUMMARY.md` for project overview

---

## 🆘 Support

For questions or issues:
1. Check Swagger UI documentation
2. Review API Contract document
3. Check backend logs
4. Contact backend team

---

**Last Updated:** January 18, 2026  
**Backend Version:** 1.0.0  
**API Version:** v1
