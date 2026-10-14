# Live database schema (public)

Generated: 2026-06-02T09:00:23.168Z

## Tables

- admin_audit_logs
- admissions
- analytics_events
- changelogs
- deadlines
- email_delivery_logs
- notifications
- push_delivery_logs
- push_notification_tokens
- recommendations
- reminder_delivery_logs
- schema_migrations
- scraper_ingestion_events
- scraper_ingestion_runs
- seed_tracking
- universities
- user_activity
- user_preferences
- users
- watchlists

## Columns by table

### admin_audit_logs

| Column | Type | UDT | Nullable | Default |
|--------|------|-----|----------|---------|
| id | uuid | uuid | NO | gen_random_uuid() |
| admin_id | uuid | uuid | NO |  |
| action_type | character varying | varchar | NO |  |
| entity_type | character varying | varchar | NO |  |
| entity_id | uuid | uuid | NO |  |
| old_values | jsonb | jsonb | YES |  |
| new_values | jsonb | jsonb | YES |  |
| reason | text | text | YES |  |
| ip_address | inet | inet | YES |  |
| user_agent | text | text | YES |  |
| created_at | timestamp without time zone | timestamp | NO | now() |
| created_by | character varying | varchar | YES | 'system'::character varying |

### admissions

| Column | Type | UDT | Nullable | Default |
|--------|------|-----|----------|---------|
| id | uuid | uuid | NO | gen_random_uuid() |
| university_id | uuid | uuid | NO |  |
| title | character varying | varchar | NO |  |
| description | text | text | YES |  |
| program_type | character varying | varchar | YES |  |
| degree_level | character varying | varchar | YES |  |
| field_of_study | character varying | varchar | YES |  |
| duration | character varying | varchar | YES |  |
| tuition_fee | numeric | numeric | YES |  |
| currency | character varying | varchar | YES |  |
| application_fee | numeric | numeric | YES |  |
| deadline | timestamp with time zone | timestamptz | YES |  |
| start_date | date | date | YES |  |
| location | character varying | varchar | YES |  |
| delivery_mode | character varying | varchar | YES |  |
| requirements | jsonb | jsonb | YES |  |
| verification_status | USER-DEFINED | verification_status | NO | 'draft'::verification_status |
| verified_at | timestamp with time zone | timestamptz | YES |  |
| verified_by | uuid | uuid | YES |  |
| rejection_reason | text | text | YES |  |
| dispute_reason | text | text | YES |  |
| created_by | uuid | uuid | YES |  |
| created_at | timestamp with time zone | timestamptz | NO | now() |
| updated_at | timestamp with time zone | timestamptz | NO | now() |
| is_active | boolean | bool | NO | true |
| admin_notes | text | text | YES |  |
| verification_comments | text | text | YES |  |
| needs_reverification | boolean | bool | YES | false |
| updated_by | uuid | uuid | YES |  |
| data_origin | text | text | YES |  |
| source_system | text | text | YES |  |
| source_url | text | text | YES |  |
| source_record_hash | text | text | YES |  |
| source_last_seen_at | timestamp with time zone | timestamptz | YES |  |
| ingestion_run_id | uuid | uuid | YES |  |

### admissions_needing_reverification

| Column | Type | UDT | Nullable | Default |
|--------|------|-----|----------|---------|
| id | uuid | uuid | YES |  |
| university_id | uuid | uuid | YES |  |
| title | character varying | varchar | YES |  |
| description | text | text | YES |  |
| program_type | character varying | varchar | YES |  |
| degree_level | character varying | varchar | YES |  |
| field_of_study | character varying | varchar | YES |  |
| duration | character varying | varchar | YES |  |
| tuition_fee | numeric | numeric | YES |  |
| currency | character varying | varchar | YES |  |
| application_fee | numeric | numeric | YES |  |
| deadline | timestamp with time zone | timestamptz | YES |  |
| start_date | date | date | YES |  |
| location | character varying | varchar | YES |  |
| delivery_mode | character varying | varchar | YES |  |
| requirements | jsonb | jsonb | YES |  |
| verification_status | USER-DEFINED | verification_status | YES |  |
| verified_at | timestamp with time zone | timestamptz | YES |  |
| verified_by | uuid | uuid | YES |  |
| rejection_reason | text | text | YES |  |
| dispute_reason | text | text | YES |  |
| created_by | uuid | uuid | YES |  |
| created_at | timestamp with time zone | timestamptz | YES |  |
| updated_at | timestamp with time zone | timestamptz | YES |  |
| is_active | boolean | bool | YES |  |
| admin_notes | text | text | YES |  |
| verification_comments | text | text | YES |  |
| needs_reverification | boolean | bool | YES |  |
| verified_by_email | character varying | varchar | YES |  |
| verified_by_name | character varying | varchar | YES |  |

