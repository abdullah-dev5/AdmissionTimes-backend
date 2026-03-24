/**
 * Domain Registration Module
 * 
 * Centralized domain route registration for clean bootstrapping.
 * All domain routes are registered here, making it easy to scale
 * and maintain a domain-aware architecture.
 * 
 * Usage:
 *   import { registerDomains } from './domain';
 *   registerDomains(app);
 */

import { Application } from 'express';
import admissionsRoutes from './admissions/routes/admissions.routes';
import universityAdmissionsRoutes from './admissions/routes/university-admissions.routes';
import adminAdmissionsRoutes from './admissions/routes/admin-admissions.routes';
import adminRoutes from './admin/routes/admin.routes';
import notificationsRoutes from './notifications/routes/notifications.routes';
import deadlinesRoutes from './deadlines/routes/deadlines.routes';
import userActivityRoutes from './user-activity/routes/user-activity.routes';
import usersRoutes from './users/routes/users.routes';
import analyticsRoutes from './analytics/routes/analytics.routes';
import changelogsRoutes from './changelogs/routes/changelogs.routes';
import watchlistsRoutes from './watchlists/routes/watchlists.routes';
import dashboardRoutes from './dashboard/routes/dashboard.routes';
import schedulerRoutes from './scheduler/routes/scheduler.routes';
import recommendationsRoutes from './recommendations/routes/recommendations.routes';
import aiRoutes from './ai/routes/ai.routes';

/**
 * Registers all domain routes with the Express application
 * 
 * @param app - Express application instance
 */
export function registerDomains(app: Application): void {
  // Admissions Domain (Core)
  app.use('/api/v1/admissions', admissionsRoutes);
  
  // Admissions Alias Routes (Frontend Compatibility)
  app.use('/api/v1/university/admissions', universityAdmissionsRoutes);
  
  // Admin Domain (New - Full admin module)
  app.use('/api/v1/admin', adminRoutes);
  
  // Admin admissions alias routes (register after admin domain to avoid /pending conflicts)
  app.use('/api/v1/admin/admissions', adminAdmissionsRoutes);
  
  // Supporting Domains (Phase 4A)
  app.use('/api/v1/notifications', notificationsRoutes);
  app.use('/api/v1/deadlines', deadlinesRoutes);
  app.use('/api/v1/activity', userActivityRoutes);
  
  // Core Domains (Phase 4B)
  app.use('/api/v1/users', usersRoutes);
  app.use('/api/v1/analytics', analyticsRoutes);
  app.use('/api/v1/changelogs', changelogsRoutes);
  
  // Advanced Features (Phase 5)
  app.use('/api/v1/watchlists', watchlistsRoutes);
  
  // Recommendations Domain (Smart collaborative filtering)
  app.use('/api/v1/recommendations', recommendationsRoutes);

  // AI Domain (Gemini-backed chat and summarization)
  app.use('/api/v1/ai', aiRoutes);
  
  // Dashboard Domain (Phase 6 - Backend Implementation Plan)
  app.use('/api/v1', dashboardRoutes);

  // Scheduler Domain (Phase 2 reminders)
  app.use('/api/v1/scheduler', schedulerRoutes);
}
