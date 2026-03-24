import * as admissionsService from '@domain/admissions/services/admissions.service';
import { Admission } from '@domain/admissions/types/admissions.types';
import { AppError } from '@shared/middleware/errorHandler';
import { config } from '@config/config';
import { buildChatExtractionPrompt, buildGuidanceAnswerPrompt, buildSummarizationPrompt, isUniversityContext } from '../prompts/ai.prompts';
import {
  AdmissionChatFilters,
  AdmissionChatResponse,
  AdmissionChatResultItem,
  AdmissionSummaryResult,
  ChatExecutionContext,
  GeminiChatExtraction,
} from '../types/ai.types';
import { generateJson, generateText, getGeminiUsageMetadata, isGeminiConfigured } from './gemini.client';

const MAX_RESULTS = 8;
const SENSITIVE_QUERY_PATTERN = /(password|email list|all users|admin data|internal analytics|service role|token|secret)/i;

type LocalIntentResult = {
  intent: 'guidance' | 'search_admissions' | 'unknown';
  answer?: string;
  filters?: AdmissionChatFilters;
  verification_status?: 'verified' | 'pending' | 'rejected';
};

type ConversationHistoryEntry = {
  role: 'user' | 'assistant' | 'ai';
  text: string;
};

const isGeminiQuotaError = (error: unknown): boolean => {
  const message = String((error as Error)?.message || error || '').toLowerCase();
  return (
    message.includes('429') ||
    message.includes('resource_exhausted') ||
    message.includes('quota') ||
    message.includes('rate-limit')
  );
};

const buildLocalGuidance = (message: string, isUniversity: boolean): string => {
  const lower = message.toLowerCase();

  if (isUniversity) {
    if (lower.includes('pending') || lower.includes('audit') || lower.includes('status')) {
      return [
        'Pending Audit means the admission is waiting for admin verification.',
        '- Open Verification Center and review remarks for that admission.',
        '- Fix missing or invalid fields (title, deadline, eligibility, location).',
        '- Resubmit and monitor until status moves to Verified.',
      ].join('\n');
    }

    if (lower.includes('publish') || lower.includes('upload') || lower.includes('new admission')) {
      return [
        'Publishing checklist:',
        '- Open Manage Admissions and create a new admission.',
        '- Upload PDF or fill fields manually and verify extracted details.',
        '- Submit for verification and track progress in Verification Center.',
      ].join('\n');
    }

    if (lower.includes('re-verification') || lower.includes('resubmit') || lower.includes('edit')) {
      return [
        'Re-verification is triggered when key admission details are edited.',
        '- Update fields carefully and keep deadline/eligibility consistent.',
        '- Resubmit and check verification remarks for corrections.',
      ].join('\n');
    }

    return [
      'I can help with university admission workflow:',
      '- Publishing and submitting admissions',
      '- Verification status explanation and fixes',
      '- Resubmission and data quality checklist',
    ].join('\n');
  }

  if (lower.includes('compare')) {
    return [
      'How to compare programs:',
      '- Open Compare and select at least two saved programs.',
      '- Review fee, deadline, location, and eligibility side by side.',
      '- Keep the stronger option in watchlist with alerts enabled.',
    ].join('\n');
  }

  if (lower.includes('alert') || lower.includes('watchlist') || lower.includes('reminder')) {
    return [
      'How to manage alerts:',
      '- Open Watchlist and enable reminders for your saved programs.',
      '- Check Deadlines for urgent items this week.',
      '- Remove expired entries to keep your list relevant.',
    ].join('\n');
  }

  if (lower.includes('status') || lower.includes('application')) {
    return [
      'Status quick guide:',
      '- Verified: listing is approved and visible.',
      '- Pending: still under review.',
      '- Rejected: check remarks and required corrections.',
    ].join('\n');
  }

  return [
    'I can help with admissions tasks:',
    '- Find programs by field, city, degree, and deadline',
    '- Compare options and explain differences',
    '- Explain statuses and suggest next actions',
  ].join('\n');
};