### analytics_events

| Column | Type | UDT | Nullable | Default |
|--------|------|-----|----------|---------|
| id | uuid | uuid | NO | gen_random_uuid() |
| event_type | USER-DEFINED | analytics_event_type | NO |  |
| entity_type | character varying | varchar | YES |  |
| entity_id | uuid | uuid | YES |  |
| user_type | USER-DEFINED | user_type | YES |  |
| user_id | uuid | uuid | YES |  |
| metadata | jsonb | jsonb | YES |  |
| created_at | timestamp with time zone | timestamptz | NO | now() |

### changelogs

| Column | Type | UDT | Nullable | Default |
|--------|------|-----|----------|---------|
| id | uuid | uuid | NO | gen_random_uuid() |
| admission_id | uuid | uuid | NO |  |
| actor_type | USER-DEFINED | actor_type | NO |  |
| changed_by | uuid | uuid | YES |  |
| action_type | USER-DEFINED | change_action_type | NO |  |
| field_name | character varying | varchar | YES |  |
| old_value | jsonb | jsonb | YES |  |
| new_value | jsonb | jsonb | YES |  |
| diff_summary | text | text | YES |  |
| metadata | jsonb | jsonb | YES |  |
| created_at | timestamp with time zone | timestamptz | NO | now() |

### deadlines

| Column | Type | UDT | Nullable | Default |
|--------|------|-----|----------|---------|
| id | uuid | uuid | NO | gen_random_uuid() |
| admission_id | uuid | uuid | NO |  |
| deadline_type | USER-DEFINED | deadline_type | NO |  |
| deadline_date | timestamp with time zone | timestamptz | NO |  |
| timezone | character varying | varchar | NO | 'UTC'::character varying |
| is_flexible | boolean | bool | NO | false |
| reminder_sent | boolean | bool | NO | false |
| created_at | timestamp with time zone | timestamptz | NO | now() |
| updated_at | timestamp with time zone | timestamptz | NO | now() |
| reminder_sent_7d_at | timestamp with time zone | timestamptz | YES |  |
| reminder_sent_3d_at | timestamp with time zone | timestamptz | YES |  |
| reminder_sent_1d_at | timestamp with time zone | timestamptz | YES |  |

### email_delivery_logs

| Column | Type | UDT | Nullable | Default |
|--------|------|-----|----------|---------|
| id | uuid | uuid | NO | gen_random_uuid() |
| notification_id | uuid | uuid | NO |  |
| recipient_email | character varying | varchar | NO |  |
| subject | character varying | varchar | NO |  |
| status | character varying | varchar | NO |  |
| error_message | text | text | YES |  |
| attempt_number | integer | int4 | NO |  |
| provider_message_id | text | text | YES |  |
| created_at | timestamp with time zone | timestamptz | NO | now() |

### notifications

| Column | Type | UDT | Nullable | Default |
|--------|------|-----|----------|---------|
| id | uuid | uuid | NO | gen_random_uuid() |
| recipient_id | uuid | uuid | YES |  |
| role_type | USER-DEFINED | user_type | NO |  |
| notification_type | USER-DEFINED | notification_type | NO |  |
| priority | USER-DEFINED | notification_priority | NO | 'medium'::notification_priority |
| title | character varying | varchar | NO |  |
| message | text | text | NO |  |
| related_entity_type | character varying | varchar | YES |  |
| related_entity_id | uuid | uuid | YES |  |
| is_read | boolean | bool | NO | false |
| read_at | timestamp with time zone | timestamptz | YES |  |
| action_url | character varying | varchar | YES |  |
| created_at | timestamp with time zone | timestamptz | NO | now() |
| event_key | character varying | varchar | NO |  |

### push_delivery_logs

| Column | Type | UDT | Nullable | Default |
|--------|------|-----|----------|---------|
| id | uuid | uuid | NO | gen_random_uuid() |
| notification_id | uuid | uuid | YES |  |
| recipient_id | uuid | uuid | YES |  |
| token_hash | character varying | varchar | YES |  |
| channel | character varying | varchar | NO | 'expo'::character varying |
| ticket_status | character varying | varchar | NO |  |
| ticket_id | character varying | varchar | YES |  |
| error_code | character varying | varchar | YES |  |
| error_message | text | text | YES |  |
| http_status | integer | int4 | YES |  |
| provider_response | jsonb | jsonb | YES |  |
| created_at | timestamp without time zone | timestamp | NO | now() |

