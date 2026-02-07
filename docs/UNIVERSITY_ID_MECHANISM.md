# University ID Auto-Assignment Mechanism

**Status:** ✅ Implemented  
**Date:** February 6, 2026  
**Purpose:** Automatic university_id generation for university users

---

## 🎯 Problem

The `admissions` table has a `university_id` foreign key field, but we made `university_id` **optional** during signup to simplify the testing process. This creates an issue:

- University users can sign up without a `university_id`
- When they create admissions, what `university_id` should be used?
- Foreign key relationships need valid UUIDs

---

## ✅ Solution Implemented

### **Auto-Generate University ID During Signup**

When a university user signs up **without** providing a `university_id`, the system automatically:
1. Generates a unique UUID (v4)
2. Assigns it to the user's `organization_id` field
3. Uses this ID as `university_id` for all admissions created by that user

---

## 🔧 Implementation Details

### 1. Backend Auth Service

**File:** `src/domain/auth/services/auth.service.ts`

**Lines ~33-40:**
```typescript
// TEMPORARY: Auto-generate university_id for university users if not provided
// This allows them to create admissions without manual university_id entry
if (data.user_type === 'university' && !data.university_id) {
  // Generate a UUID v4 for the university
  const { randomUUID } = require('crypto');
  data.university_id = randomUUID();
  console.log(`[Auth Service] Auto-generated university_id for ${data.email}: ${data.university_id}`);
}
```

**What happens:**
- Checks if user is signing up as "university"
- Checks if `university_id` was NOT provided
- Generates a new UUID using Node's crypto module
- Assigns it to `data.university_id`
- Logs the generated ID for debugging

### 2. Database Storage

**File:** `src/domain/auth/models/auth.model.ts`

**Line ~56:**
```typescript
data.university_id || null,  // Stored in organization_id column
```

The `university_id` from signup is stored in the `users.organization_id` column in the database.

**Database Schema:**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE,
  role user_type NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  organization_id UUID,  -- ← University ID stored here
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3. Admissions Creation

**File:** `src/domain/admissions/services/admissions.service.ts`

**Line ~148:**
```typescript
university_id: userContext?.university_id || null,
```

When a university user creates an admission:
- `userContext.university_id` contains their `organization_id`
- This value is used as the `university_id` for the admission
- Creates proper relationship between user and their admissions

---

## 📊 Data Flow

```
1. University Signup (without university_id)
   ↓
   User fills signup form
   ↓
   Frontend: { email, password, user_type: 'university', university_id: '' }
   ↓
   Backend: Auto-generates UUID
   ↓
   Database: Stores in users.organization_id
   ↓
   Result: User ID = abc-123, organization_id = xyz-789-auto


2. Create Admission
   ↓
   User creates admission
   ↓
   System fetches userContext (includes organization_id)
   ↓
   Admission: { title: "...", university_id: xyz-789-auto, ... }
   ↓
   Database: Admission linked to university
   ↓
   Result: Admission.university_id = xyz-789-auto
```

---

## 🧪 Testing the Mechanism

### 1. Sign Up as University (Without ID)

```bash
POST /api/v1/auth/signup
{
  "email": "test-uni@example.com",
  "password": "password123",
  "user_type": "university"
  // No university_id provided
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid-here",
      "email": "test-uni@example.com",
      "role": "university",
      "university_id": "auto-generated-uuid-here",  // ← Auto-generated!
      ...
    }
  }
}
```

**Console Log:**
```
[Auth Service] Auto-generated university_id for test-uni@example.com: 12345678-abcd-1234-efgh-567890abcdef
```

### 2. Verify in Database

```sql
SELECT id, email, role, organization_id 
FROM users 
WHERE email = 'test-uni@example.com';
```

**Expected Result:**
```
id                                   | email                  | role       | organization_id
-------------------------------------|------------------------|------------|-------------------------------------
abc-123-def-456                      | test-uni@example.com   | university | 12345678-abcd-1234-efgh-567890abcdef
```

### 3. Create Admission

```bash
POST /api/v1/admissions
Headers: { x-user-id: "abc-123-def-456", x-user-role: "university" }
{
  "title": "Master of Science in Computer Science",
  "program_type": "graduate",
  "degree_level": "master",
  ...
}
```

**Database Result:**
```sql
SELECT id, title, university_id, created_by 
FROM admissions 
WHERE title = 'Master of Science in Computer Science';
```

```
id          | title                                    | university_id                        | created_by
------------|------------------------------------------|--------------------------------------|-------------
admission-1 | Master of Science in Computer Science    | 12345678-abcd-1234-efgh-567890abcdef | abc-123-def-456
```

✅ **university_id matches the user's organization_id!**

---

## 🔄 Seed Script Integration

The seed script (`supabase/seeds/seed_admissions.sql`) has been updated to:

1. **Fetch** the user's `organization_id`
2. **Generate** one if it doesn't exist
3. **Use** it for all seeded admissions

