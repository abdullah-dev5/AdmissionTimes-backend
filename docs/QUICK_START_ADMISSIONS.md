# Quick Start: University ID & Admissions Seeding

**Date:** February 6, 2026  
**Status:** ✅ Ready to Use

---

## 🎯 What Was Solved

**Problem:**  
The `admissions` table needs a `university_id`, but we made it optional during signup. How do university users get an ID to associate with their admissions?

**Solution:**  
✅ **Auto-generate university_id** when a university user signs up without one!

---

## 🚀 Quick Setup

### Step 1: University User Already Exists

You already have a university user:
- **ID:** `16c7989e-3408-4ab3-b9bf-b2bcf7e1ab42`
- **Email:** `university@test.com`
- **Password:** `password123`

### Step 2: Run the Seed Script

```bash
# From backend directory
cd e:\fyp\admission-times-backend

# Run seed script
psql -U postgres -d admissiontimes -f supabase/seeds/seed_admissions.sql
```

**What the script does:**
1. Checks if user has `organization_id`
2. If NULL → generates one and updates user
3. Creates 10 admission records using that `organization_id` as `university_id`

---

## ✅ Expected Output

```
NOTICE:  Generated and assigned organization_id: 12345678-abcd-1234-efgh-567890abcdef to user 16c7989e-3408-4ab3-b9bf-b2bcf7e1ab42
NOTICE:  Successfully created 10 admission records
NOTICE:  University ID used: 12345678-abcd-1234-efgh-567890abcdef

NOTICE:  ============================================
NOTICE:  ✅ Admissions Seeding Complete!
NOTICE:  ============================================
NOTICE:  Total Admissions: 10
NOTICE:    - Pending: 4
NOTICE:    - Verified: 3
NOTICE:    - Rejected: 1
NOTICE:    - Disputed: 1
NOTICE:    - Draft: 1
NOTICE:  ============================================
```

---

## 🧪 Test the Complete Flow

### 1. Start Backend

```bash
cd e:\fyp\admission-times-backend
npm run dev
```

### 2. Start Frontend

```bash
cd e:\fyp\admission-times-frontend
pnpm dev
```

### 3. Sign In

Go to: `http://localhost:5173/signin`

**Credentials:**
- Email: `university@test.com`
- Password: `password123`

### 4. View Admissions

After signin, you'll be redirected to: `/university/dashboard`

**You should see:**
- 10 admission records
- All with the same `university_id` (auto-generated)
- Different statuses (pending, verified, rejected, disputed, draft)

---

## 🔍 Verify in Database

### Check User's University ID

```sql
SELECT 
  id,
  email,
  role,
  organization_id AS university_id,
  created_at
FROM users
WHERE email = 'university@test.com';
```

**Expected:**
```
id             | email                 | role       | university_id          | created_at
15c7989e...    | university@test.com   | university | 12345678-abcd-1234... | 2026-02-06 12:35:26
```

### Check Admissions

```sql
SELECT 
  id,
  title,
  university_id,
  verification_status,
  tuition_fee,
  created_by
FROM admissions
WHERE created_by = '16c7989e-3408-4ab3-b9bf-b2bcf7e1ab42'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected:**
All admissions should have the same `university_id` matching the user's `organization_id`!

---

## 📊 What Got Seeded

| # | Program | Degree | Status | Fee |
|---|---------|--------|--------|-----|
| 1 | BS Computer Science | Bachelor | Pending | $50,000 |
| 2 | Executive MBA | Master | Verified | $75,000 |
| 3 | MS Data Science | Master | Rejected | $60,000 |
| 4 | PhD Physics | PhD | Pending | Free |
| 5 | BBA Honors | Bachelor | Disputed | $45,000 |
| 6 | MS Artificial Intelligence | Master | Draft | $65,000 |
| 7 | MBA Digital Marketing | Master | Verified | $55,000 |
| 8 | BSc Mechanical Engineering | Bachelor | Pending | $48,000 |
| 9 | MS Cybersecurity | Master | Verified | $58,000 |
| 10 | PhD Economics | PhD | Pending | Free |

---

## 🔄 How Auto-Generation Works

### During Signup (New University Users)

```
User signs up as "university" WITHOUT university_id
    ↓
Backend: "No university_id provided"
    ↓
Auto-generate: UUID v4 → "abc-123-def-456"
    ↓
Store in: users.organization_id = "abc-123-def-456"
    ↓
Response: { university_id: "abc-123-def-456" }
```

### During Admission Creation

```
User creates admission
    ↓
System fetches user context
    ↓
userContext.university_id = organization_id
    ↓
Admission: { university_id: "abc-123-def-456", ... }
    ↓
Saved with proper foreign key relationship!
```

---

## 🎓 Create New University User (Test)

### 1. Sign Up

Go to: `http://localhost:5173/signup`

**Fill form:**
- Account Type: **University Representative**
- University ID: **(Leave empty)** ← Will auto-generate!
- Email: `newuni@test.com`
- Password: `password123`

### 2. Check Console

**Backend logs:**
```
[Auth Service] Auto-generated university_id for newuni@test.com: fedcba98-7654-3210-abcd-1234567890ab
```

### 3. Verify

```sql
SELECT organization_id FROM users WHERE email = 'newuni@test.com';
```

**Result:**
```
organization_id
-------------------------------------
fedcba98-7654-3210-abcd-1234567890ab  ← Auto-generated!
```

### 4. Create Admission

Sign in as `newuni@test.com`, create an admission, and it will automatically use that `university_id`!

---

## 🧹 Cleanup (Optional)

### Remove All Seeded Admissions

```sql
DELETE FROM admissions 
WHERE created_by = '16c7989e-3408-4ab3-b9bf-b2bcf7e1ab42';
```

### Remove User's University ID

```sql
UPDATE users 
SET organization_id = NULL 
WHERE email = 'university@test.com';
```

### Re-seed

```bash
psql -U postgres -d admissiontimes -f supabase/seeds/seed_admissions.sql
```

---

## 📚 Documentation

For complete details, see:
- **[UNIVERSITY_ID_MECHANISM.md](./UNIVERSITY_ID_MECHANISM.md)** - Full technical documentation
- **[supabase/seeds/README.md](../supabase/seeds/README.md)** - Seeding guide
- **[AUTHENTICATION_ARCHITECTURE.md](../../admission-times-frontend/AUTHENTICATION_ARCHITECTURE.md)** - Auth system

---

## ✅ Summary

✅ **Auto-generates** university_id during signup  
✅ **Stores** in users.organization_id  
✅ **Uses** for all admissions  
✅ **Seed script** handles it automatically  
✅ **No manual entry** required  
✅ **Testing-friendly**  

**You're all set!** 🎉

---

## 🆘 Troubleshooting

### Issue: Seed script fails

**Check:**
1. Database is running
2. Migrations have been run
3. University user exists

**Fix:**
```bash
# Run migrations
psql -U postgres -d admissiontimes -f supabase/migrations/20260105000001_initial_schema.sql

# Create user if needed (sign up via frontend)
# Then run seed script again
```

### Issue: Admissions have NULL university_id

**Check:**
```sql
SELECT organization_id FROM users WHERE id = '16c7989e-3408-4ab3-b9bf-b2bcf7e1ab42';
```

If NULL:
```sql
-- Manually set
UPDATE users 
SET organization_id = gen_random_uuid() 
WHERE id = '16c7989e-3408-4ab3-b9bf-b2bcf7e1ab42';
```

Then re-run seed script.

---

**Happy Testing! 🚀**
