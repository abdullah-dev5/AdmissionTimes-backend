# Technical Specifications

**Last Updated:** January 18, 2026 (Supabase Cloud Setup & Seeding System Complete)

## Tech Stack

### Runtime & Framework
- **Node.js**: v18+ JavaScript runtime environment
- **Express.js**: v5.2.1 Web framework for Node.js
- **TypeScript**: v5.9.3 Typed superset of JavaScript for better code quality and maintainability
- **Package Manager**: pnpm v10+

### Database
- **PostgreSQL**: Primary database (via Supabase Cloud)
- **Supabase Cloud**: Database hosting with Session Pooler (IPv4 compatible)
- **Database Client**: `pg` (PostgreSQL client for Node.js)
- **Connection Pooling**: Built-in pg pool management (Session Pooler)
- **Database Migrations**: Migration system with tracking (`pnpm migrate`)
- **Database Seeding**: Comprehensive seeding system with 9 seed files (`pnpm seed`)
- **RLS (Row Level Security)**: Policies configured for data access control

### Validation & Documentation
- **Joi**: Schema validation for request bodies and query parameters
- **swagger-jsdoc**: OpenAPI/Swagger documentation generation
- **swagger-ui-express**: Interactive API documentation UI

### Development Tools
- **Version Control**: Git
- **TypeScript Compiler**: Type checking and compilation
- **ts-node**: TypeScript execution environment for development
- **nodemon**: Development server with hot reload
- **Code Quality**: ESLint (recommended, to be configured)
- **Testing**: Planned (Jest/Vitest + Supertest)

### Dependencies

**Production:**
- `express` ^5.2.1
- `dotenv` ^17.2.3
- `pg` ^8.11.3
- `joi` ^17.11.0
- `swagger-jsdoc` ^6.2.8
- `swagger-ui-express` ^5.0.1

**Development:**
- `typescript` ^5.9.3
- `@types/express` ^5.0.6
- `@types/node` ^25.0.3
- `@types/pg` ^8.10.9
- `@types/swagger-jsdoc` ^6.0.4
- `@types/swagger-ui-express` ^4.1.8
- `ts-node` ^10.9.2
- `nodemon` ^3.1.11

## Development Methods

### Architecture
- **Clean Architecture**: Separation of concerns into layers
- **Domain-Driven Design (DDD)**: Code organized around business domains
- **RESTful API**: Standard HTTP methods and status codes
- **API Versioning**: `/api/v1/` prefix for all endpoints

### Code Organization
- **Domain-Based Structure**: Each domain has controllers, services, models, routes, types, validators, constants
- **Layer Separation**: Controllers handle HTTP, services handle business logic, models handle database
- **Shared Utilities**: Common code in `src/shared/`
- **Configuration**: Centralized config in `src/config/`

### Error Handling
- **Centralized Middleware**: Global error handler in `src/shared/middleware/errorHandler.ts`
- **Custom Error Class**: `AppError` for consistent error responses
- **Error Types**: ValidationError, NotFoundError, UnauthorizedError, etc.
- **Error Logging**: Console.error for now, structured logging planned

### Logging
- **Current**: Console logging (console.error, console.log)
- **Planned**: Structured logging with winston or pino
- **Request Logging**: Planned middleware for request/response logging
- **Correlation IDs**: Planned for request tracking

## Coding Standards

### Principles
- ✅ **SOLID Principles**: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion
- ✅ **Design Patterns**: Repository pattern, Factory pattern, Strategy pattern where appropriate
- ✅ **Clean Code**: Meaningful names, small functions, clear structure

### Code Style
- **Naming**: camelCase for variables/functions, PascalCase for classes
- **Comments**: Comprehensive comments for all modules, functions, and complex logic
- **Type Safety**: 100% TypeScript with strict mode enabled
- **Error Handling**: Try-catch blocks for async operations
- **Validation**: Joi schemas for all input validation

### File Structure Standards
- **Controllers**: HTTP input/output only, delegate to services
- **Services**: Business logic and orchestration
- **Models**: Database access only, parameterized queries
- **Validators**: Joi schemas only
- **Constants**: Enums, literals, configuration values
- **Types**: DTOs, internal types, response contracts

## Database Design

### Database System
- **PostgreSQL**: Primary database
- **Supabase**: Hosting and RLS policies
- **Schema**: Defined in Supabase migrations

### Key Tables

**Core Tables:**
- `admissions` - Admission records
- `changelogs` - Audit trail (immutable)
- `notifications` - User notifications
- `deadlines` - Deadline records
- `user_activity` - User activity tracking
- `analytics_events` - Analytics events (planned)

### Database Patterns
- **Parameterized Queries**: All queries use parameterized statements (SQL injection prevention)
- **RLS Policies**: Row Level Security for access control
- **Indexes**: Indexes on frequently queried fields
- **Foreign Keys**: Referential integrity enforced
- **Soft Deletes**: Logical deletion where appropriate (isDeleted flag)

### Connection Management
- **Connection Pooling**: pg pool for efficient connection management
- **Environment-Based**: Different connections for dev/staging/prod
- **Error Handling**: Connection retry logic

## API Design

### RESTful Conventions
- **HTTP Methods**: GET (retrieve), POST (create), PUT (update), PATCH (partial update), DELETE (delete)
- **Resource Naming**: Nouns, not verbs (e.g., `/admissions`, not `/getAdmissions`)
- **Versioning**: `/api/v1/` prefix
- **Status Codes**: 200 (OK), 201 (Created), 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found), 500 (Internal Error)

### Response Format
- **Consistent Envelope**: All responses follow standard format
- **Success Response**: `{ success: true, data: {...}, message?: string }`
- **Error Response**: `{ success: false, error: { message: string, code?: string } }`
- **Pagination**: Standard pagination contract with `page`, `limit`, `total`, `totalPages`

### API Documentation
- **Swagger/OpenAPI**: Complete documentation at `/api-docs`
- **Interactive UI**: Swagger UI for testing endpoints
- **Schemas**: Reusable schemas defined in `src/config/swagger.ts`
- **Annotations**: JSDoc `@swagger` comments in route files

### Endpoints Summary

**Total Endpoints:** 25
- Admissions: 10 endpoints
- Notifications: 5 endpoints
- Deadlines: 3 endpoints
- User Activity: 2 endpoints
- Health: 1 endpoint
- Swagger Docs: 1 endpoint (`/api-docs`)

### Authentication
- **Current**: Mock authentication middleware
- **Planned**: Real Supabase Auth with JWT tokens
- **Authorization**: Role-based (student, university, admin)

### Validation
- **Request Validation**: Joi schemas for all inputs
- **Query Parameters**: Validated with Joi
- **Path Parameters**: Validated with Joi
- **Request Bodies**: Validated with Joi
- **Error Messages**: Clear validation error messages
