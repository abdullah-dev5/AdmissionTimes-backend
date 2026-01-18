# Seed Reset Guide

This guide explains how to reset and reseed your database when seeds are being skipped due to previous executions.

## Problem

When seeds have already been executed, they are skipped on subsequent runs because the `seed_tracking` table marks them as completed. This prevents re-seeding with updated data.

## Solution

We've created a comprehensive reset script that can:
1. Clear seed tracking (allows re-seeding)
2. Optionally clear all seeded data from tables
3. Re-run all seeds automatically

## Usage

### Option 1: Reset Seed Tracking Only (Keeps Data)

This clears the seed tracking table but keeps all existing data. Seeds will run again and may create duplicates if not handled properly.

```bash
pnpm seed:reset
```

**Use when:** You want to re-run seeds but keep existing data (seeds should handle duplicates with `ON CONFLICT`)

### Option 2: Clear Data + Reset Tracking (Full Reset)

This clears both the seed tracking table AND all seeded data from tables, then re-runs all seeds.

```bash
pnpm seed:force
# or
pnpm seed:clear
```

**Use when:** You want a completely fresh start with updated seed data

### Option 3: Reset Specific Seeds Only

Reset and re-run only specific seeds:

```bash
# Reset only admissions seed
pnpm seed:reset admissions

# Reset multiple seeds
pnpm seed:reset admissions notifications

# Clear data and reset specific seeds
pnpm seed:reset --clear-data admissions
```

## Available Commands

| Command | Description |
|---------|-------------|
| `pnpm seed` | Run all seeds (skips if already executed) |
| `pnpm seed:reset` | Clear seed tracking and re-run all seeds |
| `pnpm seed:force` | Clear data + tracking, then re-run all seeds |
| `pnpm seed:clear` | Same as `seed:force` |
| `pnpm seed:reset <seed-name>` | Reset specific seed only |

## Seed Names

Available seed names:
- `users`
- `admissions`
- `deadlines`
- `changelogs`
- `notifications`
- `user-activity`
- `analytics-events`
- `watchlists`
- `user-preferences`

## How It Works

### Reset Process

1. **Connection Check**: Verifies database connection
2. **Clear Data** (if `--clear-data` flag): Deletes all records from tables in reverse dependency order
3. **Clear Tracking**: Removes entries from `seed_tracking` table
4. **Re-run Seeds**: Executes all seeds in correct dependency order
5. **Summary**: Shows results and statistics

### Table Clearing Order

When clearing data, tables are cleared in reverse dependency order to avoid foreign key constraint errors:

1. `user_preferences` (depends on users)
2. `watchlists` (depends on users, admissions)
3. `analytics_events` (depends on admissions)
4. `user_activity` (depends on users, admissions)
5. `notifications` (depends on admissions, users)
6. `changelogs` (depends on admissions)
7. `deadlines` (depends on admissions)
8. `admissions` (independent)
9. `users` (independent)

## Examples

### Full Reset with Updated Seed Data

```bash
# 1. Clear everything and reseed
pnpm seed:force

# 2. Verify seeds ran successfully
# Check console output for summary
```

### Update Only Admissions Seed

```bash
# 1. Reset only admissions seed tracking
pnpm seed:reset admissions

# Note: This will re-run admissions seed, but may create duplicates
# if your seed file doesn't handle conflicts properly
```

### Update Admissions with Data Clear

```bash
# 1. Clear admissions data and reset tracking
pnpm seed:reset --clear-data admissions

# This will:
# - Delete all records from admissions table
# - Clear admissions seed tracking
# - Re-run admissions seed
```

## Troubleshooting

### Error: "Table does not exist"

If you see this error, the table hasn't been created yet. Run migrations first:

```bash
pnpm migrate
```

### Error: "Foreign key constraint violation"

This happens if you try to clear parent tables before child tables. The script handles this automatically, but if you encounter it:

1. Make sure you're using the reset script (not manual SQL)
2. Check that migrations are up to date

### Seeds Still Skipping

If seeds are still being skipped after reset:

1. Verify seed tracking was cleared:
   ```sql
   SELECT * FROM seed_tracking;
   ```

2. Check if the seed name matches exactly (case-sensitive)

3. Try clearing manually:
   ```sql
   DELETE FROM seed_tracking WHERE seed_name = 'admissions';
   ```

## Best Practices

1. **Use `--clear-data` for major updates**: When seed data structure changes significantly
2. **Use reset-only for minor updates**: When adding new records or fixing data
3. **Test in development first**: Always test seed resets in development before production
4. **Backup before clearing**: If working with production data, backup first
5. **Check seed files**: Ensure seed files handle duplicates properly with `ON CONFLICT` clauses

## Related Files

- `scripts/reset-seeds.ts` - Main reset script
- `supabase/seeds/typescript/index.ts` - Seed runner with force mode support
- `supabase/seeds/typescript/utils.ts` - Seed tracking utilities
- `supabase/migrations/20260118000001_create_seed_tracking_table.sql` - Seed tracking table

## Force Mode in Seed Runner

The seed runner also supports a `--force` flag to bypass seed tracking:

```bash
# Force re-run all seeds (bypasses tracking check)
pnpm seed --force

# Force re-run specific seed
pnpm seed admissions --force
```

This is useful when you want to re-run seeds without clearing tracking or data.