### push_notification_tokens

| Column | Type | UDT | Nullable | Default |
|--------|------|-----|----------|---------|
| id | uuid | uuid | NO | gen_random_uuid() |
| user_id | uuid | uuid | NO |  |
| expo_push_token | text | text | NO |  |
| platform | character varying | varchar | NO | 'unknown'::character varying |
| device_id | character varying | varchar | YES | NULL::character varying |
| app_version | character varying | varchar | YES | NULL::character varying |
| is_active | boolean | bool | NO | true |
| last_used_at | timestamp without time zone | timestamp | NO | now() |
| created_at | timestamp without time zone | timestamp | NO | now() |
| updated_at | timestamp without time zone | timestamp | NO | now() |

### recommendations

| Column | Type | UDT | Nullable | Default |
|--------|------|-----|----------|---------|
| id | uuid | uuid | NO | gen_random_uuid() |
| user_id | uuid | uuid | NO |  |
| admission_id | uuid | uuid | NO |  |
| score | integer | int4 | NO |  |
| reason | text | text | YES |  |
| factors | jsonb | jsonb | YES |  |
| generated_at | timestamp with time zone | timestamptz | NO | now() |
| expires_at | timestamp with time zone | timestamptz | YES |  |

### reminder_delivery_logs

| Column | Type | UDT | Nullable | Default |
|--------|------|-----|----------|---------|
| id | uuid | uuid | NO | gen_random_uuid() |
| deadline_id | uuid | uuid | NO |  |
| recipient_id | uuid | uuid | NO |  |
| threshold_day | integer | int4 | NO |  |
| notification_id | uuid | uuid | YES |  |
| status | character varying | varchar | NO |  |
| event_key | text | text | NO |  |
| error_message | text | text | YES |  |
| created_at | timestamp with time zone | timestamptz | NO | now() |
| sent_at | timestamp with time zone | timestamptz | YES |  |
| updated_at | timestamp with time zone | timestamptz | NO | now() |

### schema_migrations