const detectLocalIntent = (message: string, isUniversity: boolean): LocalIntentResult => {
  const lower = message.toLowerCase();

  if (isUniversity) {
    if (
      lower.includes('publish') ||
      lower.includes('upload') ||
      lower.includes('pending audit') ||
      lower.includes('verification') ||
      lower.includes('re-verification') ||
      lower.includes('resubmit') ||
      lower.includes('policy') ||
      lower.includes('status')
    ) {
      return { intent: 'guidance', answer: buildLocalGuidance(message, true) };
    }

    if (lower.includes('show') || lower.includes('list') || lower.includes('all my') || lower.includes('my ')) {
      const filters: AdmissionChatFilters = {};
      let verificationStatus: LocalIntentResult['verification_status'];

      if (lower.includes('verified')) verificationStatus = 'verified';
      if (lower.includes('pending')) verificationStatus = 'pending';
      if (lower.includes('rejected')) verificationStatus = 'rejected';

      return { intent: 'search_admissions', filters, verification_status: verificationStatus };
    }
  } else {
    if (
      lower.includes('how do i') ||
      lower.includes('compare') ||
      lower.includes('watchlist') ||
      lower.includes('alerts') ||
      lower.includes('status')
    ) {
      return { intent: 'guidance', answer: buildLocalGuidance(message, false) };
    }

    if (
      lower.includes('find') ||
      lower.includes('show') ||
      lower.includes('admission') ||
      lower.includes('program')
    ) {
      return { intent: 'search_admissions', filters: { search: message } };
    }
  }

  return { intent: 'unknown' };
};

const normalizeFilters = (extraction: GeminiChatExtraction): AdmissionChatFilters => {
  const deadlineWithinDays = extraction.deadline_within_days ?? undefined;
  return {
    search: extraction.search || undefined,
    degree_level: extraction.degree_level || undefined,
    field_of_study: extraction.field_of_study || undefined,
    location: extraction.location || undefined,
    program_type: extraction.program_type || undefined,
    delivery_mode: extraction.delivery_mode || undefined,
    deadline_within_days: typeof deadlineWithinDays === 'number' && deadlineWithinDays > 0 ? deadlineWithinDays : undefined,
  };
};

const mapResult = (admission: Admission): AdmissionChatResultItem => ({
  id: admission.id,
  title: admission.title,
  degree_level: admission.degree_level,
  location: admission.location,
  deadline: admission.deadline,
  verification_status: admission.verification_status,
  university_id: admission.university_id,
});

const filterByDeadlineWindow = (admissions: Admission[], withinDays?: number): Admission[] => {
  if (!withinDays) {
    return admissions;
  }

  const now = Date.now();
  const windowMs = withinDays * 24 * 60 * 60 * 1000;

  return admissions.filter((admission) => {
    if (!admission.deadline) {
      return false;
    }

    const deadlineMs = new Date(admission.deadline).getTime();
    return Number.isFinite(deadlineMs) && deadlineMs >= now && deadlineMs - now <= windowMs;
  });
};

const formatAdmissionLine = (admission: AdmissionChatResultItem, index: number): string => {
  const detailParts = [admission.degree_level, admission.location, admission.deadline].filter(Boolean);
  return `${index + 1}. ${admission.title}${detailParts.length > 0 ? ` — ${detailParts.join(' | ')}` : ''}`;
};

const formatSearchAnswer = (results: AdmissionChatResultItem[], filters: AdmissionChatFilters): string => {
  if (results.length === 0) {
    return 'No matching admissions were found for that query. Try broadening the program, location, or deadline filters.';
  }

  const appliedFilters = [filters.search, filters.degree_level, filters.field_of_study, filters.location]
    .filter(Boolean)
    .join(', ');

  const intro = appliedFilters
    ? `Here are the matching admissions for ${appliedFilters}:`
    : 'Here are the matching admissions:';

  return [intro, ...results.map(formatAdmissionLine)].join('\n');
};

const buildSummaryTextFromFallback = (description: string | null | undefined, title: string, location: string, deadline: string): string => {
  const summaryParts = [
    `${title} is an admission listing${location ? ` in ${location}` : ''}.`,
    description ? description.slice(0, 240).trim() : '',
    deadline ? `Application deadline: ${deadline}.` : '',
  ].filter(Boolean);

  return summaryParts.join(' ');
};

