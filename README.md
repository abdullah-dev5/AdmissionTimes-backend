# AdmissionTimes Backend

Backend service for managing university admission information, verification workflows, deadlines, notifications, and recommendations.

**Status:** ✅ Production Ready  
**Version:** 1.0.0  
**Last Updated:** February 25, 2026

---

## 📖 Documentation

### 👉 Main Documentation
For complete documentation, see **[../admission-times-frontend/project-docs/README.md](../admission-times-frontend/project-docs/README.md)**

### Quick Links
- **Architecture Overview**: [project-docs/overview.md](../admission-times-frontend/project-docs/overview.md)
- **Tech Stack**: [project-docs/tech-specs.md](../admission-times-frontend/project-docs/tech-specs.md)
- **Database Schema**: [project-docs/requirements.md](../admission-times-frontend/project-docs/requirements.md)
- **API Documentation**: Run `pnpm run dev` → Visit `http://localhost:3000/api-docs`

### Recently Implemented Features ✨
- **Recommendation System** - Smart collaborative filtering ([README](src/domain/recommendations/README.md))
- **Deadline Reminders** - 3-tier notification system (7, 3, 1 day emails)
- **Email Notifications** - Gmail SMTP integration
- **User Preferences** - Email notification controls

---

## 🚀 Key Features

✅ **Admissions Management** - Complete CRUD + verification workflow  
✅ **Notifications System** - Email + in-app notifications  
✅ **Deadlines Management** - Automatic reminders with 3-tier system  
✅ **User Activity Tracking** - Complete audit trail  
✅ **Users Management** - Role-based access (student, university, admin)  
✅ **Watchlists** - Bookmark programs with optional notes  
✅ **Recommendations** - Collaborative filtering suggestions  
✅ **API Documentation** - Complete Swagger/OpenAPI endpoints  

---

## 🛠️ Tech Stack

- **Runtime**: Node.js v22+
- **Language**: TypeScript (strict mode)
- **Framework**: Express.js 5.x
- **Database**: PostgreSQL (Supabase pooler)
- **Validation**: Zod schemas
- **Documentation**: Swagger/OpenAPI
- **Email**: Nodemailer + Gmail SMTP
- **Scheduling**: Node-cron (daily batch jobs)

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd admission-times-backend
pnpm install
```

### 2. Setup Environment
```bash
cp .env.example .env
# Edit .env with your database credentials
```

### 3. Database Setup
```bash
# Run migrations
pnpm run migrate

# Test connection
pnpm run db:test
```

### 4. Start Development Server
```bash
pnpm run dev
# Server: http://localhost:3000
# API Docs: http://localhost:3000/api-docs
```

### 5. Type Check
```bash
pnpm tsc --noEmit
```

---

## 📁 Project Structure

```
src/
├── domain/                 # Domain-driven design modules
│   ├── admissions/        # Core admissions module
│   ├── notifications/     # Notification system
│   ├── deadlines/         # Deadline management
│   ├── recommendations/   # Smart recommendations
│   ├── watchlists/        # Bookmark management
│   ├── users/             # User management
│   ├── dashboard/         # Aggregated data
│   └── ...
├── shared/                 # Cross-cutting concerns
│   ├── middleware/         # Auth, validation, error handling
│   ├── utils/              # Helpers, formatters
│   └── scheduler/          # Background jobs
├── config/                 # Configuration files
├── database/               # Connection pool & migrations
└── index.ts                # Application entry point
```

---

## 🔌 API Endpoints

### Recommendations (NEW)
- `GET /api/v1/recommendations` - Get personalized recommendations
- `POST /api/v1/recommendations/refresh` - Force refresh
- `GET /api/v1/recommendations/count` - Get recommendation count
- `POST /api/v1/recommendations/generate-all` - Batch generate (admin)
- `DELETE /api/v1/recommendations/cleanup` - Clean expired (admin)

### Notifications
- `GET /api/v1/notifications` - Get user notifications
- `POST /api/v1/notifications/:id/read` - Mark as read
- `PUT /api/v1/notifications/mark-all-read` - Mark all as read

### Deadlines
- `GET /api/v1/deadlines` - List deadlines
- `GET /api/v1/deadlines/reminders/:admission_id` - Get reminders

### Admissions
- `GET /api/v1/admissions` - List admissions
- `POST /api/v1/admissions` - Create admission
- `GET /api/v1/admissions/:id` - Get admission details
- `PUT /api/v1/admissions/:id` - Update admission

See full API docs at `http://localhost:3000/api-docs`

---

## 🔐 Authentication

All endpoints (except `/auth/*` and `/health`) require JWT authentication.

**Header:**
```
Authorization: Bearer <access_token>
```

**User Context:**
```typescript
req.user = {
  id: string;           // User UUID
  role: 'student' | 'university' | 'admin' | 'guest';
  university_id?: string | null;
}
```

---

## 📊 Database

### Connection Pool
- **Host**: aws-1-ap-northeast-2.pooler.supabase.com
- **Pool Size**: 10-20 connections
- **Timeout**: 30 seconds

### Key Tables
- `users` - User accounts
- `admissions` - University programs
- `notifications` - User notifications
- `deadlines` - Application deadlines
- `recommendations` - Pre-computed suggestions
- `watchlists` - Bookmarked programs
- `user_preferences` - User settings

---

## 🧪 Testing

### Type Checking
```bash
pnpm tsc --noEmit
```

### Run Tests
```bash
pnpm test
```

---

## 📝 Environment Variables

```env
# Database
DATABASE_URL=postgresql://...
DATABASE_POOL_HOST=...
DATABASE_POOL_PORT=...

# JWT
JWT_SECRET=your_secret_key
JWT_EXPIRY=24h

# Email (Gmail)
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_app_password

# Server
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

---

## 🚢 Deployment

### Build
```bash
pnpm run build
```

### Start Production
```bash
NODE_ENV=production pnpm start
```

---

## 🔗 Related Resources

- **Frontend**: [../admission-times-frontend](../admission-times-frontend)
- **Mobile App**: [../AdmissionTimes-MobileApp](../AdmissionTimes-MobileApp)
- **Documentation**: [../admission-times-frontend/project-docs](../admission-times-frontend/project-docs)

---

**Current Version:** 1.0.0  
**Last Updated:** February 25, 2026  
**Status:** Active Development