| Column | Type | UDT | Nullable | Default |
|--------|------|-----|----------|---------|
| id | integer | int4 | NO | nextval('schema_migrations_id_seq'::regc |
| migration_name | character varying | varchar | NO |  |
| executed_at | timestamp without time zone | timestamp | YES | CURRENT_TIMESTAMP |

### scraper_ingestion_events

| Column | Type | UDT | Nullable | Default |
|--------|------|-----|----------|---------|
| id | uuid | uuid | NO | gen_random_uuid() |
| run_id | uuid | uuid | NO |  |
| source_record_hash | text | text | YES |  |
| source_university_name | text | text | YES |  |
| source_program_title | text | text | YES |  |
| source_last_date | text | text | YES |  |
| source_details_link | text | text | YES |  |
| event_status | text | text | NO |  |
| canonical_admission_id | uuid | uuid | YES |  |
| reason | text | text | YES |  |
| error_detail | text | text | YES |  |
| metadata | jsonb | jsonb | YES |  |
| created_at | timestamp with time zone | timestamptz | NO | now() |

### scraper_ingestion_runs

| Column | Type | UDT | Nullable | Default |
|--------|------|-----|----------|---------|
| id | uuid | uuid | NO | gen_random_uuid() |
| mode | text | text | NO |  |
| status | text | text | NO |  |
| source_system | text | text | NO | 'AdmissionTimes-Scrapers'::text |
| requested_by | text | text | YES |  |
| university_scope | text | text | YES |  |
| started_at | timestamp with time zone | timestamptz | NO | now() |
| completed_at | timestamp with time zone | timestamptz | YES |  |
| fetched_count | integer | int4 | NO | 0 |
| mirrored_count | integer | int4 | NO | 0 |
| published_count | integer | int4 | NO | 0 |
| updated_count | integer | int4 | NO | 0 |
| skipped_count | integer | int4 | NO | 0 |
| failed_count | integer | int4 | NO | 0 |
| error_log | jsonb | jsonb | YES |  |
| metadata | jsonb | jsonb | YES |  |
| created_at | timestamp with time zone | timestamptz | NO | now() |
| updated_at | timestamp with time zone | timestamptz | NO | now() |

### seed_tracking

| Column | Type | UDT | Nullable | Default |
|--------|------|-----|----------|---------|
| id | integer | int4 | NO | nextval('seed_tracking_id_seq'::regclass |
| seed_name | character varying | varchar | NO |  |
| executed_at | timestamp with time zone | timestamptz | NO | now() |
| record_count | integer | int4 | YES |  |
| metadata | jsonb | jsonb | YES |  |

### universities

| Column | Type | UDT | Nullable | Default |
|--------|------|-----|----------|---------|
| id | uuid | uuid | NO | gen_random_uuid() |
| name | character varying | varchar | NO |  |
| city | character varying | varchar | YES |  |
| country | character varying | varchar | YES |  |
| website | character varying | varchar | YES |  |
| logo_url | text | text | YES |  |
| description | text | text | YES |  |
| address | text | text | YES |  |
| contact_name | character varying | varchar | YES |  |
| contact_email | character varying | varchar | YES |  |
| contact_phone | character varying | varchar | YES |  |
| is_active | boolean | bool | NO | true |
| created_at | timestamp with time zone | timestamptz | NO | now() |
| updated_at | timestamp with time zone | timestamptz | NO | now() |

### user_activity

| Column | Type | UDT | Nullable | Default |
|--------|------|-----|----------|---------|
| id | uuid | uuid | NO | gen_random_uuid() |
| user_id | uuid | uuid | YES |  |
| user_type | USER-DEFINED | user_type | NO |  |
| activity_type | USER-DEFINED | activity_type | NO |  |
| entity_type | character varying | varchar | NO |  |
| entity_id | uuid | uuid | NO |  |
| metadata | jsonb | jsonb | YES |  |
| created_at | timestamp with time zone | timestamptz | NO | now() |

### user_preferences

| Column | Type | UDT | Nullable | Default |
|--------|------|-----|----------|---------|
| id | uuid | uuid | NO | gen_random_uuid() |
| user_id | uuid | uuid | NO |  |
| email_notifications_enabled | boolean | bool | YES | true |
| email_frequency | character varying | varchar | YES | 'immediate'::character varying |
| push_notifications_enabled | boolean | bool | YES | true |
| notification_categories | jsonb | jsonb | YES | '{"system": true, "update": true, "deadl |
| language | character varying | varchar | YES | 'en'::character varying |
| timezone | character varying | varchar | YES | 'UTC'::character varying |
| theme | character varying | varchar | YES | 'light'::character varying |
| created_at | timestamp with time zone | timestamptz | YES | now() |
| updated_at | timestamp with time zone | timestamptz | YES | now() |

### users

| Column | Type | UDT | Nullable | Default |
|--------|------|-----|----------|---------|
| id | uuid | uuid | NO | gen_random_uuid() |
| auth_user_id | uuid | uuid | YES |  |
| role | USER-DEFINED | user_type | NO |  |
| display_name | character varying | varchar | NO |  |
| university_id | uuid | uuid | YES |  |
| status | character varying | varchar | NO | 'active'::character varying |
| created_at | timestamp with time zone | timestamptz | NO | now() |
| updated_at | timestamp with time zone | timestamptz | NO | now() |
| email | character varying | varchar | YES |  |
| password | character varying | varchar | YES |  |

### watchlists

| Column | Type | UDT | Nullable | Default |
|--------|------|-----|----------|---------|
| id | uuid | uuid | NO | gen_random_uuid() |
| user_id | uuid | uuid | NO |  |
| admission_id | uuid | uuid | NO |  |
| notes | text | text | YES |  |
| created_at | timestamp with time zone | timestamptz | YES | now() |
| updated_at | timestamp with time zone | timestamptz | YES | now() |
| alert_opt_in | boolean | bool | NO | false |

## Enums

- **activity_type**: viewed, searched, compared, watchlisted, alert, saved, deadline, notification
- **actor_type**: admin, university, system
- **analytics_event_type**: admission_viewed, admission_created, verification_completed, verification_rejected, deadline_approaching, search_performed, comparison_made
- **change_action_type**: created, updated, verified, rejected, disputed, status_changed
- **deadline_type**: application, document_submission, payment, other
- **notification_priority**: low, medium, high, urgent
- **notification_type**: admission_submitted, admission_resubmitted, admission_verified, admission_rejected, admission_revision_required, admission_updated_saved, deadline_near, system_broadcast, dispute_raised, system_error
- **user_type**: student, university, admin, maintenance
- **verification_status**: draft, pending, verified, rejected, disputed