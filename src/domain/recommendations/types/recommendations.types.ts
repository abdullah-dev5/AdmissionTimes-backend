/**
 * Recommendations Domain - Type Definitions
 */

export interface Recommendation {
  id: string;
  user_id: string;
  admission_id: string;
  score: number; // 0-100
  reason: string;
  factors: Record<string, any>; // jsonb
  generated_at: Date;
  expires_at: Date;
}

export interface CreateRecommendationDTO {
  user_id: string;
  admission_id: string;
  score: number;
  reason: string;
  factors: Record<string, any>;
  expires_at?: Date;
}

export interface RecommendationQueryParams {
  limit?: number;
  min_score?: number;
}

export interface RecommendationWithAdmission extends Recommendation {
  admission?: {
    id: string;
    university_id: string;
    program_name: string;
    degree_level: string;
    status: string;
    deadline: string | null;
  };
}
