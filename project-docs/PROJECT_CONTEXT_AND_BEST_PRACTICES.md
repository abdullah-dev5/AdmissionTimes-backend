# Project Context & Best Practices Guide

**Last Updated:** February 2026  
**Project:** AdmissionTimes Backend  
**Phase:** 4C-1 (Real Authentication - In Progress)

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture & Design Patterns](#architecture--design-patterns)
3. [Code Standards & Conventions](#code-standards--conventions)
4. [Project Structure](#project-structure)
5. [Path Aliases & Imports](#path-aliases--imports)
6. [Domain-Driven Development](#domain-driven-development)
7. [API Design Standards](#api-design-standards)
8. [Error Handling Patterns](#error-handling-patterns)
9. [Validation Patterns](#validation-patterns)
10. [Database Patterns](#database-patterns)
11. [Security Practices](#security-practices)
12. [Testing Strategy](#testing-strategy)
13. [Future Phases & Roadmap](#future-phases--roadmap)
14. [Common Patterns & Examples](#common-patterns--examples)

---

## 🎯 Project Overview

### Purpose
Backend API for managing university admission times, scheduling, and verification workflows.

### Tech Stack
- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL (via Supabase)
- **Validation:** Joi
- **Package Manager:** pnpm

### Current Status
- ✅ Phase 1: Project Setup & Database Schema
- ✅ Phase 2: Database Migrations & RLS Policies
- ✅ Phase 3: Admissions Domain (CRUD, Status Transitions, Changelog Integration)
- 🔄 Phase 4C-1: Real Authentication (JWT) - **In Progress**
  - ✅ Dependencies installed (jsonwebtoken, jwks-rsa)
  - ✅ Environment variables configured
  - ✅ JWT middleware implemented
  - ✅ Main app updated to use jwtAuth
  - 🔄 Service layer updates in progress
- 📋 Phase 4C-2: CORS Configuration - Planned
- 📋 Phase 4C-3+: Rate Limiting, Security Headers, etc. - Planned

---

## 🏗️ Architecture & Design Patterns

### Architecture Style
**Domain-Driven Design (DDD)** with **Clean Architecture** principles

### Layer Separation
```
┌─────────────────────────────────────┐
│         Controllers Layer           │  HTTP Request/Response
│    (Extract data, call services)    │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│          Services Layer             │  Business Logic
│  (Status transitions, changelogs)   │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│          Models Layer               │  Database Access
│    (Raw SQL queries, no logic)      │
└─────────────────────────────────────┘
```

### Design Patterns Used
1. **Repository Pattern** - Models act as repositories
2. **Service Layer Pattern** - Business logic in services
3. **DTO Pattern** - Data Transfer Objects for type safety
4. **Middleware Pattern** - Cross-cutting concerns (auth, validation, errors)
5. **Factory Pattern** - (Future: Notification factories)
6. **Strategy Pattern** - (Future: Different verification strategies)

### SOLID Principles
- ✅ **Single Responsibility** - Each layer has one job
- ✅ **Open/Closed** - Open for extension via new domains
- ✅ **Liskov Substitution** - Interfaces are substitutable
- ✅ **Interface Segregation** - Focused interfaces (DTOs)
- ✅ **Dependency Inversion** - Depend on abstractions (services depend on models, not DB directly)

---

## 📝 Code Standards & Conventions

### Naming Conventions
```typescript
// Variables & Functions: camelCase
const userId = '123';
function getUserById(id: string) { }

// Classes & Interfaces: PascalCase
class AppError extends Error { }
interface UserContext { }

// Constants: UPPER_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3;
const VERIFICATION_STATUS = { DRAFT: 'draft' };

// Files: kebab-case
admissions.controller.ts
admissions.service.ts
```

### File Organization
```
domain/
  └── admissions/
      ├── controllers/     # HTTP handlers
      ├── services/         # Business logic
      ├── models/           # Database queries
      ├── routes/           # Route definitions
      ├── types/            # TypeScript types
      ├── validators/       # Joi schemas
      └── constants/        # Domain constants
```

### Function Guidelines
- ✅ Keep functions under 50 lines when possible
- ✅ Single responsibility per function
- ✅ Use early returns to reduce nesting
- ✅ Max 3-4 parameters (use objects for more)
- ✅ Always handle async errors with try-catch

### Comments & Documentation
```typescript
/**
 * Get admission by ID
 * 
 * @param id - Admission UUID
 * @param userContext - User context (for access control)
 * @returns Admission record
 * @throws AppError if not found or access denied
 */
export const getById = async (
  id: string,
  userContext?: UserContext
): Promise<Admission> => {
  // Implementation
};
```

### Code Quality Rules
- ✅ No magic numbers/strings - use constants
- ✅ No unused imports or variables
- ✅ TypeScript strict mode enabled
- ✅ All async functions use try-catch
- ✅ All database queries use parameterized statements

---

## 📁 Project Structure

### Root Structure
```
admission-times-backend/
├── src/
│   ├── config/              # Configuration & constants
│   ├── database/            # DB connection & utilities
│   ├── domain/              # Domain modules (DDD)
│   │   ├── admissions/      # Admissions domain
│   │   └── index.ts         # Domain registration
│   ├── shared/              # Shared utilities
│   │   ├── middleware/      # Express middleware
│   │   ├── types/           # Shared TypeScript types
│   │   └── utils/           # Utility functions
│   └── index.ts             # Application entry point
├── supabase/
│   ├── migrations/          # Database migrations
│   └── seed.sql             # Seed data
├── project-docs/            # Project documentation
└── tsconfig.json            # TypeScript config
```

### Domain Structure (Template)
```
domain/
└── {domain-name}/
    ├── controllers/         # HTTP request handlers
    │   └── {domain}.controller.ts
    ├── services/            # Business logic
    │   └── {domain}.service.ts
    ├── models/              # Database access
    │   └── {domain}.model.ts
    ├── routes/              # Route definitions
    │   └── {domain}.routes.ts
    ├── types/               # TypeScript interfaces
    │   └── {domain}.types.ts
    ├── validators/          # Joi validation schemas
    │   └── {domain}.validators.ts
    └── constants/          # Domain-specific constants
        └── {domain}.constants.ts
```

---

## 🔗 Path Aliases & Imports

### Path Aliases Configuration
Defined in `tsconfig.json`:
```json
{
  "baseUrl": "src",
  "paths": {
    "@domain/*": ["domain/*"],
    "@shared/*": ["shared/*"],
    "@config/*": ["config/*"],
    "@db/*": ["database/*"]
  }
}
```

### Import Examples
```typescript
// ✅ GOOD - Use path aliases
import { sendSuccess } from '@shared/utils/response';
import { query } from '@db/connection';
import { VERIFICATION_STATUS } from '@config/constants';

// ❌ BAD - Deep relative paths
import { sendSuccess } from '../../../shared/utils/response';
import { query } from '../../../database/connection';
```

### Runtime Path Resolution
- Uses `tsconfig-paths/register` in dev and production
- Configured in `package.json` scripts

---

## 🎯 Domain-Driven Development

### Domain Registration
All domains are registered centrally in `src/domain/index.ts`:

```typescript
import { Application } from 'express';
import admissionsRoutes from './admissions/routes/admissions.routes';

export function registerDomains(app: Application): void {
  app.use('/api/v1/admissions', admissionsRoutes);
  // Future domains:
  // app.use('/api/v1/users', usersRoutes);
  // app.use('/api/v1/analytics', analyticsRoutes);
}
```

### Adding a New Domain
1. Create domain folder: `src/domain/{domain-name}/`
2. Create all required subfolders (controllers, services, models, etc.)
3. Add route registration in `src/domain/index.ts`
4. Follow the same structure as `admissions` domain

### Domain Boundaries
- Each domain is self-contained
- Domains communicate via services (not direct model access)
- Shared utilities go in `src/shared/`
- Domain-specific constants stay in domain folder

---

## 🌐 API Design Standards

### RESTful Conventions
```
GET    /api/v1/admissions          # List (with pagination)
GET    /api/v1/admissions/:id      # Get single
POST   /api/v1/admissions          # Create
PUT    /api/v1/admissions/:id      # Full update
PATCH  /api/v1/admissions/:id/...  # Partial update (status transitions)
DELETE /api/v1/admissions/:id      # Delete (soft delete)
```

### HTTP Status Codes
```typescript
200  OK                    // Success
201  Created               // Resource created
400  Bad Request           // Validation error
401  Unauthorized          // Not authenticated
403  Forbidden             // Not authorized
404  Not Found             // Resource not found
500  Internal Server Error // Server error
```

### Response Format
```typescript
// Success Response
{
  "success": true,
  "message": "Admission retrieved successfully",
  "data": { ... },
  "timestamp": "2025-01-05T10:30:00.000Z"
}

// Paginated Response
{
  "success": true,
  "message": "Success",
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  },
  "timestamp": "2025-01-05T10:30:00.000Z"
}

// Error Response
{
  "success": false,
  "message": "Validation error",
  "errors": {
    "title": "Title is required"
  },
  "timestamp": "2025-01-05T10:30:00.000Z"
}
```

### API Versioning
- Current version: `/api/v1/`
- Future versions: `/api/v2/`, `/api/v3/`, etc.
- Version in URL path, not headers

---

## ⚠️ Error Handling Patterns

### Custom Error Class
```typescript
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}
```

### Error Handling Flow
```
Controller (try-catch) → Service (throws AppError) → Error Middleware → Response
```

### Controller Pattern
```typescript
export const getAdmission = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const admission = await admissionsService.getById(id, userContext);
    sendSuccess(res, admission, 'Admission retrieved successfully');
  } catch (error) {
    next(error); // Pass to error middleware
  }
};
```

### Service Pattern
```typescript
export const getById = async (id: string): Promise<Admission> => {
  const admission = await admissionsModel.findById(id);
  
  if (!admission) {
    throw new AppError('Admission not found', 404);
  }
  
  return admission;
};
```

### Error Middleware
- Must be last middleware in `src/index.ts`
- Handles both `AppError` and unexpected errors
- Never exposes stack traces in production
- Logs all errors with context

---

## ✅ Validation Patterns

### Validation Middleware
Uses Joi schemas with middleware:
```typescript
router.post(
  '/',
  validateBody(createAdmissionSchema),
  admissionsController.createAdmission
);
```

### Joi Schema Example
```typescript
export const createAdmissionSchema = Joi.object({
  title: Joi.string().min(3).max(200).required(),
  description: Joi.string().max(5000).optional(),
  program_type: Joi.string().max(100).optional(),
  // ... more fields
});
```

### Validation Rules
- ✅ Validate at API boundary (routes/middleware)
- ✅ Use Joi for schema validation
- ✅ Strip unknown fields
- ✅ Return clear error messages
- ✅ Never trust client-side validation alone

### Validated Data Access
```typescript
// In controller, access validated data:
const data = req.validated as CreateAdmissionDTO;
```

---

## 🗄️ Database Patterns

### Connection Pattern
```typescript
import { query } from '@db/connection';

// All queries use parameterized statements
const result = await query(
  'SELECT * FROM admissions WHERE id = $1',
  [id]
);
```

### Query Building
- ✅ Always use parameterized queries (prevents SQL injection)
- ✅ Build dynamic queries carefully (validate sort fields)
- ✅ Use transactions for multi-step operations
- ✅ Handle connection errors gracefully

### Model Layer Responsibilities
- Execute raw SQL queries
- Handle pagination (OFFSET/LIMIT)
- Build filter queries dynamically
- Return raw data (no transformation)

### Database Constants
- Sortable fields defined in domain constants
- Search fields defined in domain constants
- Prevents SQL injection via field validation

---

## 🔒 Security Practices

### Current Implementation
### Authentication (Phase 4C-1 - In Progress)
- ✅ JWT technology implemented via `jsonwebtoken` package
- ✅ JWT middleware created (`src/shared/middleware/jwtAuth.ts`)
- ✅ Supabase JWT integration configured
- ✅ Real token validation via HMAC-HS256
- 🔄 Service layer updates to use real user IDs
- 📋 Frontend integration with Supabase Auth (frontend task)
- User context attached via `req.user` (validated from JWT claims)
- Token validation includes:
  - Signature verification using JWT secret
  - Issuer validation
  - Audience validation
  - Expiry tolerance (5 minute clock skew)

### Authorization
- Access control in service layer
- Role-based checks (`admin`, `university`, `student`, `guest`)
- University can only see their own admissions
- Role-based endpoint access via `requireRole()` middleware (available for use)

### Security Checklist (Remaining)
- [ ] Test JWT authentication end-to-end
- [ ] Add rate limiting (Phase 4C-3)
- [ ] Enhance CORS configuration (Phase 4C-2)
- [ ] Add helmet.js for security headers (Phase 4C-4)
- [ ] Implement CSRF protection
- [ ] Add request timeout handling
- [ ] Add input sanitization (Phase 4C-5)

---

## 🧪 Testing Strategy

### Current Status
- ⚠️ No tests implemented yet (Phase 3)
- ✅ Test structure planned for Phase 4

### Planned Test Structure
```
tests/
├── unit/              # Unit tests (services, utils)
├── integration/       # Integration tests (API endpoints)
└── fixtures/          # Test data
```

### Testing Guidelines (Future)
- Unit tests for business logic (services)
- Integration tests for API endpoints
- Test error cases and edge cases
- Mock external dependencies
- Maintain >80% coverage for critical paths

---

## 🗺️ Future Phases & Roadmap

### Phase 4 (Planned)
- **Users Domain** - User management, authentication
- **Analytics Domain** - Statistics and reporting
- **Notifications Domain** - Notification system
- **Deadlines Domain** - Deadline management
- **Changelogs API** - Standalone changelog endpoints

### Phase 5+ (Future)
- Real-time features (WebSockets)
- File uploads
- Advanced search (Elasticsearch?)
- Caching layer (Redis)
- Background jobs (Bull/BullMQ)

---

## 📚 Common Patterns & Examples

### Creating a New Domain Endpoint

#### 1. Define Types (`types/{domain}.types.ts`)
```typescript
export interface CreateItemDTO {
  name: string;
  description?: string;
}
```

#### 2. Create Validator (`validators/{domain}.validators.ts`)
```typescript
export const createItemSchema = Joi.object({
  name: Joi.string().min(3).required(),
  description: Joi.string().optional(),
});
```

#### 3. Add Model Method (`models/{domain}.model.ts`)
```typescript
export const create = async (data: CreateItemDTO): Promise<Item> => {
  const sql = 'INSERT INTO items (name, description) VALUES ($1, $2) RETURNING *';
  const result = await query(sql, [data.name, data.description]);
  return result.rows[0];
};
```

#### 4. Add Service Method (`services/{domain}.service.ts`)
```typescript
export const create = async (data: CreateItemDTO): Promise<Item> => {
  // Business logic here
  const item = await itemsModel.create(data);
  // Create changelog, send notifications, etc.
  return item;
};
```

#### 5. Add Controller (`controllers/{domain}.controller.ts`)
```typescript
export const createItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = req.validated as CreateItemDTO;
    const item = await itemsService.create(data);
    sendSuccess(res, item, 'Item created successfully', 201);
  } catch (error) {
    next(error);
  }
};
```

#### 6. Add Route (`routes/{domain}.routes.ts`)
```typescript
router.post(
  '/',
  validateBody(createItemSchema),
  itemsController.createItem
);
```

### Status Transition Pattern
```typescript
// In service:
if (existing.status !== ALLOWED_STATUS) {
  throw new AppError(`Cannot transition from ${existing.status}`, 400);
}

const updated = await model.update(id, { status: NEW_STATUS });

await createChangelogEntry({
  admission_id: id,
  action_type: CHANGE_TYPE.STATUS_CHANGED,
  old_value: existing.status,
  new_value: NEW_STATUS,
  diff_summary: `Status changed from ${existing.status} to ${NEW_STATUS}`,
});
```

### Pagination Pattern
```typescript
// In controller:
const { page, limit } = parsePagination({
  page: queryParams.page,
  limit: queryParams.limit,
});

const { items, total } = await service.getMany(filters, page, limit, sort, order);
const pagination = calculatePagination(total, page, limit);

sendPaginated(res, items, pagination, 'Success');
```

### Access Control Pattern
```typescript
// In service:
function applyAccessControl(filters: Filters, userContext?: UserContext): Filters {
  const effectiveFilters = { ...filters };
  
  if (!userContext || userContext.role === 'guest') {
    effectiveFilters.is_public = true;
  }
  
  if (userContext?.role === 'university') {
    effectiveFilters.university_id = userContext.university_id;
  }
  
  return effectiveFilters;
}
```

---

## 🔍 Code Review Checklist

When adding new code, ensure:

- [ ] ✅ Follows naming conventions
- [ ] ✅ Has comprehensive comments
- [ ] ✅ Uses path aliases for imports
- [ ] ✅ Handles errors with try-catch
- [ ] ✅ Uses constants instead of magic values
- [ ] ✅ Validates input with Joi
- [ ] ✅ Uses parameterized database queries
- [ ] ✅ Returns consistent response format
- [ ] ✅ Uses appropriate HTTP status codes
- [ ] ✅ Follows domain structure
- [ ] ✅ No business logic in controllers
- [ ] ✅ No HTTP concerns in services
- [ ] ✅ TypeScript types are defined
- [ ] ✅ No unused imports/variables

---

## 📖 Additional Resources

### Documentation Files
- `PHASE3_ADMISSIONS_DOMAIN_ROADMAP.md` - Phase 3 implementation details
- `PROJECT_STRUCTURE.md` - Detailed project structure
- `CLEAN_PROJECT_STRUCTURE.md` - Structure guidelines
- `project-docs/` - Project documentation

### Key Files to Reference
- `src/domain/admissions/` - Complete domain example
- `src/shared/middleware/errorHandler.ts` - Error handling pattern
- `src/shared/utils/response.ts` - Response formatting
- `src/config/constants.ts` - Application constants

---

## 🎓 Learning Resources

### Design Patterns
- Repository Pattern
- Service Layer Pattern
- Middleware Pattern
- DTO Pattern

### Best Practices
- RESTful API Design
- Domain-Driven Design
- Clean Architecture
- SOLID Principles

---

## 📝 Notes for Future Developers

1. **Always start with types** - Define TypeScript interfaces first
2. **Follow the domain structure** - Use `admissions` as a template
3. **Use path aliases** - Never use `../../../` imports
4. **Handle errors properly** - Always use try-catch in controllers
5. **Validate everything** - Use Joi schemas for all inputs
6. **Document your code** - Add JSDoc comments to all functions
7. **Test your changes** - Run `pnpm type-check` before committing
8. **Follow the patterns** - Consistency is key

---

**Remember:** This document is a living guide. Update it as patterns evolve and new best practices emerge.
