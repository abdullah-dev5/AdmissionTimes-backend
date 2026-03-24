import { UserContext } from '@domain/admissions/types/admissions.types';

export interface ChatRequestDTO {
  message: string;
  conversation_context?: string;
  conversation_history?: Array<{
    role: 'user' | 'assistant' | 'ai';
    text: string;
  }>;
}

export interface SummarizeRequestDTO {
  raw_text: string;
  source_type?: 'pdf' | 'manual';
  admission_id?: string;
}

export interface AdmissionChatFilters {
  search?: string;
  degree_level?: string;
  field_of_study?: string;
  location?: string;
  program_type?: string;
  delivery_mode?: string;
  deadline_within_days?: number;
}

export interface GeminiChatExtraction {
  intent: 'search_admissions' | 'guidance' | 'clarification' | 'unsupported';
  search?: string | null;
  degree_level?: string | null;
  field_of_study?: string | null;
  location?: string | null;
  program_type?: string | null;
  delivery_mode?: string | null;
  deadline_within_days?: number | null;
  clarification_question?: string | null;
  refusal_reason?: string | null;
}

export interface AdmissionChatResultItem {
  id: string;
  title: string;
  degree_level: string | null;
  location: string | null;
  deadline: string | null;
  verification_status: string;
  university_id: string | null;
}

export interface AdmissionChatResponse {
  intent: 'search_admissions' | 'guidance' | 'clarification' | 'unsupported';
  extracted_filters: AdmissionChatFilters;
  clarification_needed: boolean;
  clarification_question?: string;
  answer: string;
  result_count: number;
  results: AdmissionChatResultItem[];
}

export interface AdmissionSummaryResult {
  title?: string | null;
  degree_level?: string | null;
  location?: string | null;
  application_fee?: number | null;
  deadline?: string | null;
  description?: string | null;
  eligibility?: string | null;
  summary_text: string;
  highlights: string[];
  extracted_fields: string[];
  confidence: number;
  provider: 'gemini' | 'regex';
  model?: string;
  method: 'ai' | 'fallback';
}

export interface GeminiGenerateJsonOptions {
  prompt: string;
  temperature?: number;
}

export interface GeminiUsageMetadata {
  model: string;
  provider: 'gemini';
}

export interface AiHealthResponse {
  enabled: boolean;
  provider: string;
  model: string;
  ready: boolean;
}

export interface ChatExecutionContext {
  userContext?: UserContext;
}
