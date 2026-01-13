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

/**
 * Registers all domain routes with the Express application
 * 
 * @param app - Express application instance
 */
export function registerDomains(app: Application): void {
  // Admissions Domain
  app.use('/api/v1/admissions', admissionsRoutes);
  
  // Future domains can be added here:
  // app.use('/api/v1/users', usersRoutes);
  // app.use('/api/v1/analytics', analyticsRoutes);
  // app.use('/api/v1/notifications', notificationsRoutes);
}
