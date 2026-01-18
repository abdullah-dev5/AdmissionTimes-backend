# API Endpoint Testing Guide

This guide explains how to test API endpoints for the AdmissionTimes backend.

## Prerequisites

1. **Start the server**:
   ```bash
   pnpm dev
   # or
   npm run dev
   ```

2. **Verify server is running**:
   - Server should be running on `http://localhost:3000`
   - Health check: `http://localhost:3000/health`
   - API Docs: `http://localhost:3000/api-docs`

## Testing Methods

### Method 1: TypeScript Script (Recommended)

Run the TypeScript test script:

```bash
pnpm test-api
# or
npm run test-api
# or
ts-node -r tsconfig-paths/register scripts/test-api.ts
```

This script will:
- Test all major API endpoints
- Show pass/fail status for each endpoint
- Display test summary with success rate
- Show response times

### Method 2: PowerShell Script (Windows)

Run the PowerShell script:

```powershell
.\scripts\test-api.ps1
```

### Method 3: Bash Script (Linux/Mac)

Run the bash script:

```bash
chmod +x scripts/test-api.sh
./scripts/test-api.sh
```

### Method 4: Manual Testing with curl

Test individual endpoints using curl:

#### Health Check
```bash
curl http://localhost:3000/health
```

#### List Admissions (Student)
```bash
curl -X GET "http://localhost:3000/api/v1/admissions?page=1&limit=10" \
  -H "x-user-id: 7998b0fe-9d05-44e4-94ab-e65e0213bf10" \
  -H "x-user-role: student"
```

#### Get Current User Profile
```bash
curl -X GET "http://localhost:3000/api/v1/users/me" \
  -H "x-user-id: 7998b0fe-9d05-44e4-94ab-e65e0213bf10" \
  -H "x-user-role: student"
```

#### Create Admission (University)
```bash
curl -X POST "http://localhost:3000/api/v1/admissions" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 412c9cd6-78db-46c1-84e1-c059a20d11bf" \
  -H "x-user-role: university" \
  -H "x-university-id: 412c9cd6-78db-46c1-84e1-c059a20d11bf" \
  -d '{
    "title": "Test Program",
    "description": "Test Description",
    "degree_level": "bachelor",
    "deadline": "2026-12-31T23:59:59Z",
    "university_id": "412c9cd6-78db-46c1-84e1-c059a20d11bf"
  }'
```

### Method 5: Using Postman/Insomnia

1. Import the Postman collection: `postman_collection.json`
2. Set environment variables:
   - `base_url`: `http://localhost:3000`
   - `student_user_id`: `7998b0fe-9d05-44e4-94ab-e65e0213bf10`
   - `university_user_id`: `412c9cd6-78db-46c1-84e1-c059a20d11bf`
   - `admin_user_id`: `e61690b2-0a64-47de-9274-66e06d1437b7`

3. Add headers to requests:
   - `x-user-id`: User UUID
   - `x-user-role`: `student`, `university`, or `admin`
   - `x-university-id`: University UUID (for university users)

## Test User IDs

The following test user IDs are configured in the mock authentication:

- **Student**: `7998b0fe-9d05-44e4-94ab-e65e0213bf10`
- **University**: `412c9cd6-78db-46c1-84e1-c059a20d11bf`
- **Admin**: `e61690b2-0a64-47de-9274-66e06d1437b7`

## Endpoints Tested

The test scripts cover the following endpoints:

### Health & Documentation
- `GET /health` - Health check

### Admissions Domain
- `GET /api/v1/admissions` - List admissions
- `GET /api/v1/admissions/:id` - Get admission detail
- `POST /api/v1/admissions` - Create admission

### Users Domain
- `GET /api/v1/users/me` - Get current user (student/university/admin)

### Notifications Domain
- `GET /api/v1/notifications` - List notifications
- `GET /api/v1/notifications/unread-count` - Get unread count

### Deadlines Domain
- `GET /api/v1/deadlines` - List deadlines
- `GET /api/v1/deadlines/upcoming` - Get upcoming deadlines

### Analytics Domain
- `POST /api/v1/analytics/events` - Track event
- `GET /api/v1/analytics/stats` - Get statistics

### Changelogs Domain
- `GET /api/v1/changelogs` - List changelogs

### Watchlists Domain
- `GET /api/v1/watchlists` - List watchlists

### User Activity Domain
- `GET /api/v1/activity` - List activities

### Dashboard Domain
- `GET /api/v1/student/dashboard` - Student dashboard
- `GET /api/v1/university/dashboard` - University dashboard
- `GET /api/v1/admin/dashboard` - Admin dashboard

## Expected Results

- ✅ **200-299**: Success
- ❌ **400-499**: Client error (validation, not found, etc.)
- ❌ **500-599**: Server error

## Troubleshooting

### Server not running
```
Error: connect ECONNREFUSED 127.0.0.1:3000
```
**Solution**: Start the server with `pnpm dev`

### Database connection errors
```
Warning: Database connection test failed
```
**Solution**: 
1. Check database configuration in `.env`
2. Ensure Supabase is running (if using local)
3. Verify database credentials

### 404 errors
```
Route not found
```
**Solution**: 
1. Verify the endpoint path is correct
2. Check that the domain routes are registered
3. Ensure server is running the latest code

### Authentication errors
```
403 Forbidden
```
**Solution**: 
1. Add required headers (`x-user-id`, `x-user-role`)
2. Verify user role has permission for the endpoint
3. Check middleware configuration

## Additional Resources

- **API Documentation**: `http://localhost:3000/api-docs` (Swagger UI)
- **API Contract**: See `API_CONTRACT.md`
- **Postman Collection**: `postman_collection.json`
