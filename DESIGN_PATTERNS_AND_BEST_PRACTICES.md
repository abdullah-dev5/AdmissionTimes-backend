# Design Patterns, System Design & Best Practices

**Created:** January 18, 2026  
**Purpose:** Comprehensive reference document for all design patterns, system design principles, and best practices followed in AdmissionTimes Backend  
**Status:** Active Reference Document

---

## 📋 Table of Contents

1. [Architecture Patterns](#architecture-patterns)
2. [Design Patterns](#design-patterns)
3. [SOLID Principles](#solid-principles)
4. [System Design Principles](#system-design-principles)
5. [Code Organization Patterns](#code-organization-patterns)
6. [API Design Patterns](#api-design-patterns)
7. [Database Patterns](#database-patterns)
8. [Security Patterns](#security-patterns)
9. [Error Handling Patterns](#error-handling-patterns)
10. [Validation Patterns](#validation-patterns)
11. [Code Quality Practices](#code-quality-practices)
12. [Naming Conventions](#naming-conventions)
13. [Documentation Practices](#documentation-practices)

---

## 🏗️ Architecture Patterns

### 1. Domain-Driven Design (DDD)

**Purpose:** Organize code around business domains rather than technical layers.

**Implementation:**
- Code organized by domain (`admissions`, `notifications`, `deadlines`, etc.)
- Each domain is self-contained with its own:
  - Controllers (HTTP layer)
  - Services (Business logic)
  - Models (Data access)
  - Routes (API endpoints)
  - Types (TypeScript interfaces)
  - Validators (Input validation)
  - Constants (Domain constants)

**Benefits:**
- Clear separation of concerns
- Easy to locate domain-specific code
- Scalable architecture
- Domain experts can understand code structure

**Example Structure:**
```
src/domain/admissions/
├── controllers/    # HTTP request/response handling
├── services/       # Business logic
├── models/         # Database access
├── routes/         # API endpoint definitions
├── types/          # TypeScript interfaces
├── validators/     # Input validation schemas
└── constants/      # Domain-specific constants
```

---

### 2. Clean Architecture

**Purpose:** Separate concerns into distinct layers with clear dependencies.

**Layer Structure:**
```
┌─────────────────────────────────────┐
│      Controllers Layer              │  HTTP Request/Response
│  (Extract data, call services)     │  No business logic
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│       Services Layer                │  Business Logic
│  (Status transitions, rules)       │  No HTTP concerns
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│        Models Layer                 │  Database Access
│  (Raw SQL queries, no logic)        │  No business rules
└─────────────────────────────────────┘
```

**Dependency Rule:**
- Controllers depend on Services
- Services depend on Models
- Models depend on Database
- **No reverse dependencies**

**Benefits:**
- Testable (each layer can be tested independently)
- Maintainable (changes isolated to specific layers)
- Flexible (easy to swap implementations)

---

### 3. Layered Architecture

**Purpose:** Organize code into horizontal layers with clear responsibilities.

**Layers:**

1. **Presentation Layer** (Controllers, Routes)
   - Handle HTTP requests/responses
   - Extract request data
   - Format responses
   - No business logic

2. **Application Layer** (Services)
   - Business logic
   - Orchestration
   - Validation
   - No HTTP concerns

3. **Domain Layer** (Types, Constants)
   - Domain models
   - Business rules
   - Domain constants
   - No infrastructure concerns

4. **Infrastructure Layer** (Models, Database)
   - Data access
   - External services
   - Database queries
   - No business logic

---

## 🎨 Design Patterns

### 1. Repository Pattern

**Purpose:** Abstract data access logic from business logic.

**Implementation:**
- Models act as repositories
- Encapsulate database queries
- Provide clean interface for data access
- Hide database implementation details

**Example:**
```typescript
// Model (Repository)
export const findById = async (id: string): Promise<Admission | null> => {
  const result = await query(
    'SELECT * FROM admissions WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
};

// Service uses repository
const admission = await admissionsModel.findById(id);
```

**Benefits:**
- Testable (can mock repositories)
- Flexible (can swap data sources)
- Maintainable (database changes isolated)

---

### 2. Service Layer Pattern

**Purpose:** Encapsulate business logic in dedicated service classes.

**Implementation:**
- Services contain business rules
- Services orchestrate between models
- Services handle complex operations
- Controllers delegate to services

**Example:**
```typescript
// Service
export const verifyAdmission = async (
  id: string,
  userContext: UserContext
): Promise<Admission> => {
  // Business logic
  const admission = await admissionsModel.findById(id);
  if (admission.verification_status !== VERIFICATION_STATUS.PENDING) {
    throw new AppError('Admission must be pending', 400);
  }
  
  // Update status
  const updated = await admissionsModel.update(id, {
    verification_status: VERIFICATION_STATUS.VERIFIED,
    verified_by: userContext.id,
    verified_at: new Date().toISOString(),
  });
  
  // Create changelog
  await createChangelog(...);
  
  return updated;
};

// Controller delegates to service
export const verifyAdmission = asyncHandler(async (req, res) => {
  const admission = await admissionsService.verifyAdmission(
    req.params.id,
    req.user!
  );
  sendSuccess(res, admission, 'Admission verified successfully');
});
```

**Benefits:**
- Reusable business logic
- Testable business rules
- Clear separation of concerns

---

### 3. DTO (Data Transfer Object) Pattern

**Purpose:** Transfer data between layers with type safety.

**Implementation:**
- Separate DTOs for input/output
- TypeScript interfaces for type safety
- Validation at boundaries
- No business logic in DTOs

**Example:**
```typescript
// Input DTO
export interface CreateAdmissionDTO {
  title: string;
  description?: string;
  deadline?: string;
}

// Output (Domain Model)
export interface Admission {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  // ... more fields
}
```

**Benefits:**
- Type safety
- Clear contracts
- Validation boundaries
- Versioning support

---

### 4. Middleware Pattern

**Purpose:** Handle cross-cutting concerns (auth, validation, errors).

**Implementation:**
- Express middleware functions
- Chain of responsibility
- Reusable across routes
- Composable

**Example:**
```typescript
// Authentication middleware
export const mockAuth = (req: Request, res: Response, next: NextFunction) => {
  const userId = req.headers['x-user-id'];
  req.user = { id: userId || null, role: 'guest' };
  next();
};

// Validation middleware
export const validateBody = (schema: Joi.Schema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return sendError(res, error.details[0].message, 400);
    }
    next();
  };
};

// Usage
router.post('/admissions', 
  validateBody(createAdmissionSchema),
  createAdmission
);
```

**Benefits:**
- Reusable logic
- Separation of concerns
- Composable
- Testable

---

### 5. Factory Pattern

**Purpose:** Create objects without specifying exact classes.

**Implementation:**
- Factory functions for object creation
- Centralized creation logic
- Flexible object creation

**Example:**
```typescript
// Notification factory (future)
export const createNotification = (
  type: NotificationType,
  data: NotificationData
): Notification => {
  switch (type) {
    case 'verification':
      return createVerificationNotification(data);
    case 'deadline':
      return createDeadlineNotification(data);
    default:
      throw new Error('Unknown notification type');
  }
};
```

**Benefits:**
- Encapsulates creation logic
- Easy to extend
- Centralized control

---

### 6. Strategy Pattern

**Purpose:** Define family of algorithms and make them interchangeable.

**Implementation:**
- Different strategies for same operation
- Context uses strategy
- Easy to swap strategies

**Example:**
```typescript
// Verification strategies (future)
interface VerificationStrategy {
  verify(admission: Admission): Promise<VerificationResult>;
}

class AutoVerificationStrategy implements VerificationStrategy {
  async verify(admission: Admission) { /* ... */ }
}

class ManualVerificationStrategy implements VerificationStrategy {
  async verify(admission: Admission) { /* ... */ }
}
```

**Benefits:**
- Flexible algorithms
- Easy to add new strategies
- Testable strategies

---

### 7. Observer Pattern

**Purpose:** Notify multiple objects about state changes.

**Implementation:**
- Event-driven architecture
- Publishers and subscribers
- Loose coupling

**Example:**
```typescript
// Event emission (future)
eventEmitter.on('admission.verified', (admission) => {
  createNotification(admission);
  trackAnalytics(admission);
  updateCache(admission);
});
```

**Benefits:**
- Loose coupling
- Extensible
- Event-driven

---

## 🔧 SOLID Principles

### 1. Single Responsibility Principle (SRP)

**Definition:** A class should have only one reason to change.

**Implementation:**
- Controllers: Only HTTP handling
- Services: Only business logic
- Models: Only data access
- Validators: Only validation

**Example:**
```typescript
// ✅ Good: Single responsibility
export const getAdmissions = async (filters: AdmissionFilters) => {
  return await admissionsModel.findMany(filters);
};

// ❌ Bad: Multiple responsibilities
export const getAdmissionsAndSendEmail = async (filters: AdmissionFilters) => {
  const admissions = await admissionsModel.findMany(filters);
  await sendEmail(admissions); // Wrong responsibility
  return admissions;
};
```

---

### 2. Open/Closed Principle (OCP)

**Definition:** Open for extension, closed for modification.

**Implementation:**
- Add new domains without modifying existing code
- Extend functionality through new services
- Use interfaces for extension points

**Example:**
```typescript
// ✅ Good: Extensible
export const registerDomains = (app: Application) => {
  app.use('/api/v1/admissions', admissionsRoutes);
  app.use('/api/v1/notifications', notificationsRoutes);
  // Easy to add new domains
};

// ❌ Bad: Requires modification
export const handleRequest = (path: string) => {
  if (path === '/admissions') { /* ... */ }
  if (path === '/notifications') { /* ... */ }
  // Must modify to add new paths
};
```

---

### 3. Liskov Substitution Principle (LSP)

**Definition:** Subtypes must be substitutable for their base types.

**Implementation:**
- Interfaces define contracts
- Implementations follow contracts
- No breaking changes in subtypes

**Example:**
```typescript
// ✅ Good: Substitutable
interface DataAccess {
  findById(id: string): Promise<Entity | null>;
}

class PostgresDataAccess implements DataAccess {
  async findById(id: string) { /* ... */ }
}

class MockDataAccess implements DataAccess {
  async findById(id: string) { /* ... */ }
}
```

---

### 4. Interface Segregation Principle (ISP)

**Definition:** Clients should not depend on interfaces they don't use.

**Implementation:**
- Focused interfaces
- Small, specific DTOs
- No fat interfaces

**Example:**
```typescript
// ✅ Good: Segregated interfaces
interface CreateAdmissionDTO {
  title: string;
  description?: string;
}

interface UpdateAdmissionDTO {
  title?: string;
  description?: string;
}

// ❌ Bad: Fat interface
interface AdmissionDTO {
  title: string;
  description?: string;
  id?: string;
  created_at?: string;
  // Too many fields
}
```

---

### 5. Dependency Inversion Principle (DIP)

**Definition:** Depend on abstractions, not concretions.

**Implementation:**
- Services depend on model interfaces
- Controllers depend on service interfaces
- Use dependency injection

**Example:**
```typescript
// ✅ Good: Depend on abstraction
export const getAdmissions = async (filters: AdmissionFilters) => {
  return await admissionsModel.findMany(filters);
  // Service depends on model abstraction, not database directly
};

// ❌ Bad: Depend on concretion
export const getAdmissions = async (filters: AdmissionFilters) => {
  const pool = new Pool({ /* ... */ });
  const result = await pool.query('SELECT * FROM admissions');
  // Service depends on database directly
};
```

---

## 🎯 System Design Principles

### 1. Separation of Concerns

**Principle:** Each component should have a single, well-defined responsibility.

**Implementation:**
- Controllers: HTTP only
- Services: Business logic only
- Models: Data access only
- Middleware: Cross-cutting concerns only

---

### 2. DRY (Don't Repeat Yourself)

**Principle:** Avoid code duplication.

**Implementation:**
- Shared utilities (`src/shared/utils/`)
- Reusable middleware
- Common types (`src/shared/types/`)
- Response helpers

**Example:**
```typescript
// ✅ Good: Reusable utility
export const sendSuccess = (res: Response, data: any, message: string) => {
  res.status(200).json({ success: true, message, data });
};

// ❌ Bad: Repeated code
res.status(200).json({ success: true, message: 'Success', data });
res.status(200).json({ success: true, message: 'Success', data });
```

---

### 3. KISS (Keep It Simple, Stupid)

**Principle:** Prefer simple solutions over complex ones.

**Implementation:**
- Simple, readable code
- Avoid over-engineering
- Clear naming
- Straightforward logic

---

### 4. YAGNI (You Aren't Gonna Need It)

**Principle:** Don't implement features until needed.

**Implementation:**
- Implement only current requirements
- Avoid speculative features
- Refactor when needed

---

### 5. Fail Fast

**Principle:** Detect and report errors as early as possible.

**Implementation:**
- Input validation at boundaries
- Type checking (TypeScript)
- Early error returns
- Clear error messages

**Example:**
```typescript
// ✅ Good: Fail fast
export const getById = async (id: string) => {
  if (!id) {
    throw new AppError('ID is required', 400);
  }
  // ... rest of logic
};
```

---

### 6. Principle of Least Surprise

**Principle:** Code should behave as expected.

**Implementation:**
- Consistent naming
- Predictable behavior
- Clear documentation
- Standard patterns

---

## 📁 Code Organization Patterns

### 1. Domain-Based Organization

**Structure:**
```
src/domain/{domain-name}/
├── controllers/    # HTTP handlers
├── services/       # Business logic
├── models/         # Data access
├── routes/         # Route definitions
├── types/          # TypeScript types
├── validators/     # Validation schemas
└── constants/      # Domain constants
```

**Benefits:**
- Easy to locate code
- Clear domain boundaries
- Scalable structure

---

### 2. Shared Code Organization

**Structure:**
```
src/shared/
├── middleware/    # Cross-cutting middleware
├── utils/         # Reusable utilities
└── types/         # Shared types
```

**Benefits:**
- Reusable code
- Consistent utilities
- Shared types

---

### 3. Configuration Organization

**Structure:**
```
src/config/
├── config.ts       # Application config
├── constants.ts    # Application constants
└── swagger.ts      # API documentation
```

**Benefits:**
- Centralized configuration
- Easy to find constants
- Single source of truth

---

## 🌐 API Design Patterns

### 1. RESTful API Design

**Principles:**
- Use HTTP methods correctly
- Resource-based URLs
- Stateless requests
- Standard status codes

**Implementation:**
```typescript
GET    /api/v1/admissions        # List
GET    /api/v1/admissions/:id    # Get one
POST   /api/v1/admissions        # Create
PUT    /api/v1/admissions/:id   # Update (full)
PATCH  /api/v1/admissions/:id   # Update (partial)
DELETE /api/v1/admissions/:id   # Delete
```

---

### 2. Consistent Response Format

**Standard Response:**
```typescript
{
  success: boolean,
  message: string,
  data: T,
  timestamp: string
}
```

**Paginated Response:**
```typescript
{
  success: boolean,
  message: string,
  data: T[],
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number,
    hasNext: boolean,
    hasPrev: boolean
  },
  timestamp: string
}
```

---

### 3. API Versioning

**Implementation:**
- URL-based versioning: `/api/v1/`
- Version in all endpoints
- Backward compatibility

---

### 4. Pagination Pattern

**Implementation:**
- Query parameters: `?page=1&limit=20`
- Default values: page=1, limit=20
- Maximum limit: 100
- Pagination metadata in response

---

### 5. Filtering & Search Pattern

**Implementation:**
- Query parameters for filters
- Search parameter for text search
- Multiple filters combinable
- Case-insensitive search

**Example:**
```
GET /api/v1/admissions?search=computer&program_type=master&degree_level=graduate
```

---

## 🗄️ Database Patterns

### 1. Migration Pattern

**Purpose:** Version control for database schema.

**Implementation:**
- SQL migration files
- Timestamped migrations
- Idempotent migrations
- Migration tracking table

---

### 2. Connection Pooling

**Purpose:** Efficient database connection management.

**Implementation:**
- Pool configuration
- Connection reuse
- Proper cleanup
- Error handling

**Example:**
```typescript
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});
```

---

### 3. Parameterized Queries

**Purpose:** Prevent SQL injection.

**Implementation:**
- Always use parameters
- Never concatenate user input
- Type-safe parameters

**Example:**
```typescript
// ✅ Good: Parameterized
await query('SELECT * FROM admissions WHERE id = $1', [id]);

// ❌ Bad: String concatenation
await query(`SELECT * FROM admissions WHERE id = '${id}'`);
```

---

### 4. Transaction Pattern

**Purpose:** Ensure atomic operations.

**Implementation:**
- BEGIN/COMMIT/ROLLBACK
- Transaction helpers
- Error handling

**Example:**
```typescript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('INSERT INTO ...');
  await client.query('UPDATE ...');
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

---

### 5. Seeding Pattern

**Purpose:** Populate database with test data.

**Implementation:**
- Idempotent seeds
- Transaction-safe
- Dependency management
- Seed tracking

---

## 🔒 Security Patterns

### 1. Input Validation

**Implementation:**
- Validate at API boundary
- Use Joi schemas
- Sanitize inputs
- Type checking

---

### 2. Authentication Pattern

**Implementation:**
- JWT tokens (future)
- Middleware for auth
- User context injection
- Token validation

---

### 3. Authorization Pattern

**Implementation:**
- Role-based access control (RBAC)
- Resource-level permissions
- Service-layer checks
- Clear error messages

---

### 4. SQL Injection Prevention

**Implementation:**
- Parameterized queries
- Never concatenate user input
- Input validation
- Type checking

---

### 5. XSS Prevention

**Implementation:**
- Input sanitization (planned)
- Output encoding
- Content Security Policy (planned)
- Validation

---

## ⚠️ Error Handling Patterns

### 1. Centralized Error Handling

**Implementation:**
- Global error handler middleware
- Consistent error format
- Error logging
- User-friendly messages

**Example:**
```typescript
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }
  
  res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
};
```

---

### 2. Custom Error Classes

**Implementation:**
- AppError base class
- Specific error types
- Status codes
- Error context

**Example:**
```typescript
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}
```

---

### 3. Async Error Handling

**Implementation:**
- Try-catch blocks
- Async handler wrapper
- Promise error handling

**Example:**
```typescript
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
```

---

## ✅ Validation Patterns

### 1. Schema Validation

**Implementation:**
- Joi schemas
- Request validation middleware
- Clear error messages
- Type-safe validation

**Example:**
```typescript
export const createAdmissionSchema = Joi.object({
  title: Joi.string().required().min(3).max(255),
  description: Joi.string().optional().max(5000),
  deadline: Joi.date().iso().optional(),
});
```

---

### 2. Validation Middleware

**Implementation:**
- Reusable validation middleware
- Body/query/params validation
- Error formatting

**Example:**
```typescript
export const validateBody = (schema: Joi.Schema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return sendError(res, error.details[0].message, 400);
    }
    next();
  };
};
```

---

## 📝 Code Quality Practices

### 1. TypeScript Strict Mode

**Implementation:**
- Strict type checking
- No implicit any
- Strict null checks
- Type safety

---

### 2. Meaningful Names

**Implementation:**
- Descriptive variable names
- Clear function names
- Self-documenting code
- No abbreviations

**Example:**
```typescript
// ✅ Good
const admissionId = '123';
const getUserById = async (id: string) => { };

// ❌ Bad
const aId = '123';
const get = async (i: string) => { };
```

---

### 3. Small Functions

**Implementation:**
- Single responsibility
- Max 50 lines (guideline)
- Clear purpose
- Testable

---

### 4. Comments

**Implementation:**
- JSDoc comments
- Explain why, not what
- Complex logic documentation
- API documentation

**Example:**
```typescript
/**
 * Get admission by ID with access control
 * 
 * @param id - Admission UUID
 * @param userContext - User context for access control
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

---

### 5. Constants Over Magic Values

**Implementation:**
- No magic numbers/strings
- Centralized constants
- Named constants
- Configuration values

**Example:**
```typescript
// ✅ Good
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_PAGE_SIZE = 20;

// ❌ Bad
if (attempts < 3) { }
const limit = 20;
```

---

## 📛 Naming Conventions

### Variables & Functions
- **camelCase**: `userId`, `getUserById()`

### Classes & Interfaces
- **PascalCase**: `AppError`, `UserContext`

### Constants
- **UPPER_SNAKE_CASE**: `MAX_RETRY_ATTEMPTS`, `DEFAULT_PAGE_SIZE`

### Files
- **kebab-case**: `admissions.service.ts`, `error-handler.ts`

### Database
- **snake_case**: `user_id`, `created_at`

---

## 📚 Documentation Practices

### 1. Code Documentation

**JSDoc Comments:**
- Function descriptions
- Parameter descriptions
- Return value descriptions
- Example usage

### 2. API Documentation

**Swagger/OpenAPI:**
- Endpoint documentation
- Request/response schemas
- Example payloads
- Error responses

### 3. Project Documentation

**Markdown Files:**
- README.md
- Project docs (project-docs/)
- Integration guides
- Architecture documents

---

## 🎯 Summary

### Architecture Patterns
- ✅ Domain-Driven Design (DDD)
- ✅ Clean Architecture
- ✅ Layered Architecture

### Design Patterns
- ✅ Repository Pattern
- ✅ Service Layer Pattern
- ✅ DTO Pattern
- ✅ Middleware Pattern
- ✅ Factory Pattern (planned)
- ✅ Strategy Pattern (planned)
- ✅ Observer Pattern (planned)

### Principles
- ✅ SOLID Principles
- ✅ DRY (Don't Repeat Yourself)
- ✅ KISS (Keep It Simple)
- ✅ YAGNI (You Aren't Gonna Need It)
- ✅ Fail Fast
- ✅ Principle of Least Surprise

### Best Practices
- ✅ TypeScript strict mode
- ✅ Meaningful naming
- ✅ Small functions
- ✅ Comprehensive comments
- ✅ Constants over magic values
- ✅ Consistent code style
- ✅ Error handling
- ✅ Input validation
- ✅ Security practices

---

**Last Updated:** January 18, 2026  
**Status:** Active Reference Document  
**Maintained By:** Development Team
