# User Flow & Project Structure

**Last Updated:** January 13, 2025 (Phase 4B Complete)

## User Journey

### Student User Flow

1. **Browse Admissions**
   - View verified admissions
   - Search and filter admissions
   - View admission details
   - Activity tracked automatically

2. **Track Interests**
   - Compare admissions
   - Add to watchlist
   - View deadlines
   - Receive notifications

3. **View Activity**
   - See recent activity history
   - Track viewed admissions

### University User Flow

1. **Manage Admissions**
   - Create new admission
   - Edit draft admissions
   - Submit for verification
   - View own admissions

2. **Handle Verification**
   - Receive verification notifications
   - Handle rejections (can dispute)
   - View changelogs

3. **Monitor Deadlines**
   - View admission deadlines
   - Track upcoming deadlines
   - Receive deadline reminders

### Admin User Flow

1. **Moderate Admissions**
   - Review pending admissions
   - Verify or reject admissions
   - Handle disputes
   - View all admissions

2. **Audit Trail**
   - View changelogs for all admissions
   - Track all status changes
   - Monitor system activity

## Data Flow

### Request Flow

```
Client Request
    ↓
Express Middleware (JSON parsing, auth)
    ↓
Route Handler (validation middleware)
    ↓
Controller (extract data, call service)
    ↓
Service (business logic, orchestration)
    ↓
Model (database queries)
    ↓
PostgreSQL/Supabase
    ↓
Response (through service → controller → middleware)
```

### Domain Integration Flow

```
Admissions Service (Core Domain)
    ↓ (service-level hooks)
Notifications Service (Supporting Domain)
    ↓
User Activity Service (Supporting Domain)
    ↓
Database (PostgreSQL)
```

**Key Principle:** Domains communicate via services only, no direct model access.

## Project File Structure

### Current Structure (Phase 4A & 4B Complete)

```
admission-times-backend/
├── project-docs/              # Project documentation
│   ├── index.md               # Documentation index
│   ├── overview.md            # Project overview
│   ├── requirements.md        # Requirements & features
│   ├── tech-specs.md          # Technical specifications
│   ├── user-structure.md      # This file
│   ├── timeline.md            # Project timeline
│   ├── backend-architecture.md # Architecture blueprint
│   └── achievements-summary.md  # Achievements summary
│
├── src/                       # Source code
│   ├── config/                # Configuration
│   │   ├── config.ts         # Main config loader
│   │   ├── constants.ts      # System constants
│   │   └── swagger.ts        # Swagger/OpenAPI config
│   │
│   ├── domain/               # Domain-driven modules
│   │   ├── index.ts          # Domain registration
│   │   │
│   │   ├── admissions/       # ✅ Core Domain (Phase 3)
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── models/
│   │   │   ├── routes/
│   │   │   ├── types/
│   │   │   ├── validators/
│   │   │   └── constants/
│   │   │
│   │   ├── notifications/     # ✅ Supporting Domain (Phase 4A)
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── models/
│   │   │   ├── routes/
│   │   │   ├── types/
│   │   │   ├── validators/
│   │   │   └── constants/
│   │   │
│   │   ├── deadlines/        # ✅ Supporting Domain (Phase 4A)
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── models/
│   │   │   ├── routes/
│   │   │   ├── types/
│   │   │   ├── validators/
│   │   │   └── constants/
│   │   │
│   │   ├── user-activity/    # ✅ Supporting Domain (Phase 4A)
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── models/
│   │   │   ├── routes/
│   │   │   ├── types/
│   │   │   ├── validators/
│   │   │   └── constants/
│   │   │
│   │   ├── users/            # ✅ Core Domain (Phase 4B)
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── models/
│   │   │   ├── routes/
│   │   │   ├── types/
│   │   │   ├── validators/
│   │   │   └── constants/
│   │   │
│   │   ├── analytics/        # ✅ Core Domain (Phase 4B)
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── models/
│   │   │   ├── routes/
│   │   │   ├── types/
│   │   │   ├── validators/
│   │   │   └── constants/
│   │   │
│   │   └── changelogs/       # ✅ Core Domain (Phase 4B)
│   │       ├── controllers/
│   │       ├── services/
│   │       ├── models/
│   │       ├── routes/
│   │       ├── types/
│   │       ├── validators/
│   │       └── constants/
│   │
│   ├── shared/               # Shared utilities
│   │   ├── middleware/
│   │   │   ├── auth.ts       # Authentication middleware (mock)
│   │   │   └── errorHandler.ts # Error handling
│   │   └── utils/
│   │       ├── response.ts   # Response utilities
│   │       └── pagination.ts  # Pagination helpers
│   │
│   ├── db/                   # Database layer
│   │   └── connection.ts     # Database connection
│   │
│   └── index.ts              # Application entry point
│
├── tests/                    # Test files (planned)
├── dist/                     # Compiled JavaScript (generated)
├── .env.example             # Environment variables template
├── .cursorrules              # Project coding standards
├── .gitignore
├── package.json
├── tsconfig.json
├── nodemon.json
├── README.md
│
├── PHASE4_FINAL_REPORT.md         # Phase 4A completion report
├── PHASE4_COMPLETE_FINAL_REPORT.md # Phase 4A & 4B complete report
├── PHASE4B_PLANNING.md            # Phase 4B planning document
├── FUTURE_IMPLEMENTATION_CHECKLIST.md # Future features checklist
├── SYSTEM_CONCEPTS.md             # Foundational system concepts
├── PHASE4_PLANNING.md              # Phase 4 planning document
└── [other phase reports...]
```

