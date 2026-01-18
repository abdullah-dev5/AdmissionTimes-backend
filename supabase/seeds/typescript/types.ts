/**
 * Seeding Type Definitions
 * 
 * TypeScript types for seeding operations.
 */

/**
 * Seed execution result
 */
export interface SeedResult {
  seedName: string;
  success: boolean;
  recordCount?: number;
  error?: string;
  executionTime?: number;
}

/**
 * Seed function signature
 */
export type SeedFunction = () => Promise<SeedResult>;

/**
 * Seed configuration
 */
export interface SeedConfig {
  name: string;
  description: string;
  dependencies?: string[]; // Other seeds that must run first
  skipIfExists?: boolean; // Skip if already executed
}
