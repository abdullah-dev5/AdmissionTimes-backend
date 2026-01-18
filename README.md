# AdmissionTimes Backend

Backend service for managing university admission information, verification workflows, deadlines, notifications, and user activity tracking. Built with Clean Architecture and Domain-Driven Design principles.

## 🚀 Features

- **Admissions Management** - Complete CRUD operations with status workflow
- **Notifications System** - User-facing notifications with read/unread tracking
- **Deadlines Management** - Real-time deadline tracking with urgency calculations
- **User Activity Tracking** - Append-only activity feeds for user behavior
- **Users Management** - Identity mapping, role intent, and ownership anchoring
- **Analytics** - Event tracking and statistics aggregation
- **Changelogs** - Immutable audit trail with advanced filtering
- **Watchlists** - User interest tracking for admissions
- **User Preferences** - Customize user experience and notification settings
- **API Documentation** - Complete Swagger documentation (51 endpoints) 

## 🛠️ Tech Stack

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js (v5.2.1)
- **Language**: TypeScript (v5.9.3)
- **Package Manager**: pnpm (v10+)
- **Database**: PostgreSQL (via Supabase)
- **Validation**: Joi
- **Documentation**: Swagger/OpenAPI

## 📋 Prerequisites

- Node.js (v18 or higher)
- pnpm (v10 or higher)
- PostgreSQL (via Supabase local or cloud)

## 🔧 Installation

1. Clone the repository:
```bash
git clone https://github.com/abdullah-dev5/AdmissionTimes-backend.git
cd admission-times-backend
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Set up database:
```bash
# Run Supabase migrations
pnpm migrate

# Seed database with test data
pnpm seed
```

## 🚀 Development

Run the development server with hot reload:
```bash
pnpm dev
```

The server will start on `http://localhost:3000` (or the port specified in your `.env` file).

### Available Scripts

- `pnpm dev` - Start development server with hot reload
- `pnpm build` - Build the TypeScript project
- `pnpm start` - Start the production server (requires build first)
- `pnpm type-check` - Type check without building
- `pnpm migrate` - Run database migrations
- `pnpm seed` - Seed database with test data
- `pnpm seed <table>` - Seed specific table (e.g., `pnpm seed admissions`)

## 📁 Project Structure

```
admission-times-backend/
├── src/
│   ├── config/              # Configuration files
│   │   ├── config.ts        # Main config loader
│   │   ├── constants.ts     # System constants
│   │   └── swagger.ts       # Swagger/OpenAPI config
│   │
│   ├── domain/              # Domain-driven modules
│   │   ├── index.ts         # Domain registration
│   │   │
│   │   ├── admissions/      # ✅ Core Domain (10 endpoints)
│   │   ├── notifications/   # ✅ Supporting Domain (7 endpoints)
│   │   ├── deadlines/       # ✅ Supporting Domain (6 endpoints)
│   │   ├── user-activity/   # ✅ Supporting Domain (2 endpoints)
│   │   ├── users/           # ✅ Core Domain (5 endpoints)
│   │   ├── analytics/       # ✅ Core Domain (5 endpoints)
│   │   ├── changelogs/      # ✅ Core Domain (3 endpoints)
│   │   ├── watchlists/      # ✅ Advanced Domain (5 endpoints)
│   │   └── user-preferences/# ✅ Advanced Domain (3 endpoints)
│   │
│   ├── shared/              # Shared utilities
│   │   ├── middleware/     # Custom middleware
│   │   └── utils/           # Utility functions
│   │
│   ├── db/                  # Database layer
│   │   └── connection.ts    # Database connection
│   │
│   └── index.ts             # Application entry point
│
├── project-docs/             # Project documentation
├── supabase/                 # Supabase configuration
│   ├── migrations/           # Database migrations
│   └── seeds/                # Database seeds
│       ├── typescript/       # TypeScript seed files
│       └── sql/              # SQL seed files
├── scripts/                  # Utility scripts
│   └── run-migrations.ts     # Migration runner
├── dist/                     # Compiled JavaScript (generated)
└── tests/                    # Test files (planned)
```

## 🌐 API Endpoints

### Health & Documentation
- `GET /health` - Health check endpoint
- `GET /api-docs` - Swagger UI documentation

### Admissions Domain (10 endpoints)
- `GET /api/v1/admissions` - List admissions
- `GET /api/v1/admissions/:id` - Get admission detail
- `POST /api/v1/admissions` - Create admission
- `PUT /api/v1/admissions/:id` - Update admission
- `DELETE /api/v1/admissions/:id` - Delete admission
- `PATCH /api/v1/admissions/:id/submit` - Submit for verification
- `PATCH /api/v1/admissions/:id/verify` - Verify admission (admin)
- `PATCH /api/v1/admissions/:id/reject` - Reject admission (admin)
- `PATCH /api/v1/admissions/:id/dispute` - Dispute admission (university)
- `GET /api/v1/admissions/:id/changelogs` - Get admission changelogs

### Notifications Domain (7 endpoints)
- `GET /api/v1/notifications` - List notifications
- `GET /api/v1/notifications/unread-count` - Get unread count
- `GET /api/v1/notifications/:id` - Get notification detail
- `PATCH /api/v1/notifications/:id/read` - Mark as read
- `PATCH /api/v1/notifications/read-all` - Mark all as read
- `POST /api/v1/notifications` - Create notification
- `DELETE /api/v1/notifications/:id` - Delete notification