### Domain Structure Pattern

Each domain follows the same structure:

```
domain-name/
├── controllers/     # HTTP request/response handling
├── services/        # Business logic and orchestration
├── models/          # Database access (parameterized queries)
├── routes/          # Route definitions with validation
├── types/           # TypeScript types and DTOs
├── validators/      # Joi validation schemas
└── constants/       # Domain-specific constants
```

## Domain Responsibilities

### Admissions Domain (Core)
- **Purpose:** Manage admission records and verification workflow
- **Endpoints:** 10 endpoints
- **Key Features:** CRUD, status transitions, changelog integration
- **Dependencies:** None (core domain)

### Notifications Domain (Supporting)
- **Purpose:** Store and manage user-facing notifications
- **Endpoints:** 7 endpoints (full CRUD)
- **Key Features:** Read/unread tracking, filtering, auto-creation
- **Dependencies:** Triggered by Admissions domain events

### Deadlines Domain (Supporting)
- **Purpose:** Normalize and expose deadline data with calculations
- **Endpoints:** 6 endpoints (full CRUD)
- **Key Features:** Days remaining, urgency levels, overdue flags
- **Dependencies:** References Admissions domain

### User Activity Domain (Supporting)
- **Purpose:** Capture user behavior for activity feeds
- **Endpoints:** 2 endpoints
- **Key Features:** Append-only tracking, lightweight records
- **Dependencies:** Triggered by Admissions domain events

### Users Domain (Core)
- **Purpose:** Identity mapping, role intent, and ownership anchoring
- **Endpoints:** 5 endpoints
- **Key Features:** Identity mapping, role management, profile management
- **Dependencies:** None (anchors other domains)

### Analytics Domain (Core)
- **Purpose:** Track system metrics and aggregate statistics
- **Endpoints:** 5 endpoints
- **Key Features:** Event tracking, statistics aggregation, activity feed
- **Dependencies:** Service-level hooks from other domains

### Changelogs Domain (Core)
- **Purpose:** Standalone API for accessing changelogs
- **Endpoints:** 3 endpoints
- **Key Features:** Advanced filtering, search, pagination
- **Dependencies:** Changelogs created by Admissions domain

## Integration Points

### Service-Level Hooks

**Admissions → Notifications:**
- `createNotificationForVerification()` - On verify
- `createNotificationForRejection()` - On reject
- `createNotificationForDispute()` - On dispute

**Admissions → User Activity:**
- `trackAdmissionView()` - On admission view

**Future Integrations:**
- Admissions → Analytics (event tracking)
- Users → All domains (ownership anchoring)

**Integration Principle:** Non-blocking, fail-silently, service-level only