const buildConversationContext = (
  conversationContext: string | undefined,
  conversationHistory: ConversationHistoryEntry[] | undefined
): string | undefined => {
  const base = conversationContext?.trim() || '';
  const history = Array.isArray(conversationHistory) ? conversationHistory.slice(-6) : [];

  if (history.length === 0) {
    return base || undefined;
  }

  const historyLines = history
    .map((entry) => {
      const role = entry.role === 'user' ? 'User' : 'Assistant';
      const text = String(entry.text || '').trim().slice(0, 200);
      return text ? `${role}: ${text}` : '';
    })
    .filter(Boolean);

  if (historyLines.length === 0) {
    return base || undefined;
  }

  const merged = [base, 'Recent messages:', ...historyLines].filter(Boolean).join('\n');
  return merged.slice(0, 3000);
};

export const getAiHealth = () => {
  const metadata = getGeminiUsageMetadata();
  return {
    enabled: config.ai.enabled,
    provider: metadata.provider,
    model: metadata.model,
    ready: isGeminiConfigured(),
  };
};

export const summarizeAdmissionText = async (rawText: string): Promise<AdmissionSummaryResult> => {
  const boundedText = rawText.slice(0, config.ai.maxInputChars);

  if (!isGeminiConfigured()) {
    throw new AppError('Gemini AI is not configured', 503);
  }

  const extraction = await generateJson<Omit<AdmissionSummaryResult, 'provider' | 'method' | 'model'>>({
    prompt: buildSummarizationPrompt(boundedText),
    temperature: 0.1,
  });

  const metadata = getGeminiUsageMetadata();
  return {
    ...extraction,
    summary_text: extraction.summary_text?.trim() || 'No summary could be generated from the provided admission text.',
    highlights: Array.isArray(extraction.highlights) ? extraction.highlights.slice(0, 6) : [],
    extracted_fields: Array.isArray(extraction.extracted_fields) ? extraction.extracted_fields : [],
    confidence: typeof extraction.confidence === 'number' ? Math.max(0, Math.min(100, extraction.confidence)) : 0,
    provider: metadata.provider,
    model: metadata.model,
    method: 'ai',
  };
};

export const summarizeAdmissionTextWithFallback = async (
  rawText: string,
  fallback: {
    title: string;
    degree_level: string;
    location: string;
    application_fee: number;
    deadline: string;
    description: string;
    extracted_fields: string[];
    confidence: number;
  }
): Promise<AdmissionSummaryResult> => {
  try {
    return await summarizeAdmissionText(rawText);
  } catch {
    return {
      title: fallback.title,
      degree_level: fallback.degree_level,
      location: fallback.location,
      application_fee: fallback.application_fee,
      deadline: fallback.deadline,
      description: fallback.description,
      eligibility: null,
      summary_text: buildSummaryTextFromFallback(
        fallback.description,
        fallback.title,
        fallback.location,
        fallback.deadline
      ),
      highlights: [],
      extracted_fields: fallback.extracted_fields,
      confidence: fallback.confidence,
      provider: 'regex',
      method: 'fallback',
    };
  }
};

