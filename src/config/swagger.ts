/**
 * Swagger/OpenAPI Configuration
 * 
 * Configuration for API documentation using Swagger/OpenAPI 3.0
 * Documentation is auto-generated from JSDoc comments in route files
 */

import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './config';

/**
 * Swagger/OpenAPI specification options
 */
const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AdmissionTimes API',
      version: '1.0.0',
      description: 'API documentation for AdmissionTimes backend - A platform for managing admission deadlines and notifications',
      contact: {
        name: 'API Support',
        email: 'support@admissiontimes.com',
      },
      license: {
        name: 'ISC',
      },
    },
    servers: [
      {
        url: process.env.API_URL || `http://localhost:${config.port || 3000}`,
        description: 'Development server',
      },
      {
        url: 'https://api.admissiontimes.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token authentication (Supabase Auth)',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            message: {
              type: 'string',
              example: 'Error message',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              example: 1,
            },
            limit: {
              type: 'integer',
              example: 20,
            },
            total: {
              type: 'integer',
              example: 100,
            },
            totalPages: {
              type: 'integer',
              example: 5,
            },
            hasNext: {
              type: 'boolean',
              example: true,
            },
            hasPrev: {
              type: 'boolean',
              example: false,
            },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
              example: 'Success',
            },
            data: {
              type: 'object',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
              example: 'Success',
            },
            data: {
              type: 'array',
              items: {
                type: 'object',
              },
            },
            pagination: {
              $ref: '#/components/schemas/Pagination',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Notification: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000',
            },
            recipient_id: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000',
            },
            role_type: {
              type: 'string',
              enum: ['student', 'university', 'admin'],
              example: 'student',
            },
            notification_type: {
              type: 'string',
              enum: ['admission_submitted', 'admission_resubmitted', 'admission_verified', 'admission_rejected', 'admission_revision_required', 'admission_updated_saved', 'deadline_near', 'system_broadcast', 'dispute_raised', 'system_error'],
              example: 'admission_verified',
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'urgent'],
              example: 'high',
            },
            title: {
              type: 'string',
              example: 'Admission Verified',
            },
            message: {
              type: 'string',
              example: 'Your admission has been verified and is now visible to students.',
            },
            related_entity_type: {
              type: 'string',
              nullable: true,
              example: 'admission',
            },
            related_entity_id: {
              type: 'string',
              format: 'uuid',
              nullable: true,
              example: '123e4567-e89b-12d3-a456-426614174000',
            },
            is_read: {
              type: 'boolean',
              example: false,
            },
            read_at: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            action_url: {
              type: 'string',
              nullable: true,
              example: '/admissions/123e4567-e89b-12d3-a456-426614174000',
            },
            event_key: {
              type: 'string',
              example: 'admission_verified:123e4567-e89b-12d3-a456-426614174000:admin_1',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-15T10:30:00Z',
            },
          },
        },
        Admission: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000',
            },
            university_id: {
              type: 'string',
              format: 'uuid',
              nullable: true,
            },
            title: {
              type: 'string',
              example: 'Computer Science Master Program',
            },
            description: {
              type: 'string',
              nullable: true,
              example: 'A comprehensive master program in computer science',
            },
            program_type: {
              type: 'string',
              nullable: true,
              example: 'graduate',
            },
            degree_level: {
              type: 'string',
              nullable: true,
              example: 'master',
            },
            field_of_study: {
              type: 'string',
              nullable: true,
              example: 'Computer Science',
            },
            duration: {
              type: 'string',
              nullable: true,
              example: '2 years',
            },
            tuition_fee: {
              type: 'number',
              nullable: true,
              example: 25000,
            },
            currency: {
              type: 'string',
              nullable: true,
              example: 'USD',
            },
            application_fee: {
              type: 'number',
              nullable: true,
              example: 100,
            },
            deadline: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            start_date: {
              type: 'string',
              format: 'date',
              nullable: true,
            },
            location: {
              type: 'string',
              nullable: true,
              example: 'New York, USA',
            },
            campus: {
              type: 'string',
              nullable: true,
              example: 'Main Campus',
            },
            delivery_mode: {
              type: 'string',
              enum: ['on-campus', 'online', 'hybrid'],
              nullable: true,
              example: 'on-campus',
            },
            requirements: {
              type: 'object',
              nullable: true,
            },
            verification_status: {
              type: 'string',
              enum: ['draft', 'pending', 'verified', 'rejected', 'disputed'],
              example: 'verified',
            },
            verified_at: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            verified_by: {
              type: 'string',
              format: 'uuid',
              nullable: true,
            },
            rejection_reason: {
              type: 'string',
              nullable: true,
            },
            dispute_reason: {
              type: 'string',
              nullable: true,
            },
            created_by: {
              type: 'string',
              format: 'uuid',
              nullable: true,
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
            },
            is_active: {
              type: 'boolean',
              example: true,
            },
          },
        },
        Deadline: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            admission_id: {
              type: 'string',
              format: 'uuid',
            },
            deadline_type: {
              type: 'string',
              enum: ['application', 'document_submission', 'payment', 'other'],
              example: 'application',
            },
            deadline_date: {
              type: 'string',
              format: 'date-time',
            },
            timezone: {
              type: 'string',
              example: 'UTC',
            },
            is_flexible: {
              type: 'boolean',
              example: false,
            },
            reminder_sent: {
              type: 'boolean',
              example: false,
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        DeadlineWithMetadata: {
          allOf: [
            { $ref: '#/components/schemas/Deadline' },
            {
              type: 'object',
              properties: {
                days_remaining: {
                  type: 'integer',
                  example: 30,
                  description: 'Number of days remaining until deadline (negative if overdue)',
                },
                is_overdue: {
                  type: 'boolean',
                  example: false,
                  description: 'Whether the deadline has passed',
                },
                urgency_level: {
                  type: 'string',
                  enum: ['low', 'medium', 'high', 'critical', 'expired'],
                  example: 'medium',
                  description: 'Calculated urgency level based on days remaining',
                },
              },
            },
          ],
        },
        UserActivity: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            user_id: {
              type: 'string',
              format: 'uuid',
              nullable: true,
            },
            user_type: {
              type: 'string',
              enum: ['student', 'university', 'admin'],
              example: 'student',
            },
            activity_type: {
              type: 'string',
              enum: ['viewed', 'searched', 'compared', 'watchlisted'],
              example: 'viewed',
            },
            entity_type: {
              type: 'string',
              example: 'admission',
            },
            entity_id: {
              type: 'string',
              format: 'uuid',
            },
            metadata: {
              type: 'object',
              nullable: true,
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Changelog: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            admission_id: {
              type: 'string',
              format: 'uuid',
            },
            actor_type: {
              type: 'string',
              enum: ['admin', 'university', 'system'],
              example: 'admin',
            },
            changed_by: {
              type: 'string',
              format: 'uuid',
              nullable: true,
            },
            action_type: {
              type: 'string',
              enum: ['created', 'updated', 'verified', 'rejected', 'disputed', 'status_changed'],
              example: 'verified',
            },
            field_name: {
              type: 'string',
              nullable: true,
              example: 'verification_status',
            },
            old_value: {
              type: 'object',
              nullable: true,
            },
            new_value: {
              type: 'object',
              nullable: true,
            },
            diff_summary: {
              type: 'string',
              example: 'Admission verified by admin',
            },
            metadata: {
              type: 'object',
              nullable: true,
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000',
            },
            auth_user_id: {
              type: 'string',
              format: 'uuid',
              nullable: true,
              example: '123e4567-e89b-12d3-a456-426614174000',
              description: 'Supabase Auth UUID (nullable for mock auth)',
            },
            role: {
              type: 'string',
              enum: ['student', 'university', 'admin'],
              example: 'student',
              description: 'User role - determines intent and permissions',
            },
            display_name: {
              type: 'string',
              example: 'John Doe',
              description: 'User display name',
            },
            university_id: {
              type: 'string',
              format: 'uuid',
              nullable: true,
              example: '123e4567-e89b-12d3-a456-426614174000',
              description: 'University ID (for university users only)',
            },
            status: {
              type: 'string',
              enum: ['active', 'suspended'],
              example: 'active',
              description: 'User status - active or suspended',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-15T10:30:00Z',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-15T10:30:00Z',
            },
          },
        },
        Watchlist: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000',
            },
            user_id: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000',
              description: 'User who added to watchlist',
            },
            admission_id: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000',
              description: 'Admission being watched',
            },
            notes: {
              type: 'string',
              nullable: true,
              maxLength: 5000,
              example: 'Interested in this program',
              description: 'Optional user notes about this admission',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-15T10:30:00Z',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-15T10:30:00Z',
            },
          },
        },
        UserPreferences: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000',
            },
            user_id: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000',
            },
            email_notifications_enabled: {
              type: 'boolean',
              example: true,
              description: 'Enable/disable email notifications',
            },
            email_frequency: {
              type: 'string',
              enum: ['immediate', 'daily', 'weekly', 'never'],
              example: 'daily',
              description: 'How often to send email notifications',
            },
            push_notifications_enabled: {
              type: 'boolean',
              example: true,
              description: 'Enable/disable push notifications',
            },
            notification_categories: {
              type: 'object',
              properties: {
                verification: {
                  type: 'boolean',
                  example: true,
                },
                deadline: {
                  type: 'boolean',
                  example: true,
                },
                system: {
                  type: 'boolean',
                  example: false,
                },
                update: {
                  type: 'boolean',
                  example: true,
                },
              },
              description: 'Category-specific notification preferences',
            },
            language: {
              type: 'string',
              enum: ['en', 'ar', 'fr', 'es'],
              example: 'en',
              description: 'Preferred language',
            },
            timezone: {
              type: 'string',
              maxLength: 50,
              example: 'America/New_York',
              description: 'User timezone',
            },
            theme: {
              type: 'string',
              enum: ['light', 'dark', 'auto'],
              example: 'light',
              description: 'UI theme preference',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-15T10:30:00Z',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-15T10:30:00Z',
            },
          },
        },
        NotificationCategories: {
          type: 'object',
          properties: {
            verification: {
              type: 'boolean',
              example: true,
            },
            deadline: {
              type: 'boolean',
              example: true,
            },
            system: {
              type: 'boolean',
              example: false,
            },
            update: {
              type: 'boolean',
              example: true,
            },
          },
          description: 'Category-specific notification preferences',
        },
      },
    },
    tags: [
      {
        name: 'Admissions',
        description: 'Admission management endpoints - Core domain for managing admission records',
      },
      {
        name: 'Notifications',
        description: 'Notification endpoints - User-facing system notifications',
      },
      {
        name: 'Deadlines',
        description: 'Deadline management endpoints - Admission deadlines with urgency calculations',
      },
      {
        name: 'Activity',
        description: 'User activity tracking endpoints - Recent user behavior tracking',
      },
      {
        name: 'Users',
        description: 'User management endpoints - Identity mapping, role intent, and ownership anchoring',
      },
      {
        name: 'Analytics',
        description: 'Analytics endpoints - System metrics, event tracking, and statistics aggregation',
      },
      {
        name: 'Changelogs',
        description: 'Changelogs endpoints - Immutable audit trail access with advanced filtering',
      },
      {
        name: 'Watchlists',
        description: 'Watchlists endpoints - User watchlists for tracking admissions of interest',
      },
      {
        name: 'User Preferences',
        description: 'User preferences endpoints - Customize user experience and notification settings',
      },
      {
        name: 'Health',
        description: 'Health check and system status endpoints',
      },
    ],
  },
  apis: [
    './src/domain/**/routes/*.ts',
    './src/domain/**/controllers/*.ts',
    './src/index.ts',
  ],
};

/**
 * Generated Swagger specification
 */
export const swaggerSpec = swaggerJsdoc(options);
