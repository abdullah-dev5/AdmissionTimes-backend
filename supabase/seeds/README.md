# Database Seeds

This folder contains seed scripts to populate the database with test data for development and testing.

## 📁 Available Seeds

### `seed_admissions.sql`
Seeds 10 diverse admission records with different:
- Program types (undergraduate, graduate)
- Degree levels (bachelor, master, phd)
- Verification statuses (draft, pending, verified, rejected, Rejected)
- Fields of study (Computer Science, Business, Physics, Engineering, etc.)
- Realistic deadlines, fees, and requirements

**University User:**
- ID: `16c7989e-3408-4ab3-b9bf-b2bcf7e1ab42`
- Email: `university@test.com`

## 🚀 Usage

### Option 1: Using psql (Recommended)

```bash
# From the backend root directory
psql -U postgres -d admissiontimes -f supabase/seeds/seed_admissions.sql
```

### Option 2: Using Supabase CLI

```bash
# From the backend root directory
supabase db reset  # Resets and runs all migrations + seed.sql

# OR run specific seed
psql "postgresql://postgres:postgres@localhost:54322/postgres" -f supabase/seeds/seed_admissions.sql
```

### Option 3: Copy and Paste

1. Open your database client (pgAdmin, DBeaver, Supabase Studio, etc.)
2. Open `seed_admissions.sql`
3. Copy the entire content
4. Paste and execute in your SQL query window

## 📊 What Gets Seeded

The `seed_admissions.sql` creates **10 admission records**:

| # | Title | Program Type | Degree | Field | Status | Fee |
|---|-------|-------------|--------|-------|---------|-----|
| 1 | BS Computer Science - Fall 2025 | Undergraduate | Bachelor | Computer Science | Pending | $50,000 |
| 2 | Executive MBA Program | Graduate | Master | Business Administration | Verified | $75,000 |
| 3 | MS Data Science | Graduate | Master | Data Science | Rejected | $60,000 |
| 4 | PhD Physics | Graduate | PhD | Physics | Pending | Free (Funded) |
| 5 | BBA Honors Program | Undergraduate | Bachelor | Business Administration | Rejected | $45,000 |
| 6 | MS Artificial Intelligence | Graduate | Master | AI | Draft | $65,000 |
| 7 | MBA Digital Marketing | Graduate | Master | Marketing | Verified | $55,000 |
| 8 | BSc Mechanical Engineering | Undergraduate | Bachelor | Mech Engineering | Pending | $48,000 |
| 9 | MS Cybersecurity | Graduate | Master | Cybersecurity | Verified | $58,000 |
| 10 | PhD Economics | Graduate | PhD | Economics | Pending | Free (Funded) |

### Status Distribution:
- **Pending:** 4 records
- **Verified:** 3 records
- **Rejected:** 1 record
- **Rejected:** 1 record
- **Draft:** 1 record

## ✅ Verification

After running the seed script, verify the data:

```sql
-- Check all seeded admissions
SELECT 
  title,
  program_type,
  degree_level,
  verification_status,
  tuition_fee,
  deadline
FROM admissions
WHERE created_by = '16c7989e-3408-4ab3-b9bf-b2bcf7e1ab42'
ORDER BY created_at DESC;

-- Count by status
SELECT 
  verification_status,
  COUNT(*) as count
FROM admissions
WHERE created_by = '16c7989e-3408-4ab3-b9bf-b2bcf7e1ab42'
GROUP BY verification_status;
```

## 🧹 Cleanup

To remove all seeded admissions:

```sql
-- Delete all admissions created by the test university user
DELETE FROM admissions 
WHERE created_by = '16c7989e-3408-4ab3-b9bf-b2bcf7e1ab42';

-- Verify deletion
SELECT COUNT(*) FROM admissions 
WHERE created_by = '16c7989e-3408-4ab3-b9bf-b2bcf7e1ab42';
-- Should return 0
```

## 📝 Customization

To add more admissions or modify existing ones:

1. Open `seed_admissions.sql`
2. Copy one of the INSERT value blocks
3. Modify the fields as needed
4. Make sure to use `gen_random_uuid()` for the `id` field
5. Keep the `created_by` as `'16c7989e-3408-4ab3-b9bf-b2bcf7e1ab42'`
6. Run the modified script

## 🔗 Related Files

- **Main seed file:** `../seed.sql` - Auto-executed on `supabase db reset`
- **Schema:** `../migrations/20260105000001_initial_schema.sql`
- **Admissions types:** `../../src/domain/admissions/types/admissions.types.ts`

## 🆘 Troubleshooting

### Issue: "relation 'admissions' does not exist"
**Solution:** Run migrations first
```bash
supabase db reset
# OR
psql -U postgres -d admissiontimes -f supabase/migrations/20260105000001_initial_schema.sql
```

### Issue: "user does not exist" (created_by constraint)
**Solution:** The user must exist first. Sign up at `/signup` with email `university@test.com`

### Issue: Duplicate key violation
**Solution:** The script uses `gen_random_uuid()` which should always generate unique IDs. If you get this error, you may have run the script multiple times. Clean up first:
```sql
DELETE FROM admissions WHERE created_by = '16c7989e-3408-4ab3-b9bf-b2bcf7e1ab42';
```

## 📧 Notes

- All seeded admissions use realistic data
- Deadlines are set in 2025 (past dates for testing)
- Requirements are stored as JSONB for flexibility
- The `university_id` is NULL as it's optional for now
- All records are marked as `is_active = true`
- Created timestamps use NOW() so they'll reflect when you run the seed

---

**Happy Testing! 🚀**