export const chatWithAdmissionsAssistant = async (
  message: string,
  conversationContext: string | undefined,
  conversationHistory: ConversationHistoryEntry[] | undefined,
  executionContext: ChatExecutionContext
): Promise<AdmissionChatResponse> => {
  if (!isGeminiConfigured()) {
    throw new AppError('Gemini AI is not configured', 503);
  }

  if (SENSITIVE_QUERY_PATTERN.test(message)) {
    return {
      intent: 'unsupported',
      extracted_filters: {},
      clarification_needed: false,
      answer: 'Sorry, I cannot access personal or sensitive information. I can only help with university admissions, programs, eligibility, and deadlines.',
      result_count: 0,
      results: [],
    };
  }

  const enrichedContext = buildConversationContext(conversationContext, conversationHistory);
  const uniCtx = isUniversityContext(enrichedContext);
  const localIntent = detectLocalIntent(message, uniCtx);

  if (localIntent.intent === 'guidance' && localIntent.answer) {
    return {
      intent: 'guidance',
      extracted_filters: {},
      clarification_needed: false,
      answer: localIntent.answer,
      result_count: 0,
      results: [],
    };
  }

  // Step 1: classify intent and extract filters (JSON, low temperature)
  let extraction: GeminiChatExtraction;
  try {
    extraction = await generateJson<GeminiChatExtraction>({
      prompt: buildChatExtractionPrompt(message, enrichedContext),
      temperature: 0.1,
    });
  } catch (error) {
    if (isGeminiQuotaError(error)) {
      return {
        intent: 'guidance',
        extracted_filters: {},
        clarification_needed: false,
        answer: [
          'AI quota is temporarily exhausted. You can still continue with this guidance:',
          buildLocalGuidance(message, uniCtx),
        ].join('\n'),
        result_count: 0,
        results: [],
      };
    }

    extraction = { intent: 'guidance' };
  }

  const filters = normalizeFilters(extraction);

  if (localIntent.intent === 'search_admissions') {
    const { admissions } = await admissionsService.getMany(
      {
        search: localIntent.filters?.search,
        degree_level: localIntent.filters?.degree_level,
        field_of_study: localIntent.filters?.field_of_study,
        location: localIntent.filters?.location,
        program_type: localIntent.filters?.program_type,
        delivery_mode: localIntent.filters?.delivery_mode,
        verification_status: localIntent.verification_status,
      },
      1,
      MAX_RESULTS,
      'deadline',
      'asc',
      executionContext.userContext
    );

    const results = admissions.slice(0, MAX_RESULTS).map(mapResult);
    return {
      intent: 'search_admissions',
      extracted_filters: localIntent.filters || {},
      clarification_needed: false,
      answer: formatSearchAnswer(results, localIntent.filters || {}),
      result_count: results.length,
      results,
    };
  }

  // Step 2a: guidance → separate free-text call at higher temperature
  if (extraction.intent === 'guidance') {
    let answer: string;
    try {
      answer = await generateText(
        buildGuidanceAnswerPrompt(message, enrichedContext, uniCtx),
        0.4
      );
    } catch (error) {
      if (isGeminiQuotaError(error)) {
        answer = [
          'AI quota is temporarily exhausted. You can still continue with this guidance:',
          buildLocalGuidance(message, uniCtx),
        ].join('\n');
      } else {
        answer = buildLocalGuidance(message, uniCtx);
      }
    }

    return {
      intent: 'guidance',
      extracted_filters: {},
      clarification_needed: false,
      answer: answer.trim(),
      result_count: 0,
      results: [],
    };
  }

  // Step 2b: truly unsupported
  if (extraction.intent === 'unsupported') {
    return {
      intent: 'unsupported',
      extracted_filters: {},
      clarification_needed: false,
      answer: extraction.refusal_reason || "I can help with admissions, programs, verification workflows, deadlines, and eligibility. Could you rephrase your question?",
      result_count: 0,
      results: [],
    };
  }

  // Step 2c: clarification — only as last resort
  if (extraction.intent === 'clarification') {
    return {
      intent: 'clarification',
      extracted_filters: filters,
      clarification_needed: true,
      clarification_question: extraction.clarification_question || undefined,
      answer: extraction.clarification_question || 'Could you share more details about what you are looking for?',
      result_count: 0,
      results: [],
    };
  }

  const { admissions } = await admissionsService.getMany(
    {
      search: filters.search,
      degree_level: filters.degree_level,
      field_of_study: filters.field_of_study,
      location: filters.location,
      program_type: filters.program_type,
      delivery_mode: filters.delivery_mode,
    },
    1,
    MAX_RESULTS,
    'deadline',
    'asc',
    executionContext.userContext
  );

  const filteredAdmissions = filterByDeadlineWindow(admissions, filters.deadline_within_days);
  const results = filteredAdmissions.slice(0, MAX_RESULTS).map(mapResult);

  return {
    intent: 'search_admissions',
    extracted_filters: filters,
    clarification_needed: false,
    answer: formatSearchAnswer(results, filters),
    result_count: results.length,
    results,
  };
};