### Deadlines Domain (6 endpoints)
- `GET /api/v1/deadlines` - List deadlines
- `GET /api/v1/deadlines/upcoming` - Get upcoming deadlines
- `GET /api/v1/deadlines/:id` - Get deadline detail
- `POST /api/v1/deadlines` - Create deadline
- `PUT /api/v1/deadlines/:id` - Update deadline
- `DELETE /api/v1/deadlines/:id` - Delete deadline

### User Activity Domain (2 endpoints)
- `GET /api/v1/activity` - List activities
- `GET /api/v1/activity/:id` - Get activity detail

### Users Domain (5 endpoints)
- `GET /api/v1/users/me` - Get current user profile
- `PUT /api/v1/users/me` - Update current user profile
- `GET /api/v1/users/:id` - Get user by ID
- `GET /api/v1/users` - List users (admin only)
- `PATCH /api/v1/users/:id/role` - Update user role (admin only)

### Analytics Domain (5 endpoints)
- `POST /api/v1/analytics/events` - Track event
- `GET /api/v1/analytics/stats` - Get general statistics
- `GET /api/v1/analytics/admissions` - Admission statistics
- `GET /api/v1/analytics/users` - User statistics
- `GET /api/v1/analytics/activity` - Aggregated activity feed

### Changelogs Domain (3 endpoints)
- `GET /api/v1/changelogs` - List changelogs (with filters)
- `GET /api/v1/changelogs/:id` - Get changelog by ID
- `GET /api/v1/changelogs/admission/:admissionId` - Get admission changelogs

### Watchlists Domain (5 endpoints)
- `GET /api/v1/watchlists` - List user's watchlists
- `POST /api/v1/watchlists` - Add admission to watchlist
- `GET /api/v1/watchlists/:id` - Get watchlist item
- `PATCH /api/v1/watchlists/:id` - Update watchlist notes
- `DELETE /api/v1/watchlists/:id` - Remove from watchlist

### User Preferences Domain (3 endpoints)
- `GET /api/v1/users/me/preferences` - Get user preferences
- `PUT /api/v1/users/me/preferences` - Update preferences (full update)
- `PATCH /api/v1/users/me/preferences` - Partial update preferences

**Total: 51 API Endpoints**

## 📚 API Documentation

Interactive API documentation is available at:
- **Swagger UI**: `http://localhost:3000/api-docs`

All endpoints are fully documented with:
- Request/response schemas
- Authentication requirements
- Error responses
- Example values

## 🔐 Authentication

Currently using **mock authentication** for development. Real Supabase Auth integration is planned for Phase 4C.

**Development Headers:**
- `x-user-id`: User UUID (optional)
- `x-user-role`: 'student' | 'university' | 'admin' (optional)
- `x-university-id`: University UUID (optional, for university users)

## 🗄️ Database

The project uses **PostgreSQL** via Supabase Cloud with:
- Row Level Security (RLS) policies
- Database migrations
- Connection pooling (Session Pooler for IPv4 compatibility)
- Database seeding system

**Database Tables:**
- `admissions` - Core admission records
- `changelogs` - Immutable audit trail
- `deadlines` - Deadline management
- `notifications` - User notifications
- `user_activity` - Activity tracking
- `analytics_events` - Analytics events
- `users` - User identity mapping
- `watchlists` - User watchlists
- `user_preferences` - User preferences

**Database Seeding:**
- Comprehensive seeding system with 9 seed files
- Idempotent (safe to run multiple times)
- Transaction-safe execution
- 120+ realistic test records
- See `supabase/seeds/typescript/` for seed files

## 📖 Documentation

Comprehensive project documentation is available in:

**Project Documentation (`project-docs/`):**
- **index.md** - Documentation index
- **overview.md** - Project overview and objectives
- **requirements.md** - System requirements and features
- **tech-specs.md** - Technical specifications
- **user-structure.md** - User flow and project structure
- **timeline.md** - Project timeline and progress
- **backend-architecture.md** - Complete backend architecture blueprint
- **achievements-summary.md** - Summary of completed work

**Phase Documentation (`phases/`):**
- Phase reports and implementation summaries
- Roadmaps and planning documents
- See `phases/README.md` for complete list


## 🏗️ Architecture

The project follows **Clean Architecture** and **Domain-Driven Design** principles:

- **Controllers**: HTTP input/output only
- **Services**: Business logic and orchestration
- **Models**: Database access only
- **Validators**: Joi schemas for validation
- **Types**: TypeScript types and DTOs
- **Constants**: Domain-specific constants

**Key Principles:**
- Domain isolation (no cross-domain model access)
- Service-level orchestration
- Consistent response formats
- Comprehensive error handling
- Type safety (100% TypeScript)


## 🚢 Deployment

### Prerequisites
- Node.js v18+
- PostgreSQL database
- Environment variables configured

### Steps
1. Build the project: `pnpm build`
2. Set up environment variables (see `.env.example`)
3. Run database migrations: `pnpm migrate`
4. Seed database (optional): `pnpm seed`
5. Start the server: `pnpm start`

## 📝 Environment Variables

See `.env.example` for all available environment variables. Key variables:

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `DB_HOST` - Database host (Supabase Cloud pooler)
- `DB_PORT` - Database port (5432)
- `DB_NAME` - Database name (postgres)
- `DB_USER` - Database user (postgres.[PROJECT_REF] for pooler)
- `DB_PASSWORD` - Database password
- `DB_POOL_MAX` - Connection pool size (15 for free tier)

## 🤝 Contributing

## 📄 License

ISC


*

For detailed progress tracking, see `project-docs/timeline.md`.