**Key Changes:**
```sql
DO $$
DECLARE
  v_university_id UUID;
  v_created_by UUID := '16c7989e-3408-4ab3-b9bf-b2bcf7e1ab42';
BEGIN
  -- Get the organization_id from the university user
  SELECT organization_id INTO v_university_id
  FROM users
  WHERE id = v_created_by AND role = 'university';

  -- If organization_id is NULL, generate one and update the user
  IF v_university_id IS NULL THEN
    v_university_id := gen_random_uuid();
    
    UPDATE users
    SET organization_id = v_university_id,
        updated_at = NOW()
    WHERE id = v_created_by;
    
    RAISE NOTICE 'Generated and assigned organization_id: %', v_university_id;
  END IF;

  -- Insert admissions using v_university_id
  INSERT INTO admissions (university_id, ...) VALUES
    (v_university_id, ...),  -- ← Uses generated/existing ID
    (v_university_id, ...),
    ...
END $$;
```

---

## 📝 Benefits

### ✅ Pros

1. **No Manual Entry Required**
   - Users don't need to know their university ID
   - Simplifies signup process

2. **Automatic Relationship**
   - Admissions automatically linked to university
   - Foreign key constraints satisfied

3. **Unique per University**
   - Each university user gets their own unique ID
   - No collisions or conflicts

4. **Backward Compatible**
   - Users can still provide university_id manually
   - Auto-generation only happens if not provided

5. **Testing Friendly**
   - Easy to create test university accounts
   - Seed scripts work automatically

### ⚠️ Considerations

1. **Not a "Real" University**
   - Each user is treated as their own university
   - No shared admissions between users

2. **No Validation**
   - Auto-generated IDs are not validated against a universities table
   - Assumes single user = single university

3. **Future Migration Needed**
   - When real universities table is created, need to migrate data
   - See "Future Enhancements" below

---

## 🚀 Future Enhancements

When implementing a proper universities system:

### 1. Create Universities Table

```sql
CREATE TABLE universities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  country VARCHAR(100),
  website VARCHAR(255),
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add foreign key to admissions
ALTER TABLE admissions 
ADD CONSTRAINT fk_university 
FOREIGN KEY (university_id) REFERENCES universities(id);
```

### 2. Migration Strategy

```sql
-- Migrate auto-generated university IDs to universities table
INSERT INTO universities (id, name, verified)
SELECT DISTINCT 
  organization_id,
  'University - ' || display_name,  -- Temporary name
  false  -- Not verified
FROM users
WHERE role = 'university' 
  AND organization_id IS NOT NULL;
```

### 3. Update Services

- Validate `university_id` against universities table
- Allow multiple users to share a university_id
- Implement university verification workflow

---

## 🛠️ Troubleshooting

### Issue: No university_id after signup

**Check:**
```javascript
console.log output in backend logs
```

**Verify:**
```sql
SELECT organization_id FROM users WHERE email = 'your-email@test.com';
```

### Issue: Admissions have NULL university_id

**Cause:** User context not passing organization_id

**Solution:** Check JWT middleware sets `req.user.university_id`

**Verify:**
```typescript
// In admissions controller
console.log('User context:', req.user);
// Should include university_id
```

### Issue: Duplicate university_id

**Unlikely:** UUID v4 has 122 bits of randomness (5.3×10³⁶ possible values)

**If it happens:** Regenerate and retry

---

## 📊 Database Queries

### Check all university users and their IDs

```sql
SELECT 
  id,
  email,
  role,
  organization_id as university_id,
  created_at
FROM users
WHERE role = 'university'
ORDER BY created_at DESC;
```

### Check admissions by university

```sql
SELECT 
  a.id,
  a.title,
  a.university_id,
  u.email as created_by_email,
  u.organization_id as user_university_id
FROM admissions a
LEFT JOIN users u ON a.created_by = u.id
WHERE u.role = 'university'
ORDER BY a.created_at DESC;
```

### Verify consistency

```sql
-- All admissions should have university_id matching user's organization_id
SELECT 
  CASE 
    WHEN a.university_id = u.organization_id THEN 'Consistent ✓'
    ELSE 'Inconsistent ✗'
  END as status,
  a.title,
  a.university_id as admission_university_id,
  u.organization_id as user_organization_id,
  u.email
FROM admissions a
LEFT JOIN users u ON a.created_by = u.id
WHERE u.role = 'university';
```

---

## ✅ Summary

**Current State:**
- ✅ Auto-generates university_id during signup if not provided
- ✅ Stores in `users.organization_id`
- ✅ Uses for all admissions created by that user
- ✅ Seed script automatically handles it
- ✅ No manual entry required
- ✅ Testing-friendly

**Limitations:**
- ⚠️ Each user = separate university (no sharing)
- ⚠️ No universities table (yet)
- ⚠️ No validation against real universities

**Next Steps:**
- 🔜 Create universities table (future)
- 🔜 Implement university verification (future)
- 🔜 Allow shared university_id (future)

---

**For now, this mechanism allows seamless testing and development without manual university ID management!** 🎉
