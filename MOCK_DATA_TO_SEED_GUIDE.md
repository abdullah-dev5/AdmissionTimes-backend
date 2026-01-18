# Mock Data to Seed Data Conversion Guide

This guide explains how the frontend mock data has been converted to backend seed data.

## Overview

The comprehensive mock data provided from the frontend has been integrated into the backend seed files to ensure consistency between frontend development and backend testing.

## What Has Been Done

### 1. Enhanced Admissions Seed Data

**File**: `supabase/seeds/typescript/admissions.seed.ts`

**Updated with**:
- All 7 programs from the `mockPrograms` array
- Detailed eligibility requirements
- Important dates (application start/end, entry test dates, result dates)
- Complete fee structures (admission fee, semester fee, total program fee)
- Document requirements
- Program highlights
- Official links

**Programs Included**:
1. BS Computer Science - Global Tech University (Verified, Open)
2. MBA - LUMS (Verified, Closing Soon)
3. MD Medicine - Aga Khan University (Verified, Open)
4. BBA - IBA Karachi (Verified, Open)
5. BS Software Engineering - National University of IT (Verified, Open)
6. BS Data Science - Metropolitan Science College (Pending)
7. BS Artificial Intelligence - Lahore Engineering University (Verified, Closed)

### 2. Conversion Utility Script

**File**: `scripts/convert-mock-to-seed.ts`

A utility script that can convert frontend mock program data to backend seed format. This helps maintain consistency when mock data is updated.

**Usage**:
```bash
ts-node -r tsconfig-paths/register scripts/convert-mock-to-seed.ts
```

This will output TypeScript seed data format that can be copied into seed files.

## Data Mapping

### Frontend Mock Data → Backend Database Schema

| Frontend Field | Backend Field | Notes |
|---------------|---------------|-------|
| `title` | `title` | Direct mapping |
| `overview.description` | `description` | Direct mapping |
| `status` | `verification_status` | Mapped: Open/Closing Soon → verified, Closed → verified (inactive) |
| `deadline` | `deadline` | Date conversion |
| `feeStructure.totalProgramFee` | `tuition_fee` | Parsed from "Rs. X,XXX,XXX" format |
| `feeStructure.admissionFee` | `application_fee` | Parsed from "Rs. XX,XXX" format |
| `location` | `location` | Direct mapping |
| `eligibility.requirements` | `requirements.eligibility` | Nested in JSONB |
| `eligibility.documents` | `requirements.documents` | Nested in JSONB |
| `importantDates` | `requirements.importantDates` | Nested in JSONB |
| `feeStructure` | `requirements.feeStructure` | Nested in JSONB |
| `overview.highlights` | `requirements.highlights` | Nested in JSONB |
| `officialLinks` | `requirements.officialLinks` | Nested in JSONB |

## Additional Mock Data Available

The following mock data structures were provided but not yet converted to seed data:

### Student Admissions (24 records)
- **Location**: Frontend mock data
- **Contains**: Detailed admission records with match scores, deadlines, statuses
- **Potential Use**: Could seed additional admissions or user watchlists

### University Admissions (5 records)
- **Location**: Frontend mock data (`sharedAdmissions`)
- **Contains**: Admissions with verification statuses (Pending Audit, Verified, Rejected, Disputed)
- **Potential Use**: Seed admissions with various verification states

### Admin Data
- **Pending Verifications**: 5 items
- **Change Logs**: 10 items
- **Notifications**: 12 items
- **Scraper Jobs**: 8 items
- **Analytics Events**: 10 items
- **Verification Items**: 10 items

### Notifications
- **Student Notifications**: 10 items
- **Admin Notifications**: 12 items
- **University Notifications**: 4 items

## Next Steps (Optional)

If you want to convert additional mock data to seed files:

1. **Notifications Seed**: Convert notification mock data
2. **Changelogs Seed**: Convert changelog mock data
3. **User Activity Seed**: Create activity records based on mock data
4. **Watchlists Seed**: Create watchlist entries from student saved admissions
5. **Deadlines Seed**: Extract deadlines from importantDates in programs

## Running Seeds

To seed the database with the enhanced data:

```bash
# Seed all tables (including enhanced admissions)
pnpm seed

# Or seed specific table
ts-node -r tsconfig-paths/register supabase/seeds/typescript/admissions.seed.ts
```

## Testing with Seed Data

After seeding, you can test the API endpoints:

```bash
# Test all endpoints
pnpm test-api

# Or use the PowerShell script
.\scripts\test-api.ps1
```

## Data Consistency

The seed data now matches the frontend mock data structure, ensuring:
- ✅ Consistent program information
- ✅ Realistic Pakistani university data (LUMS, IBA, AKU, etc.)
- ✅ Proper fee structures in PKR
- ✅ Complete eligibility and document requirements
- ✅ Important dates for application cycles
- ✅ Various verification statuses for testing

## Notes

- All fees are stored as numbers (PKR) in the database
- Dates are stored as ISO timestamps
- Requirements are stored as JSONB for flexibility
- Verification statuses match the workflow states
- Closed programs have `is_active: false`
