# Backend Overview

## Purpose

Provide a stable, role-aware API for the AdmissionTimes platform across web and mobile clients.

## Primary Responsibilities

- Admission lifecycle and verification workflows
- Student dashboard aggregation and recommendation delivery
- Notifications, deadlines, and scheduler-based reminders
- User identity resolution and preferences
- Admin operations and analytics support

## Architecture

- Runtime: Node.js + Express + TypeScript
- Data: PostgreSQL (Supabase)
- Auth: JWT middleware with Supabase identity model
- API docs: Swagger/OpenAPI generated from route annotations and central schema config

## Domain Map

- admissions
- admin
- analytics
- auth
- changelogs
- dashboard
- deadlines
- notifications
- recommendations
- scheduler
- user-activity
- user-preferences
- users
- watchlists

## Current Status

- Core domains are implemented and integrated.
- JWT protection is active for `/api/v1/*` except public auth endpoints.
- Preference contract/documentation required alignment work (captured in dedicated gap report).

Updated: 2026-03-30
