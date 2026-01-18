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
import notificationsRoutes from './notifications/routes/notifications.routes';
import deadlinesRoutes from './deadlines/routes/deadlines.routes';
import userActivityRoutes from './user-activity/routes/user-activity.routes';
import usersRoutes from './users/routes/users.routes';
import analyticsRoutes from './analytics/routes/analytics.routes';
import changelogsRoutes from './changelogs/routes/changelogs.routes';

/**
 * Registers all domain routes with the Express application
 * 
 * @param app - Express application instance
 */
export function registerDomains(app: Application): void {
  // Admissions Domain (Core)
  app.use('/api/v1/admissions', admissionsRoutes);
  
  // Supporting Domains (Phase 4A)
  app.use('/api/v1/notifications', notificationsRoutes);
  app.use('/api/v1/deadlines', deadlinesRoutes);
  app.use('/api/v1/activity', userActivityRoutes);
  
  // Core Domains (Phase 4B)
  app.use('/api/v1/users', usersRoutes);
  app.use('/api/v1/analytics', analyticsRoutes);
  app.use('/api/v1/changelogs', changelogsRoutes);
}
