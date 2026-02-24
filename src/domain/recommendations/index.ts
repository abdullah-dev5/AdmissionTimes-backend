/**
 * Recommendations Domain - Entry Point
 * 
 * Exports all public interfaces from the recommendations domain.
 */

export { default as recommendationsRoutes } from './routes/recommendations.routes';
export * as recommendationsService from './services/recommendations.service';
export * as recommendationsModel from './models/recommendations.model';
export * from './types/recommendations.types';
